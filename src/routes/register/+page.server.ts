import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/dashboard');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const displayName = data.get('displayName') as string;
		const email       = data.get('email')       as string;
		const password    = data.get('password')    as string;
		const confirm     = data.get('confirm')     as string;
		const remember    = data.get('remember') === 'on';

		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		try {
			await pb.collection('users').create({
				email,
				password,
				passwordConfirm: confirm,
				displayName,
				role: 'participant'
			});
			await pb.collection('users').authWithPassword(email, password);
		} catch (e: unknown) {
			const msg = (e as { message?: string })?.message ?? 'Registration failed.';
			return fail(400, { error: msg });
		}

		cookies.set(
			'pb_auth',
			JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record }),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: remember ? 60 * 60 * 24 * 30 : undefined
			}
		);

		redirect(302, '/dashboard');
	}
};
