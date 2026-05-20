import { redirect } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard');
	if (locals.role === 'super_admin' || locals.role === 'pool_admin') redirect(302, '/admin');

	let pb: Awaited<ReturnType<typeof pbAdmin>>;
	try {
		pb = await pbAdmin();
	} catch (e) {
		console.error('[dashboard] pbAdmin failed:', e);
		throw e;
	}

	const [entries, seasons] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: `user = "${locals.user.id}"`,
			expand: 'season',
			sort:   '-id'
		}).catch(() => []),
		pb.collection('seasons').getFullList({ sort: '-year' }).catch(() => [])
	]);



	const e          = entries as any[];
	const allSeasons = seasons as any[];

	// Active/open seasons — there may be multiple (LMS + Second Half run concurrently)
	const activeSeasons = allSeasons.filter(s => s.status === 'active' || s.status === 'open');
	// Primary season for the welcome banner — prefer LMS type, else first active
	const activeSeason = activeSeasons.find(s => s.poolType === 'lms') ?? activeSeasons[0] ?? null;

	// Seasons the user actually has entries in (may include non-active seasons)
	const userSeasonIds = [...new Set((entries as any[]).map((e: any) => e.season))];
	// Merge with active seasons so we have full season objects for all user seasons
	const userSeasons = userSeasonIds.map(id =>
		allSeasons.find((s: any) => s.id === id) ?? { id, name: '—', status: 'unknown' }
	);

	// Current open/locked week per season the user has entries in
	const currentWeekBySeason: Record<string, any> = {};
	await Promise.all(
		userSeasons.map(async (s: any) => {
			const w = await pb.collection('weekly_settings').getFirstListItem(
				`season = "${s.id}" && (status = "open" || status = "locked")`,
				{ sort: 'week' }
			).catch(() => null);
			if (w) currentWeekBySeason[s.id] = w;
		})
	);

	// Build a set of all current week IDs for quick lookup
	const currentWeekIds = new Set(Object.values(currentWeekBySeason).map((w: any) => w.id));

	// Fetch picks for ALL entries (active across all seasons)
	const pickByEntry: Record<string, any>    = {};
	const usedTeamCountByEntry: Record<string, number> = {};

	const activeIds = e.filter(x => x.status === 'active').map(x => x.id);
	if (activeIds.length) {
		const CHUNK = 30;
		const allPicks: any[] = [];

		for (let i = 0; i < activeIds.length; i += CHUNK) {
			const chunk  = activeIds.slice(i, i + CHUNK);
			const filter = chunk.map(id => `entry = "${id}"`).join(' || ');
			const batch  = await pb.collection('picks').getFullList({
				filter,
				expand: 'pickedTeams',
				sort:   '-id'
			}).catch(() => []);
			allPicks.push(...batch);
		}

		const usedTeams: Record<string, Set<string>> = {};
		for (const p of allPicks) {
			if (!usedTeams[p.entry]) usedTeams[p.entry] = new Set();
			for (const t of p.expand?.pickedTeams ?? []) usedTeams[p.entry].add(t.id);
			// Index pick for the current week of its season
			if (currentWeekIds.has(p.week)) pickByEntry[p.entry] = p;
		}
		for (const id of activeIds) {
			usedTeamCountByEntry[id] = usedTeams[id]?.size ?? 0;
		}
	}

	// Group entries by season for the UI
	const entriesBySeason: Record<string, any[]> = {};
	for (const entry of e) {
		const sid = entry.season;
		if (!entriesBySeason[sid]) entriesBySeason[sid] = [];
		entriesBySeason[sid].push(entry);
	}

	return {
		user: {
			id:          locals.user.id,
			displayName: locals.user.displayName as string,
			role:        locals.user.role        as string
		},
		entries:              e,
		activeEntries:        e.filter(x => x.status === 'active'),
		pendingEntries:       e.filter(x => x.status === 'pending_payment'),
		eliminatedEntries:    e.filter(x => x.status === 'eliminated'),
		activeSeason,
		activeSeasons,
		currentWeekBySeason,
		entriesBySeason,
		pickByEntry,
		usedTeamCountByEntry
	};
};
