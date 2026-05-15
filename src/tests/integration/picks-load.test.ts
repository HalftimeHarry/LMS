import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from '../../routes/dashboard/picks/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeUrl(params: Record<string, string> = {}) {
	const sp = new URLSearchParams(params);
	return { searchParams: { get: (k: string) => sp.get(k) } } as unknown as URL;
}

function makeLocals(userId = 'user1') {
	return { user: { id: userId } };
}

/** Capture the redirect location thrown by SvelteKit's redirect() */
async function catchRedirect(fn: () => Promise<unknown>): Promise<string> {
	try {
		await fn();
		return '';
	} catch (e: any) {
		return e?.location ?? '';
	}
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const ENTRY_LMS = {
	id: 'entry1', user: 'user1', entryType: 'lms',
	expand: { season: { id: 'season1', name: 'LMS 2027', secondHalfPicksPerWeek: 1 } }
};

const ENTRY_2H = {
	id: 'entry2', user: 'user1', entryType: 'second_half',
	expand: { season: { id: 'season1', name: 'LMS 2027', secondHalfPicksPerWeek: 2 } }
};

const OPEN_WEEK = {
	id: 'week1', week: 5, status: 'open',
	deadline: '2027-10-09T20:00:00Z',
	secondHalfPicksPerWeek: null
};

const TEAMS = [
	{ id: 'teamKC', abbreviation: 'KC', name: 'Chiefs',   city: 'Kansas City', conference: 'AFC', division: 'West' },
	{ id: 'teamNE', abbreviation: 'NE', name: 'Patriots', city: 'New England', conference: 'AFC', division: 'East' }
];

// ── mock factory ──────────────────────────────────────────────────────────────

function makePb(overrides: {
	entry?:       any;
	week?:        any | null;
	teams?:       any[];
	existingPick?: any | null;
} = {}) {
	const entry       = overrides.entry       ?? ENTRY_LMS;
	const week        = overrides.week        ?? OPEN_WEEK;
	const teams       = overrides.teams       ?? TEAMS;
	const existingPick = overrides.existingPick ?? null;

	const collections: Record<string, any> = {
		entries: {
			getOne: vi.fn().mockResolvedValue(entry)
		},
		weekly_settings: {
			getFirstListItem: week
				? vi.fn().mockResolvedValue(week)
				: vi.fn().mockRejectedValue(new Error('no open week'))
		},
		nfl_teams: {
			getFullList: vi.fn().mockResolvedValue(teams)
		},
		picks: {
			getFirstListItem: existingPick
				? vi.fn().mockResolvedValue(existingPick)
				: vi.fn().mockRejectedValue(new Error('no pick'))
		}
	};

	return {
		collection: vi.fn((name: string) => collections[name] ?? {}),
		_collections: collections
	};
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('picks page load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('redirects to /login when not authenticated', async () => {
		const location = await catchRedirect(() =>
			load({ locals: { user: null }, url: makeUrl({ entry: 'entry1' }) } as any)
		);
		expect(location).toBe('/login?redirect=/dashboard/picks');
	});

	it('redirects to /dashboard when no entry param', async () => {
		vi.mocked(pbAdmin).mockResolvedValue(makePb() as any);
		const location = await catchRedirect(() =>
			load({ locals: makeLocals(), url: makeUrl() } as any)
		);
		expect(location).toBe('/dashboard');
	});

	it('redirects to /dashboard when entry belongs to another user', async () => {
		const pb = makePb({ entry: { ...ENTRY_LMS, user: 'other-user' } });
		vi.mocked(pbAdmin).mockResolvedValue(pb as any);
		const location = await catchRedirect(() =>
			load({ locals: makeLocals('user1'), url: makeUrl({ entry: 'entry1' }) } as any)
		);
		expect(location).toBe('/dashboard');
	});

	it('returns week=null and empty teams when no open week exists', async () => {
		// Explicitly build a pb where weekly_settings always rejects
		const pb = {
			collection: vi.fn((name: string) => {
				if (name === 'entries') return {
					getOne: vi.fn().mockResolvedValue(ENTRY_LMS)
				};
				if (name === 'weekly_settings') return {
					getFirstListItem: vi.fn().mockRejectedValue(new Error('no open week'))
				};
				return { getFullList: vi.fn().mockResolvedValue([]), getFirstListItem: vi.fn().mockRejectedValue(new Error()) };
			})
		};
		vi.mocked(pbAdmin).mockResolvedValue(pb as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry1' })
		} as any) as any;

		expect(result.week).toBeNull();
		expect(result.teams).toEqual([]);
		expect(result.picksRequired).toBe(0);
	});

	it('returns picksRequired=1 for an LMS entry', async () => {
		vi.mocked(pbAdmin).mockResolvedValue(makePb() as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry1' })
		} as any) as any;

		expect(result.picksRequired).toBe(1);
		expect(result.week.id).toBe('week1');
	});

	it('uses week-level secondHalfPicksPerWeek override for second_half entry', async () => {
		const pb = makePb({
			entry: ENTRY_2H,
			week:  { ...OPEN_WEEK, secondHalfPicksPerWeek: 3 }
		});
		vi.mocked(pbAdmin).mockResolvedValue(pb as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry2' })
		} as any) as any;

		expect(result.picksRequired).toBe(3);
	});

	it('falls back to season secondHalfPicksPerWeek when week has no override', async () => {
		const pb = makePb({
			entry: ENTRY_2H,
			week:  { ...OPEN_WEEK, secondHalfPicksPerWeek: null }
		});
		vi.mocked(pbAdmin).mockResolvedValue(pb as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry2' })
		} as any) as any;

		// ENTRY_2H.expand.season.secondHalfPicksPerWeek = 2
		expect(result.picksRequired).toBe(2);
	});

	it('returns all teams for the picker', async () => {
		vi.mocked(pbAdmin).mockResolvedValue(makePb() as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry1' })
		} as any) as any;

		expect(result.teams).toHaveLength(2);
		expect(result.teams[0].abbreviation).toBe('KC');
	});

	it('returns existingPick when one is found', async () => {
		const pick = { id: 'pick1', expand: { pickedTeams: [TEAMS[0]] } };
		const pb   = makePb({ existingPick: pick });
		vi.mocked(pbAdmin).mockResolvedValue(pb as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry1' })
		} as any) as any;

		expect(result.existingPick.id).toBe('pick1');
	});

	it('returns existingPick=null when no prior pick exists', async () => {
		vi.mocked(pbAdmin).mockResolvedValue(makePb() as any);
		const result = await load({
			locals: makeLocals(), url: makeUrl({ entry: 'entry1' })
		} as any) as any;

		expect(result.existingPick).toBeNull();
	});
});
