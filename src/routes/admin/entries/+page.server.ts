import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { adminCreateEntriesSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const pb = await pbAdmin();

	const seasonFilter = url.searchParams.get('season');
	const statusFilter = url.searchParams.get('status') ?? 'pending_payment';

	const filter = [
		seasonFilter ? `season = "${seasonFilter}"` : '',
		statusFilter !== 'all' ? `status = "${statusFilter}"` : ''
	].filter(Boolean).join(' && ');

	const [entries, seasons, participants] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: filter || undefined,
			expand: 'season,user',
			sort:   '+id'
		}),
		pb.collection('seasons').getFullList({ sort: '-year' }),
		// Only users with the participant role are valid entry holders
		pb.collection('users').getFullList({
			filter: 'role = "participant"',
			sort:   'displayName',
			fields: 'id,displayName,email'
		})
	]);

	return { entries, seasons, participants, seasonFilter, statusFilter };
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

		// Continue numbering from existing entry count for this user + season
		const existing = await pb.collection('entries').getFullList({
			filter: `user = "${userId}" && season = "${seasonId}"`,
			fields: 'id'
		});
		const offset = existing.length;

		const created: string[] = [];
		try {
			for (let i = 0; i < count; i++) {
				const entryName = count === 1 && offset === 0
					? baseName
					: `${baseName} ${offset + i + 1}`;

				await pb.collection('entries').create({
					season:     seasonId,
					user:       userId,
					entryType,
					entryName,
					status:     'pending_payment',
					paid:       false,
					referredBy: referredBy || null
				});
				created.push(entryName);
			}
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create entries.', action: 'create' });
		}

		return { success: true, created, action: 'create' };
	},

	markPaid: async ({ request }) => {
		const pb = await pbAdmin();
		const data          = await request.formData();
		const id            = data.get('id')            as string;
		const paymentMethod = data.get('paymentMethod') as string;
		const paidAt        = new Date().toISOString();

		try {
			await pb.collection('entries').update(id, {
				paid:          true,
				paidAt,
				paymentMethod,
				status:        'active'
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	markUnpaid: async ({ request }) => {
		const pb = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id') as string;
		try {
			await pb.collection('entries').update(id, {
				paid:          false,
				paidAt:        null,
				paymentMethod: null,
				status:        'pending_payment'
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	deleteEntry: async ({ request }) => {
		const pb = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id') as string;
		try {
			await pb.collection('entries').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
	}
};
