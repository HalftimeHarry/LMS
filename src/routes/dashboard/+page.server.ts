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

	let currentWeek = null;
	if (activeSeason) {
		currentWeek = await pb.collection('weekly_settings').getFirstListItem(
			`season = "${activeSeason.id}" && (status = "open" || status = "locked")`,
			{ sort: 'week' }
		).catch(() => null);
	}

	const e = entries as any[];
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
		currentWeek
	};
};
