import { pbAdmin } from '$lib/server/pb-admin';
import { fail, redirect } from '@sveltejs/kit';
import { seasonSchema } from '$lib/schemas';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const pb = await pbAdmin();

		const raw    = await request.formData();
		const parsed = seasonSchema.safeParse({
			name:                (raw.get('name') as string)?.trim(),
			year:                raw.get('year'),
			lmsEntryFee:         raw.get('lmsEntryFee'),
			secondHalfEntryFee:  raw.get('secondHalfEntryFee'),
			paymentDeadline:     raw.get('paymentDeadline')   || undefined,
			firstPickDeadline:   raw.get('firstPickDeadline') || undefined,
			regularSeasonOnly:   raw.get('regularSeasonOnly') === 'on',
			notes:               (raw.get('notes') as string) || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message });
		}
		const { name, year, lmsEntryFee, secondHalfEntryFee, paymentDeadline, firstPickDeadline, regularSeasonOnly, notes } = parsed.data;

		// datetime-local sends "YYYY-MM-DDTHH:MM" — PocketBase needs full ISO with seconds
		const toIso = (v?: string) => v ? new Date(v).toISOString().replace('T', ' ') : null;

		try {
			await pb.collection('seasons').create({
				year, name, lmsEntryFee, secondHalfEntryFee,
				status: 'setup',
				regularSeasonOnly,
				paymentDeadline:   toIso(paymentDeadline),
				firstPickDeadline: toIso(firstPickDeadline),
				notes:             notes ?? null
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create season.' });
		}

		redirect(302, '/admin/seasons');
	}
};
