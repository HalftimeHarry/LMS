import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const PB_URL = (env.PUBLIC_POCKETBASE_URL ?? process.env.PUBLIC_POCKETBASE_URL ?? '').replace(/\/$/, '');

export const load = async ({ url }: { url: URL }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token };
};

export const actions = {
	default: async ({ request }: { request: Request }) => {
		const data     = await request.formData();
		const token    = (data.get('token')    as string | null)?.trim() ?? '';
		const password = (data.get('password') as string | null) ?? '';
		const confirm  = (data.get('confirm')  as string | null) ?? '';

		if (!token)                        return fail(400, { error: 'Reset token is missing. Use the link from your email.' });
		if (password.length < 8)           return fail(400, { error: 'Password must be at least 8 characters.' });
		if (password !== confirm)          return fail(400, { error: 'Passwords do not match.' });

		const res = await fetch(`${PB_URL}/api/collections/users/confirm-password-reset`, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json' },
			body:    JSON.stringify({ token, password, passwordConfirm: confirm }),
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({})) as { message?: string };
			const msg  = body.message ?? 'Reset failed.';
			// Surface a friendlier message for expired/invalid tokens
			if (msg.toLowerCase().includes('token') || res.status === 400) {
				return fail(400, { error: 'This reset link has expired or already been used. Request a new one.' });
			}
			return fail(400, { error: msg });
		}

		redirect(303, '/login?reset=1');
	},
};
