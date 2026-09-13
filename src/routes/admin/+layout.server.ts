import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// All /admin routes require pool_admin or super_admin
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/admin');
	if (locals.role !== 'super_admin' && locals.role !== 'pool_admin') {
		redirect(302, '/dashboard');
	}
	return { user: locals.user, role: locals.role };
};
