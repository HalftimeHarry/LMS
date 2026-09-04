import { redirect } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import { getDeadlinePairFromKickoff, getKickoffIso, KICKOFF_FIELDS } from '$lib/server/deadlines';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends, cookies }) => {
	depends('dashboard:season');
	if (!locals.user) throw redirect(302, '/login?redirect=/dashboard');
	if (locals.role === 'super_admin' || locals.role === 'pool_admin') throw redirect(302, '/admin');

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
	const seasonIdsToLoad = new Set<string>(userSeasonIds);
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

	if (defaultSeasonId) seasonIdsToLoad.add(defaultSeasonId);

	console.log('[dashboard debug]', {
		seasonParam,
		defaultSeasonId,
		userSeasonIds,
		seasonIdsToLoad: [...seasonIdsToLoad],
		selectedSeasonName: allSeasons.find((s: any) => s.id === defaultSeasonId)?.name ?? null,
	});

	// Redirect to canonical URL if param is missing or pointing to a test season when a real one exists
	if (defaultSeasonId && seasonParam !== defaultSeasonId) {
		throw redirect(303, `/dashboard?season=${defaultSeasonId}`);
	}

	// Selected season object
	const activeSeason = allSeasons.find((s: any) => s.id === defaultSeasonId)
		?? activeSeasons[0]
		?? null;

	// Current open/locked week per season the user has entries in.
	// Prefer the earliest open week whose effective deadline (kickoff-derived when available)
	// is in the future; fall back to the earliest locked week, then earliest open week.
	const currentWeekBySeason: Record<string, any> = {};
	const now = new Date();

	const derivedDeadlineCache = new Map<string, { pick: string | null; entry: string | null }>();
	const getDerivedDeadlinePair = async (seasonId: string, weekNum: number): Promise<{ pick: string | null; entry: string | null }> => {
		const key = `${seasonId}:${weekNum}`;
		if (derivedDeadlineCache.has(key)) return derivedDeadlineCache.get(key)!;

		const odds = await pb.collection('game_odds').getFirstListItem(
			`season = "${seasonId}" && week = ${weekNum} && isActive = true`,
			{ sort: 'game_time_stamp', fields: KICKOFF_FIELDS }
		).catch(() => null) as any;

		const kickoff = getKickoffIso(odds);
		const derived = getDeadlinePairFromKickoff(kickoff);
		derivedDeadlineCache.set(key, derived);
		return derived;
	};

	const withEffectiveDeadline = async (weekObj: any | null): Promise<any | null> => {
		if (!weekObj) return weekObj;
		const derived = await getDerivedDeadlinePair(weekObj.season, Number(weekObj.week));
		if (!derived.pickDeadline && !derived.entryDeadline) return weekObj;
		return {
			...weekObj,
			deadline: derived.pickDeadline ?? weekObj.deadline ?? null,
			entryDeadline: derived.entryDeadline ?? null,
			pickDeadline: derived.pickDeadline ?? weekObj.deadline ?? null,
		};
	};

	const seasonsToEvaluate = [...seasonIdsToLoad].map(id =>
		allSeasons.find((s: any) => s.id === id) ?? { id, name: '—', status: 'unknown' }
	);

	// Determine the "current" pickable week for a season, optionally restricted to
	// weeks >= minWeek (used for the Second Half pool, which starts at week 6+).
	const computeCurrentWeek = async (s: any, minWeek: number): Promise<any | null> => {
		const openWeeks = (await pb.collection('weekly_settings').getFullList({
			filter: `season = "${s.id}" && status = "open"`,
			sort: 'week'
		}).catch(() => []) as any[]).filter(w => w.week >= minWeek);

		let selected: any | null = null;
		for (const week of openWeeks) {
			const effectiveWeek = await withEffectiveDeadline(week);
			const deadline = effectiveWeek?.deadline ? new Date(effectiveWeek.deadline) : null;
			if (deadline && !Number.isNaN(deadline.getTime()) && deadline > now) {
				selected = effectiveWeek;
				break;
			}
		}

		if (!selected && openWeeks.length > 0) {
			selected = await withEffectiveDeadline(openWeeks[openWeeks.length - 1]);
		}

		if (!selected) {
			const lockedWeek = await pb.collection('weekly_settings').getFirstListItem(
				`season = "${s.id}" && status = "locked" && week >= ${minWeek}`,
				{ sort: 'week' }
			).catch(() => null);
			selected = await withEffectiveDeadline(lockedWeek);
		}

		return selected;
	};

	// Second Half pool current week — kept separate since its pickable weeks start
	// at secondHalfStartWeek (default 6), independent of the LMS pool's current week.
	const currentWeekSHBySeason: Record<string, any> = {};

	await Promise.all(
		seasonsToEvaluate.map(async (s: any) => {
			const selected = await computeCurrentWeek(s, 0);
			if (selected) {
				console.log('[dashboard debug] selected week', {
					seasonId: s.id,
					week: selected.week,
					deadline: selected.deadline,
					entryDeadline: selected.entryDeadline,
					pickDeadline: selected.pickDeadline,
				});
				currentWeekBySeason[s.id] = selected;
			}

			const shSelected = await computeCurrentWeek(s, s.secondHalfStartWeek ?? 6);
			if (shSelected) currentWeekSHBySeason[s.id] = shSelected;
		})
	);

	// Load Week 6 (2H start week) deadline for each season that has secondHalfEnabled.
	// The 2H countdown card shows this deadline before the 2H pool opens.
	const week6BySeason: Record<string, any> = {};
	await Promise.all(
		seasonsToEvaluate
			.filter((s: any) => s.secondHalfEnabled !== false)
			.map(async (s: any) => {
				const startWeek = s.secondHalfStartWeek ?? 6;
				const w = await pb.collection('weekly_settings').getFirstListItem(
					`season = "${s.id}" && week = ${startWeek}`,
					{ sort: 'week' }
				).catch(() => null);
				const effectiveWeek = await withEffectiveDeadline(w);
				if (effectiveWeek) week6BySeason[s.id] = effectiveWeek;
			})
	);

	// Build a set of all current week IDs for quick lookup (LMS + Second Half)
	const currentWeekIds = new Set([
		...Object.values(currentWeekBySeason).map((w: any) => w.id),
		...Object.values(currentWeekSHBySeason).map((w: any) => w.id),
	]);

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
		lms: { total: number; active: number; eliminated: number; pot: number; paid: number; free: number };
		sh:  { total: number; active: number; eliminated: number; pot: number };
	}> = {};

	await Promise.all(
		[...seasonIdsToLoad].map(async (sid) => {
			const season   = allSeasons.find((s: any) => s.id === sid);
			const lmsFee   = (season?.lmsEntryFee        ?? 0) as number;
			const shFee    = (season?.secondHalfEntryFee ?? 0) as number;
			const maintFee = (season?.maintenanceFee     ?? 0) as number;

			const all = await pb.collection('entries').getFullList({
				filter: `season = "${sid}"`,
				fields: 'id,status,paid,paymentMethod,entryType',
			}).catch(() => []) as any[];

			const lmsAll = all.filter((x: any) => x.entryType === 'lms');
			const shAll  = all.filter((x: any) => x.entryType === 'second_half');

			poolStatsBySeason[sid] = {
				total:      all.length,
				active:     all.filter((x: any) => x.status === 'active').length,
				pending:    all.filter((x: any) => x.status === 'pending_payment').length,
				eliminated: all.filter((x: any) => x.status === 'eliminated').length,
				pot: all
					.filter((x: any) => x.paid && x.paymentMethod !== 'free')
					.reduce((sum: number, x: any) =>
						sum + (x.entryType === 'lms' ? lmsFee : shFee), 0),
				// Per-pool breakdown
				lms: {
					total:      lmsAll.length,
					active:     lmsAll.filter((x: any) => x.status === 'active').length,
					eliminated: lmsAll.filter((x: any) => x.status === 'eliminated').length,
					free:       lmsAll.filter((x: any) => x.paymentMethod === 'free').length,
					paid:       lmsAll.filter((x: any) => x.paid && x.paymentMethod !== 'free').length,
					pot:        Math.max(0, lmsAll.filter((x: any) => x.paid && x.paymentMethod !== 'free').length * lmsFee - maintFee),
				},
				sh: {
					total:      shAll.length,
					active:     shAll.filter((x: any) => x.status === 'active').length,
					eliminated: shAll.filter((x: any) => x.status === 'eliminated').length,
					pot:        shAll.filter((x: any) => x.paid && x.paymentMethod !== 'free').length * shFee,
				},
			};
		})
	);

	// Stat cards only count real (non-test) season entries
	const realSeasonIds = new Set(allSeasons.filter(s => !s.name?.includes('[TEST]')).map(s => s.id));
	const realEntries   = e.filter(x => realSeasonIds.has(x.season));

	const pickView = (cookies.get('pick_view') ?? 'entries') as 'entries' | 'standings';

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
		currentWeekSHBySeason,
		week6BySeason,
		entriesBySeason,
		poolStatsBySeason,
		pickByEntry,
		usedTeamCountByEntry,
		selectedSeasonId: defaultSeasonId,
		pickView,
	};
};
