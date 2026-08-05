import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from '../../routes/admin/entries/+page.server';
import { pbAdmin } from '$lib/server/pb-admin';

function makeFormData(fields: Record<string, string>) {
	return {
		get: (key: string) => fields[key] ?? null
	} as unknown as FormData;
}

describe('entries admin — deleteEntry', () => {
	let mockPb: any;
	let collections: Record<string, any>;

	beforeEach(() => {
		collections = {
			entries: {
				getOne:   vi.fn(),
				delete:   vi.fn().mockResolvedValue(undefined)
			},
			game_odds: {
				getFirstListItem: vi.fn().mockResolvedValue(null)
			}
		};
		mockPb = { collection: vi.fn((name: string) => collections[name]) };
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('deletes an entry when season is in setup status', async () => {
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			expand: { season: { status: 'setup' } }
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).toHaveBeenCalledWith('e1');
		expect((result as any).success).toBe(true);
	});

	it('deletes an entry when season is open', async () => {
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			expand: { season: { status: 'open' } }
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).toHaveBeenCalledWith('e1');
		expect((result as any).success).toBe(true);
	});

	// Use kickoff times that produce clearly past deadlines for deterministic tests.
	const PAST_KICKOFF = '2020-01-01T00:00:00Z';
	const TEST_PAST_KICKOFF = '2020-01-01T00:00:00Z';

	it('blocks delete when a real season has a past kickoff cutoff', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({ game_time_stamp: PAST_KICKOFF });
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			season: 's1',
			expand: {
				season: {
					name:   '2027 LMS',
					status: 'active',
				}
			}
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).not.toHaveBeenCalled();
		expect((result as any).status).toBe(400);
		expect((result as any).data.error).toMatch(/deadline has passed/i);
	});

	it('blocks delete when a real complete season has a past kickoff cutoff', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({ game_time_stamp: PAST_KICKOFF });
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			season: 's1',
			expand: {
				season: {
					name:   '2027 LMS',
					status: 'complete',
				}
			}
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).not.toHaveBeenCalled();
		expect((result as any).status).toBe(400);
	});

	it('allows delete on a [TEST] season even after the kickoff cutoff', async () => {
		collections.game_odds.getFirstListItem = vi.fn().mockResolvedValue({ game_time_stamp: TEST_PAST_KICKOFF });
		collections.entries.getOne = vi.fn().mockResolvedValue({
			id: 'e1',
			season: 's1',
			expand: {
				season: {
					name:   '[TEST] 2027 LMS (1h/week) 2020-01-01T00:00',
					status: 'active',
				}
			}
		});

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.delete).toHaveBeenCalledWith('e1');
		expect((result as any).success).toBe(true);
	});

	it('returns 404 when entry does not exist', async () => {
		collections.entries.getOne = vi.fn().mockRejectedValue(new Error('not found'));

		const result = await actions.deleteEntry({
			request: { formData: async () => makeFormData({ id: 'missing' }) }
		} as any);

		expect((result as any).status).toBe(404);
	});
});

describe('entries admin — markPaid', () => {
	let mockPb: any;
	let collections: Record<string, any>;

	beforeEach(() => {
		collections = {
			entries: {
				update: vi.fn().mockResolvedValue({ id: 'e1', paid: true })
			}
		};
		mockPb = { collection: vi.fn((name: string) => collections[name]) };
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('marks an entry paid with a standard method', async () => {
		const result = await actions.markPaid({
			request: { formData: async () => makeFormData({ id: 'e1', paymentMethod: 'venmo' }) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('e1', expect.objectContaining({
			paid:          true,
			paymentMethod: 'venmo',
			status:        'active'
		}));
		expect((result as any).success).toBe(true);
	});

	it('marks an entry as a free entry', async () => {
		const result = await actions.markPaid({
			request: { formData: async () => makeFormData({ id: 'e1', paymentMethod: 'free' }) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('e1', expect.objectContaining({
			paid:          true,
			paymentMethod: 'free',
			status:        'active'
		}));
		expect((result as any).success).toBe(true);
	});

	it('returns 400 when PocketBase update fails', async () => {
		collections.entries.update = vi.fn().mockRejectedValue(new Error('DB error'));

		const result = await actions.markPaid({
			request: { formData: async () => makeFormData({ id: 'e1', paymentMethod: 'cash' }) }
		} as any);

		expect((result as any).status).toBe(400);
	});
});

describe('entries admin — markUnpaid', () => {
	let mockPb: any;
	let collections: Record<string, any>;

	beforeEach(() => {
		collections = {
			entries: {
				update: vi.fn().mockResolvedValue({ id: 'e1', paid: false })
			}
		};
		mockPb = { collection: vi.fn((name: string) => collections[name]) };
		vi.mocked(pbAdmin).mockResolvedValue(mockPb);
	});

	it('reverts an entry to pending_payment', async () => {
		const result = await actions.markUnpaid({
			request: { formData: async () => makeFormData({ id: 'e1' }) }
		} as any);

		expect(collections.entries.update).toHaveBeenCalledWith('e1', expect.objectContaining({
			paid:          false,
			paymentMethod: null,
			status:        'pending_payment'
		}));
		expect((result as any).success).toBe(true);
	});
});
