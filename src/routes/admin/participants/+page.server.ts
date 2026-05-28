import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const pb = await pbAdmin();

	const [users, entries] = await Promise.all([
		pb.collection('users').getFullList({
			filter: 'role = "participant"',
			sort:   '+displayName',
			fields: 'id,displayName,email,created,verified',
		}),
		pb.collection('entries').getFullList({
			fields: 'id,user,status,entryType,entryName',
		}),
	]);

	// Group entries by user
	const entriesByUser: Record<string, any[]> = {};
	for (const e of entries as any[]) {
		if (!entriesByUser[e.user]) entriesByUser[e.user] = [];
		entriesByUser[e.user].push(e);
	}

	return { users, entriesByUser };
};

export const actions: Actions = {
	// Delete one or more participants. Also deletes their entries.
	delete: async ({ request, locals }) => {
		if (locals.role !== 'super_admin' && locals.role !== 'pool_admin') {
			return fail(403, { error: 'Not authorized.' });
		}

		const pb   = await pbAdmin();
		const data = await request.formData();
		const ids  = data.getAll('ids') as string[];

		if (!ids.length) return fail(400, { error: 'No participants selected.' });

		// Verify every id is actually a participant — never delete admins
		const users = await pb.collection('users').getFullList({
			filter: ids.map(id => `id = "${id}"`).join(' || '),
			fields: 'id,role',
		}).catch(() => []) as any[];

		const safeIds = users.filter((u: any) => u.role === 'participant').map((u: any) => u.id);
		if (safeIds.length !== ids.length) {
			return fail(400, { error: 'One or more selected users are not participants.' });
		}

		const errors: string[] = [];
		for (const id of safeIds) {
			try {
				// Delete entries first (cascade not guaranteed)
				const userEntries = await pb.collection('entries').getFullList({
					filter: `user = "${id}"`,
					fields: 'id',
				}).catch(() => []) as any[];
				for (const e of userEntries) {
					await pb.collection('entries').delete(e.id).catch(() => {});
				}
				await pb.collection('users').delete(id);
			} catch {
				errors.push(id);
			}
		}

		if (errors.length) {
			return fail(500, { error: `Failed to delete ${errors.length} participant(s). Others may have been removed.` });
		}
		return { success: true, deleted: safeIds.length };
	},
};
