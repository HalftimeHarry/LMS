import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { adminCreateEntriesSchema } from '$lib/schemas';
import { EntryProvider, SeasonProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';
import type { EntryStatus } from '$lib/providers';

export const load: PageServerLoad = async ({ url }) => {
	const pb = await pbAdmin();

	const seasonFilter = url.searchParams.get('season') ?? '';
	const statusFilter = (url.searchParams.get('status') ?? 'all') as EntryStatus | 'all';
	const poolType     = (url.searchParams.get('poolType') ?? 'all') as 'lms' | 'second_half' | 'all';

	const entryProvider  = new EntryProvider(pb);
	const seasonProvider = new SeasonProvider(pb);

	const [entries, seasons, participants] = await Promise.all([
		entryProvider.getAll({
			seasonId:  seasonFilter || undefined,
			status:    statusFilter,
			entryType: poolType !== 'all' ? poolType : undefined
		}),
		seasonProvider.getAll(),
		pb.collection('users').getFullList({
			filter: 'role = "participant"',
			sort:   'displayName',
			fields: 'id,displayName,email'
		})
	]);

	// Map seasonId → firstPickDeadline (ISO string) so the UI can gate delete per entry
	const deadlineMap: Record<string, string> = {};
	for (const s of seasons) {
		if (s.firstPickDeadline) deadlineMap[s.id] = s.firstPickDeadline;
	}

	return { entries, seasons, participants, seasonFilter, statusFilter, poolType, deadlineMap };
};

export const actions: Actions = {
	createEntries: async ({ request }) => {
		const pb  = await pbAdmin();
		const raw = await request.formData();

		const parsed = adminCreateEntriesSchema.safeParse({
			seasonId:      raw.get('seasonId'),
			userId:        raw.get('userId'),
			entryType:     raw.get('entryType'),
			count:         raw.get('count'),
			baseName:      (raw.get('baseName') as string)?.trim(),
			referredBy:    (raw.get('referredBy') as string)?.trim() || undefined,
			complimentary: raw.get('complimentary') === 'true'
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, action: 'create' });
		}
		const { seasonId, userId, entryType, count, baseName, referredBy = '', complimentary } = parsed.data;

		// Admin bypasses entry window rules — no isLmsOpen/isSecondHalfOpen check here.
		// Window enforcement only applies to participant self-registration.
		const entryProvider = new EntryProvider(pb);
		const existing      = await entryProvider.getAll({ seasonId, userId });
		const offset        = existing.length;

		const created: string[] = [];
		try {
			for (let i = 0; i < count; i++) {
				const entryName = count === 1 && offset === 0
					? baseName
					: `${baseName} ${offset + i + 1}`;
				await pb.collection('entries').create({
					season:        seasonId,
					user:          userId,
					entryType,
					entryName,
					referredBy:    referredBy || null,
					// Complimentary entries are immediately active — no payment step needed
					status:        complimentary ? 'active'          : 'pending_payment',
					paid:          complimentary ? true              : false,
					paidAt:        complimentary ? new Date().toISOString() : null,
					paymentMethod: complimentary ? 'free'            : null,
				});
				created.push(entryName);
			}
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create entries.', action: 'create' });
		}
		return { success: true, created, action: 'create' };
	},

	markPaid: async ({ request }) => {
		const pb            = await pbAdmin();
		const data          = await request.formData();
		const id            = data.get('id')            as string;
		const paymentMethod = data.get('paymentMethod') as string;
		try {
			await pb.collection('entries').update(id, {
				paid: true, paidAt: new Date().toISOString(), paymentMethod, status: 'active'
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	markUnpaid: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id') as string;
		try {
			await pb.collection('entries').update(id, {
				paid: false, paidAt: null, paymentMethod: null, status: 'pending_payment'
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	deleteEntry: async ({ request }) => {
		const pb            = await pbAdmin();
		const data          = await request.formData();
		const id            = data.get('id') as string;
		const entryProvider = new EntryProvider(pb);

		let entry: any;
		try {
			entry = await entryProvider.getById(id);
		} catch {
			return fail(404, { error: 'Entry not found.' });
		}

		const deadline = entry.expand?.season?.firstPickDeadline;
		if (deadline && new Date() > new Date(deadline)) {
			return fail(400, {
				error: 'The first-game deadline has passed. Entries can no longer be deleted — change the entry status instead.'
			});
		}
		try {
			await pb.collection('entries').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
	},

	bulkMarkPaid: async ({ request }) => {
		const pb            = await pbAdmin();
		const data          = await request.formData();
		const ids           = data.getAll('ids') as string[];
		const paymentMethod = data.get('paymentMethod') as string;

		if (!ids.length)      return fail(400, { error: 'No entries selected.' });
		if (!paymentMethod)   return fail(400, { error: 'Payment method required.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				await pb.collection('entries').update(id, {
					paid: true, paidAt: new Date().toISOString(), paymentMethod, status: 'active'
				});
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some updates failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	},

	bulkSetStatus: async ({ request }) => {
		const pb     = await pbAdmin();
		const data   = await request.formData();
		const ids    = data.getAll('ids') as string[];
		const status = data.get('status') as string;

		if (!ids.length) return fail(400, { error: 'No entries selected.' });
		if (!status)     return fail(400, { error: 'Status required.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				const patch: Record<string, unknown> = { status };
				// Keep paid flag consistent when activating
				if (status === 'active') patch.paid = true;
				await pb.collection('entries').update(id, patch);
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some updates failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	},

	bulkSetInactive: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const ids  = data.getAll('ids') as string[];

		if (!ids.length) return fail(400, { error: 'No entries selected.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				await pb.collection('entries').update(id, { status: 'eliminated' });
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some updates failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	}
};
