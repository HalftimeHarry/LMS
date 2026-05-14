import { pbAdmin } from '$lib/server/pb-admin';
import { fail, redirect } from '@sveltejs/kit';
import { entryRequestSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries/new');

	const pb = await pbAdmin();

	// Allow both open (pre-season) and active (in-season) seasons
	const seasons = await pb.collection('seasons').getFullList({
		filter: 'status = "open" || status = "active"',
		sort:   '-year'
	});

	if (seasons.length === 0) redirect(302, '/dashboard/entries');

	// Default entry type: lms before season starts, second_half once active
	const defaultEntryType = seasons[0]?.status === 'active' ? 'second_half' : 'lms';

	return { seasons, defaultEntryType };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const pb = await pbAdmin();

		const raw = await request.formData();
		const parsed = entryRequestSchema.safeParse({
			seasonId:   raw.get('seasonId'),
			entryType:  raw.get('entryType'),
			entryName:  (raw.get('entryName') as string)?.trim(),
			referredBy: (raw.get('referredBy') as string)?.trim() || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message });
		}
		const { seasonId, entryType, entryName, referredBy = '' } = parsed.data;

		// Validate entry type is allowed for the season's current status
		const season = await pb.collection('seasons').getOne(seasonId).catch(() => null);
		if (!season) return fail(400, { error: 'Season not found.' });

		if (season.status === 'open' && entryType === 'second_half') {
			return fail(400, { error: 'Second Half entries are only available once the season is active.' });
		}

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
				entryType,
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
