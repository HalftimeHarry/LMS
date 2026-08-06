import { pbAdmin } from '$lib/server/pb-admin';
import { fail, redirect } from '@sveltejs/kit';
import { entryRequestSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

function deriveCutoffFromKickoff(kickoffIso: string): string {
	const cutoff = new Date(kickoffIso);
	cutoff.setMinutes(cutoff.getMinutes() - 40);
	return cutoff.toISOString();
}

/** Fetch first kickoff for a given week from game_odds (canonical source). */
async function fetchWeekKickoff(pb: any, seasonId: string, weekNum: number): Promise<string | null> {
	const odds = await pb.collection('game_odds')
		.getFirstListItem(
			`season = "${seasonId}" && week = ${weekNum} && isActive = true`,
			{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
		)
		.catch(() => null) as any;

	return odds?.game_time_stamp ?? odds?.gameTime ?? null;
}

/** Fetch the week-6 pick deadline for a season (the canonical 2H entry cutoff). */
async function fetchWeek6Deadline(pb: any, seasonId: string, startWeek = 6): Promise<string | null> {
	const week = await pb.collection('weekly_settings')
		.getFirstListItem(`season = "${seasonId}" && week = ${startWeek}`, { fields: 'deadline' })
		.catch(() => null) as any;
	return week?.deadline ?? null;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries/new');

	const pb = await pbAdmin();

	// Fetch all active/open seasons
	const allSeasons = await pb.collection('seasons').getFullList({ sort: '-year' }) as any[];
	const activeSeason = allSeasons.find(s => s.status === 'active' || s.status === 'open') ?? null;

	if (!activeSeason) redirect(302, '/dashboard/entries');

	const now = new Date();

	// Fetch kickoff-derived cutoffs (source of truth)
	const shStartWeek = activeSeason.secondHalfStartWeek ?? 6;
	const [week1Kickoff, shKickoff] = await Promise.all([
		fetchWeekKickoff(pb, activeSeason.id, 1),
		fetchWeekKickoff(pb, activeSeason.id, shStartWeek)
	]);

	const lmsDeadline = week1Kickoff ? deriveCutoffFromKickoff(week1Kickoff) : null;
	const shDeadlineFromOdds = shKickoff ? deriveCutoffFromKickoff(shKickoff) : null;
	const shDeadlineFallback = await fetchWeek6Deadline(pb, activeSeason.id, shStartWeek);
	const week6Deadline = shDeadlineFromOdds ?? shDeadlineFallback;

	const lmsOpen = activeSeason.lmsEnabled !== false
		&& activeSeason.status === 'open'
		&& (!lmsDeadline || now < new Date(lmsDeadline));

	const secondHalfOpen = activeSeason.secondHalfEnabled !== false
		&& activeSeason.status === 'active'
		&& (!!week6Deadline && now < new Date(week6Deadline));

	const defaultEntryType = lmsOpen ? 'lms' : (secondHalfOpen ? 'second_half' : null);

	if (!lmsOpen && !secondHalfOpen) redirect(302, '/dashboard/entries');
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

		const season = await pb.collection('seasons').getOne(seasonId).catch(() => null) as any;
		if (!season) return fail(400, { error: 'Season not found.' });

		const now = new Date();

		// Enforce entry windows — participants cannot bypass these
		if (entryType === 'lms') {
			const week1Kickoff = await fetchWeekKickoff(pb, seasonId, 1);
			const lmsDeadline = week1Kickoff ? deriveCutoffFromKickoff(week1Kickoff) : null;
			const lmsOpen = season.lmsEnabled !== false
				&& season.status === 'open'
				&& (!lmsDeadline || now < new Date(lmsDeadline));
			if (!lmsOpen) {
				return fail(400, { error: 'LMS registration is closed. The first pick deadline has passed.' });
			}
		}

		if (entryType === 'second_half') {
			const shStartWeek   = season.secondHalfStartWeek ?? 6;
			const shKickoff = await fetchWeekKickoff(pb, seasonId, shStartWeek);
			const shDeadlineFromOdds = shKickoff ? deriveCutoffFromKickoff(shKickoff) : null;
			const shDeadlineFallback = await fetchWeek6Deadline(pb, seasonId, shStartWeek);
			const week6Deadline = shDeadlineFromOdds ?? shDeadlineFallback;

			const secondHalfOpen = season.secondHalfEnabled !== false
				&& season.status === 'active'
				&& (!!week6Deadline && now < new Date(week6Deadline));

			if (!secondHalfOpen) {
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
