import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

	let hydratedUser: Record<string, unknown> | null = null;
	const cookie = event.cookies.get('pb_auth');
	if (cookie) {
		try {
			const { token, record } = JSON.parse(cookie);
			if (token && record) {
				pb.authStore.save(token, record);
				hydratedUser = record;
			}
		} catch {
			event.cookies.delete('pb_auth', { path: '/' });
		}
	}

	event.locals.user = hydratedUser as App.Locals['user'] | null;
	event.locals.role = (event.locals.user?.role as App.Locals['role']) ?? null;

	return resolve(event);
};
