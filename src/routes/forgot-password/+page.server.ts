import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isRateLimited, clientIp } from '$lib/server/rate-limit';

const PB_URL = (env.PUBLIC_POCKETBASE_URL ?? process.env.PUBLIC_POCKETBASE_URL ?? '').replace(/\/$/, '');

export const actions = {
	default: async ({ request }: { request: Request }) => {
		// Rate limit: 5 requests per IP per 15 minutes
		const ip = clientIp(request);
		if (isRateLimited(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
			return fail(429, { error: 'Too many requests. Please wait a few minutes and try again.' });
		}

		const data  = await request.formData();
		const email = (data.get('email') as string | null)?.trim().toLowerCase();

		if (!email) return fail(400, { error: 'Email is required.' });
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, { error: 'Enter a valid email address.' });

		// Always return success — don't reveal whether the email exists
		try {
			await fetch(`${PB_URL}/api/collections/users/request-password-reset`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			});
		} catch {
			// Swallow errors — same response either way
		}

		return { sent: true };
	},
};
