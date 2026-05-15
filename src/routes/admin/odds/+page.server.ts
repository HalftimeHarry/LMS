import { fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const pb      = await pbAdmin();
	const weekNum = Number(url.searchParams.get('week') ?? 1);

	const seasons = await pb.collection('seasons').getFullList({ sort: '-year' });
	const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'open') ?? seasons[0] ?? null;

	if (!activeSeason) {
		return { activeSeason: null, weekNum, games: [], teams: [], weekSummary: [] };
	}

	// All teams for display
	const teams = await pb.collection('nfl_teams').getFullList({ sort: 'abbreviation' }).catch(() => []) as any[];

	// Games for the selected week
	const games = await pb.collection('game_odds').getFullList({
		filter: `season = "${activeSeason.id}" && week = ${weekNum}`,
		expand: 'homeTeam,awayTeam',
		sort:   'gameTime'
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
		activeSeason,
		weekNum,
		games:       games       as any[],
		teams:       teams       as any[],
		weekSummary: weekSummary as any[],
		weekSetting: weekSetting ?? null,
	};
};

export const actions: Actions = {
	/** Save spread + moneylines for one or more games */
	saveOdds: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		// Form sends: gameId_homeSpread, gameId_homeMoneyline, gameId_awayMoneyline
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

			try {
				await pb.collection('game_odds').update(id, {
					homeSpread:    homeSpread    !== '' && homeSpread    != null ? Number(homeSpread)    : null,
					homeMoneyline: homeMoneyline !== '' && homeMoneyline != null ? Number(homeMoneyline) : null,
					awayMoneyline: awayMoneyline !== '' && awayMoneyline != null ? Number(awayMoneyline) : null,
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
	activateWeek: async ({ request }) => {
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
	applyAutoPickFromOdds: async ({ request }) => {
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
