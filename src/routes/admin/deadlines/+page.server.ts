import { pbAdmin } from '$lib/server/pb-admin';
import { getKickoffIso, KICKOFF_FIELDS, deriveDeadlineFromKickoff } from '$lib/server/deadlines';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const pb = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';
	const seasonParam = url.searchParams.get('season') ?? null;

	const allSeasons = (await pb.collection('seasons').getFullList({ sort: '-year' })) as any[];
	const seasons = isSuperAdmin ? allSeasons : allSeasons.filter((s: any) => !s.name?.includes('[TEST]'));

	const activeSeason =
		(seasonParam ? seasons.find((s: any) => s.id === seasonParam) : null) ??
		seasons.find((s: any) => s.status === 'active' || s.status === 'open') ??
		seasons[0] ??
		null;

	if (!activeSeason) {
		return { seasons, activeSeason: null, rows: [], isSuperAdmin };
	}

	const [weeks, odds] = await Promise.all([
		pb
			.collection('weekly_settings')
			.getFullList({ filter: `season = "${activeSeason.id}"`, sort: 'week' })
			.catch(() => []) as Promise<any[]>,
		pb
			.collection('game_odds')
			.getFullList({
				filter: `season = "${activeSeason.id}" && isActive = true`,
				fields: `week,isActive,${KICKOFF_FIELDS}`
			})
			.catch(() => []) as Promise<any[]>
	]);

	const now = Date.now();

	const rows = weeks.map((week: any) => {		const kickoffs = odds
			.filter((o: any) => o.week === week.week)
			.map((o: any) => getKickoffIso(o))
			.filter((iso): iso is string => !!iso)
			.sort();

		const firstKickoff = kickoffs[0] ?? null;
		const expectedPickDeadline = deriveDeadlineFromKickoff(firstKickoff, 30);
		const entryDeadline = deriveDeadlineFromKickoff(firstKickoff, 40);

		const storedDeadline = week.deadline || null;
		let driftMinutes: number | null = null;
		if (firstKickoff && storedDeadline) {
			driftMinutes = Math.round(
				(new Date(firstKickoff).getTime() - new Date(storedDeadline).getTime()) / 60_000
			);
		}

		return {
			id: week.id,
			week: week.week,
			status: week.status,
			gameCount: kickoffs.length,
			firstKickoff,
			storedDeadline,
			expectedPickDeadline,
			entryDeadline,
			driftMinutes,
			isPast: !!firstKickoff && new Date(firstKickoff).getTime() < now,
			// Anything other than 30 minutes before kickoff needs an admin's eyes.
			ok: driftMinutes === 30
		};
	});

	return { seasons, activeSeason, rows, isSuperAdmin };
};
