/**
 * Tests for entry and pick deadline logic.
 *
 * Entry deadline  = 20 minutes before the first game kickoff of the relevant week
 *   - LMS entries  → Week 1 first kickoff
 *   - 2H entries   → Week 6 (secondHalfStartWeek) first kickoff
 *
 * Pick deadline   = weekly_settings.deadline for the current week
 *   - Stored per-week in PocketBase; admin sets it when importing odds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, actions } from '../../routes/admin/entries/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
	return { get: (k: string) => fields[k] ?? null } as unknown as FormData;
}

/** ISO string N minutes from now */
function minutesFromNow(n: number) {
	return new Date(Date.now() + n * 60_000).toISOString();
}

/** ISO string N minutes ago */
function minutesAgo(n: number) {
	return new Date(Date.now() - n * 60_000).toISOString();
}

// ── Shared mock setup ─────────────────────────────────────────────────────────

let mockPb: any;
let collections: Record<string, any>;

beforeEach(() => {
	collections = {
		seasons:         { getOne: vi.fn(), getFullList: vi.fn().mockResolvedValue([]) },
		entries:         { getOne: vi.fn(), delete: vi.fn().mockResolvedValue(undefined), getFullList: vi.fn().mockResolvedValue([]) },
		game_odds:       { getFirstListItem: vi.fn() },
		weekly_settings: { getFirstListItem: vi.fn() },
		users:           { getFullList: vi.fn().mockResolvedValue([]) },
	};
	mockPb = { collection: vi.fn((name: string) => collections[name]) };
	vi.mocked(pbAdmin).mockResolvedValue(mockPb);
});

// ── load() — deadline derivation ─────────────────────────────────────────────

describe('load — entry deadlines derived from game_odds', () => {
	const SEASON = { id: 's1', name: '2026 LMS', status: 'active', year: 2026, secondHalfStartWeek: 6 };

	beforeEach(() => {
		collections.seasons.getFullList = vi.fn().mockResolvedValue([SEASON]);
		collections.entries.getFullList = vi.fn().mockResolvedValue([]);
		collections.users.getFullList   = vi.fn().mockResolvedValue([]);
	});

	it('sets lmsEntryDeadline to 20 min before week 1 first kickoff', async () => {
		const kickoff = minutesFromNow(60); // 60 min from now
		collections.game_odds.getFirstListItem = vi.fn()
			.mockResolvedValueOnce({ gameTime: kickoff })   // week 1
			.mockResolvedValueOnce(null);                   // week 6

		const result = await load({ url: new URL('http://x/admin/entries'), locals: { role: 'pool_admin' } } as any);

		const expected = new Date(kickoff);
		expected.setMinutes(expected.getMinutes() - 20);
		expect(result.lmsEntryDeadline).toBe(expected.toISOString());
	});

	it('sets shEntryDeadline to 20 min before week 6 first kickoff', async () => {
		const kickoff = minutesFromNow(120);
		collections.game_odds.getFirstListItem = vi.fn()
			.mockResolvedValueOnce(null)                    // week 1
			.mockResolvedValueOnce({ gameTime: kickoff });  // week 6

		const result = await load({ url: new URL('http://x/admin/entries'), locals: { role: 'pool_admin' } } as any);

		const expected = new Date(kickoff);
		expected.setMinutes(expected.getMinutes() - 20);
		expect(result.shEntryDeadline).toBe(expected.toISOString());
	});

	it('uses secondHalfStartWeek from season when set', async () => {
		const seasonWith8 = { ...SEASON, secondHalfStartWeek: 8 };
		collections.seasons.getFullList = vi.fn().mockResolvedValue([seasonWith8]);

		const kickoff = minutesFromNow(90);
		collections.game_odds.getFirstListItem = vi.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ gameTime: kickoff });

		await load({ url: new URL('http://x/admin/entries'), locals: { role: 'pool_admin' } } as any);

		// Second call should query week = 8
		const secondCall = collections.game_odds.getFirstListItem.mock.calls[1][0] as string;
		expect(secondCall).toContain('week = 8');
	});

	it('returns null deadlines when no odds exist', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue(null);

		const result = await load({ url: new URL('http://x/admin/entries'), locals: { role: 'pool_admin' } } as any);

		expect(result.lmsEntryDeadline).toBeNull();
		expect(result.shEntryDeadline).toBeNull();
	});

	it('returns null deadlines when no active season', async () => {
		collections.seasons.getFullList = vi.fn().mockResolvedValue([
			{ ...SEASON, status: 'complete' }
		]);

		const result = await load({ url: new URL('http://x/admin/entries'), locals: { role: 'pool_admin' } } as any);

		expect(result.lmsEntryDeadline).toBeNull();
		expect(result.shEntryDeadline).toBeNull();
	});
});

// ── createEntries — deadline enforcement ─────────────────────────────────────

describe('createEntries — blocked after game-derived deadline', () => {
	const BASE_FIELDS = {
		seasonId:  's1',
		userId:    'u1',
		entryType: 'lms',
		count:     '1',
		baseName:  'Test LMS',
	};

	beforeEach(() => {
		collections.seasons.getOne = vi.fn().mockResolvedValue({
			id: 's1', secondHalfStartWeek: 6
		});
		collections.entries.getFullList = vi.fn().mockResolvedValue([]);
		collections.entries.create      = vi.fn().mockResolvedValue({ id: 'e1', entryName: 'Test LMS 1' });
	});

	it('allows LMS entry creation when week 1 deadline is in the future', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({
			gameTime: minutesFromNow(60) // kickoff in 60 min → deadline in 40 min
		});

		const result = await actions.createEntries({
			request: { formData: async () => makeFormData(BASE_FIELDS) }
		} as any);

		expect((result as any)?.status).not.toBe(400);
	});

	it('blocks LMS entry creation when week 1 deadline has passed', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({
			gameTime: minutesAgo(10) // kickoff was 10 min ago → deadline was 30 min ago
		});

		const result = await actions.createEntries({
			request: { formData: async () => makeFormData(BASE_FIELDS) }
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/deadline has passed/i);
	});

	it('allows 2H entry creation when week 6 deadline is in the future', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({
			gameTime: minutesFromNow(60)
		});

		const result = await actions.createEntries({
			request: { formData: async () => makeFormData({ ...BASE_FIELDS, entryType: 'second_half', baseName: 'Test 2nd Half' }) }
		} as any);

		expect((result as any)?.status).not.toBe(400);
	});

	it('blocks 2H entry creation when week 6 deadline has passed', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({
			gameTime: minutesAgo(10)
		});

		const result = await actions.createEntries({
			request: { formData: async () => makeFormData({ ...BASE_FIELDS, entryType: 'second_half', baseName: 'Test 2nd Half' }) }
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/deadline has passed/i);
	});

	it('queries week 1 odds for LMS entries', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({
			gameTime: minutesFromNow(60)
		});

		await actions.createEntries({
			request: { formData: async () => makeFormData(BASE_FIELDS) }
		} as any);

		const query = collections.game_odds.getFirstListItem.mock.calls[0][0] as string;
		expect(query).toContain('week = 1');
	});

	it('queries week 6 odds for 2H entries', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({
			gameTime: minutesFromNow(60)
		});

		await actions.createEntries({
			request: { formData: async () => makeFormData({ ...BASE_FIELDS, entryType: 'second_half', baseName: 'Test 2nd Half' }) }
		} as any);

		const query = collections.game_odds.getFirstListItem.mock.calls[0][0] as string;
		expect(query).toContain('week = 6');
	});

	it('allows creation when no odds exist (deadline unknown — open by default)', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue(null);

		const result = await actions.createEntries({
			request: { formData: async () => makeFormData(BASE_FIELDS) }
		} as any);

		// No odds = no deadline enforcement = should not fail with a deadline error
		const error: string | undefined = (result as any)?.data?.error;
		expect(error ?? '').not.toMatch(/deadline has passed/i);
	});
});

// ── renameEntry ───────────────────────────────────────────────────────────────

describe('renameEntry', () => {
	beforeEach(() => {
		collections.entries.update = vi.fn().mockResolvedValue({});
	});

	it('renames an entry successfully', async () => {
		const result = await actions.renameEntry({
			request: { formData: async () => makeFormData({ id: 'e1', name: 'Turbo Nasty LMS 1' }) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('e1', { entryName: 'Turbo Nasty LMS 1' });
		expect((result as any).success).toBe(true);
	});

	it('rejects rename with missing id', async () => {
		const result = await actions.renameEntry({
			request: { formData: async () => makeFormData({ name: 'New Name' }) }
		} as any);

		expect((result as any).status).toBe(400);
		expect(collections.entries.update).not.toHaveBeenCalled();
	});

	it('rejects rename with name shorter than 2 characters', async () => {
		const result = await actions.renameEntry({
			request: { formData: async () => makeFormData({ id: 'e1', name: 'X' }) }
		} as any);

		expect((result as any).status).toBe(400);
		expect(collections.entries.update).not.toHaveBeenCalled();
	});

	it('trims whitespace from name before saving', async () => {
		await actions.renameEntry({
			request: { formData: async () => makeFormData({ id: 'e1', name: '  Turbo Nasty LMS 1  ' }) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('e1', { entryName: 'Turbo Nasty LMS 1' });
	});
});

// ── deleteEntry — deadline enforcement ───────────────────────────────────────

describe('deleteEntry — blocked after first-game deadline', () => {
	it('deletes entry when season is in setup', async () => {
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1', expand: { season: { status: 'setup', name: 'Test Season' } }
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).toHaveBeenCalledWith('e1');
		expect((result as any).success).toBe(true);
	});

	it('blocks delete when firstPickDeadline has passed on a real season', async () => {
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			expand: {
				season: {
					status:            'active',
					name:              '2026 LMS',
					firstPickDeadline: minutesAgo(30),
				}
			}
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect((result as any).status).toBe(400);
		expect(collections.entries.delete).not.toHaveBeenCalled();
	});

	it('allows delete when firstPickDeadline is in the future', async () => {
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			expand: {
				season: {
					status:            'active',
					name:              '2026 LMS',
					firstPickDeadline: minutesFromNow(30),
				}
			}
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).toHaveBeenCalledWith('e1');
		expect((result as any).success).toBe(true);
	});

	it('always allows delete for [TEST] seasons regardless of deadline', async () => {
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			expand: {
				season: {
					status:            'active',
					name:              '[TEST] 2026 LMS',
					firstPickDeadline: minutesAgo(999),
				}
			}
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).toHaveBeenCalledWith('e1');
		expect((result as any).success).toBe(true);
	});
});
