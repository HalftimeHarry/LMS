import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { fail, redirect } from '@sveltejs/kit';
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

export const load: PageServerLoad = async ({ cookies }) => {
	const pb = await adminPb(cookies);
	const seasons = await pb.collection('seasons').getFullList({
		sort: '-year'
	});
	return { seasons };
};

export const actions: Actions = {
	delete: async ({ request, cookies }) => {
		const pb = await adminPb(cookies);
		const data = await request.formData();
		const id = data.get('id') as string;
		try {
			await pb.collection('seasons').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
	},

	setStatus: async ({ request, cookies }) => {
		const pb = await adminPb(cookies);
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
