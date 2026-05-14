import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { fail, redirect } from '@sveltejs/kit';
import { seasonSchema } from '$lib/schemas';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		const cookie = cookies.get('pb_auth');
		if (cookie) {
			const { token, record } = JSON.parse(cookie);
			pb.authStore.save(token, record);
		}

		const raw    = await request.formData();
		const parsed = seasonSchema.safeParse({
			name:               (raw.get('name') as string)?.trim(),
			year:               raw.get('year'),
			entryFee:           raw.get('entryFee'),
			paymentDeadline:    raw.get('paymentDeadline')  || undefined,
			firstPickDeadline:  raw.get('firstPickDeadline') || undefined,
			regularSeasonOnly:  raw.get('regularSeasonOnly') === 'on',
			notes:              (raw.get('notes') as string) || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message });
		}
		const { name, year, entryFee, paymentDeadline, firstPickDeadline, regularSeasonOnly, notes } = parsed.data;

		try {
			await pb.collection('seasons').create({
				year, name, entryFee,
				status: 'setup',
				regularSeasonOnly,
				paymentDeadline:   paymentDeadline   ?? null,
				firstPickDeadline: firstPickDeadline ?? null,
				notes:             notes             ?? null
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create season.' });
		}

		redirect(302, '/admin/seasons');
	}
};
