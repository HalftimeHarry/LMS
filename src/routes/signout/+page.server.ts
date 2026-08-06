import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const clearDevAuth = (cookies: { delete: (name: string, options?: { path?: string }) => void; set: (name: string, value: string, options?: { path?: string; httpOnly?: boolean }) => void }) => {
	cookies.delete('pb_auth', { path: '/' });
	cookies.set('dev_bypass', 'disabled', { path: '/', httpOnly: true });
};

export const load: PageServerLoad = async ({ cookies }) => {
	clearDevAuth(cookies);
	throw redirect(302, '/login');
};

export const actions: Actions = {
	default: async ({ cookies }) => {
		clearDevAuth(cookies);
		throw redirect(302, '/login');
	}
};
