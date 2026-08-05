import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();

	// Find the active/open season (prefer real over test)
	const seasonsRaw = await pb.collection('seasons').getFullList({ sort: '-year' }).catch(() => []) as any[];
	const seasons = seasonsRaw.sort((a: any, b: any) => {
		const aTest = a.name?.includes('[TEST]') ? 1 : 0;
		const bTest = b.name?.includes('[TEST]') ? 1 : 0;
		return aTest - bTest;
	});
	const season =
		seasons.find((s: any) => !s.name?.includes('[TEST]') && (s.status === 'active' || s.status === 'open'))
		?? seasons.find((s: any) => s.status === 'active' || s.status === 'open')
		?? seasons[0]
		?? null;

	if (!season) return { season: null, week: null, games: [] };

	// Find the current open week (earliest open with future deadline, else any open, else latest locked)
	const now = new Date();
	const weeks = await pb.collection('weekly_settings').getFullList({
		filter: `season = "${season.id}"`,
		sort:   'week'
	}).catch(() => []) as any[];

	const week =
		weeks.find((w: any) => w.status === 'open' && new Date(w.deadline) > now)
		?? weeks.find((w: any) => w.status === 'open')
		?? [...weeks].reverse().find((w: any) => w.status === 'locked' || w.status === 'results_pending' || w.status === 'complete')
		?? weeks[weeks.length - 1]
		?? null;

	if (!week) return { season, week: null, games: [] };

	// Fetch active odds for this week
	const games = await pb.collection('game_odds').getFullList({
		filter: `season = "${season.id}" && week = ${week.week} && isActive = true`,
		expand: 'homeTeam,awayTeam',
		sort:   'game_time_stamp'
	}).catch(() => []) as any[];

	return { season, week, games, isLoggedIn: !!locals.user };
};
