import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { redirect, fail } from '@sveltejs/kit';
import { sendWelcomeEmail } from '$lib/server/emailjs';
import { isRateLimited, clientIp } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/dashboard');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		// Rate limit: 5 registrations per IP per hour
		const ip = clientIp(request);
		if (isRateLimited(`register:${ip}`, 5, 60 * 60 * 1000)) {
			return fail(429, { error: 'Too many registration attempts. Please try again later.' });
		}

		const data        = await request.formData();
		const displayName = (data.get('displayName') as string)?.trim();
		const email       = (data.get('email')       as string)?.trim();
		const password    = data.get('password') as string;
		const confirm     = data.get('confirm')  as string;
		const remember    = data.get('remember') === 'on';

		const fields = { displayName, email };

		if (!displayName || displayName.length < 2) return fail(400, { error: 'Full name is required.', fields });
		if (!email)                                  return fail(400, { error: 'Email is required.',     fields });

		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.', fields });
		}
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', fields });
		}

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		try {
			await pb.collection('users').create({
				email,
				password,
				passwordConfirm: confirm,
				displayName,
				role: 'participant',
			});
			await pb.collection('users').authWithPassword(email, password);
		} catch (e: unknown) {
			const msg = (e as { message?: string })?.message ?? 'Registration failed.';
			return fail(400, { error: msg, fields });
		}

		// Send welcome email — fire-and-forget, never blocks registration
		const appUrl = env.PUBLIC_APP_URL ?? PUBLIC_POCKETBASE_URL.replace(/\/api$/, '');
		sendWelcomeEmail({ displayName, email, appUrl }).catch(() => {});

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
