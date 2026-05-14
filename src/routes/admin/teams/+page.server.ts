import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const pb = await pbAdmin();
	const teams = await pb.collection('nfl_teams').getFullList({ sort: 'conference,division,name' });
	return { teams };
};
