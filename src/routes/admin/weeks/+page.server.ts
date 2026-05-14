import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function adminPb(cookies: import('@sveltejs/kit').Cookies) {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	const cookie = cookies.get('pb_auth');
	if (cookie) {
		const { token, record } = JSON.parse(cookie);
		pb.authStore.save(token, record);
	}
	return pb;
}

export const load: PageServerLoad = async ({ cookies, url }) => {
	const pb = await adminPb(cookies);
	const seasonId = url.searchParams.get('season') ?? '';

	const [seasons, teams] = await Promise.all([
		pb.collection('seasons').getFullList({ sort: '-year' }),
		pb.collection('nfl_teams').getFullList({ sort: 'name' })
	]);

	const activeSeason = seasonId
		? seasons.find((s) => s.id === seasonId) ?? seasons[0]
		: seasons[0];

	const weeks = activeSeason
		? await pb.collection('weekly_settings').getFullList({
				filter: `season = "${activeSeason.id}"`,
				expand: 'biggestFavoriteTeam',
				sort:   'week'
		  })
		: [];

	return { seasons, teams, weeks, activeSeason: activeSeason ?? null };
};

export const actions: Actions = {
	createWeek: async ({ request, cookies }) => {
		const pb   = await adminPb(cookies);
		const data = await request.formData();

		const seasonId   = data.get('seasonId')  as string;
		const week       = Number(data.get('week'));
		const deadline   = data.get('deadline')  as string;
		const notes      = (data.get('notes') as string | null) ?? '';

		if (!seasonId || !week || !deadline) {
			return fail(400, { error: 'Season, week number and deadline are required.' });
		}

		// Prevent duplicate week numbers in same season
		const existing = await pb.collection('weekly_settings').getList(1, 1, {
			filter: `season = "${seasonId}" && week = ${week}`
		});
		if (existing.totalItems > 0) {
			return fail(400, { error: `Week ${week} already exists for this season.` });
		}

		try {
			await pb.collection('weekly_settings').create({
				season:   seasonId,
				week,
				deadline,
				status:   'open',
				notes:    notes || null
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create week.' });
		}
		return { success: true };
	},

	setStatus: async ({ request, cookies }) => {
		const pb   = await adminPb(cookies);
		const data = await request.formData();
		const id     = data.get('id')     as string;
		const status = data.get('status') as string;
		try {
			await pb.collection('weekly_settings').update(id, { status });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	setFavorite: async ({ request, cookies }) => {
		const pb   = await adminPb(cookies);
		const data = await request.formData();
		const id     = data.get('id')     as string;
		const teamId = data.get('teamId') as string;
		try {
			await pb.collection('weekly_settings').update(id, {
				biggestFavoriteTeam: teamId || null
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	deleteWeek: async ({ request, cookies }) => {
		const pb   = await adminPb(cookies);
		const data = await request.formData();
		const id   = data.get('id') as string;
		try {
			await pb.collection('weekly_settings').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
	}
};
