import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();

	const [seasons, allEntries, users] = await Promise.all([
		pb.collection('seasons').getFullList({ sort: '-year' }),
		pb.collection('entries').getFullList({ fields: 'id,status,paid,season,entryType' }),
		pb.collection('users').getList(1, 1, { fields: 'id' })
	]);

	const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'open') ?? null;
	const seasonEntries = activeSeason
		? allEntries.filter(e => e.season === activeSeason.id)
		: allEntries;

	const stats = {
		totalUsers:        users.totalItems,
		totalEntries:      seasonEntries.length,
		lmsEntries:        seasonEntries.filter(e => e.entryType === 'lms').length,
		secondHalfEntries: seasonEntries.filter(e => e.entryType === 'second_half').length,
		paidEntries:       seasonEntries.filter(e => e.paid).length,
		pendingPayment:    seasonEntries.filter(e => e.status === 'pending_payment').length,
		activeEntries:     seasonEntries.filter(e => e.status === 'active').length,
		eliminatedEntries: seasonEntries.filter(e => e.status === 'eliminated').length,
		potEstimate:
			seasonEntries.filter(e => e.paid && e.entryType === 'lms').length *
				(activeSeason?.lmsEntryFee ?? 0) +
			seasonEntries.filter(e => e.paid && e.entryType === 'second_half').length *
				(activeSeason?.secondHalfEntryFee ?? 0)
	};

	return {
		role: locals.role as string,
		seasons,
		activeSeason,
		stats
	};
};
