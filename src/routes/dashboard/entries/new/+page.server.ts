import { pbAdmin } from '$lib/server/pb-admin';
import { fail, redirect } from '@sveltejs/kit';
import { entryRequestSchema } from '$lib/schemas';
import { SeasonProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries/new');

	const pb             = await pbAdmin();
	const seasonProvider = new SeasonProvider(pb);

	// Only seasons that have at least one open entry window
	const allSeasons = await seasonProvider.getAll();
	const seasons    = allSeasons.filter(s =>
		SeasonProvider.isLmsOpen(s) || SeasonProvider.isSecondHalfOpen(s)
	);

	if (seasons.length === 0) redirect(302, '/dashboard/entries');

	const season          = seasons[0];
	const defaultEntryType = SeasonProvider.defaultEntryType(season);

	// If no window is open (shouldn't happen given filter above, but guard anyway)
	if (!defaultEntryType) redirect(302, '/dashboard/entries');

	return {
		seasons,
		defaultEntryType,
		// Pass window state so the UI can show/disable options without extra fetches
		lmsOpen:        SeasonProvider.isLmsOpen(season),
		secondHalfOpen: SeasonProvider.isSecondHalfOpen(season)
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const pb  = await pbAdmin();
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

		const seasonProvider = new SeasonProvider(pb);
		const season = await seasonProvider.getById(seasonId).catch(() => null);
		if (!season) return fail(400, { error: 'Season not found.' });

		// Enforce entry windows — participants cannot bypass these
		if (entryType === 'lms' && !SeasonProvider.isLmsOpen(season)) {
			return fail(400, { error: 'LMS registration is closed. The first pick deadline has passed.' });
		}
		if (entryType === 'second_half' && !SeasonProvider.isSecondHalfOpen(season)) {
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
