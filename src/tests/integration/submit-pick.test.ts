import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from '../../routes/dashboard/picks/+page.server';

// pb-admin is aliased to the mock in vite.config.ts test.alias
import { pbAdmin } from '$lib/server/pb-admin';

function makeFormData(fields: Record<string, string | string[]>) {
	return {
		get:    (key: string) => {
			const v = fields[key];
			return Array.isArray(v) ? v[0] : (v ?? null);
		},
		getAll: (key: string) => {
			const v = fields[key];
			return Array.isArray(v) ? v : (v ? [v] : []);
		}
	} as unknown as FormData;
}

function makeLocals(overrides: Partial<{ id: string; role: string }> = {}) {
	return { user: { id: 'user1', ...overrides } };
}

describe('submit pick action', () => {
	let mockPb: any;

	beforeEach(() => {
		mockPb = {
			collection: vi.fn((name: string) => ({
				getOne:             vi.fn(),
				getFirstListItem:   vi.fn(),
				create:             vi.fn(),
				update:             vi.fn()
			}))
		};

		// Give each collection its own mock so we can configure per-collection
		const collections: Record<string, any> = {
			entries: {
				getOne: vi.fn().mockResolvedValue({
					id: 'entry1', user: 'user1', season: 'season1', entryType: 'lms'
				})
			},
			weekly_settings: {
				getOne: vi.fn().mockResolvedValue({
					id: 'week1', status: 'open', secondHalfPicksPerWeek: null
				})
			},
			seasons: {
				getOne: vi.fn().mockResolvedValue({
					id: 'season1', secondHalfPicksPerWeek: 1
				})
			},
			picks: {
				getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
				create:           vi.fn().mockResolvedValue({ id: 'pick1' }),
				update:           vi.fn().mockResolvedValue({ id: 'pick1' })
			}
		};

		mockPb.collection = vi.fn((name: string) => collections[name] ?? {
			getOne: vi.fn(), getFirstListItem: vi.fn(), create: vi.fn(), update: vi.fn()
		});
		mockPb._collections = collections;

		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('creates a new LMS pick and redirects to /dashboard', async () => {
		let redirected = '';
		try {
			await actions.default({
				request: { formData: async () => makeFormData({
					entryId:   'entry1',
					weekId:    'week1',
					entryType: 'lms',
					teamIds:   ['team1']
				})},
				locals: makeLocals()
			} as any);
		} catch (e: any) {
			redirected = e?.location ?? '';
		}

		expect(redirected).toBe('/dashboard');
		expect(mockPb._collections.picks.create).toHaveBeenCalledWith(
			expect.objectContaining({ entry: 'entry1', week: 'week1', pickedTeams: ['team1'] })
		);
	});

	it('updates an existing pick when one already exists', async () => {
		mockPb._collections.picks.getFirstListItem = vi.fn().mockResolvedValue({ id: 'existing-pick' });

		try {
			await actions.default({
				request: { formData: async () => makeFormData({
					entryId: 'entry1', weekId: 'week1', entryType: 'lms', teamIds: ['team2']
				})},
				locals: makeLocals()
			} as any);
		} catch { /* redirect */ }

		expect(mockPb._collections.picks.update).toHaveBeenCalledWith(
			'existing-pick',
			expect.objectContaining({ pickedTeams: ['team2'] })
		);
		expect(mockPb._collections.picks.create).not.toHaveBeenCalled();
	});

	it('returns 403 when entry does not belong to the user', async () => {
		mockPb._collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'entry1', user: 'other-user', season: 'season1', entryType: 'lms'
		});

		const result = await actions.default({
			request: { formData: async () => makeFormData({
				entryId: 'entry1', weekId: 'week1', entryType: 'lms', teamIds: ['team1']
			})},
			locals: makeLocals()
		} as any);

		expect((result as any).status).toBe(403);
	});

	it('returns 400 when week is locked', async () => {
		mockPb._collections.weekly_settings.getOne = vi.fn().mockResolvedValue({
			id: 'week1', status: 'locked', secondHalfPicksPerWeek: null
		});

		const result = await actions.default({
			request: { formData: async () => makeFormData({
				entryId: 'entry1', weekId: 'week1', entryType: 'lms', teamIds: ['team1']
			})},
			locals: makeLocals()
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/deadline/i);
	});

	it('returns 400 when wrong number of teams submitted for second_half', async () => {
		mockPb._collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'entry1', user: 'user1', season: 'season1', entryType: 'second_half'
		});
		mockPb._collections.seasons.getOne = vi.fn().mockResolvedValue({
			id: 'season1', secondHalfPicksPerWeek: 2
		});

		// Submit only 1 team when 2 are required
		const result = await actions.default({
			request: { formData: async () => makeFormData({
				entryId: 'entry1', weekId: 'week1', entryType: 'second_half', teamIds: ['team1']
			})},
			locals: makeLocals()
		} as any);

		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/2 teams/i);
	});

	it('returns 401 when not authenticated', async () => {
		const result = await actions.default({
			request: { formData: async () => makeFormData({
				entryId: 'entry1', weekId: 'week1', entryType: 'lms', teamIds: ['team1']
			})},
			locals: { user: null }
		} as any);

		expect((result as any).status).toBe(401);
	});
});
