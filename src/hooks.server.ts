import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

	const cookie = event.cookies.get('pb_auth');
	if (cookie) {
		try {
			const { token, record } = JSON.parse(cookie);
			pb.authStore.save(token, record);
		} catch {
			event.cookies.delete('pb_auth', { path: '/' });
		}
	}

	event.locals.user = pb.authStore.isValid ? pb.authStore.record : null;
	event.locals.role = (event.locals.user?.role as App.Locals['role']) ?? null;

	return resolve(event);
};
