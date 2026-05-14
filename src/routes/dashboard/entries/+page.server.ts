import { pbAdmin } from '$lib/server/pb-admin';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries');

	const pb = await pbAdmin();

	const [entries, seasons] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: `user = "${locals.user.id}"`,
			expand: 'season',
			sort:   '-id'
		}),
		pb.collection('seasons').getFullList({
			filter: 'status = "open" || status = "active"',
			sort:   '-year'
		})
	]);

	return { entries, seasons };
};
