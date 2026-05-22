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

		// Verify Turnstile when configured
		const turnstileSecret = env.TURNSTILE_SECRET_KEY;
		if (turnstileSecret) {
			const token = data.get('cf-turnstile-response') as string | null;
			if (!token) return fail(400, { error: 'CAPTCHA verification required.' });
			const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ secret: turnstileSecret, response: token }),
			});
			const verify = await verifyRes.json() as { success: boolean };
			if (!verify.success) return fail(400, { error: 'CAPTCHA verification failed. Please try again.' });
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
