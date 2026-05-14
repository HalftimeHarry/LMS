import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	const cookie = cookies.get('pb_auth');
	if (cookie) {
		const { token, record } = JSON.parse(cookie);
		pb.authStore.save(token, record);
	}

	const [seasons, allEntries, users] = await Promise.all([
		pb.collection('seasons').getFullList({ sort: '-year' }),
		pb.collection('entries').getFullList({ fields: 'id,status,paid,season' }),
		pb.collection('users').getList(1, 1, { fields: 'id' })
	]);

	const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'open') ?? null;
	const seasonEntries = activeSeason
		? allEntries.filter(e => e.season === activeSeason.id)
		: allEntries;

	const stats = {
		totalUsers:       users.totalItems,
		totalEntries:     seasonEntries.length,
		paidEntries:      seasonEntries.filter(e => e.paid).length,
		pendingPayment:   seasonEntries.filter(e => e.status === 'pending_payment').length,
		activeEntries:    seasonEntries.filter(e => e.status === 'active').length,
		eliminatedEntries:seasonEntries.filter(e => e.status === 'eliminated').length,
		potEstimate:      seasonEntries.filter(e => e.paid).length * (activeSeason?.entryFee ?? 100)
	};

	return { seasons, activeSeason, stats };
};
