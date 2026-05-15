import { pbAdmin } from '$lib/server/pb-admin';
import { SeasonProvider, EntryProvider, WeekProvider } from '$lib/providers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();

	const seasonProvider = new SeasonProvider(pb);
	const entryProvider  = new EntryProvider(pb);
	const weekProvider   = new WeekProvider(pb);

	const seasons = await seasonProvider.getAll();
	const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'open') ?? null;

	const [allEntries, users, currentWeek, pendingPaymentEntries] = await Promise.all([
		entryProvider.getStatsFields(activeSeason?.id),
		pb.collection('users').getList(1, 1, { fields: 'id' }),
		activeSeason ? weekProvider.getCurrentWeek(activeSeason.id) : Promise.resolve(null),
		activeSeason
			? entryProvider.getAll({ seasonId: activeSeason.id, status: 'pending_payment' })
			: Promise.resolve([])
	]);

	const seasonEntries  = allEntries; // already filtered to activeSeason by getStatsFields

	const paidLms        = seasonEntries.filter(e => e.paid && e.entryType === 'lms'         && e.paymentMethod !== 'free');
	const paidSecondHalf = seasonEntries.filter(e => e.paid && e.entryType === 'second_half' && e.paymentMethod !== 'free');
	const freeEntries    = seasonEntries.filter(e => e.paid && e.paymentMethod === 'free');

	const stats = {
		totalUsers:        users.totalItems,
		totalEntries:      seasonEntries.length,
		lmsEntries:        seasonEntries.filter(e => e.entryType === 'lms').length,
		secondHalfEntries: seasonEntries.filter(e => e.entryType === 'second_half').length,
		paidEntries:       seasonEntries.filter(e => e.paid).length,
		freeEntries:       freeEntries.length,
		pendingPayment:    seasonEntries.filter(e => e.status === 'pending_payment').length,
		activeEntries:     seasonEntries.filter(e => e.status === 'active').length,
		eliminatedEntries: seasonEntries.filter(e => e.status === 'eliminated').length,
		lmsPot:            paidLms.length        * (activeSeason?.lmsEntryFee        ?? 0),
		secondHalfPot:     paidSecondHalf.length * (activeSeason?.secondHalfEntryFee ?? 0),
		potEstimate:
			paidLms.length        * (activeSeason?.lmsEntryFee        ?? 0) +
			paidSecondHalf.length * (activeSeason?.secondHalfEntryFee ?? 0)
	};

	return {
		role: locals.role as string,
		seasons,
		activeSeason,
		currentWeek,
		pendingPaymentEntries: pendingPaymentEntries.slice(0, 5), // top 5 for quick action
		pendingPaymentCount:   stats.pendingPayment,
		stats
	};
};
