import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Create a fresh PocketBase instance per request (SSR is stateless)
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

	// Try to restore auth from the cookie sent by the browser
	const cookie = event.cookies.get('pb_auth');
	if (cookie) {
		try {
			const { token, record } = JSON.parse(cookie);
			pb.authStore.save(token, record);
			// Refresh the token if it's still valid
			if (pb.authStore.isValid) {
				await pb.collection('users').authRefresh();
			}
		} catch {
			// Invalid / expired cookie — clear it
			event.cookies.delete('pb_auth', { path: '/' });
		}
	}

	event.locals.user = pb.authStore.isValid ? pb.authStore.record : null;
	event.locals.role = (event.locals.user?.role as App.Locals['role']) ?? null;

	const response = await resolve(event);

	// Keep the cookie in sync with the (possibly refreshed) token
	if (pb.authStore.isValid && pb.authStore.token) {
		event.cookies.set(
			'pb_auth',
			JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record }),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 60 * 24 * 30 // 30 days — client-side "remember me" controls localStorage separately
			}
		);
	}

	return response;
};
