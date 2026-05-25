import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb           = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';
	const allSeasons   = await pb.collection('seasons').getFullList({ sort: '-year' });
	const seasons      = isSuperAdmin
		? allSeasons
		: (allSeasons as any[]).filter((s: any) => !s.name?.includes('[TEST]'));
	return { seasons };
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id') as string;
		if (!id) return fail(400, { error: 'Season ID required.' });

		const season = await pb.collection('seasons').getOne(id).catch(() => null) as any;
		if (!season) return fail(404, { error: 'Season not found.' });
		if (!season.name?.includes('[TEST]')) {
			return fail(400, { error: 'Only [TEST] seasons can be deleted here. Archive real seasons by setting status to "complete".' });
		}

		// Cascade: weekly_settings → picks → pick_results → entries → season
		const weeks = await pb.collection('weekly_settings').getFullList({
			filter: `season = "${id}"`
		}).catch(() => []) as any[];

		// Collect all picks for this season's weeks
		const weekIds = weeks.map((w: any) => w.id);
		const picks = weekIds.length
			? await pb.collection('picks').getFullList({
				filter: weekIds.map((wid: string) => `week = "${wid}"`).join(' || ')
			  }).catch(() => []) as any[]
			: [];

		// Delete pick_results first
		for (const p of picks) {
			const results = await pb.collection('pick_results').getFullList({
				filter: `pick = "${p.id}"`
			}).catch(() => []) as any[];
			for (const r of results) await pb.collection('pick_results').delete(r.id).catch(() => {});
		}

		// Delete picks
		for (const p of picks) await pb.collection('picks').delete(p.id).catch(() => {});

		// Delete weekly_settings
		for (const w of weeks) await pb.collection('weekly_settings').delete(w.id).catch(() => {});

		// Delete entries
		const entries = await pb.collection('entries').getFullList({
			filter: `season = "${id}"`
		}).catch(() => []) as any[];
		for (const e of entries) await pb.collection('entries').delete(e.id).catch(() => {});

		// Delete the season itself
		try {
			await pb.collection('seasons').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Season delete failed.' });
		}

		return { success: true, deleted: { weeks: weeks.length, picks: picks.length, entries: entries.length } };
	},

	setStatus: async ({ request }) => {
		const pb = await pbAdmin();
		const data = await request.formData();
		const id     = data.get('id')     as string;
		const status = data.get('status') as string;
		try {
			await pb.collection('seasons').update(id, { status });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	togglePool: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id')   as string;
		const pool = data.get('pool') as 'lms' | 'second_half';
		const enabled = data.get('enabled') === 'true';

		const field = pool === 'lms' ? 'lmsEnabled' : 'secondHalfEnabled';
		try {
			await pb.collection('seasons').update(id, { [field]: enabled });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true, pool, enabled };
	},

	updatePoolConfig: async ({ request }) => {
		const pb  = await pbAdmin();
		const raw = await request.formData();
		const id  = raw.get('id') as string;

		const secondHalfStartWeek      = parseInt(raw.get('secondHalfStartWeek')      as string);
		const secondHalfPicksStartWeek = parseInt(raw.get('secondHalfPicksStartWeek') as string);
		const secondHalfPicksPerWeek   = parseInt(raw.get('secondHalfPicksPerWeek')   as string);

		if (
			isNaN(secondHalfStartWeek)      || secondHalfStartWeek < 1      || secondHalfStartWeek > 18 ||
			isNaN(secondHalfPicksStartWeek) || secondHalfPicksStartWeek < 1 || secondHalfPicksStartWeek > 18 ||
			isNaN(secondHalfPicksPerWeek)   || secondHalfPicksPerWeek < 1   || secondHalfPicksPerWeek > 3
		) {
			return fail(400, { error: 'Invalid pool configuration values.' });
		}

		try {
			await pb.collection('seasons').update(id, {
				secondHalfStartWeek,
				secondHalfPicksStartWeek,
				secondHalfPicksPerWeek,
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	}
};
