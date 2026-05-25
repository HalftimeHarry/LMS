import { pbAdmin } from '$lib/server/pb-admin';
import { fail, redirect } from '@sveltejs/kit';
import { entryRequestSchema } from '$lib/schemas';
import { SeasonProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';

/** Fetch the week-6 pick deadline for a season (the canonical 2H entry cutoff). */
async function fetchWeek6Deadline(pb: any, seasonId: string, startWeek = 6): Promise<string | null> {
	const week = await pb.collection('weekly_settings')
		.getFirstListItem(`season = "${seasonId}" && week = ${startWeek}`, { fields: 'deadline' })
		.catch(() => null) as any;
	return week?.deadline ?? null;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries/new');

	const pb             = await pbAdmin();
	const seasonProvider = new SeasonProvider(pb);

	// Fetch all active/open seasons
	const allSeasons = await seasonProvider.getAll();
	const activeSeason = allSeasons.find(s => s.status === 'active' || s.status === 'open') ?? null;

	if (!activeSeason) redirect(302, '/dashboard/entries');

	// Fetch the week-6 deadline from the LMS season (same schedule for both pools)
	const shStartWeek    = activeSeason.secondHalfStartWeek ?? 6;
	const week6Deadline  = await fetchWeek6Deadline(pb, activeSeason.id, shStartWeek);

	const lmsOpen        = SeasonProvider.isLmsOpen(activeSeason);
	const secondHalfOpen = SeasonProvider.isSecondHalfOpen(activeSeason, undefined, week6Deadline);

	if (!lmsOpen && !secondHalfOpen) redirect(302, '/dashboard/entries');

	const defaultEntryType = SeasonProvider.defaultEntryType(activeSeason, new Date(), undefined, week6Deadline);
	if (!defaultEntryType) redirect(302, '/dashboard/entries');

	return {
		seasons:        [activeSeason],
		defaultEntryType,
		lmsOpen,
		secondHalfOpen,
		week6Deadline,
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
		if (entryType === 'second_half') {
			const shStartWeek   = season.secondHalfStartWeek ?? 6;
			const week6Deadline = await fetchWeek6Deadline(pb, seasonId, shStartWeek);
			if (!SeasonProvider.isSecondHalfOpen(season, undefined, week6Deadline)) {
				const cutoff = week6Deadline ? ` The deadline was ${new Date(week6Deadline).toLocaleDateString()}.` : '';
				return fail(400, { error: `Second Half registration is closed.${cutoff}` });
			}
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
