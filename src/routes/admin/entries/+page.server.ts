import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { adminCreateEntriesSchema } from '$lib/schemas';
import { EntryProvider, SeasonProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';
import type { EntryStatus } from '$lib/providers';

export const load: PageServerLoad = async ({ url }) => {
	const pb = await pbAdmin();

	const seasonFilter = url.searchParams.get('season') ?? '';
	const statusFilter = (url.searchParams.get('status') ?? 'pending_payment') as EntryStatus | 'all';
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

	return { entries, seasons, participants, seasonFilter, statusFilter, poolType };
};

export const actions: Actions = {
	createEntries: async ({ request }) => {
		const pb  = await pbAdmin();
		const raw = await request.formData();

		const parsed = adminCreateEntriesSchema.safeParse({
			seasonId:   raw.get('seasonId'),
			userId:     raw.get('userId'),
			entryType:  raw.get('entryType'),
			count:      raw.get('count'),
			baseName:   (raw.get('baseName') as string)?.trim(),
			referredBy: (raw.get('referredBy') as string)?.trim() || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, action: 'create' });
		}
		const { seasonId, userId, entryType, count, baseName, referredBy = '' } = parsed.data;

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
					season: seasonId, user: userId, entryType, entryName,
					status: 'pending_payment', paid: false, referredBy: referredBy || null
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

		const seasonStatus = entry.expand?.season?.status ?? '';
		if (seasonStatus === 'active' || seasonStatus === 'complete') {
			return fail(400, {
				error: 'Entries cannot be deleted once the season has started. Edit the entry status instead.'
			});
		}
		try {
			await pb.collection('entries').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
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
