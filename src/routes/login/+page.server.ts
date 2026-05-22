import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { redirect, fail } from '@sveltejs/kit';
import { roleHome } from '$lib/server/role-utils';
import { isRateLimited, clientIp } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, roleHome(locals.role));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		// Rate limit: 10 attempts per IP per 15 minutes
		const ip = clientIp(request);
		if (isRateLimited(`login:${ip}`, 10, 15 * 60 * 1000)) {
			return fail(429, { error: 'Too many login attempts. Please wait a few minutes and try again.' });
		}

		const data     = await request.formData();
		const email    = data.get('email')    as string;
		const password = data.get('password') as string;
		const remember = data.get('remember') === 'on';
		const explicit = (data.get('redirect') as string) || '';

		// Verify Turnstile when configured
		const turnstileSecret = env.TURNSTILE_SECRET_KEY;
		if (turnstileSecret) {
			const token = data.get('cf-turnstile-response') as string | null;
			if (!token) return fail(400, { error: 'CAPTCHA verification required.' });
			const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ secret: turnstileSecret, response: token }),
			});
			const verify = await verifyRes.json() as { success: boolean };
			if (!verify.success) return fail(400, { error: 'CAPTCHA verification failed. Please try again.' });
		}

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
