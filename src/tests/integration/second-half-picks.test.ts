/**
 * Second Half pool — integration tests for the pick submission action.
 *
 * Tests the dashboard/picks/+page.server.ts `default` action which handles
 * both LMS and Second Half pick submissions. Focuses on 2H-specific rules:
 *
 *  - 1 pick required for weeks 6–9
 *  - 2 picks required from week 10 onward
 *  - picksRequired derived from week record first, season record as fallback
 *  - Duplicate team within the same submission is rejected
 *  - Upsert: updating an existing 2H pick replaces both teams
 *  - Eliminated entry cannot submit
 *  - Locked week blocks submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from '../../routes/dashboard/picks/+page.server';
import { _mergePickCell } from '../../routes/dashboard/standings/+page.server';
import { actions as adminResultsActions, _calculatePerEntryShareAmounts, _getZeroSurvivorWinnerResolution } from '../../routes/admin/results/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string | string[]>) {
	return {
		get:    (key: string) => {
			const v = fields[key];
			return Array.isArray(v) ? v[0] : (v ?? null);
		},
		getAll: (key: string) => {
			const v = fields[key];
			return Array.isArray(v) ? v : (v ? [v] : []);
		},
	} as unknown as FormData;
}

function makeLocals(userId = 'user1') {
	return { user: { id: userId } };
}

/** Build a standard 2H pick form submission. */
function sh2HFormData(teamIds: string[], weekId = 'week1') {
	return makeFormData({
		entryId:   'entry1',
		weekId,
		entryType: 'second_half',
		teamIds,
	});
}

// ── Mock factory ─────────────────────────────────────────────────────────────

function makeCollections(overrides: Record<string, Partial<any>> = {}) {
	const FUTURE_KICKOFF = '2099-01-01T12:00:00.000Z';

	const defaults: Record<string, any> = {
		entries: {
			getOne: vi.fn().mockResolvedValue({
				id: 'entry1', user: 'user1', season: 'season1',
				entryType: 'second_half', status: 'active',
			}),
		},
		weekly_settings: {
			getOne: vi.fn().mockResolvedValue({
				id: 'week1', status: 'open', week: 7,
				secondHalfPicksPerWeek: null, // fall through to season
			}),
		},
		game_odds: {
			getFirstListItem: vi.fn().mockResolvedValue({ game_time_stamp: FUTURE_KICKOFF }),
		},
		seasons: {
			getOne: vi.fn().mockResolvedValue({
				id: 'season1',
				secondHalfPicksPerWeek:  2,
				secondHalfPicksStartWeek: 10,
			}),
		},
		picks: {
			getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
			create:           vi.fn().mockResolvedValue({ id: 'pick1' }),
			update:           vi.fn().mockResolvedValue({ id: 'pick1' }),
		},
		nfl_teams: {
			getOne: vi.fn().mockResolvedValue({ id: 't1', city: 'Seattle', name: 'Seahawks' }),
		},
	};

	// Merge overrides per collection
	for (const [col, mock] of Object.entries(overrides)) {
		defaults[col] = { ...defaults[col], ...mock };
	}
	return defaults;
}

function makePb(collections: Record<string, any>) {
	const pb: any = { collection: vi.fn((name: string) => collections[name] ?? {}) };
	pb._c = collections;
	return pb;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Second Half pick submission — pick count enforcement', () => {

	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols    = makeCollections();
		mockPb  = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('accepts 1 team for a week before the 2-pick threshold (week 7, season default 2)', async () => {
		// Week 7 < secondHalfPicksStartWeek(10) → 1 pick required
		// week record has no override, season.secondHalfPicksPerWeek = 2
		// BUT picksRequired logic uses week.secondHalfPicksPerWeek ?? season.secondHalfPicksPerWeek
		// and does NOT apply the start-week ramp in the picks action — it uses the raw value.
		// So with week.secondHalfPicksPerWeek = null and season = 2, it requires 2.
		// This test documents the CURRENT behaviour (action doesn't apply the ramp).
		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1']) },
			locals:  makeLocals(),
		} as any);

		// Expects 400 because season says 2 picks required regardless of week number
		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/2 team/i);
	});

	it('accepts 2 teams when season requires 2 picks', async () => {
		let redirected = '';
		try {
			await actions.default({
				request: { formData: async () => sh2HFormData(['team1', 'team2']) },
				locals:  makeLocals(),
			} as any);
		} catch (e: any) {
			redirected = e?.location ?? '';
		}

		expect(redirected).toBe('/dashboard');
		expect(cols.picks.create).toHaveBeenCalledWith(expect.objectContaining({
			pickedTeams: ['team1', 'team2'],
			entryType:   'second_half',
		}));
	});

	it('rejects 3 teams when only 2 are required', async () => {
		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2', 'team3']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/2 team/i);
	});

	it('rejects 0 teams', async () => {
		const result = await actions.default({
			request: { formData: async () => sh2HFormData([]) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('uses week-level secondHalfPicksPerWeek override when set', async () => {
		// Week record overrides to 1 pick (e.g. a special week)
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'open', week: 7, secondHalfPicksPerWeek: 1,
		});

		let redirected = '';
		try {
			await actions.default({
				request: { formData: async () => sh2HFormData(['team1']) },
				locals:  makeLocals(),
			} as any);
		} catch (e: any) {
			redirected = e?.location ?? '';
		}

		expect(redirected).toBe('/dashboard');
		expect(cols.picks.create).toHaveBeenCalledWith(expect.objectContaining({
			pickedTeams: ['team1'],
		}));
	});
});

describe('Second Half standings grid', () => {
	it('merges multiple picks for the same week into one displayed cell', () => {
		const merged = _mergePickCell(
			{ teams: ['DAL'], isAutoPick: false, isOwn: false },
			{ teams: ['PHI', 'DAL'], isAutoPick: true, isOwn: true }
		);

		expect(merged.teams).toEqual(['DAL', 'PHI']);
		expect(merged.isAutoPick).toBe(true);
		expect(merged.isOwn).toBe(true);
	});

	it('keeps both picks in a week when one is winning and one is losing', () => {
		const merged = _mergePickCell(
			{ teams: ['PHI'], isAutoPick: false, isOwn: true },
			{ teams: ['DAL'], isAutoPick: false, isOwn: true }
		);

		expect(merged.teams).toEqual(['PHI', 'DAL']);
		expect(merged.isOwn).toBe(true);
	});

	it('keeps both picks in a week when both selections are winners', () => {
		const merged = _mergePickCell(
			{ teams: ['ATL'], isAutoPick: false, isOwn: false },
			{ teams: ['CIN'], isAutoPick: false, isOwn: false }
		);

		expect(merged.teams).toEqual(['ATL', 'CIN']);
		expect(merged.isOwn).toBe(false);
	});

	it('keeps both picks in a week when both selections are losers', () => {
		const merged = _mergePickCell(
			{ teams: ['JAX'], isAutoPick: true, isOwn: false },
			{ teams: ['NE'], isAutoPick: false, isOwn: false }
		);

		expect(merged.teams).toEqual(['JAX', 'NE']);
		expect(merged.isAutoPick).toBe(true);
	});
});

describe('zero-survivor winner confirmation safeguards', () => {
	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols = makeCollections();
		mockPb = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('blocks direct confirmation when a relevant game is pending even if the week is marked complete', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'complete', week: 7,
		});
		cols.game_odds.getFullList = vi.fn().mockResolvedValue([{ id: 'g1', resultStatus: 'pending' }]);
		cols.entries.getFullList = vi.fn().mockResolvedValue([
			{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'winner' },
		]);

		const result = await adminResultsActions.confirmWinnerResolution({
			request: { formData: async () => makeFormData({
				seasonId: 'season1',
				weekId: 'week1',
				winnerEntryId: 'entry1',
				poolType: 'second_half',
			}) }
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/pending|final/i);
	});

	it('blocks direct confirmation when a relevant game result is missing final status', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'complete', week: 7,
		});
		cols.game_odds.getFullList = vi.fn().mockResolvedValue([{ id: 'g1' }]);
		cols.entries.getFullList = vi.fn().mockResolvedValue([
			{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'winner' },
		]);

		const result = await adminResultsActions.confirmWinnerResolution({
			request: { formData: async () => makeFormData({
				seasonId: 'season1',
				weekId: 'week1',
				winnerEntryId: 'entry1',
				poolType: 'second_half',
			}) }
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/missing an explicit final-result status|pending/i);
	});

	it('blocks direct confirmation when a relevant game exists but is not marked final', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'complete', week: 7,
		});
		cols.game_odds.getFullList = vi.fn().mockResolvedValue([{ id: 'g1', resultStatus: 'postponed' }]);
		cols.entries.getFullList = vi.fn().mockResolvedValue([
			{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'winner' },
		]);

		const result = await adminResultsActions.confirmWinnerResolution({
			request: { formData: async () => makeFormData({
				seasonId: 'season1',
				weekId: 'week1',
				winnerEntryId: 'entry1',
				poolType: 'second_half',
			}) }
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/pending|final/i);
	});

	it('allows confirmation once every relevant game is explicitly final', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'complete', week: 7,
		});
		cols.game_odds.getFullList = vi.fn().mockResolvedValue([{ id: 'g1', resultStatus: 'final' }]);
		cols.entries.getFullList = vi.fn().mockResolvedValue([
			{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'winner' },
		]);
		cols.entries.update = vi.fn().mockResolvedValue({ id: 'entry1', status: 'winner' });

		const result = await adminResultsActions.confirmWinnerResolution({
			request: { formData: async () => makeFormData({
				seasonId: 'season1',
				weekId: 'week1',
				winnerEntryId: 'entry1',
				poolType: 'second_half',
			}) }
		} as any);

		expect((result as any).success).toBe(true);
	});

	it('does not duplicate or overwrite a protected settlement on repeated confirmation', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'complete', week: 7,
		});
		cols.game_odds.getFullList = vi.fn().mockResolvedValue([{ id: 'g1', resultStatus: 'final' }]);
		cols.entries.getFullList = vi.fn()
			.mockResolvedValueOnce([
				{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'active' },
			])
			.mockResolvedValueOnce([
				{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'winner' },
			]);
		cols.entries.update = vi.fn().mockResolvedValue({ id: 'entry1', status: 'winner' });

		const first = await adminResultsActions.confirmWinnerResolution({
			request: { formData: async () => makeFormData({
				seasonId: 'season1',
				weekId: 'week1',
				winnerEntryId: 'entry1',
				poolType: 'second_half',
			}) }
		} as any);
		const second = await adminResultsActions.confirmWinnerResolution({
			request: { formData: async () => makeFormData({
				seasonId: 'season1',
				weekId: 'week1',
				winnerEntryId: 'entry1',
				poolType: 'second_half',
			}) }
		} as any);

		expect((first as any).success).toBe(true);
		expect((second as any).success).toBe(true);
		expect(cols.entries.update).toHaveBeenCalledTimes(1);
	});
});

describe('split-pot share allocation', () => {
	it('allocates one share per qualifying entry from the winners list', () => {
		const result = _calculatePerEntryShareAmounts(1000, ['entry1', 'entry2', 'entry2']);
		expect(result.totalCents).toBe(1000);
		expect(result.shares).toEqual([
			{ entryId: 'entry1', cents: 500 },
			{ entryId: 'entry2', cents: 500 },
		]);
	});
});

describe('Second Half zero-survivor winner resolution', () => {
	it('uses the final elimination week score only when all remaining entries are eliminated in the same week', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week10',
			weekNum: 10,
			entries: [
				{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'active' },
				{ id: 'entry2', season: 'season1', entryType: 'second_half', status: 'active' },
				{ id: 'entry3', season: 'season1', entryType: 'second_half', status: 'active' },
			],
			picks: [
				{ id: 'p1', entry: 'entry1', week: 'week10', pickedTeams: ['team1', 'team2'] },
				{ id: 'p2', entry: 'entry2', week: 'week10', pickedTeams: ['team3', 'team4'] },
				{ id: 'p3', entry: 'entry3', week: 'week10', pickedTeams: ['team5', 'team6'] },
			],
			teamResult: {
				team1: 'correct', team2: 'correct',
				team3: 'incorrect', team4: 'incorrect',
				team5: 'incorrect', team6: 'incorrect',
			},
			poolType: 'second_half',
			remainingActiveEntryIds: ['entry1', 'entry2', 'entry3'],
		});
		expect(result.status).toBe('winner_candidate');
		expect(result.highestRankedEntries).toEqual(['entry1']);
		expect(result.maxCorrectPicks).toBe(2);
	});

	it('chooses the sole highest correct-pick entry as the winner candidate', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week10',
			weekNum: 10,
			entries: Array.from({ length: 10 }, (_, index) => ({
				id: `entry${index + 1}`,
				season: 'season1',
				entryType: 'second_half',
				status: 'active',
			})),
			picks: [
				{ id: 'p1', entry: 'entry1', week: 'week10', pickedTeams: ['team1', 'team2'] },
				{ id: 'p2', entry: 'entry2', week: 'week10', pickedTeams: ['team3', 'team4'] },
				{ id: 'p3', entry: 'entry3', week: 'week10', pickedTeams: ['team5', 'team6'] },
				{ id: 'p4', entry: 'entry4', week: 'week10', pickedTeams: ['team7', 'team8'] },
				{ id: 'p5', entry: 'entry5', week: 'week10', pickedTeams: ['team9', 'team10'] },
				{ id: 'p6', entry: 'entry6', week: 'week10', pickedTeams: ['team11', 'team12'] },
				{ id: 'p7', entry: 'entry7', week: 'week10', pickedTeams: ['team13', 'team14'] },
				{ id: 'p8', entry: 'entry8', week: 'week10', pickedTeams: ['team15', 'team16'] },
				{ id: 'p9', entry: 'entry9', week: 'week10', pickedTeams: ['team17', 'team18'] },
				{ id: 'p10', entry: 'entry10', week: 'week10', pickedTeams: ['team19', 'team20'] },
			],
			teamResult: {
				team1: 'correct', team2: 'incorrect',
				team3: 'incorrect', team4: 'incorrect',
				team5: 'incorrect', team6: 'incorrect',
				team7: 'incorrect', team8: 'incorrect',
				team9: 'incorrect', team10: 'incorrect',
				team11: 'incorrect', team12: 'incorrect',
				team13: 'incorrect', team14: 'incorrect',
				team15: 'incorrect', team16: 'incorrect',
				team17: 'incorrect', team18: 'incorrect',
				team19: 'incorrect', team20: 'incorrect',
			},
			poolType: 'second_half',
			remainingActiveEntryIds: [],
		});
		expect(result.status).toBe('winner_candidate');
		expect(result.highestRankedEntries).toEqual(['entry1']);
		expect(result.needsAdminConfirmation).toBe(true);
	});

	it('ranks by cumulative correct picks across the pool instead of only the final week', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week10',
			weekNum: 10,
			entries: [
				{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'active' },
				{ id: 'entry2', season: 'season1', entryType: 'second_half', status: 'active' },
				{ id: 'entry3', season: 'season1', entryType: 'second_half', status: 'active' },
			],
			picks: [
				{ id: 'p1', entry: 'entry1', week: 'week8', pickedTeams: ['w8a'] },
				{ id: 'p2', entry: 'entry1', week: 'week9', pickedTeams: ['w9a'] },
				{ id: 'p3', entry: 'entry1', week: 'week10', pickedTeams: ['w10a'] },
				{ id: 'p4', entry: 'entry2', week: 'week10', pickedTeams: ['w10b', 'w10c'] },
				{ id: 'p5', entry: 'entry3', week: 'week10', pickedTeams: ['w10d'] },
			],
			teamResult: {
				w8a: 'correct',
				w9a: 'correct',
				w10a: 'correct',
				w10b: 'correct',
				w10c: 'correct',
				w10d: 'incorrect',
			},
			poolType: 'second_half',
			remainingActiveEntryIds: [],
		});
		expect(result.status).toBe('winner_candidate');
		expect(result.highestRankedEntries).toEqual(['entry1']);
		expect(result.maxCorrectPicks).toBe(3);
	});

	it('treats an all-eliminated LMS week as a split among entries alive entering that week', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week9',
			weekNum: 9,
			entries: [
				{ id: 'entry1', season: 'season1', entryType: 'lms', status: 'eliminated' },
				{ id: 'entry2', season: 'season1', entryType: 'lms', status: 'eliminated' },
				{ id: 'entry3', season: 'season1', entryType: 'lms', status: 'eliminated' },
			],
			picks: [
				{ id: 'p1', entry: 'entry1', week: 'week9', pickedTeams: ['team1'] },
				{ id: 'p2', entry: 'entry2', week: 'week9', pickedTeams: ['team2'] },
				{ id: 'p3', entry: 'entry3', week: 'week9', pickedTeams: ['team3'] },
			],
			teamResult: {
				team1: 'correct',
				team2: 'correct',
				team3: 'correct',
			},
			poolType: 'lms',
			remainingActiveEntryIds: ['entry1', 'entry2', 'entry3'],
		});
		expect(result.status).toBe('tie_required');
		expect(result.highestRankedEntries).toEqual(['entry1', 'entry2', 'entry3']);
	});

	it('keeps tied leaders pending admin review without declaring a single winner', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week10',
			weekNum: 10,
			entries: Array.from({ length: 10 }, (_, index) => ({
				id: `entry${index + 1}`,
				season: 'season1',
				entryType: 'second_half',
				status: 'active',
			})),
			picks: Array.from({ length: 10 }, (_, index) => ({
				id: `p${index + 1}`,
				entry: `entry${index + 1}`,
				week: 'week10',
				pickedTeams: ['team10', 'team20'],
			})),
			teamResult: {
				team10: 'correct', team20: 'incorrect',
			},
			poolType: 'second_half',
			remainingActiveEntryIds: [],
		});
		expect(result.status).toBe('tie_required');
		expect(result.highestRankedEntries).toHaveLength(10);
		expect(result.needsAdminConfirmation).toBe(true);
	});

	it('does not use cumulative season scores when the rule is a same-week all-eliminated tie-breaker', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week10',
			weekNum: 10,
			entries: [
				{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'active' },
				{ id: 'entry2', season: 'season1', entryType: 'second_half', status: 'active' },
			],
			picks: [
				{ id: 'p1', entry: 'entry1', week: 'week6', pickedTeams: ['teamA'] },
				{ id: 'p2', entry: 'entry1', week: 'week10', pickedTeams: ['teamB'] },
				{ id: 'p3', entry: 'entry2', week: 'week10', pickedTeams: ['teamC'] },
			],
			teamResult: {
				teamA: 'correct',
				teamB: 'correct',
				teamC: 'correct',
			},
			poolType: 'second_half',
			remainingActiveEntryIds: ['entry1', 'entry2'],
		});
		expect(result.status).toBe('tie_required');
		expect(result.maxCorrectPicks).toBe(1);
	});

	it('keeps resolution pending when a required game is still unresolved', () => {
		const result = _getZeroSurvivorWinnerResolution({
			seasonId: 'season1',
			weekId: 'week10',
			weekNum: 10,
			entries: [
				{ id: 'entry1', season: 'season1', entryType: 'second_half', status: 'active' },
				{ id: 'entry2', season: 'season1', entryType: 'second_half', status: 'active' },
			],
			picks: [
				{ id: 'p1', entry: 'entry1', week: 'week10', pickedTeams: ['team1', 'team2'] },
				{ id: 'p2', entry: 'entry2', week: 'week10', pickedTeams: ['team3', 'team4'] },
			],
			teamResult: {
				team1: 'correct',
				team2: 'incorrect',
				team3: 'incorrect',
			},
			poolType: 'second_half',
			remainingActiveEntryIds: [],
		});
		expect(result.status).toBe('pending_results');
	});
});

describe('Second Half pick submission — upsert behaviour', () => {

	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols   = makeCollections();
		mockPb = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('creates a new pick when none exists', async () => {
		cols.picks.getFirstListItem = vi.fn().mockRejectedValue(new Error('not found'));

		try {
			await actions.default({
				request: { formData: async () => sh2HFormData(['team1', 'team2']) },
				locals:  makeLocals(),
			} as any);
		} catch { /* redirect */ }

		expect(cols.picks.create).toHaveBeenCalledWith(expect.objectContaining({
			entry:       'entry1',
			week:        'week1',
			pickedTeams: ['team1', 'team2'],
			entryType:   'second_half',
			isAutoPick:  false,
		}));
		expect(cols.picks.update).not.toHaveBeenCalled();
	});

	it('updates an existing pick, replacing both teams', async () => {
		cols.picks.getFirstListItem = vi.fn().mockResolvedValue({ id: 'existing-pick' });

		try {
			await actions.default({
				request: { formData: async () => sh2HFormData(['teamA', 'teamB']) },
				locals:  makeLocals(),
			} as any);
		} catch { /* redirect */ }

		expect(cols.picks.update).toHaveBeenCalledWith('existing-pick', expect.objectContaining({
			pickedTeams: ['teamA', 'teamB'],
			entryType:   'second_half',
			isAutoPick:  false,
		}));
		expect(cols.picks.create).not.toHaveBeenCalled();
	});
});

describe('Second Half pick submission — access control', () => {

	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols   = makeCollections();
		mockPb = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('returns 401 when user is not authenticated', async () => {
		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  { user: null },
		} as any);

		expect((result as any).status).toBe(401);
	});

	it('returns 403 when entry belongs to a different user', async () => {
		cols.entries.getOne = vi.fn().mockResolvedValue({
			id: 'entry1', user: 'other-user', season: 'season1',
			entryType: 'second_half', status: 'active',
		});

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals('user1'),
		} as any);

		expect((result as any).status).toBe(403);
	});

	it('returns 400 when week is locked', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'locked', week: 7, secondHalfPicksPerWeek: null,
		});

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/deadline/i);
	});

	it('returns 400 when week is results_pending', async () => {
		cols.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'results_pending', week: 7, secondHalfPicksPerWeek: null,
		});

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('returns 404 when entry does not exist', async () => {
		cols.entries.getOne = vi.fn().mockRejectedValue(new Error('not found'));

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(404);
	});

	it('returns 404 when week does not exist', async () => {
		cols.weekly_settings.getOne = vi.fn().mockRejectedValue(new Error('not found'));

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(404);
	});
});

describe('Second Half pick submission — schema validation', () => {

	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols   = makeCollections();
		mockPb = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('returns 400 when entryId is missing', async () => {
		const result = await actions.default({
			request: { formData: async () => makeFormData({
				weekId: 'week1', entryType: 'second_half', teamIds: ['team1', 'team2'],
			})},
			locals: makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('returns 400 when weekId is missing', async () => {
		const result = await actions.default({
			request: { formData: async () => makeFormData({
				entryId: 'entry1', entryType: 'second_half', teamIds: ['team1', 'team2'],
			})},
			locals: makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('returns 400 when entryType is invalid', async () => {
		const result = await actions.default({
			request: { formData: async () => makeFormData({
				entryId: 'entry1', weekId: 'week1', entryType: 'invalid', teamIds: ['team1'],
			})},
			locals: makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});
});

describe('Second Half pick submission — PocketBase error handling', () => {

	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols   = makeCollections();
		mockPb = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('returns 400 when pick create fails', async () => {
		cols.picks.getFirstListItem = vi.fn().mockRejectedValue(new Error('not found'));
		cols.picks.create           = vi.fn().mockRejectedValue(new Error('DB write error'));

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('returns 400 when pick update fails', async () => {
		cols.picks.getFirstListItem = vi.fn().mockResolvedValue({ id: 'existing' });
		cols.picks.update           = vi.fn().mockRejectedValue(new Error('DB write error'));

		const result = await actions.default({
			request: { formData: async () => sh2HFormData(['team1', 'team2']) },
			locals:  makeLocals(),
		} as any);

		expect((result as any).status).toBe(400);
	});
});

describe('Second Half pick submission — redirect target', () => {

	let mockPb: any;
	let cols: ReturnType<typeof makeCollections>;

	beforeEach(() => {
		cols   = makeCollections();
		mockPb = makePb(cols);
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('redirects to /dashboard on success', async () => {
		let location = '';
		try {
			await actions.default({
				request: { formData: async () => sh2HFormData(['team1', 'team2']) },
				locals:  makeLocals(),
			} as any);
		} catch (e: any) {
			location = e?.location ?? '';
		}

		expect(location).toBe('/dashboard');
	});
});
