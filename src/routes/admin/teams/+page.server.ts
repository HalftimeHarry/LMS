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

	const teams = await pb.collection('nfl_teams').getFullList({ sort: 'conference,division,name' });
	return { teams };
};
