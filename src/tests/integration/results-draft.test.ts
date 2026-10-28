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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { actions, load } from '../../routes/admin/results/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';
import { clearResultsDraftOutcomes, saveResultsDraftOutcomes } from '$lib/server/adminResultsDraftStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
	const map = new Map(Object.entries(fields));
	return {
		get:     (k: string) => map.get(k) ?? null,
		entries: () => map.entries(),
	} as unknown as FormData;
}

function makeStatefulEntries(entries: Array<{ id: string; season: string; entryType: 'lms' | 'second_half'; status?: string }>) {
	const state = entries.map((entry) => ({ ...entry, status: entry.status ?? 'active' }));
	const map = new Map(state.map((entry) => [entry.id, entry]));
	return {
		entries: state,
		getFullList: vi.fn(async () => [...state]),
		update: vi.fn(async (id: string, patch: Record<string, any>) => {
			const current = map.get(id);
			if (!current) throw new Error(`Missing entry ${id}`);
			Object.assign(current, patch);
			map.set(id, current);
			return current;
		}),
	};
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
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));

	collections = {
		game_odds:        { getFullList: vi.fn().mockResolvedValue([GAME]) },
		picks:            { getFullList: vi.fn() },
		pick_results:     { getFirstListItem: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'pr1' }), update: vi.fn().mockResolvedValue({}) },
		entries:          { update: vi.fn().mockResolvedValue({}) },
		weekly_settings:  { getOne: vi.fn().mockResolvedValue({ id: LMS_WEEK, status: 'locked', week: 1, deadline: '2026-09-10T23:50:00.000Z' }), update: vi.fn().mockResolvedValue({}) },
	};
	mockPb = { collection: vi.fn((name: string) => collections[name]) };
	vi.mocked(pbAdmin).mockResolvedValue(mockPb);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('shared draft store', () => {
	it('exposes the in-progress draft state during page load', async () => {
		clearResultsDraftOutcomes('2027', 1);
		saveResultsDraftOutcomes('2027', 1, { game1: 'home', game2: 'away' });

		collections.seasons = {
			getFullList: vi.fn().mockResolvedValue([
				{ id: 'season1', year: 2027, name: 'LMS 2027', lmsEnabled: true, secondHalfEnabled: false }
			])
		};
		collections.weekly_settings.getFullList = vi.fn().mockResolvedValue([
			{ id: LMS_WEEK, week: 1, status: 'locked', deadline: '2026-09-10T23:50:00.000Z' }
		]);
		collections.weekly_settings.getFirstListItem = vi.fn().mockResolvedValue({
			id: LMS_WEEK,
			week: 1,
			status: 'locked',
			deadline: '2026-09-10T23:50:00.000Z'
		});
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);
		collections.game_odds.getFullList = vi.fn().mockResolvedValue([GAME]);

		const page = await load({
			url: new URL('http://localhost/admin/results?year=2027&week=1'),
			locals: { role: 'super_admin' }
		} as any);

		expect((page as any).draftOutcomes).toEqual({ game1: 'home', game2: 'away' });
	});

	it('persists a save-draft outcome for the active year/week after reload', async () => {
		clearResultsDraftOutcomes('2027', 1);
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1', year: '2027' })) }
		} as any);

		collections.seasons = {
			getFullList: vi.fn().mockResolvedValue([
				{ id: 'season1', year: 2027, name: 'LMS 2027', lmsEnabled: true, secondHalfEnabled: false }
			])
		};
		collections.weekly_settings.getFullList = vi.fn().mockResolvedValue([
			{ id: LMS_WEEK, week: 1, status: 'locked', deadline: '2026-09-10T23:50:00.000Z' }
		]);
		collections.weekly_settings.getFirstListItem = vi.fn().mockResolvedValue({
			id: LMS_WEEK,
			week: 1,
			status: 'locked',
			deadline: '2026-09-10T23:50:00.000Z'
		});
		collections.game_odds.getFullList = vi.fn().mockResolvedValue([GAME]);

		const page = await load({
			url: new URL('http://localhost/admin/results?year=2027&week=1'),
			locals: { role: 'super_admin' }
		} as any);

		expect((page as any).draftOutcomes).toEqual({ [GAME_ID]: 'home' });
	});
});

describe('recordResults — server-side results window gating', () => {
	it('returns a service error when PocketBase admin access is unavailable', async () => {
		vi.mocked(pbAdmin).mockRejectedValueOnce(new Error('fetch failed'));

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect((result as any).status).toBe(503);
		expect((result as any).data?.error).toMatch(/connect to the results database/i);
	});

	it('blocks direct POST before the week deadline', async () => {
		vi.setSystemTime(new Date('2026-09-09T20:00:00.000Z'));
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect((result as any).status).toBe(403);
		expect((result as any).data?.error ?? '').toMatch(/not active for this week|locked until/i);
	});

	it('blocks direct POST before the selected week deadline', async () => {
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: LMS_WEEK,
			status: 'locked',
			week: 1,
			deadline: '2026-09-20T15:00:00.000Z'
		});
		vi.setSystemTime(new Date('2026-09-20T14:00:00.000Z'));
		collections.picks.getFullList = vi.fn().mockResolvedValue([]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect((result as any).status).toBe(403);
		expect((result as any).data?.error ?? '').toMatch(/not active for this week/i);
	});
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

	it('falls back to entry.entryType when pick.entryType is missing', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          PICK_ID,
			entryType:   undefined,
			pickedTeams: [HOME_TEAM],
			expand:      { entry: { id: ENTRY_ID, status: 'active', entryType: 'lms' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith(ENTRY_ID, expect.objectContaining({
			status: 'eliminated',
			eliminatedWeek: 1,
		}));
		expect((result as any).eliminated).toBe(1);
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
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: LMS_WEEK, status: 'complete', week: 1, deadline: '2026-09-10T23:50:00.000Z' });

		await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields()) }
		} as any);

		expect(collections.weekly_settings.update).not.toHaveBeenCalled();
	});
});

describe('recordResults — zero-survivor automation is disabled for the season', () => {
	it('uses the actual Week 7 LMS outcome set and keeps the six true survivors active while eliminating the seven Giants entries', async () => {
		const lmsEntries = [
			...Array.from({ length: 7 }, (_, index) => ({ id: `giant${index + 1}`, season: SEASON_ID, entryType: 'lms' as const, status: 'active' })),
			...Array.from({ length: 3 }, (_, index) => ({ id: `ind${index + 1}`, season: SEASON_ID, entryType: 'lms' as const, status: 'active' })),
			{ id: 'ne1', season: SEASON_ID, entryType: 'lms' as const, status: 'active' },
			{ id: 'lv1', season: SEASON_ID, entryType: 'lms' as const, status: 'active' },
			{ id: 'phi1', season: SEASON_ID, entryType: 'lms' as const, status: 'active' },
		];
		const statefulEntries = makeStatefulEntries(lmsEntries);
		const giantIds = lmsEntries.slice(0, 7).map((entry) => entry.id);
		const survivorIds = lmsEntries.slice(7).map((entry) => entry.id);
		const picks = lmsEntries.map((entry, index) => ({
			id: `pick${index + 1}`,
			entry: entry.id,
			week: LMS_WEEK,
			pickedTeams: index < 7 ? [HOME_TEAM] : [AWAY_TEAM],
			expand: { entry: { id: entry.id, status: 'active', entryType: 'lms' } },
		}));
		collections.picks.getFullList = vi.fn().mockResolvedValue(picks);
		collections.entries = statefulEntries;

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect((result as any).success).toBe(true);
		expect((result as any).eliminated).toBe(7);
		expect((result as any).zeroSurvivorResolution).toBeUndefined();
		const activeIds = statefulEntries.entries.filter((entry) => entry.status === 'active').map((entry) => entry.id).sort();
		expect(activeIds).toEqual([...survivorIds].sort());
		const eliminatedIds = statefulEntries.entries.filter((entry) => entry.status === 'eliminated').map((entry) => entry.id).sort();
		expect(eliminatedIds).toEqual([...giantIds].sort());
		const winnerUpdates = (statefulEntries.update as any).mock.calls.filter(([, payload]: any[]) => payload?.status === 'winner');
		expect(winnerUpdates).toHaveLength(0);
	});

	it('does not assign winners in a genuine all-eliminated LMS week and leaves all eliminated entries intact for manual review', async () => {
		const lmsEntries = [
			{ id: 'all1', season: SEASON_ID, entryType: 'lms' as const, status: 'active' },
			{ id: 'all2', season: SEASON_ID, entryType: 'lms' as const, status: 'active' },
			{ id: 'all3', season: SEASON_ID, entryType: 'lms' as const, status: 'active' },
		];
		const statefulEntries = makeStatefulEntries(lmsEntries);
		const picks = lmsEntries.map((entry, index) => ({
			id: `pick${index + 1}`,
			entry: entry.id,
			week: LMS_WEEK,
			pickedTeams: [HOME_TEAM],
			expand: { entry: { id: entry.id, status: 'active', entryType: 'lms' } },
		}));
		collections.picks.getFullList = vi.fn().mockResolvedValue(picks);
		collections.entries = statefulEntries;

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ draft: '1' })) }
		} as any);

		expect((result as any).success).toBe(true);
		expect((result as any).eliminated).toBe(3);
		expect((result as any).zeroSurvivorResolution).toBeUndefined();
		const allEliminated = statefulEntries.entries.filter((entry) => entry.status === 'eliminated').map((entry) => entry.id);
		expect(allEliminated).toHaveLength(3);
		const winnerUpdates = (statefulEntries.update as any).mock.calls.filter(([, payload]: any[]) => payload?.status === 'winner');
		expect(winnerUpdates).toHaveLength(0);
	});

	it('does not auto-create zero-survivor winners for Second Half when the pool is processed separately', async () => {
		const shEntries = Array.from({ length: 3 }, (_, index) => ({
			id: `sh${index + 1}`,
			season: SEASON_ID,
			entryType: 'second_half' as const,
			status: 'active',
		}));
		const statefulEntries = makeStatefulEntries(shEntries);
		const picks = shEntries.map((entry, index) => ({
			id: `shpick${index + 1}`,
			entry: entry.id,
			week: 'shWeek6',
			pickedTeams: index === 0 ? [HOME_TEAM] : [AWAY_TEAM],
			expand: { entry: { id: entry.id, status: 'active', entryType: 'second_half' } },
		}));
		collections.picks.getFullList = vi.fn().mockResolvedValue(picks);
		collections.entries = statefulEntries;
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: 'shWeek6', status: 'locked', week: 6, deadline: '2026-09-15T23:50:00.000Z' });

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({
				shWeekId: 'shWeek6',
				shSeasonId: SEASON_ID,
				weekNum: '6',
				draft: '1',
				[`gameId_${GAME_ID}`]: 'home',
			}) }
		} as any);

		expect((result as any).success).toBe(true);
		expect((result as any).zeroSurvivorResolution).toBeUndefined();
		const winnerUpdates = (statefulEntries.update as any).mock.calls.filter(([, payload]: any[]) => payload?.status === 'winner');
		expect(winnerUpdates).toHaveLength(0);
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
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: SH_WEEK, status: 'locked', week: 6, deadline: '2026-09-15T23:50:00.000Z' });
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

	it('does not eliminate 2H entries before the pool start week', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id:          'pick_sh_early',
			entryType:   'second_half',
			pickedTeams: [AWAY_TEAM], // away loses, but week 5 is before 2H start week 6
			expand:      { entry: { id: 'entry_sh_early', status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({
				shWeekId: SH_WEEK,
				shSeasonId: SEASON_ID,
				weekNum: '5',
				draft: '1',
				[`gameId_${GAME_ID}`]: 'home',
			}) }
		} as any);

		expect(collections.entries.update).not.toHaveBeenCalled();
		expect((result as any).eliminated).toBe(0);
	});

	it('does not process 2H picks attached to the LMS week before the 2H start week', async () => {
		// Regression: 2H entries pick on the LMS season's week records. Processing
		// the LMS week must skip their picks entirely (no pick_results, no
		// elimination) when the week is before secondHalfStartWeek.
		collections.picks.getFullList = vi.fn().mockResolvedValue([
			{
				id:          'pick_lms',
				entryType:   'lms',
				pickedTeams: [HOME_TEAM], // home wins → LMS elimination
				expand:      { entry: { id: 'entry_lms', status: 'active' } },
			},
			{
				id:          'pick_sh_on_lms_week',
				entryType:   'second_half',
				pickedTeams: [AWAY_TEAM], // away loses → would eliminate under 2H rule
				expand:      { entry: { id: 'entry_sh', status: 'active' } },
			},
		]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(baseFields({ weekNum: '3', draft: '1' })) }
		} as any);

		// LMS entry processed; 2H entry untouched
		expect(collections.entries.update).toHaveBeenCalledTimes(1);
		expect(collections.entries.update).toHaveBeenCalledWith('entry_lms', expect.objectContaining({
			status:         'eliminated',
			eliminatedWeek: 3,
		}));
		// No pick_result written for the 2H pick
		expect(collections.pick_results.create).toHaveBeenCalledTimes(1);
		expect(collections.pick_results.create).toHaveBeenCalledWith(expect.objectContaining({ pick: 'pick_lms' }));
		expect((result as any).eliminated).toBe(1);
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

// ── Tie result — both teams eliminated ───────────────────────────────────────

describe('recordResults — tie result eliminates pickers of both teams', () => {

	function tieFields(extra: Record<string, string> = {}) {
		return {
			lmsWeekId:   LMS_WEEK,
			lmsSeasonId: SEASON_ID,
			weekNum:     '1',
			draft:       '1',
			[`gameId_${GAME_ID}`]: 'tie',
			...extra,
		};
	}

	it('LMS: eliminates entry that picked the home team in a tie', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id: PICK_ID, entryType: 'lms', pickedTeams: [HOME_TEAM],
			expand: { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(tieFields()) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith(ENTRY_ID, expect.objectContaining({
			status: 'eliminated', eliminatedWeek: 1, eliminatedReason: 'Picked a team that tied',
		}));
		expect((result as any).eliminated).toBe(1);
	});

	it('LMS: eliminates entry that picked the away team in a tie', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id: PICK_ID, entryType: 'lms', pickedTeams: [AWAY_TEAM],
			expand: { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(tieFields()) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith(ENTRY_ID, expect.objectContaining({
			status: 'eliminated', eliminatedWeek: 1, eliminatedReason: 'Picked a team that tied',
		}));
		expect((result as any).eliminated).toBe(1);
	});

	it('LMS: eliminates entries that picked both teams in a tie', async () => {
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
			request: { formData: async () => makeFormData(tieFields()) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledTimes(2);
		expect(collections.entries.update).toHaveBeenCalledWith('entry_home', expect.objectContaining({ status: 'eliminated' }));
		expect(collections.entries.update).toHaveBeenCalledWith('entry_away', expect.objectContaining({ status: 'eliminated' }));
		expect((result as any).eliminated).toBe(2);
	});

	it('2H: eliminates entry that picked the home team in a tie', async () => {
		const SH_WEEK = 'shWeek6';
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: SH_WEEK, status: 'locked', week: 6, deadline: '2026-09-15T23:50:00.000Z' });
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id: 'pick_sh', entryType: 'second_half', pickedTeams: [HOME_TEAM],
			expand: { entry: { id: 'entry_sh', status: 'active' } },
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({
				shWeekId: SH_WEEK, shSeasonId: SEASON_ID, weekNum: '6',
				draft: '1', [`gameId_${GAME_ID}`]: 'tie',
			}) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('entry_sh', expect.objectContaining({
			status: 'eliminated', eliminatedWeek: 6, eliminatedReason: 'Picked a team that tied',
		}));
		expect((result as any).eliminated).toBe(1);
	});

	it('2H: eliminates entries that picked both teams in a tie', async () => {
		const SH_WEEK = 'shWeek6';
		collections.weekly_settings.getOne = vi.fn().mockResolvedValue({ id: SH_WEEK, status: 'locked', week: 6, deadline: '2026-09-15T23:50:00.000Z' });
		collections.picks.getFullList = vi.fn().mockResolvedValue([
			{
				id: 'pick_sh_home', entryType: 'second_half', pickedTeams: [HOME_TEAM],
				expand: { entry: { id: 'entry_sh_home', status: 'active' } },
			},
			{
				id: 'pick_sh_away', entryType: 'second_half', pickedTeams: [AWAY_TEAM],
				expand: { entry: { id: 'entry_sh_away', status: 'active' } },
			},
		]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({
				shWeekId: SH_WEEK, shSeasonId: SEASON_ID, weekNum: '6',
				draft: '1', [`gameId_${GAME_ID}`]: 'tie',
			}) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledTimes(2);
		expect(collections.entries.update).toHaveBeenCalledWith('entry_sh_home', expect.objectContaining({ status: 'eliminated' }));
		expect(collections.entries.update).toHaveBeenCalledWith('entry_sh_away', expect.objectContaining({ status: 'eliminated' }));
		expect((result as any).eliminated).toBe(2);
	});

	it('does not eliminate already-eliminated entries on tie', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id: PICK_ID, entryType: 'lms', pickedTeams: [HOME_TEAM],
			expand: { entry: { id: ENTRY_ID, status: 'eliminated' } }, // already out
		}]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData(tieFields()) }
		} as any);

		expect(collections.entries.update).not.toHaveBeenCalled();
		expect((result as any).eliminated).toBe(0);
	});

	it('writes pick_result with result="tie" for both teams', async () => {
		collections.picks.getFullList = vi.fn().mockResolvedValue([{
			id: PICK_ID, entryType: 'lms', pickedTeams: [HOME_TEAM],
			expand: { entry: { id: ENTRY_ID, status: 'active' } },
		}]);

		await actions.recordResults({
			request: { formData: async () => makeFormData(tieFields()) }
		} as any);

		expect(collections.pick_results.create).toHaveBeenCalledWith(
			expect.objectContaining({ pick: PICK_ID, team: HOME_TEAM, result: 'tie' })
		);
	});

	it('only eliminates pickers of the tied game — other game pickers unaffected', async () => {
		const GAME2_ID   = 'game2';
		const TEAM_C     = 'teamC';
		const TEAM_D     = 'teamD';

		// Two games this week: game1 ties, game2 home wins
		collections.game_odds.getFullList = vi.fn().mockResolvedValue([
			{
				id: GAME_ID, week: 1, homeTeam: HOME_TEAM, awayTeam: AWAY_TEAM,
				expand: { homeTeam: { id: HOME_TEAM }, awayTeam: { id: AWAY_TEAM } },
			},
			{
				id: GAME2_ID, week: 1, homeTeam: TEAM_C, awayTeam: TEAM_D,
				expand: { homeTeam: { id: TEAM_C }, awayTeam: { id: TEAM_D } },
			},
		]);

		collections.picks.getFullList = vi.fn().mockResolvedValue([
			// Picked tied team → eliminated
			{
				id: 'pick_tied', entryType: 'lms', pickedTeams: [HOME_TEAM],
				expand: { entry: { id: 'entry_tied', status: 'active' } },
			},
			// Picked loser of game2 → safe (LMS: picked loser = safe)
			{
				id: 'pick_safe', entryType: 'lms', pickedTeams: [TEAM_D],
				expand: { entry: { id: 'entry_safe', status: 'active' } },
			},
		]);

		const result = await actions.recordResults({
			request: { formData: async () => makeFormData({
				lmsWeekId: LMS_WEEK, lmsSeasonId: SEASON_ID, weekNum: '1',
				draft: '1',
				[`gameId_${GAME_ID}`]:  'tie',
				[`gameId_${GAME2_ID}`]: 'home', // TEAM_C wins, TEAM_D loses
			}) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledTimes(1);
		expect(collections.entries.update).toHaveBeenCalledWith('entry_tied', expect.objectContaining({ status: 'eliminated' }));
		expect((result as any).eliminated).toBe(1);

		// restore default mock for other tests
		collections.game_odds.getFullList = vi.fn().mockResolvedValue([GAME]);
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

	it('tie — eliminates LMS entries that picked either team', async () => {
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

		expect(collections.entries.update).toHaveBeenCalledTimes(2);
		expect(collections.entries.update).toHaveBeenCalledWith('entry_home', expect.objectContaining({
			status: 'eliminated', eliminatedWeek: 1, eliminatedReason: 'Picked a team that tied',
		}));
		expect(collections.entries.update).toHaveBeenCalledWith('entry_away', expect.objectContaining({
			status: 'eliminated', eliminatedWeek: 1, eliminatedReason: 'Picked a team that tied',
		}));
		expect((result as any).eliminated).toBe(2);
	});
});
