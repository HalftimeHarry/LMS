import { redirect, fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import { submitPickSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard');

	const pb = await pbAdmin();

	let entry: any;
	try {
		entry = await pb.collection('entries').getOne(params.id, { expand: 'season' });
	} catch {
		redirect(302, '/dashboard');
	}
	if (entry.user !== locals.user.id) redirect(302, '/dashboard');

	const season = entry.expand?.season ?? null;

	// All open weeks for this season, sorted ascending
	let openWeeks: any[] = [];
	if (season) {
		openWeeks = await pb
			.collection('weekly_settings')
			.getFullList({ filter: `season = "${season.id}" && status = "open"`, sort: 'week' })
			.catch(() => []);
	}

	// All NFL teams
	const teams = openWeeks.length
		? await pb.collection('nfl_teams').getFullList({ sort: 'name' }).catch(() => [])
		: [];

	// All existing picks for this entry
	let existingPicks: any[] = [];
	try {
		existingPicks = await pb.collection('picks').getFullList({
			filter: `entry = "${entry.id}"`,
			expand: 'week,pickedTeams',
			sort: '-id'
		});
	} catch (e: any) {
		console.error('[entry load] picks query failed:', e?.status, e?.message);
	}

	// Index picks by weekId
	const pickByWeek: Record<string, any> = {};
	for (const p of existingPicks) {
		pickByWeek[p.week] = p;
	}

	// For each week, compute which team IDs are already used in OTHER weeks.
	// A team used in week N is unavailable in all other weeks — unless that
	// week's pick is changed (so we exclude the current week from the used set).
	const usedByWeek: Record<string, string[]> = {};
	for (const week of openWeeks) {
		const usedElsewhere = new Set<string>();
		for (const [wId, pick] of Object.entries(pickByWeek)) {
			if (wId === week.id) continue; // exclude this week's own pick
			for (const t of pick.expand?.pickedTeams ?? []) {
				usedElsewhere.add(t.id);
			}
		}
		usedByWeek[week.id] = [...usedElsewhere];
	}

	const picksRequired = entry.entryType === 'lms'
		? 1
		: (season?.secondHalfPicksPerWeek ?? 1);

	return {
		entry,
		season,
		openWeeks:    openWeeks as any[],
		teams:        teams     as any[],
		pickByWeek,
		usedByWeek,
		picksRequired
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
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

		let entry: any;
		try {
			entry = await pb.collection('entries').getOne(entryId);
		} catch {
			return fail(404, { error: 'Entry not found.' });
		}
		if (entry.user !== locals.user.id) {
			return fail(403, { error: 'Not your entry.' });
		}

		let week: any;
		try {
			week = await pb.collection('weekly_settings').getOne(weekId);
		} catch {
			return fail(404, { error: 'Week not found.' });
		}
		if (week.status !== 'open') {
			return fail(400, { error: 'The deadline for this week has passed.' });
		}

		const season = await pb.collection('seasons').getOne(entry.season);
		const picksRequired = entryType === 'lms'
			? 1
			: (week.secondHalfPicksPerWeek ?? season.secondHalfPicksPerWeek ?? 1);

		if (teams.length !== picksRequired) {
			return fail(400, {
				error: `You must pick exactly ${picksRequired} team${picksRequired > 1 ? 's' : ''}.`
			});
		}

		// Enforce once-per-season rule: check no picked team is already used in another week
		const otherPicks = await pb.collection('picks').getFullList({
			filter: `entry = "${entryId}"`,
			expand: 'pickedTeams'
		}).catch(() => []);

		const usedElsewhere = new Set<string>();
		for (const p of otherPicks) {
			if (p.week === weekId) continue; // skip the week being updated
			for (const t of p.expand?.pickedTeams ?? []) {
				usedElsewhere.add(t.id);
			}
		}

		const conflict = teams.find((id) => usedElsewhere.has(id));
		if (conflict) {
			// Fetch team name for a helpful error message
			const team = await pb.collection('nfl_teams').getOne(conflict).catch(() => null);
			const name = team ? `${team.city} ${team.name}` : 'That team';
			return fail(400, { error: `${name} is already used in another week. Each team can only be picked once per season.` });
		}

		try {
			const existing = await pb.collection('picks')
				.getFirstListItem(`entry = "${entryId}" && week = "${weekId}"`)
				.catch(() => null);

			if (existing) {
				await pb.collection('picks').update(existing.id, {
					pickedTeams: teams, entryType, isAutoPick: false
				});
			} else {
				await pb.collection('picks').create({
					entry: entryId, week: weekId, pickedTeams: teams, entryType, isAutoPick: false
				});
			}
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to save pick.' });
		}

		redirect(302, `/dashboard/entries/${params.id}`);
	}
};
