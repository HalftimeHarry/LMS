import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/entries');

	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	const cookie = cookies.get('pb_auth');
	if (cookie) {
		const { token, record } = JSON.parse(cookie);
		pb.authStore.save(token, record);
	}

	const [entries, seasons] = await Promise.all([
		pb.collection('entries').getFullList({
			filter: `user = "${locals.user.id}"`,
			expand: 'season',
			sort:   '-created'
		}),
		pb.collection('seasons').getFullList({
			filter: 'status = "open" || status = "active"',
			sort:   '-year'
		})
	]);

	return { entries, seasons };
};
