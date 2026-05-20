import { redirect } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('dashboard:season');
	if (!locals.user) redirect(302, '/login?redirect=/dashboard');
	if (locals.role === 'super_admin' || locals.role === 'pool_admin') redirect(302, '/admin');

	let pb: Awaited<ReturnType<typeof pbAdmin>>;
	try {
		pb = await pbAdmin();
	} catch (e) {
		console.error('[dashboard] pbAdmin failed:', e);
		throw e;
	}

	const seasonParam = url.searchParams.get('season');

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
	const activeSeasons = allSeasons.filter((s: any) => s.status === 'active' || s.status === 'open');

	// Seasons the user actually has entries in
	const userSeasonIds = [...new Set(e.map((x: any) => x.season as string))];
	const userSeasons   = userSeasonIds.map(id =>
		allSeasons.find((s: any) => s.id === id) ?? { id, name: '—', status: 'unknown' }
	);

	// Season name map for quick lookup
	const seasonNameMap = new Map(allSeasons.map((s: any) => [s.id as string, s.name as string]));

	// Sort user seasons: real first, then test
	const userSeasonIdsSorted = [...userSeasonIds].sort((a, b) => {
		const aTest = seasonNameMap.get(a)?.includes('[TEST]') ? 1 : 0;
		const bTest = seasonNameMap.get(b)?.includes('[TEST]') ? 1 : 0;
		return aTest - bTest;
	});
	const bestSeasonId = userSeasonIdsSorted[0] ?? '';

	// Use explicit ?season= only if it's a valid user season AND it's a real season
	// (or there are no real seasons to fall back to)
	const hasRealSeason = userSeasonIdsSorted.some(id => !seasonNameMap.get(id)?.includes('[TEST]'));
	const paramIsReal   = seasonParam ? !seasonNameMap.get(seasonParam)?.includes('[TEST]') : false;
	const paramIsValid  = seasonParam ? userSeasonIds.includes(seasonParam) : false;

	const defaultSeasonId =
		(paramIsValid && (!hasRealSeason || paramIsReal)) ? seasonParam!
		: bestSeasonId;

	// Redirect to canonical URL if param is missing or pointing to a test season when a real one exists
	if (defaultSeasonId && seasonParam !== defaultSeasonId) {
		redirect(303, `/dashboard?season=${defaultSeasonId}`);
	}

	// Selected season object
	const activeSeason = allSeasons.find((s: any) => s.id === defaultSeasonId)
		?? activeSeasons[0]
		?? null;

	// Current open/locked week per season the user has entries in.
	// Prefer the earliest open week with a future deadline; fall back to
	// the earliest locked week if no open week with a future deadline exists.
	const currentWeekBySeason: Record<string, any> = {};
	// PocketBase stores datetimes with a space separator — use the same format for filter comparisons
	const now = new Date().toISOString().replace('T', ' ').slice(0, 23) + 'Z';
	await Promise.all(
		userSeasons.map(async (s: any) => {
			// First: earliest open week whose deadline is still in the future
			let w = await pb.collection('weekly_settings').getFirstListItem(
				`season = "${s.id}" && status = "open" && deadline > "${now}"`,
				{ sort: 'week' }
			).catch(() => null);
			// Fallback: earliest locked week
			if (!w) {
				w = await pb.collection('weekly_settings').getFirstListItem(
					`season = "${s.id}" && status = "locked"`,
					{ sort: 'week' }
				).catch(() => null);
			}
			// Last fallback: any open week (past deadline, e.g. test seasons)
			if (!w) {
				w = await pb.collection('weekly_settings').getFirstListItem(
					`season = "${s.id}" && status = "open"`,
					{ sort: 'week' }
				).catch(() => null);
			}
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

	// Pool-wide stats per season (all users)
	const poolStatsBySeason: Record<string, {
		total: number; active: number; pending: number; eliminated: number; pot: number;
	}> = {};

	await Promise.all(
		userSeasonIds.map(async (sid) => {
			const season = allSeasons.find((s: any) => s.id === sid);
			const lmsFee = (season?.lmsEntryFee        ?? 0) as number;
			const shFee  = (season?.secondHalfEntryFee ?? 0) as number;

			const all = await pb.collection('entries').getFullList({
				filter: `season = "${sid}"`,
				fields: 'id,status,paid,paymentMethod,entryType',
			}).catch(() => []) as any[];

			poolStatsBySeason[sid] = {
				total:      all.length,
				active:     all.filter((x: any) => x.status === 'active').length,
				pending:    all.filter((x: any) => x.status === 'pending_payment').length,
				eliminated: all.filter((x: any) => x.status === 'eliminated').length,
				// Pot: paid non-complimentary entries × their pool's entry fee
				pot: all
					.filter((x: any) => x.paid && x.paymentMethod !== 'free')
					.reduce((sum: number, x: any) =>
						sum + (x.entryType === 'lms' ? lmsFee : shFee), 0),
			};
		})
	);

	// Stat cards only count real (non-test) season entries
	const realSeasonIds = new Set(allSeasons.filter(s => !s.name?.includes('[TEST]')).map(s => s.id));
	const realEntries   = e.filter(x => realSeasonIds.has(x.season));

	return {
		user: {
			id:          locals.user.id,
			displayName: locals.user.displayName as string,
			role:        locals.user.role        as string
		},
		entries:              e,
		activeEntries:        realEntries.filter((x: any) => x.status === 'active'),
		pendingEntries:       realEntries.filter((x: any) => x.status === 'pending_payment'),
		eliminatedEntries:    realEntries.filter((x: any) => x.status === 'eliminated'),
		activeSeason,
		activeSeasons,
		allSeasons,
		currentWeekBySeason,
		entriesBySeason,
		poolStatsBySeason,
		pickByEntry,
		usedTeamCountByEntry,
		selectedSeasonId: defaultSeasonId
	};
};
