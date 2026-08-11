import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from '../../routes/admin/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';

function makeFormData(fields: Record<string, string>) {
	return {
		get: (key: string) => fields[key] ?? null
	} as unknown as FormData;
}

describe('admin dashboard season pairing', () => {
	let collections: Record<string, any>;
	let mockPb: any;

	const lmsSeason = {
		id: 'lms1',
		name: '2026 - 2027 LMS',
		year: 2027,
		status: 'active',
		lmsEnabled: true,
		secondHalfEnabled: true,
		lmsEntryFee: 100,
		secondHalfEntryFee: 50,
		maintenanceFee: 300
	};

	const shSeason = {
		id: 'sh1',
		name: '2026 - 2027 Second Half',
		year: 2026,
		status: 'active',
		lmsEnabled: false,
		secondHalfEnabled: true,
		lmsEntryFee: 100,
		secondHalfEntryFee: 50,
		maintenanceFee: 300
	};

	const lmsSeasonEntries = [
		{ id: 'e1', season: 'lms1', entryType: 'lms', status: 'active', paid: true,  paymentMethod: 'venmo', user: 'u1', entryName: 'LMS 1' },
		{ id: 'e2', season: 'lms1', entryType: 'lms', status: 'active', paid: true,  paymentMethod: 'cash',  user: 'u2', entryName: 'LMS 2' },
		{ id: 'e3', season: 'lms1', entryType: 'second_half', status: 'pending_payment', paid: false, paymentMethod: null, user: 'u3', entryName: '2H 1' },
		{ id: 'e4', season: 'lms1', entryType: 'second_half', status: 'pending_payment', paid: false, paymentMethod: null, user: 'u4', entryName: '2H 2' },
		{ id: 'e5', season: 'lms1', entryType: 'second_half', status: 'active', paid: true, paymentMethod: 'venmo', user: 'u5', entryName: '2H 3' }
	];

	beforeEach(() => {
		collections = {
			seasons: {
				getFullList: vi.fn().mockResolvedValue([lmsSeason, shSeason])
			},
			game_odds: {
				getFirstListItem: vi.fn().mockImplementation((filter: string) => {
					if (filter.includes('season = "lms1"') && filter.includes('week = 1')) {
						return Promise.resolve({ game_time_stamp: '2026-09-10T00:20:00.000Z' });
					}
					if (filter.includes('season = "lms1"') && filter.includes('week = 6')) {
						return Promise.resolve({ game_time_stamp: '2026-10-15T00:15:00.000Z' });
					}
					return Promise.resolve(null);
				})
			},
			users: {
				getList: vi.fn().mockResolvedValue({ totalItems: 57 })
			},
			weekly_settings: {
				getFirstListItem: vi.fn().mockImplementation((filter: string) => {
					if (filter.includes('season = "lms1"')) {
						return Promise.resolve({ id: 'w1', season: 'lms1', week: 1, status: 'open' });
					}
					return Promise.resolve(null);
				})
			},
			entries: {
				getFullList: vi.fn().mockImplementation((opts: any = {}) => {
					const filter = String(opts.filter ?? '');
					const isLmsSeasonQuery = filter.includes('season = "lms1"');
					if (!isLmsSeasonQuery) return Promise.resolve([]);

					let result = [...lmsSeasonEntries];
					if (filter.includes('entryType = "lms"')) {
						result = result.filter((e) => e.entryType === 'lms');
					}
					if (filter.includes('entryType = "second_half"')) {
						result = result.filter((e) => e.entryType === 'second_half');
					}
					if (filter.includes('status = "pending_payment"')) {
						result = result.filter((e) => e.status === 'pending_payment');
					}

					if (opts.fields) {
						return Promise.resolve(result.map((e) => ({
							id: e.id,
							status: e.status,
							paid: e.paid,
							paymentMethod: e.paymentMethod,
							season: e.season,
							entryType: e.entryType
						})));
					}

					return Promise.resolve(result.map((e) => ({
						...e,
						expand: { user: { id: e.user, displayName: e.user, email: `${e.user}@x.com` } }
					})));
				})
			}
		};

		mockPb = { collection: vi.fn((name: string) => collections[name]) };
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('uses paired LMS season entries for Second Half season stats and pending payments', async () => {
		const data = await load({ locals: { role: 'pool_admin' } } as any);

		expect(data.seasonDataMap.lms1.stats.totalEntries).toBe(2);
		expect(data.seasonDataMap.lms1.stats.lmsEntries).toBe(2);
		expect(data.seasonDataMap.lms1.stats.secondHalfEntries).toBe(0);
		expect(data.seasonDataMap.lms1.stats.pendingPayment).toBe(0);
		expect(data.seasonDataMap.lms1.pendingPaymentEntries).toHaveLength(0);

		expect(data.seasonDataMap.sh1.stats.totalEntries).toBe(3);
		expect(data.seasonDataMap.sh1.stats.lmsEntries).toBe(0);
		expect(data.seasonDataMap.sh1.stats.secondHalfEntries).toBe(3);
		expect(data.seasonDataMap.sh1.stats.pendingPayment).toBe(2);

		expect(data.seasonDataMap.sh1.pendingPaymentEntries).toHaveLength(2);
		expect(data.seasonDataMap.sh1.pendingPaymentEntries.every((e: any) => e.entryType === 'second_half')).toBe(true);
	});

	it('approves pending payment entries and marks them active', async () => {
		collections.entries.update = vi.fn().mockResolvedValue({ id: 'e3', paid: true, status: 'active' });

		const result = await actions.approveEntryPayment({
			locals: { role: 'pool_admin' },
			request: { formData: async () => makeFormData({ id: 'e3', paymentMethod: 'cash' }) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('e3', expect.objectContaining({
			paid: true,
			paymentMethod: 'cash',
			status: 'active'
		}));
		expect((result as any).success).toBe(true);
	});

	it('blocks payment approval for unauthorized roles', async () => {
		const result = await actions.approveEntryPayment({
			locals: { role: 'member' },
			request: { formData: async () => makeFormData({ id: 'e3', paymentMethod: 'cash' }) }
		} as any);

		expect((result as any).status).toBe(403);
	});
});
