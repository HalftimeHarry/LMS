import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login?redirect=/dashboard/profile');
	return {
		user: {
			id:          locals.user.id,
			displayName: locals.user.displayName as string,
			email:       locals.user.email       as string,
			role:        locals.user.role        as string
		}
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');

		const data        = await request.formData();
		const displayName = (data.get('displayName') as string)?.trim();

		if (!displayName || displayName.length < 2) {
			return fail(400, { error: 'Display name must be at least 2 characters.', action: 'profile' });
		}

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		const cookie = cookies.get('pb_auth');
		if (cookie) {
			const { token, record } = JSON.parse(cookie);
			pb.authStore.save(token, record);
		}

		try {
			await pb.collection('users').update(locals.user.id, { displayName });
			// Refresh cookie with updated record
			await pb.collection('users').authRefresh();
			cookies.set('pb_auth', JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record }), {
				path: '/', httpOnly: true, sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.', action: 'profile' });
		}

		return { success: true, action: 'profile' };
	},

	changePassword: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(302, '/login');

		const data        = await request.formData();
		const current     = data.get('currentPassword')  as string;
		const newPassword = data.get('newPassword')       as string;
		const confirm     = data.get('confirmPassword')   as string;

		if (newPassword !== confirm) {
			return fail(400, { error: 'New passwords do not match.', action: 'password' });
		}
		if (newPassword.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', action: 'password' });
		}

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		// Re-authenticate with current password to verify identity
		try {
			await pb.collection('users').authWithPassword(locals.user.email as string, current);
		} catch {
			return fail(400, { error: 'Current password is incorrect.', action: 'password' });
		}

		try {
			await pb.collection('users').update(locals.user.id, {
				password: newPassword,
				passwordConfirm: confirm,
				oldPassword: current
			});
			// Force re-login after password change
			cookies.delete('pb_auth', { path: '/' });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Password change failed.', action: 'password' });
		}

		redirect(302, '/login?message=password_changed');
	}
};
