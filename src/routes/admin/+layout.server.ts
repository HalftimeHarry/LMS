import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const RESULTS_UNLOCK_AT_ISO = '2026-09-09T23:50:00.000Z';

// All /admin routes require pool_admin or super_admin
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/admin');
	if (locals.role !== 'super_admin' && locals.role !== 'pool_admin') {
		redirect(302, '/dashboard');
	}
	const resultsUnlockAt = RESULTS_UNLOCK_AT_ISO;
	const resultsUnlocked = Date.now() >= new Date(resultsUnlockAt).getTime();
	return { user: locals.user, role: locals.role, resultsUnlockAt, resultsUnlocked };
};
