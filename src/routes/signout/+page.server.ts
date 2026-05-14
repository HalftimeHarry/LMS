import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		cookies.delete('pb_auth', { path: '/' });
		redirect(302, '/');
	}
};
