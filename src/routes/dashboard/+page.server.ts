import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard');

	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	const cookie = cookies.get('pb_auth');
	if (cookie) {
		const { token, record } = JSON.parse(cookie);
		pb.authStore.save(token, record);
	}

	const [entries, activeSeason] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: `user = "${locals.user.id}"`,
			expand: 'season',
			sort:   '-created'
		}),
		pb.collection('seasons').getFirstListItem('status = "active" || status = "open"', {
			sort: '-year'
		}).catch(() => null)
	]);

	// Current week for active season
	let currentWeek = null;
	if (activeSeason) {
		currentWeek = await pb.collection('weekly_settings').getFirstListItem(
			`season = "${activeSeason.id}" && (status = "open" || status = "locked")`,
			{ sort: 'week' }
		).catch(() => null);
	}

	const activeEntries    = entries.filter(e => e.status === 'active');
	const pendingEntries   = entries.filter(e => e.status === 'pending_payment');
	const eliminatedEntries= entries.filter(e => e.status === 'eliminated');

	return {
		user: {
			id:          locals.user.id,
			displayName: locals.user.displayName as string,
			role:        locals.user.role        as string
		},
		entries,
		activeEntries,
		pendingEntries,
		eliminatedEntries,
		activeSeason,
		currentWeek
	};
};
