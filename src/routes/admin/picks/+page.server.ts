import { pbAdmin } from '$lib/server/pb-admin';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (locals.role !== 'super_admin') redirect(303, '/admin');

	const pb = await pbAdmin();

	// All non-test seasons
	const allSeasons = await pb.collection('seasons').getFullList({ sort: '-year' }).catch(() => []) as any[];
	const seasons    = allSeasons.filter((s: any) => !s.name?.includes('[TEST]'));

	// Season selector — default to first active LMS season
	const seasonId = url.searchParams.get('season')
		?? seasons.find((s: any) => (s.status === 'active' || s.status === 'open') && !s.name?.toLowerCase().includes('second half'))?.id
		?? seasons[0]?.id
		?? '';

	const selectedSeason = seasons.find((s: any) => s.id === seasonId) ?? null;

	// All weeks for this season
	const allWeeks = selectedSeason
		? await pb.collection('weekly_settings').getFullList({
				filter: `season = "${seasonId}"`,
				sort:   'week',
				fields: 'id,week,status,deadline',
		  }).catch(() => []) as any[]
		: [];

	// Week selector — default to locked → results_pending → open → last complete
	const weekParam = url.searchParams.get('week');
	let selectedWeekNum = weekParam ? Number(weekParam) : 0;
	if (!selectedWeekNum && allWeeks.length) {
		const locked         = allWeeks.find((w: any) => w.status === 'locked');
		const resultsPending = allWeeks.find((w: any) => w.status === 'results_pending');
		const firstOpen      = allWeeks.find((w: any) => w.status === 'open');
		const lastComplete   = [...allWeeks].reverse().find((w: any) => w.status === 'complete');
		selectedWeekNum = locked?.week ?? resultsPending?.week ?? firstOpen?.week ?? lastComplete?.week ?? 1;
	}

	const selectedWeek = allWeeks.find((w: any) => w.week === selectedWeekNum) ?? null;

	// Fetch all picks for the selected week
	const picks = selectedWeek
		? await pb.collection('picks').getFullList({
				filter: `week = "${selectedWeek.id}"`,
				expand: 'entry,entry.user,pickedTeams',
				sort:   'entryType,entry.entryName',
		  }).catch(() => []) as any[]
		: [];

	// Fetch pick_results for these picks
	const pickIds = picks.map((p: any) => p.id);
	let pickResults: any[] = [];
	const CHUNK = 20;
	for (let i = 0; i < pickIds.length; i += CHUNK) {
		const chunk  = pickIds.slice(i, i + CHUNK);
		const filter = chunk.map((id: string) => `pick = "${id}"`).join(' || ');
		const batch  = await pb.collection('pick_results').getFullList({
			filter,
			expand: 'team',
		}).catch(() => []);
		pickResults.push(...batch);
	}

	// Build result map: pickId → result
	const resultMap: Record<string, string> = {};
	for (const r of pickResults as any[]) {
		resultMap[r.pick] = r.result;
	}

	return {
		seasons,
		seasonId,
		selectedSeason,
		allWeeks,
		selectedWeekNum,
		selectedWeek,
		picks,
		resultMap,
	};
};
