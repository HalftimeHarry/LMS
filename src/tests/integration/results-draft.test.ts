/**
 * Tests for recordResults — Save Draft behaviour.
 *
 * Save Draft (draft=1):
 *   - Writes pick_results immediately (upsert)
 *   - Eliminates entries whose picked team result is known
 *   - Leaves weekly_settings.status as 'locked' (does NOT advance to results_pending)
 *   - Returns { isDraft: true }
 *
 * Save & Finalize (draft omitted):
 *   - Same pick_result writes + eliminations
 *   - Advances weekly_settings.status to 'results_pending'
 *   - Returns { isDraft: false }
 *
 * LMS elimination rule:  picked team WINS  → eliminated
 * 2H  elimination rule:  picked team LOSES → eliminated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from '../../routes/admin/results/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
	const map = new Map(Object.entries(fields));
	return {
		get:     (k: string) => map.get(k) ?? null,
		entries: () => map.entries(),
	} as unknown as FormData;
}

// ── shared mock state ─────────────────────────────────────────────────────────

let mockPb: any;
let collections: Record<string, any>;

// Reusable fixture IDs
const SEASON_ID  = 'season1';
const LMS_WEEK   = 'lmsWeek1';
const GAME_ID    = 'game1';
const HOME_TEAM  = 'teamHome';
const AWAY_TEAM  = 'teamAway';
const PICK_ID    = 'pick1';
const ENTRY_ID   = 'entry1';

/** A game where home team wins */
const GAME = {
	id:      GAME_ID,
	week:    1,
	homeTeam: HOME_TEAM,
	awayTeam: AWAY_TEAM,
	expand:  { homeTeam: { id: HOME_TEAM }, awayTeam: { id: AWAY_TEAM } },
};

/** Base form fields for a single LMS week, home team wins */
function baseFields(extra: Record<string, string> = {}) {
	return {
		lmsWeekId:   LMS_WEEK,
		lmsSeasonId: SEASON_ID,
		weekNum:     '1',
		[`gameId_${GAME_ID}`]: 'home', // home wins
		...extra,
	};
}

beforeEach(() => {
	collections = {
		game_odds:        { getFullList: vi.fn().mockResolvedValue([GAME]) },
		picks:            { getFullList: vi.fn() },
		pick_results:     { getFirstListItem: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'pr1' }), update: vi.fn().mockResolvedValue({}) },
		entries:          { update: vi.fn().mockResolvedValue({}) },
		weekly_settings:  { getOne: vi.fn().mockResolvedValue({ id: LMS_WEEK, status: 'locked', week: 1 }), update: vi.fn().mockResolvedValue({}) },
	};
	mockPb = { collection: vi.fn((name: string) => collections[name]) };
	vi.mocked(pbAdmin).mockResolvedValue(mockPb);
});

// ── Save Draft — week status stays locked ─────────────────────────────────────

describe('recordResults — Save Draft (draft=1)', () => {

	it('returns isDraft: true', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect((result as any).isDraft).toBe(true);
	});

	it('does NOT advance week status to results_pending', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.weekly_settings.update).not.toHaveBeenCalled();
	});

	it('writes pick_results even in draft mode', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   'lms',
			pickedTeams: [AWAY_TEAM], // away team loses — LMS: picked loser = safe
			expand:      { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.pick_results.create).toHaveBeenCalledWith(
			expect.objectContaining({ pick: PICK_ID, team: AWAY_TEAM, result: 'incorrect' })
		);
	});

	it('eliminates LMS entry in draft mode when picked team wins', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   'lms',
			pickedTeams: [HOME_TEAM], // home wins → LMS elimination
			expand:      { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith(ENTRY_ID, expect.objectContaining({
			status:         'eliminated',
			eliminatedWeek: 1,
		}));
		expect((result as any).eliminated).toBe(1);
	});

	it('does NOT eliminate LMS entry when picked team loses (safe pick)', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   'lms',
			pickedTeams: [AWAY_TEAM], // away loses → LMS safe
			expand:      { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.entries.update).not.toHaveBeenCalled();
	});

	it('standings update: eliminated count reflects draft save', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([
			{
				id: 'pick_a', entryType: 'lms', pickedTeams: [HOME_TEAM],
				expand: { entry: { id: 'entry_a', status: 'active' } },
			},
			{
				id: 'pick_b', entryType: 'lms', pickedTeams: [AWAY_TEAM],
				expand: { entry: { id: 'entry_b', status: 'active' } },
			},
		]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		// entry_a picked home (winner) → eliminated; entry_b picked away (loser) → safe
		expect((result as any).eliminated).toBe(1);
		expect(collections.entries.update).toHaveBeenCalledTimes(1);
		expect(collections.entries.update).toHaveBeenCalledWith('entry_a', expect.objectContaining({ status: 'eliminated' }));
	});
});

// ── Save & Finalize (no draft flag) ──────────────────────────────────────────

describe('recordResults — Save & Finalize (no draft)', () => {

	it('returns isDraft: false', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields()) }
		} as any);

		expect((result as any).isDraft).toBe(false);
	});

	it('advances week status to results_pending', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields()) }
		} as any);

		expect(collections.weekly_settings.update).toHaveBeenCalledWith(
			LMS_WEEK, { status: 'results_pending' }
		);
	});

	it('does NOT advance week if already complete', async () => {
		collections.picks.getFullList    = vi.fn().mockResolvedValue([]);
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: LMS_WEEK, status: 'complete', week: 1 });

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields()) }
		} as any);

		expect(collections.weekly_settings.update).not.toHaveBeenCalled();
	});
});

// ── 2H elimination rule ───────────────────────────────────────────────────────

describe('recordResults — 2H elimination rule (picked team LOSES)', () => {
	const SH_WEEK = 'shWeek6';

	function shFields(extra: Record<string, string> = {}) {
		return {
			shWeekId:   SH_WEEK,
			shSeasonId: SEASON_ID,
			weekNum:    '6',
			[`gameId_${GAME_ID}`]: 'home', // home wins, away loses
			...extra,
		};
	}

	beforeEach(() => {
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: SH_WEEK, status: 'locked', week: 6 });
	});

	it('eliminates 2H entry when picked team LOSES', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          'pick_sh',
			entryType:   'second_half',
			pickedTeams: [AWAY_TEAM], // away loses → 2H elimination
			expand:      { entry: { id: 'entry_sh', status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(shFields({ draft: '1' })) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('entry_sh', expect.objectContaining({
			status:         'eliminated',
			eliminatedWeek: 6,
		}));
		expect((result as any).eliminated).toBe(1);
	});

	it('keeps 2H entry alive when picked team WINS', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          'pick_sh',
			entryType:   'second_half',
			pickedTeams: [HOME_TEAM], // home wins → 2H safe
			expand:      { entry: { id: 'entry_sh', status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(shFields({ draft: '1' })) }
		} as any);

		expect(collections.entries.update).not.toHaveBeenCalled();
		expect((result as any).eliminated).toBe(0);
	});
});

// ── Upsert behaviour ──────────────────────────────────────────────────────────

describe('recordResults — pick_result upsert', () => {

	it('updates existing pick_result instead of creating a duplicate', async () => {
		const existingResult = { id: 'pr_existing' };
		collections.pick_results.getFirstListItem = vi.fn().mockResolvedValue(existingResult);
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   'lms',
			pickedTeams: [HOME_TEAM],
			expand:      { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.pick_results.update).toHaveBeenCalledWith('pr_existing', { result: 'correct' });
		expect(collections.pick_results.create).not.toHaveBeenCalled();
	});

	it('creates new pick_result when none exists', async () => {
		collections.pick_results.getFirstListItem = vi.fn().mockResolvedValue(null);
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   'lms',
			pickedTeams: [HOME_TEAM],
			expand:      { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.pick_results.create).toHaveBeenCalledWith(
			expect.objectContaining({ pick: PICK_ID, team: HOME_TEAM, result: 'correct' })
		);
	});
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('recordResults — edge cases', () => {

	it('returns 400 when no week IDs provided', async () => {
		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({ weekNum: '1', [`gameId_${GAME_ID}`]: 'home' }) }
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('returns 400 when no game outcomes provided', async () => {
		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({ lmsWeekId: LMS_WEEK, lmsSeasonId: SEASON_ID, weekNum: '1' }) }
		} as any);

		expect((result as any).status).toBe(400);
	});

	it('skips elimination for already-eliminated entries', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   'lms',
			pickedTeams: [HOME_TEAM],
			expand:      { entry: { id: ENTRY_ID, status: 'eliminated' } }, // already out
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.entries.update).not.toHaveBeenCalled();
		expect((result as any).eliminated).toBe(0);
	});

	it('handles tie — neither team is eliminated', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([
			{
				id: 'pick_home', entryType: 'lms', pickedTeams: [HOME_TEAM],
				expand: { entry: { id: 'entry_home', status: 'active' } },
			},
			{
				id: 'pick_away', entryType: 'lms', pickedTeams: [AWAY_TEAM],
				expand: { entry: { id: 'entry_away', status: 'active' } },
			},
		]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({
				lmsWeekId: LMS_WEEK, lmsSeasonId: SEASON_ID, weekNum: '1',
				draft: '1',
				[`gameId_${GAME_ID}`]: 'tie',
			}) }
		} as any);

		expect(collections.entries.update).not.toHaveBeenCalled();
		expect((result as any).eliminated).toBe(0);
	});
});
