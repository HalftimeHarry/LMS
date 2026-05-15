import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();

	const [seasons, allEntries, users] = await Promise.all([
		pb.collection('seasons').getFullList({ sort: '-year' }),
		pb.collection('entries').getFullList({ fields: 'id,status,paid,paymentMethod,season,entryType' }),
		pb.collection('users').getList(1, 1, { fields: 'id' })
	]);

	const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'open') ?? null;
	const seasonEntries = activeSeason
		? allEntries.filter(e => e.season === activeSeason.id)
		: allEntries;

	// Free entries count as paid but contribute $0 to the pot
	const paidLms        = seasonEntries.filter(e => e.paid && e.entryType === 'lms' && e.paymentMethod !== 'free');
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
		// Pot only counts paying entries — free entries are excluded
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
		stats
	};
};
