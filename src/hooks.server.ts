import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

const DEV_BYPASS_COOKIE = 'dev_bypass';
const DEV_BYPASS_USER = {
	id: 'dev-user',
	email: 'dev@example.com',
	displayName: 'Dev User',
	role: 'participant'
};

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

	const devBypassDisabled = import.meta.env.DEV && event.cookies.get(DEV_BYPASS_COOKIE) === 'disabled';
	if (!hydratedUser && import.meta.env.DEV && !devBypassDisabled) {
		hydratedUser = DEV_BYPASS_USER as Record<string, unknown>;
	}

	event.locals.user = hydratedUser as App.Locals['user'] | null;
	event.locals.role = (event.locals.user?.role as App.Locals['role']) ?? null;

	if (import.meta.env.DEV) {
		const path = event.url?.pathname ?? '/';
		console.log('[dev auth]', { path, userId: event.locals.user?.id, role: event.locals.role });
	}

	return resolve(event);
};
