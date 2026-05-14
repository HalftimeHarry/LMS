import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ? {
			id:          locals.user.id,
			displayName: locals.user.displayName as string,
			email:       locals.user.email       as string,
			role:        locals.user.role        as string
		} : null
	};
};
