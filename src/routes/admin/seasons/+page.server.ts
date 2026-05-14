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
	}
};
