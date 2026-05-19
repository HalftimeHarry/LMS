import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const pb = await pbAdmin();
	const seasons = await pb.collection('seasons').getFullList({ sort: '-year' });
	return { seasons };
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const pb = await pbAdmin();
		const data = await request.formData();
		const id = data.get('id') as string;
		try {
			await pb.collection('seasons').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
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
