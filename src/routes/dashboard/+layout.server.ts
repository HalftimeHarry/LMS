import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// pool_admin and super_admin have no participant dashboard — send them to /admin.
// Rules and standings are public-ish so we exempt them from this guard.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const exempt = ['/dashboard/rules', '/dashboard/standings'];
	if (
		(locals.role === 'pool_admin' || locals.role === 'super_admin') &&
		!exempt.some((p) => url.pathname.startsWith(p))
	) {
		redirect(302, '/admin');
	}
	return {};
};
