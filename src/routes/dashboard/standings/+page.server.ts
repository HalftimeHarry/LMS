import { redirect } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/register?reason=standings');

	const pb       = await pbAdmin();
	const poolType = (url.searchParams.get('pool') ?? 'lms') as 'lms' | 'second_half';
	const seasonId = url.searchParams.get('season') ?? null;
	const userId   = locals.user.id;

	const seasonsRaw = await pb.collection('seasons').getFullList({ sort: '-year' }) as any[];
	// Real seasons before test seasons so defaults always land on the real season
	const seasons = seasonsRaw.sort((a: any, b: any) => {
		const aTest = a.name?.includes('[TEST]') ? 1 : 0;
		const bTest = b.name?.includes('[TEST]') ? 1 : 0;
		return aTest - bTest;
	});

	// Prefer explicit ?season=, then first active/open real season, then first overall
	const activeSeason = (
		(seasonId ? seasons.find((s: any) => s.id === seasonId) : null)
		?? seasons.find((s: any) => !s.name?.includes('[TEST]') && (s.status === 'active' || s.status === 'open'))
		?? seasons.find((s: any) => s.status === 'active' || s.status === 'open')
		?? seasons[0]
		?? null
	);

	if (!activeSeason) {
		return { seasons, activeSeason: null, poolType, weeks: [], entries: [], pickGrid: {}, currentWeek: null, userId };
	}

	// All weeks for this season, sorted ascending
	const weeks = await pb.collection('weekly_settings').getFullList({
		filter: `season = "${activeSeason.id}"`,
		sort:   'week',
		expand: 'biggestFavoriteTeam'
	}).catch(() => []) as any[];

	// Weeks whose picks are public (deadline passed)
	const visibleWeekIds = new Set(
		weeks
			.filter(w => w.status === 'locked' || w.status === 'results_pending' || w.status === 'complete')
			.map(w => w.id)
	);
	const openWeekIds = new Set(
		weeks.filter(w => w.status === 'open').map(w => w.id)
	);

	// All entries for this pool type (exclude pending_payment)
	const entries = await pb.collection('entries').getFullList({
		filter: `season = "${activeSeason.id}" && entryType = "${poolType}" && status != "pending_payment"`,
		expand: 'user',
		sort:   '+entryName'
	}).catch(() => []) as any[];

	// Prefer the earliest open week with a future deadline; fall back to most recent locked week
	const now = new Date();
	const currentWeek =
		weeks.find(w => w.status === 'open' && new Date(w.deadline) > now) ??
		weeks.find(w => w.status === 'open') ??
		weeks.find(w => w.status === 'locked') ??
		null;

	if (entries.length === 0) {
		return { activeSeason, poolType, weeks, entries: [], pickGrid: {}, currentWeek, userId };
	}

	// pickGrid[entryId][weekId] = { teams, isAutoPick, isOwn }
	// isOwn = true means this pick belongs to the current user (shown even on open weeks)
	const pickGrid: Record<string, Record<string, { teams: string[]; isAutoPick: boolean; isOwn: boolean }>> = {};

	const entryIds    = entries.map((e: any) => e.id);
	const myEntryIds  = new Set(entries.filter((e: any) => e.user === userId).map((e: any) => e.id));

	// Fetch all picks for visible weeks (public) in batches
	if (visibleWeekIds.size > 0) {
		const batchSize = 20;
		for (let i = 0; i < entryIds.length; i += batchSize) {
			const batch  = entryIds.slice(i, i + batchSize);
			const filter = `(${batch.map((id: string) => `entry = "${id}"`).join(' || ')})`;
			const picks  = await pb.collection('picks').getFullList({
				filter,
				expand: 'pickedTeams',
				fields: 'entry,week,isAutoPick,expand'
			}).catch(() => []) as any[];

			for (const pick of picks) {
				if (!visibleWeekIds.has(pick.week)) continue;
				if (!pickGrid[pick.entry]) pickGrid[pick.entry] = {};
				pickGrid[pick.entry][pick.week] = {
					teams:      (pick.expand?.pickedTeams ?? []).map((t: any) => t.abbreviation),
					isAutoPick: pick.isAutoPick === true,
					isOwn:      myEntryIds.has(pick.entry)
				};
			}
		}
	}

	// Fetch the current user's own picks for open weeks (private — only their own)
	if (openWeekIds.size > 0 && myEntryIds.size > 0) {
		const myIds  = [...myEntryIds];
		const filter = `(${myIds.map(id => `entry = "${id}"`).join(' || ')})`;
		const myPicks = await pb.collection('picks').getFullList({
			filter,
			expand: 'pickedTeams',
			fields: 'entry,week,isAutoPick,expand'
		}).catch(() => []) as any[];

		for (const pick of myPicks) {
			if (!openWeekIds.has(pick.week)) continue;
			if (!pickGrid[pick.entry]) pickGrid[pick.entry] = {};
			pickGrid[pick.entry][pick.week] = {
				teams:      (pick.expand?.pickedTeams ?? []).map((t: any) => t.abbreviation),
				isAutoPick: pick.isAutoPick === true,
				isOwn:      true
			};
		}
	}

	// Does the current user have any active entry missing a pick for an open week?
	const hasMissingPick = openWeekIds.size > 0 && [...myEntryIds].some(entryId => {
		const entry = entries.find((e: any) => e.id === entryId);
		if (entry?.status !== 'active') return false;
		return [...openWeekIds].some(weekId => !pickGrid[entryId]?.[weekId]);
	});

	return {
		seasons,
		activeSeason,
		poolType,
		weeks:          weeks    as any[],
		entries:        entries  as any[],
		pickGrid,
		currentWeek:    currentWeek as any,
		userId,
		hasMissingPick,
	};
};
