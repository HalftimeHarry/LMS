import { redirect } from '@sveltejs/kit';
import { isAdminRole } from '$lib/server/role-utils';
import type { LayoutServerLoad } from './$types';

// pool_admin and super_admin have no participant dashboard — send them to /admin.
// Rules and standings are exempt — visible to all authenticated users.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const exempt = ['/dashboard/rules', '/dashboard/standings', '/dashboard/odds'];
	if (isAdminRole(locals.role) && !exempt.some((p) => url.pathname.startsWith(p))) {
		throw redirect(302, '/admin');
	}
	return {};
};
