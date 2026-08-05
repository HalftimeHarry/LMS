import { fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const pb           = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';
	const weekParam    = url.searchParams.get('week');
	const seasonParam  = url.searchParams.get('season') ?? null;

	const allSeasons = await pb.collection('seasons').getFullList({ sort: '-year' }) as any[];

	// pool_admin never sees [TEST] seasons
	const seasons = isSuperAdmin
		? allSeasons
		: allSeasons.filter((s: any) => !s.name?.includes('[TEST]'));

	// For pool_admin: auto-select the active LMS season — no dropdown needed.
	// Games are shared across LMS and 2H so one season's odds covers both pools.
	// For super_admin: honour explicit ?season= param, fall back to first active.
	let activeSeason: any = null;
	if (isSuperAdmin) {
		activeSeason = seasonParam
			? (seasons.find((s: any) => s.id === seasonParam) ?? null)
			: null;
	} else {
		// Auto-pick: prefer active LMS season, then any active/open season
		activeSeason =
			seasons.find((s: any) => (s.status === 'active' || s.status === 'open') && s.lmsEnabled !== false && s.secondHalfEnabled !== true) ??
			seasons.find((s: any) => s.status === 'active' || s.status === 'open') ??
			seasons[0] ?? null;
	}

	if (!activeSeason) {
		return { seasons, activeSeason: null, weekNum: 1, games: [], teams: [], weekSummary: [], isSuperAdmin };
	}

	// Default to the current open week for this season when no ?week= param is set
	let weekNum = weekParam ? Number(weekParam) : 1;
	if (!weekParam) {
		const openWeek = await pb.collection('weekly_settings')
			.getFirstListItem(`season = "${activeSeason.id}" && status = "open"`, { sort: 'week' })
			.catch(() => null) as any;
		if (openWeek) weekNum = openWeek.week;
	}

	// All teams for display
	const teams = await pb.collection('nfl_teams').getFullList({ sort: 'abbreviation' }).catch(() => []) as any[];

	// Games for the selected week
	const games = await pb.collection('game_odds').getFullList({
		filter: `season = "${activeSeason.id}" && week = ${weekNum}`,
		expand: 'homeTeam,awayTeam',
		sort:   'game_time_stamp'
	}).catch(() => []) as any[];

	// Week summary — how many games exist and are active per week (for the week nav)
	const allGames = await pb.collection('game_odds').getFullList({
		filter: `season = "${activeSeason.id}"`,
		fields: 'week,isActive,homeSpread'
	}).catch(() => []) as any[];

	const weekSummaryMap: Record<number, { total: number; active: number; hasOdds: number }> = {};
	for (const g of allGames) {
		const w = g.week as number;
		if (!weekSummaryMap[w]) weekSummaryMap[w] = { total: 0, active: 0, hasOdds: 0 };
		weekSummaryMap[w].total++;
		if (g.isActive)    weekSummaryMap[w].active++;
		if (g.homeSpread != null) weekSummaryMap[w].hasOdds++;
	}
	const weekSummary = Object.entries(weekSummaryMap)
		.map(([w, s]) => ({ week: Number(w), ...s }))
		.sort((a, b) => a.week - b.week);

	// Weekly setting for this week (used to apply auto-pick)
	const weekSetting = await pb.collection('weekly_settings').getFirstListItem(
		`season = "${activeSeason.id}" && week = ${weekNum}`
	).catch(() => null) as any;

	return {
		seasons:      seasons      as any[],
		activeSeason,
		weekNum,
		games:        games        as any[],
		teams:        teams        as any[],
		weekSummary:  weekSummary  as any[],
		weekSetting:  weekSetting  ?? null,
		isSuperAdmin,
	};
};

export const actions: Actions = {
	/** Save spread + moneylines for one or more games */
	saveOdds: async ({ request, locals }) => {
		if (locals.role !== 'pool_admin') {
			return fail(403, { error: 'Only pool admins can edit odds.' });
		}

		const pb   = await pbAdmin();
		const data = await request.formData();

		// Form sends: gameId_homeSpread, gameId_homeMoneyline, gameId_awayMoneyline, gameId_gameTime, gameId_notes
		const gameIds = [...new Set(
			[...data.keys()]
				.filter(k => k.includes('_'))
				.map(k => k.split('_')[0])
		)];

		let saved = 0;
		const errors: string[] = [];

		for (const id of gameIds) {
			const homeSpread    = data.get(`${id}_homeSpread`);
			const homeMoneyline = data.get(`${id}_homeMoneyline`);
			const awayMoneyline = data.get(`${id}_awayMoneyline`);
			const gameTimeRaw   = data.get(`${id}_gameTime`);
			const notesRaw      = data.get(`${id}_notes`);

			let gameTimeStamp: string | null = null;
			if (gameTimeRaw != null && String(gameTimeRaw).trim() !== '') {
				const parsed = new Date(String(gameTimeRaw));
				if (Number.isNaN(parsed.getTime())) {
					errors.push(`${id}: invalid game time`);
					continue;
				}
				gameTimeStamp = parsed.toISOString();
			}

			try {
				await pb.collection('game_odds').update(id, {
					homeSpread:    homeSpread    !== '' && homeSpread    != null ? Number(homeSpread)    : null,
					homeMoneyline: homeMoneyline !== '' && homeMoneyline != null ? Number(homeMoneyline) : null,
					awayMoneyline: awayMoneyline !== '' && awayMoneyline != null ? Number(awayMoneyline) : null,
					game_time_stamp: gameTimeStamp,
					notes: notesRaw != null && String(notesRaw).trim() !== '' ? String(notesRaw).trim() : null,
				});
				saved++;
			} catch (e: any) {
				errors.push(`${id}: ${e.message}`);
			}
		}

		if (errors.length) return fail(400, { error: errors.join('; ') });
		return { success: true, saved };
	},

	/** Toggle isActive for all games in a week */
	activateWeek: async ({ request, locals }) => {
		if (locals.role !== 'pool_admin') {
			return fail(403, { error: 'Only pool admins can edit odds.' });
		}

		const pb   = await pbAdmin();
		const data = await request.formData();
		const seasonId = data.get('seasonId') as string;
		const weekNum  = Number(data.get('week'));
		const activate = data.get('activate') === 'true';

		const games = await pb.collection('game_odds').getFullList({
			filter: `season = "${seasonId}" && week = ${weekNum}`,
			fields: 'id'
		}).catch(() => []) as any[];

		for (const g of games) {
			await pb.collection('game_odds').update(g.id, { isActive: activate }).catch(() => {});
		}

		return { success: true, activated: activate };
	},

	/** Set biggestFavoriteTeam on the weekly_settings record from odds data */
	applyAutoPickFromOdds: async ({ request, locals }) => {
		if (locals.role !== 'pool_admin') {
			return fail(403, { error: 'Only pool admins can edit odds.' });
		}

		const pb   = await pbAdmin();
		const data = await request.formData();
		const weekSettingId = data.get('weekSettingId') as string;
		const teamId        = data.get('teamId')        as string;

		try {
			await pb.collection('weekly_settings').update(weekSettingId, {
				biggestFavoriteTeam: teamId || null
			});
		} catch (e: any) {
			return fail(400, { error: e.message });
		}
		return { success: true };
	},
};
