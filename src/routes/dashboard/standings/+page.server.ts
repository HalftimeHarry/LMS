import { redirect } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/register?reason=standings');

	const pb = await pbAdmin();

	const seasons = await pb.collection('seasons').getFullList({ sort: '-year' });
	const activeSeason = seasons.find((s) => s.status === 'active' || s.status === 'open')
		?? seasons[0]
		?? null;

	if (!activeSeason) {
		return { activeSeason: null, lmsEntries: [], secondHalfEntries: [], currentWeek: null };
	}

	const [entries, currentWeek] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: `season = "${activeSeason.id}" && status != "pending_payment"`,
			expand: 'user',
			sort:   '+entryName'
		}).catch(() => []),
		pb.collection('weekly_settings').getFirstListItem(
			`season = "${activeSeason.id}" && (status = "open" || status = "locked" || status = "results_pending")`,
			{ sort: '-week' }
		).catch(() => null)
	]);

	const lmsEntries        = (entries as any[]).filter((e) => e.entryType === 'lms');
	const secondHalfEntries = (entries as any[]).filter((e) => e.entryType === 'second_half');

	return { activeSeason, lmsEntries, secondHalfEntries, currentWeek };
};
