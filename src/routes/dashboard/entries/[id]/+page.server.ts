import { redirect, fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import { submitPickSchema } from '$lib/schemas';
import { SeasonProvider } from '$lib/providers/SeasonProvider';
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

	// Load open weeks (pickable) AND locked/results_pending/complete weeks (read-only)
	let allWeeks: any[] = [];
	if (season) {
		allWeeks = await pb
			.collection('weekly_settings')
			.getFullList({
				filter: `season = "${season.id}" && (status = "open" || status = "locked" || status = "results_pending" || status = "complete")`,
				sort: 'week',
				expand: 'biggestFavoriteTeam'
			})
			.catch(() => []);
	}

	// 2H entries may only see weeks >= secondHalfStartWeek
	const secondHalfStartWeek = entry.entryType === 'second_half'
		? (season?.secondHalfStartWeek ?? 6)
		: 0;
	const visibleWeeks = allWeeks.filter(w => w.week >= secondHalfStartWeek);

	const openWeeks   = visibleWeeks.filter(w => w.status === 'open');
	const closedWeeks = visibleWeeks.filter(w => w.status !== 'open');

	// All NFL teams (only needed for the open-week picker)
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

	// For each open week, compute which team IDs are already used in OTHER weeks
	const usedByWeek: Record<string, string[]> = {};
	for (const week of openWeeks) {
		const usedElsewhere = new Set<string>();
		for (const [wId, pick] of Object.entries(pickByWeek)) {
			if (wId === week.id) continue;
			for (const t of pick.expand?.pickedTeams ?? []) {
				usedElsewhere.add(t.id);
			}
		}
		usedByWeek[week.id] = [...usedElsewhere];
	}

	// Per-week picks required: LMS always 1; 2H uses ramp (1 for weeks 6-9, 2 from week 10+)
	const picksRequiredByWeek: Record<string, number> = {};
	for (const w of openWeeks) {
		picksRequiredByWeek[w.id] = entry.entryType === 'lms'
			? 1
			: SeasonProvider.secondHalfPicksForWeek(season, w.week);
	}

	const isLms = entry.entryType === 'lms';

	// ── Odds for open weeks ───────────────────────────────────────────────────
	// Fetch active game_odds for every open week in one query, then group by week id.
	const oddsRaw: any[] = openWeeks.length
		? await pb.collection('game_odds').getFullList({
				filter: `season = "${season.id}" && isActive = true && (${openWeeks.map(w => `week = ${w.week}`).join(' || ')})`,
				expand: 'homeTeam,awayTeam',
				sort:   'gameTime'
			}).catch(() => [])
		: [];

	// Group odds by weekly_settings id (match on week number)
	const weekNumToId: Record<number, string> = {};
	for (const w of openWeeks) weekNumToId[w.week] = w.id;

	const oddsByWeek: Record<string, any[]> = {};
	for (const g of oddsRaw) {
		const wid = weekNumToId[g.week];
		if (!wid) continue;
		if (!oddsByWeek[wid]) oddsByWeek[wid] = [];
		oddsByWeek[wid].push(g);
	}

	// Build a teamId → spread map for each week (used to annotate the team picker)
	// spread value = how favored that team is (negative = underdog, positive = favorite)
	// For LMS: we want to highlight the biggest FAVORITE (most likely to win = safest loser pick)
	// For 2nd Half: we want to highlight the biggest FAVORITE (most likely to win)
	const teamSpreadByWeek: Record<string, Record<string, number>> = {};
	for (const [wid, games] of Object.entries(oddsByWeek)) {
		teamSpreadByWeek[wid] = {};
		for (const g of games) {
			const homeId = g.expand?.homeTeam?.id;
			const awayId = g.expand?.awayTeam?.id;
			if (homeId) teamSpreadByWeek[wid][homeId] = -(g.homeSpread ?? 0); // positive = favored
			if (awayId) teamSpreadByWeek[wid][awayId] =  (g.homeSpread ?? 0); // away spread = -homeSpread
		}
	}

	// Compute 3 recommendations per open week
	// LMS: top 3 biggest favorites (most negative homeSpread when home, most positive when away)
	//      — avoid teams already used by this entry
	// 2nd Half: top 3 biggest favorites (same logic — pick winners)
	const usedTeamIds = new Set<string>();
	for (const pick of Object.values(pickByWeek)) {
		for (const t of pick.expand?.pickedTeams ?? []) usedTeamIds.add(t.id);
	}

	const recommendationsByWeek: Record<string, Array<{
		teamId: string; abbreviation: string; city: string; name: string;
		spread: number; moneyline: number | null; opponent: string; isHome: boolean;
		isAutoPick: boolean; alreadyUsed: boolean;
	}>> = {};

	for (const [wid, games] of Object.entries(oddsByWeek)) {
		const week = openWeeks.find(w => w.id === wid);
		const autoPickTeamId = week?.biggestFavoriteTeam ?? null;

		// Build candidate list — one entry per team per game
		const candidates: any[] = [];
		for (const g of games) {
			const home = g.expand?.homeTeam;
			const away = g.expand?.awayTeam;
			if (!home || !away) continue;

			// Effective spread from each team's perspective (positive = favored)
			const homeEffective = -(g.homeSpread ?? 0);
			const awayEffective =  (g.homeSpread ?? 0);

			candidates.push({
				teamId:      home.id,
				abbreviation:home.abbreviation,
				city:        home.city,
				name:        home.name,
				spread:      homeEffective,
				moneyline:   g.homeMoneyline ?? null,
				opponent:    `${away.abbreviation}`,
				isHome:      true,
				isAutoPick:  home.id === autoPickTeamId,
				alreadyUsed: usedTeamIds.has(home.id),
			});
			candidates.push({
				teamId:      away.id,
				abbreviation:away.abbreviation,
				city:        away.city,
				name:        away.name,
				spread:      awayEffective,
				moneyline:   g.awayMoneyline ?? null,
				opponent:    `${home.abbreviation}`,
				isHome:      false,
				isAutoPick:  away.id === autoPickTeamId,
				alreadyUsed: usedTeamIds.has(away.id),
			});
		}

		// Sort by spread descending (biggest favorite first), then pick top 3 not already used
		// Always include the auto-pick team if set, even if already used
		candidates.sort((a, b) => b.spread - a.spread);

		const recs: typeof candidates = [];
		// First pass: top 3 available (not already used)
		for (const c of candidates) {
			if (recs.length >= 3) break;
			if (!c.alreadyUsed) recs.push(c);
		}
		// If auto-pick team isn't already in recs, prepend it (it's the default fallback)
		if (autoPickTeamId) {
			const autoInRecs = recs.some(r => r.teamId === autoPickTeamId);
			if (!autoInRecs) {
				const autoCand = candidates.find(c => c.teamId === autoPickTeamId);
				if (autoCand) recs.unshift(autoCand);
				if (recs.length > 3) recs.pop();
			}
		}

		recommendationsByWeek[wid] = recs;
	}

	return {
		entry,
		season,
		openWeeks:           openWeeks           as any[],
		closedWeeks:         closedWeeks         as any[],
		teams:               teams               as any[],
		pickByWeek,
		usedByWeek,
		picksRequiredByWeek,
		oddsByWeek,
		teamSpreadByWeek,
		recommendationsByWeek,
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
		if (entry.status === 'eliminated') {
			return fail(403, { error: 'This entry has been eliminated and cannot submit picks.' });
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

		const season = await pb.collection('seasons').getOne(entry.season) as unknown as import('$lib/providers/SeasonProvider').Season;
		const picksRequired = entryType === 'lms'
			? 1
			: SeasonProvider.secondHalfPicksForWeek(season, week.week);

		if (teams.length !== picksRequired) {
			return fail(400, {
				error: `You must pick exactly ${picksRequired} team${picksRequired > 1 ? 's' : ''}.`
			});
		}

		// Enforce once-per-season rule
		const otherPicks = await pb.collection('picks').getFullList({
			filter: `entry = "${entryId}"`,
			expand: 'pickedTeams'
		}).catch(() => []);

		const usedElsewhere = new Set<string>();
		for (const p of otherPicks) {
			if (p.week === weekId) continue;
			for (const t of p.expand?.pickedTeams ?? []) {
				usedElsewhere.add(t.id);
			}
		}

		const conflict = teams.find((id) => usedElsewhere.has(id));
		if (conflict) {
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

		redirect(302, `/dashboard/entries/${entryId}?pickSaved=1`);
	}
};
