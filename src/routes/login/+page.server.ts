import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function roleHome(role: string | null) {
	return role === 'super_admin' || role === 'pool_admin' ? '/admin' : '/dashboard';
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, roleHome(locals.role));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email    = data.get('email')    as string;
		const password = data.get('password') as string;
		const remember = data.get('remember') === 'on';
		const explicit = (data.get('redirect') as string) || '';

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		try {
			await pb.collection('users').authWithPassword(email, password);
		} catch {
			return fail(400, { error: 'Invalid email or password.' });
		}

		const role   = (pb.authStore.record?.role as string) ?? null;
		const dest   = explicit || roleHome(role);

		cookies.set(
			'pb_auth',
			JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record }),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: remember ? 60 * 60 * 24 * 30 : undefined // session cookie if not remembered
			}
		);

		redirect(302, dest);
	}
};
