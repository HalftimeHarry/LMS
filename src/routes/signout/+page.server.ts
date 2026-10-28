import { redirect, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const clearDevAuth = (cookies: Cookies) => {
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
