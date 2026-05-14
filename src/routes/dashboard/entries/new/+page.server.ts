import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { fail, redirect } from '@sveltejs/kit';
import { entryRequestSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries/new');

	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	const cookie = cookies.get('pb_auth');
	if (cookie) {
		const { token, record } = JSON.parse(cookie);
		pb.authStore.save(token, record);
	}

	const seasons = await pb.collection('seasons').getFullList({
		filter: 'status = "open"',
		sort:   '-year'
	});

	if (seasons.length === 0) redirect(302, '/dashboard/entries');

	return { seasons };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		const cookie = cookies.get('pb_auth');
		if (cookie) {
			const { token, record } = JSON.parse(cookie);
			pb.authStore.save(token, record);
		}

		const raw = await request.formData();
		const parsed = entryRequestSchema.safeParse({
			seasonId:   raw.get('seasonId'),
			entryName:  (raw.get('entryName') as string)?.trim(),
			referredBy: (raw.get('referredBy') as string)?.trim() || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message });
		}
		const { seasonId, entryName, referredBy = '' } = parsed.data;

		// Prevent duplicate entry names for same user + season
		const existing = await pb.collection('entries').getList(1, 1, {
			filter: `user = "${locals.user.id}" && season = "${seasonId}" && entryName = "${entryName}"`
		});
		if (existing.totalItems > 0) {
			return fail(400, { error: 'You already have an entry with that name in this season.' });
		}

		try {
			await pb.collection('entries').create({
				season:     seasonId,
				user:       locals.user.id,
				entryName,
				status:     'pending_payment',
				paid:       false,
				referredBy: referredBy || null
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create entry.' });
		}

		redirect(302, '/dashboard/entries');
	}
};
