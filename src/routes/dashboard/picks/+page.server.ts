import { redirect, fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import { submitPickSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

async function fetchWeekCutoff(pb: any, seasonId: string, weekNum: number): Promise<Date | null> {
	const odds = await pb.collection('game_odds').getFirstListItem(
		`season = "${seasonId}" && week = ${weekNum} && isActive = true`,
		{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
	).catch(() => null) as any;

	const kickoff = odds?.game_time_stamp ?? odds?.gameTime;
	if (!kickoff) return null;

	const cutoff = new Date(kickoff);
	cutoff.setMinutes(cutoff.getMinutes() - 40);
	return cutoff;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/picks');

	const pb      = await pbAdmin();
	const entryId = url.searchParams.get('entry') ?? '';

	if (!entryId) redirect(302, '/dashboard');

	// Load the entry — must belong to this user
	let entry: any;
	try {
		entry = await pb.collection('entries').getOne(entryId, { expand: 'season' });
	} catch {
		redirect(302, '/dashboard');
	}
	if (entry.user !== locals.user.id) redirect(302, '/dashboard');

	const season = entry.expand?.season;
	if (!season) redirect(302, '/dashboard');

	// Find the current open week for this season
	let week: any = null;
	try {
		week = await pb.collection('weekly_settings').getFirstListItem(
			`season = "${season.id}" && status = "open"`,
			{ sort: 'week' }
		);
	} catch { /* no open week */ }

	if (!week) {
		return {
			entry,
			season,
			week:          null,
			teams:         [],
			existingPick:  null,
			picksRequired: 0
		};
	}

	// Source-of-truth deadline: 40 min before first kickoff from game_odds.
	const cutoff = await fetchWeekCutoff(pb, season.id, week.week);
	if (cutoff && new Date() >= cutoff) {
		return {
			entry,
			season,
			week:          null,
			teams:         [],
			existingPick:  null,
			picksRequired: 0
		};
	}

	// How many picks are required this week for this entry type
	const picksRequired = entry.entryType === 'lms'
		? 1
		: (week.secondHalfPicksPerWeek ?? season.secondHalfPicksPerWeek ?? 1);

	// All NFL teams for the picker
	const teams = await pb.collection('nfl_teams').getFullList({ sort: 'name' });

	// Check if a pick already exists for this entry + week
	let existingPick: any = null;
	try {
		existingPick = await pb.collection('picks').getFirstListItem(
			`entry = "${entryId}" && week = "${week.id}"`,
			{ expand: 'pickedTeams' }
		);
	} catch { /* no pick yet */ }

	return {
		entry,
		season,
		week,
		teams,
		existingPick,
		picksRequired
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const pb   = await pbAdmin();
		const data = await request.formData();

		const teamIds = data.getAll('teamIds') as string[];

		const parsed = submitPickSchema.safeParse({
			entryId:   data.get('entryId'),
			weekId:    data.get('weekId'),
			entryType: data.get('entryType'),
			teamIds
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message });
		}
		const { entryId, weekId, entryType, teamIds: teams } = parsed.data;

		// Verify entry belongs to this user
		let entry: any;
		try {
			entry = await pb.collection('entries').getOne(entryId);
		} catch {
			return fail(404, { error: 'Entry not found.' });
		}
		if (entry.user !== locals.user.id) {
			return fail(403, { error: 'Not your entry.' });
		}

		// Verify week is still open
		let week: any;
		try {
			week = await pb.collection('weekly_settings').getOne(weekId);
		} catch {
			return fail(404, { error: 'Week not found.' });
		}
		if (week.status !== 'open') {
			return fail(400, { error: 'The deadline for this week has passed.' });
		}

		const cutoff = await fetchWeekCutoff(pb, entry.season, week.week);
		if (cutoff && new Date() >= cutoff) {
			return fail(400, { error: 'The deadline for this week has passed.' });
		}

		// Enforce pick count
		const season = await pb.collection('seasons').getOne(entry.season);
		const picksRequired = entryType === 'lms'
			? 1
			: (week.secondHalfPicksPerWeek ?? season.secondHalfPicksPerWeek ?? 1);

		if (teams.length !== picksRequired) {
			return fail(400, {
				error: `You must pick exactly ${picksRequired} team${picksRequired > 1 ? 's' : ''}.`
			});
		}

		// Upsert: update existing pick or create new one
		try {
			const existing = await pb.collection('picks').getFirstListItem(
				`entry = "${entryId}" && week = "${weekId}"`
			).catch(() => null);

			if (existing) {
				await pb.collection('picks').update(existing.id, {
					pickedTeams: teams,
					entryType,
					isAutoPick: false
				});
			} else {
				await pb.collection('picks').create({
					entry:       entryId,
					week:        weekId,
					pickedTeams: teams,
					entryType,
					isAutoPick:  false
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to save pick.' });
		}

		redirect(302, '/dashboard');
	}
};
