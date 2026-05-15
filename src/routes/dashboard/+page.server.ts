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

	const activeSeason = (seasons as any[]).find(s => s.status === 'active' || s.status === 'open') ?? null;

	let currentWeek: any = null;
	if (activeSeason) {
		currentWeek = await pb.collection('weekly_settings').getFirstListItem(
			`season = "${activeSeason.id}" && (status = "open" || status = "locked")`,
			{ sort: 'week' }
		).catch(() => null);
	}

	// Fetch all picks for active entries — current week pick (with teams) + total used team count.
	const e = entries as any[];
	const pickByEntry: Record<string, any> = {};
	const usedTeamCountByEntry: Record<string, number> = {};

	const activeIds = e.filter(x => x.status === 'active').map(x => x.id);
	if (activeIds.length) {
		const filter = activeIds.map(id => `entry = "${id}"`).join(' || ');

		// All picks across all weeks — to count used teams
		const allPicks = await pb.collection('picks').getFullList({
			filter,
			expand: 'pickedTeams',
			sort:   '-id'
		}).catch(() => []);

		// Count distinct teams used per entry
		const usedTeams: Record<string, Set<string>> = {};
		for (const p of allPicks) {
			if (!usedTeams[p.entry]) usedTeams[p.entry] = new Set();
			for (const t of p.expand?.pickedTeams ?? []) usedTeams[p.entry].add(t.id);
			// Also index the current week's pick for the badge
			if (currentWeek && p.week === currentWeek.id) pickByEntry[p.entry] = p;
		}
		for (const id of activeIds) {
			usedTeamCountByEntry[id] = usedTeams[id]?.size ?? 0;
		}
	}

	return {
		user: {
			id:          locals.user.id,
			displayName: locals.user.displayName as string,
			role:        locals.user.role        as string
		},
		entries:           e,
		activeEntries:     e.filter(x => x.status === 'active'),
		pendingEntries:    e.filter(x => x.status === 'pending_payment'),
		eliminatedEntries: e.filter(x => x.status === 'eliminated'),
		activeSeason,
		currentWeek,
		pickByEntry,
		usedTeamCountByEntry
	};
};
