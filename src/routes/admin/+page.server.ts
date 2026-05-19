import { pbAdmin } from '$lib/server/pb-admin';
import { SeasonProvider, EntryProvider, WeekProvider } from '$lib/providers';
import { seedTestSeasonPair, clearTestSeason } from '$lib/server/test-season';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
			paidSecondHalf.length * (season?.secondHalfEntryFee ?? 0)
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();

	const seasonProvider = new SeasonProvider(pb);
	const entryProvider  = new EntryProvider(pb);
	const weekProvider   = new WeekProvider(pb);

	const seasons      = await seasonProvider.getAll();
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
		pendingPaymentEntries: any[];
	}> = {};

	await Promise.all(activeSeasons.map(async (season) => {
		const [entries, currentWeek, pendingEntries] = await Promise.all([
			entryProvider.getStatsFields(season.id),
			weekProvider.getCurrentWeek(season.id),
			entryProvider.getAll({ seasonId: season.id, status: 'pending_payment' })
		]);
		seasonDataMap[season.id] = {
			stats:                buildStats(entries, season, users.totalItems),
			currentWeek,
			pendingPaymentEntries: pendingEntries.slice(0, 5)
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
		pendingPaymentEntries: defaultData?.pendingPaymentEntries  ?? [],
		pendingPaymentCount:   defaultData?.stats.pendingPayment   ?? 0,
		stats:                 defaultData?.stats                  ?? buildStats([], null, users.totalItems)
	};
};

export const actions: Actions = {
	// Seed a new test season pair (LMS + Second Half)
	seedTestSeason: async ({ request }) => {
		const pb       = await pbAdmin();
		const formData = await request.formData();
		const interval = (formData.get('interval') ?? '1h') as '1h' | '1d';
		if (interval !== '1h' && interval !== '1d') {
			return fail(400, { error: 'Invalid interval. Use 1h or 1d.' });
		}
		try {
			const result = await seedTestSeasonPair(pb, interval);
			return { success: true, ...result };
		} catch (e: unknown) {
			return fail(500, { error: (e as Error).message });
		}
	},

	// Clear a single test season and all its data
	clearTestSeason: async ({ request }) => {
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

	// Clear all test seasons then seed a fresh pair
	resetTestSeason: async ({ request }) => {
		const pb       = await pbAdmin();
		const formData = await request.formData();
		const interval = (formData.get('interval') ?? '1h') as '1h' | '1d';
		const seasonIds = formData.getAll('seasonId') as string[];

		// Clear existing test seasons
		for (const id of seasonIds) {
			try { await clearTestSeason(pb, id); } catch { /* skip */ }
		}

		// Seed fresh
		try {
			const result = await seedTestSeasonPair(pb, interval);
			return { success: true, ...result };
		} catch (e: unknown) {
			return fail(500, { error: (e as Error).message });
		}
	},
};
