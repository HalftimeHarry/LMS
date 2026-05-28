import { pbAdmin } from '$lib/server/pb-admin';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role !== 'super_admin') redirect(303, '/admin');

	const pb = await pbAdmin();

	const [users, entries] = await Promise.all([
		pb.collection('users').getFullList({
			sort:   '-created',
			fields: 'id,displayName,email,role,created,verified',
		}),
		pb.collection('entries').getFullList({
			fields: 'id,user,status,entryType,season',
		}),
	]);

	// Count entries per user
	const entryCounts: Record<string, number> = {};
	for (const e of entries as any[]) {
		entryCounts[e.user] = (entryCounts[e.user] ?? 0) + 1;
	}

	return { users, entryCounts };
};

export const actions: Actions = {
	deleteUsers: async ({ request, locals }) => {
		if (locals.role !== 'super_admin') return fail(403, { error: 'Not authorized.' });

		const pb   = await pbAdmin();
		const data = await request.formData();
		const ids  = data.getAll('ids') as string[];

		if (!ids.length) return fail(400, { error: 'No users selected.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				await pb.collection('users').delete(id);
			} catch (e: any) {
				errors.push(id);
			}
		}

		if (errors.length) return fail(500, { error: `Failed to delete ${errors.length} user(s).` });
		return { success: true, deleted: ids.length };
	},
};
