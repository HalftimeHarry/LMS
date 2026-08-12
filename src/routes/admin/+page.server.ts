import { pbAdmin } from '$lib/server/pb-admin';
import { SeasonProvider, EntryProvider, WeekProvider } from '$lib/providers';
import { seedTestSeasonPair, clearTestSeason } from '$lib/server/test-season';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function isSecondHalfSeason(season: any): boolean {
	if (!season) return false;
	if (season.lmsEnabled === false && season.secondHalfEnabled !== false) return true;
	return String(season.name ?? '').toLowerCase().includes('second half');
}

function seasonCycleKey(season: any): string | null {
	const name = String(season?.name ?? '');
	const match = name.match(/(\d{4}\s*-\s*\d{4})/);
	if (!match) return null;
	return match[1].replace(/\s+/g, '');
}

function resolveEntrySourceSeason(season: any, activeSeasons: any[]): any {
	if (!isSecondHalfSeason(season)) return season;
	const cycleKey = seasonCycleKey(season);
	const byCycle = cycleKey
		? activeSeasons.find((candidate) =>
			candidate.id !== season.id &&
			!isSecondHalfSeason(candidate) &&
			seasonCycleKey(candidate) === cycleKey
		)
		: null;
	if (byCycle) return byCycle;

	const yearKey = String(season.year ?? '');
	const byYear = activeSeasons.find((candidate) =>
		candidate.id !== season.id &&
		!isSecondHalfSeason(candidate) &&
		String(candidate.year ?? '') === yearKey
	);
	return byYear ?? season;
}

function buildStats(entries: any[], season: any, totalUsers: number) {
	const paidLms        = entries.filter(e => e.paid && e.entryType === 'lms'         && e.paymentMethod !== 'free');
	const paidSecondHalf = entries.filter(e => e.paid && e.entryType === 'second_half' && e.paymentMethod !== 'free');
	const freeEntries    = entries.filter(e => e.paid && e.paymentMethod === 'free');
	return {
		totalUsers,
		totalEntries:      entries.length,
		lmsEntries:        entries.filter(e => e.entryType === 'lms').length,
		secondHalfEntries: entries.filter(e => e.entryType === 'second_half').length,
		paidEntries:       entries.filter(e => e.paid).length,
		freeEntries:       freeEntries.length,
		pendingPayment:    entries.filter(e => e.status === 'pending_payment').length,
		activeEntries:     entries.filter(e => e.status === 'active').length,
		eliminatedEntries: entries.filter(e => e.status === 'eliminated').length,
		lmsPot:            paidLms.length        * (season?.lmsEntryFee        ?? 0),
		secondHalfPot:     paidSecondHalf.length * (season?.secondHalfEntryFee ?? 0),
		potEstimate:
			paidLms.length        * (season?.lmsEntryFee        ?? 0) +
			paidSecondHalf.length * (season?.secondHalfEntryFee ?? 0),
		maintenanceFee:    (season?.maintenanceFee ?? 0) as number,
		lmsNetPayout:      Math.max(0,
			paidLms.length * (season?.lmsEntryFee ?? 0) - (season?.maintenanceFee ?? 0)
		),
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const pb            = await pbAdmin();
	const isSuperAdmin  = locals.role === 'super_admin';

	const seasonProvider = new SeasonProvider(pb);
	const entryProvider  = new EntryProvider(pb);
	const weekProvider   = new WeekProvider(pb);

	const allSeasons    = await seasonProvider.getAll();
	const seasons       = isSuperAdmin ? allSeasons : allSeasons.filter(s => !s.name?.includes('[TEST]'));
	const activeSeasons = seasons.filter(s => s.status === 'active' || s.status === 'open');
	// Default selected season: first LMS one, fallback to first active
	const activeSeason = activeSeasons.find(s => !s.name?.toLowerCase().includes('second half'))
		?? activeSeasons[0]
		?? null;

	const [users] = await Promise.all([
		pb.collection('users').getList(1, 1, { fields: 'id' })
	]);

	// Load stats + pending entries for every active season in parallel
	const seasonDataMap: Record<string, {
		stats: ReturnType<typeof buildStats>;
		currentWeek: any;
		tableEntries: any[];
		pendingPaymentEntries: any[];
		lmsEntryDeadline: string | null;
		shEntryDeadline: string | null;
	}> = {};

	await Promise.all(activeSeasons.map(async (season) => {
		const sourceSeason = resolveEntrySourceSeason(season, activeSeasons as any[]);
		const entryTypeScope = isSecondHalfSeason(season) ? 'second_half' : 'lms';
		const shStartWeek = sourceSeason?.secondHalfStartWeek ?? 6;

		const [rawEntries, currentWeek, scopedEntries, week1Odds, shOdds] = await Promise.all([
			entryProvider.getStatsFields(sourceSeason.id),
			weekProvider.getCurrentWeek(sourceSeason.id),
			entryProvider.getAll({ seasonId: sourceSeason.id, entryType: entryTypeScope as any }),
			pb.collection('game_odds').getFirstListItem(
				`season = "${sourceSeason.id}" && week = 1 && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			).catch(() => null),
			pb.collection('game_odds').getFirstListItem(
				`season = "${sourceSeason.id}" && week = ${shStartWeek} && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			).catch(() => null),
		]);
		const entries = rawEntries.filter((entry: any) => entry.entryType === entryTypeScope);
		const pendingEntries = scopedEntries.filter((entry: any) => entry.status === 'pending_payment');

		const week1Kickoff = (week1Odds as any)?.game_time_stamp ?? (week1Odds as any)?.gameTime;
		const shKickoff = (shOdds as any)?.game_time_stamp ?? (shOdds as any)?.gameTime;
		const lmsEntryDeadline = week1Kickoff
			? new Date(new Date(week1Kickoff).getTime() - 40 * 60_000).toISOString()
			: null;
		const shEntryDeadline = shKickoff
			? new Date(new Date(shKickoff).getTime() - 40 * 60_000).toISOString()
			: null;

		seasonDataMap[season.id] = {
			stats:                buildStats(entries, season, users.totalItems),
			currentWeek,
			tableEntries:         scopedEntries,
			pendingPaymentEntries: pendingEntries.slice(0, 5),
			lmsEntryDeadline,
			shEntryDeadline,
		};
	}));

	const defaultData = activeSeason ? seasonDataMap[activeSeason.id] : null;

	return {
		role:          locals.role as string,
		seasons,
		activeSeasons,
		activeSeason,
		seasonDataMap,
		// Top-level defaults (for the initially selected season)
		currentWeek:           defaultData?.currentWeek           ?? null,
		tableEntries:          defaultData?.tableEntries          ?? [],
		pendingPaymentEntries: defaultData?.pendingPaymentEntries  ?? [],
		lmsEntryDeadline:      defaultData?.lmsEntryDeadline      ?? null,
		shEntryDeadline:       defaultData?.shEntryDeadline       ?? null,
		pendingPaymentCount:   defaultData?.stats.pendingPayment   ?? 0,
		stats:                 defaultData?.stats                  ?? buildStats([], null, users.totalItems)
	};
};

export const actions: Actions = {
	approveEntryPayment: async ({ request, locals }) => {
		if (locals.role !== 'pool_admin' && locals.role !== 'super_admin') {
			return fail(403, { error: 'Not authorized.' });
		}

		const pb = await pbAdmin();
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		const paymentMethod = String(formData.get('paymentMethod') ?? '');

		if (!id) return fail(400, { error: 'Entry id is required.' });
		if (!paymentMethod) return fail(400, { error: 'Payment method is required.' });

		try {
			await pb.collection('entries').update(id, {
				paid: true,
				paidAt: new Date().toISOString(),
				paymentMethod,
				status: 'active'
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { error: (e as Error)?.message ?? 'Failed to approve payment.' });
		}
	},

	deleteEntry: async ({ request, locals }) => {
		if (locals.role !== 'pool_admin' && locals.role !== 'super_admin') {
			return fail(403, { error: 'Not authorized.' });
		}

		const pb = await pbAdmin();
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '');
		if (!id) return fail(400, { error: 'Entry id is required.' });

		try {
			const entry = await pb.collection('entries').getOne(id) as any;
			const season = await pb.collection('seasons').getOne(entry.season).catch(() => null) as any;
			const pickWeek = entry.entryType === 'second_half' ? (season?.secondHalfStartWeek ?? 6) : 1;
			const odds = await pb.collection('game_odds').getFirstListItem(
				`season = "${entry.season}" && week = ${pickWeek} && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			).catch(() => null) as any;
			const kickoff = odds?.game_time_stamp ?? odds?.gameTime;
			if (kickoff) {
				const deadline = new Date(kickoff);
				deadline.setMinutes(deadline.getMinutes() - 40);
				if (new Date() > deadline) {
					return fail(400, {
						error: 'The entry deadline has passed — entries can no longer be deleted.'
					});
				}
			}
			await pb.collection('entries').delete(id);
			return { success: true };
		} catch (e: unknown) {
			return fail(400, { error: (e as Error)?.message ?? 'Failed to delete entry.' });
		}
	},

	// Seed a new test season pair (LMS + Second Half) — super_admin only
	seedTestSeason: async ({ request, locals }) => {
		if (locals.role !== 'super_admin') return fail(403, { error: 'Not authorized.' });
		const pb       = await pbAdmin();
		const formData = await request.formData();
		const interval = (formData.get('interval') ?? '1h') as '1h' | '1d';
		const mode     = (formData.get('mode') ?? 'with-picks') as 'with-picks' | 'no-picks';
		if (interval !== '1h' && interval !== '1d') {
			return fail(400, { error: 'Invalid interval. Use 1h or 1d.' });
		}
		try {
			const result = await seedTestSeasonPair(pb, interval, mode);
			return { success: true, ...result };
		} catch (e: unknown) {
			return fail(500, { error: (e as Error).message });
		}
	},

	// Clear a single test season and all its data — super_admin only
	clearTestSeason: async ({ request, locals }) => {
		if (locals.role !== 'super_admin') return fail(403, { error: 'Not authorized.' });
		const pb       = await pbAdmin();
		const formData = await request.formData();
		const seasonId = formData.get('seasonId') as string;
		if (!seasonId) return fail(400, { error: 'seasonId required.' });
		try {
			const result = await clearTestSeason(pb, seasonId);
			return { success: true, ...result };
		} catch (e: unknown) {
			return fail(500, { error: (e as Error).message });
		}
	},

	// Clear all test seasons then seed a fresh pair — super_admin only
	resetTestSeason: async ({ request, locals }) => {
		if (locals.role !== 'super_admin') return fail(403, { error: 'Not authorized.' });
		const pb       = await pbAdmin();
		const formData = await request.formData();
		const interval  = (formData.get('interval') ?? '1h') as '1h' | '1d';
		const mode      = (formData.get('mode') ?? 'with-picks') as 'with-picks' | 'no-picks';
		const seasonIds = formData.getAll('seasonId') as string[];

		// Clear existing test seasons
		for (const id of seasonIds) {
			try { await clearTestSeason(pb, id); } catch { /* skip */ }
		}

		// Seed fresh
		try {
			const result = await seedTestSeasonPair(pb, interval, mode);
			return { success: true, ...result };
		} catch (e: unknown) {
			return fail(500, { error: (e as Error).message });
		}
	},
};
