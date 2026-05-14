import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { fail } from '@sveltejs/kit';
import { adminCreateEntriesSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

async function adminPb(cookies: import('@sveltejs/kit').Cookies) {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	const cookie = cookies.get('pb_auth');
	if (cookie) {
		const { token, record } = JSON.parse(cookie);
		pb.authStore.save(token, record);
	}
	return pb;
}

export const load: PageServerLoad = async ({ cookies, url }) => {
	const pb = await adminPb(cookies);

	const seasonFilter = url.searchParams.get('season');
	const statusFilter = url.searchParams.get('status') ?? 'pending_payment';

	const filter = [
		seasonFilter ? `season = "${seasonFilter}"` : '',
		statusFilter !== 'all' ? `status = "${statusFilter}"` : ''
	].filter(Boolean).join(' && ');

	const [entries, seasons, users] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: filter || undefined,
			expand: 'season,user',
			sort:   'status,created'
		}),
		pb.collection('seasons').getFullList({ sort: '-year' }),
		pb.collection('users').getFullList({ sort: 'displayName', fields: 'id,displayName,email' })
	]);

	return { entries, seasons, users, seasonFilter, statusFilter };
};

export const actions: Actions = {
	createEntries: async ({ request, cookies }) => {
		const pb  = await adminPb(cookies);
		const raw = await request.formData();

		const parsed = adminCreateEntriesSchema.safeParse({
			seasonId:   raw.get('seasonId'),
			userId:     raw.get('userId'),
			count:      raw.get('count'),
			baseName:   (raw.get('baseName') as string)?.trim(),
			referredBy: (raw.get('referredBy') as string)?.trim() || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, action: 'create' });
		}
		const { seasonId, userId, count, baseName, referredBy = '' } = parsed.data;

		// Find how many entries this user already has in this season
		// so we can continue numbering from the right offset
		const existing = await pb.collection('entries').getFullList({
			filter: `user = "${userId}" && season = "${seasonId}"`,
			fields: 'id'
		});
		const offset = existing.length;

		const created: string[] = [];
		try {
			for (let i = 0; i < count; i++) {
				const entryName = count === 1 && offset === 0
					? baseName                              // single entry, no number suffix
					: `${baseName} ${offset + i + 1}`;     // e.g. "Dustin Entry 2"

				await pb.collection('entries').create({
					season:     seasonId,
					user:       userId,
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

	markPaid: async ({ request, cookies }) => {
		const pb = await adminPb(cookies);
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

	markUnpaid: async ({ request, cookies }) => {
		const pb = await adminPb(cookies);
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

	deleteEntry: async ({ request, cookies }) => {
		const pb = await adminPb(cookies);
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
