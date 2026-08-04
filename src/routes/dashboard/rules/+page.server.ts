import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();
	const canEditRules = locals.role === 'pool_admin' || locals.role === 'super_admin';

	// Fetch the active season for dynamic deadline display
	const seasons = await pb.collection('seasons')
		.getFullList({ filter: 'status = "active" || status = "open"', sort: '-year' })
		.catch(() => []) as any[];

	const season = seasons[0] ?? null;

	// Fetch week 6 deadline for 2H entry cutoff
	let week6Deadline: string | null = null;
	let week6Id: string | null = null;
	if (season) {
		const shStartWeek = season.secondHalfStartWeek ?? 6;
		const week6 = await pb.collection('weekly_settings')
			.getFirstListItem(`season = "${season.id}" && week = ${shStartWeek}`, { fields: 'id,deadline' })
			.catch(() => null) as any;
		week6Deadline = week6?.deadline ?? null;
		week6Id = week6?.id ?? null;
	}

	return { season, week6Deadline, week6Id, canEditRules };
};

export const actions: Actions = {
	updateRulesContent: async ({ request, locals }) => {
		if (locals.role !== 'pool_admin' && locals.role !== 'super_admin') {
			return fail(403, { error: 'Only pool admins or super admins can edit rules content.' });
		}

		const pb = await pbAdmin();
		const data = await request.formData();

		const seasonId = (data.get('seasonId') as string | null) ?? '';
		const shWeekId = (data.get('shWeekId') as string | null) ?? '';
		if (!seasonId) return fail(400, { error: 'Missing season id.' });

		const firstPickDeadlineRaw = (data.get('firstPickDeadline') as string | null) ?? '';
		const secondHalfDeadlineRaw = (data.get('secondHalfDeadline') as string | null) ?? '';
		const rulesDeadlineNote = ((data.get('rulesDeadlineNote') as string | null) ?? '').trim();
		const winnersLocationNote = ((data.get('winnersLocationNote') as string | null) ?? '').trim();

		const winnerYears = data.getAll('winnerYear').map((v) => String(v).trim());
		const winnerNames = data.getAll('winnerName').map((v) => String(v).trim());
		const winnerLocations = data.getAll('winnerLocation').map((v) => String(v).trim());
		const winnerPayouts = data.getAll('winnerPayout').map((v) => String(v).trim());

		const pastWinners = winnerYears
			.map((year, i) => ({
				year,
				winner: winnerNames[i] ?? '',
				location: winnerLocations[i] ?? '',
				payout: winnerPayouts[i] ?? '',
			}))
			.filter((w) => w.year || w.winner || w.location || w.payout)
			.filter((w) => w.year && w.winner);

		const parseLocalDateTime = (value: string): string | null => {
			if (!value) return null;
			const dt = new Date(value);
			if (Number.isNaN(dt.getTime())) return null;
			return dt.toISOString();
		};

		const firstPickDeadline = parseLocalDateTime(firstPickDeadlineRaw);
		if (firstPickDeadlineRaw && !firstPickDeadline) {
			return fail(400, { error: 'Invalid first pick deadline value.' });
		}

		const secondHalfDeadline = parseLocalDateTime(secondHalfDeadlineRaw);
		if (secondHalfDeadlineRaw && !secondHalfDeadline) {
			return fail(400, { error: 'Invalid second half deadline value.' });
		}

		try {
			await pb.collection('seasons').update(seasonId, {
				firstPickDeadline: firstPickDeadline ?? null,
				rulesDeadlineNote: rulesDeadlineNote || null,
				winnersLocationNote: winnersLocationNote || null,
				pastWinnersJson: pastWinners.length ? JSON.stringify(pastWinners) : null,
			});

			if (shWeekId) {
				await pb.collection('weekly_settings').update(shWeekId, {
					deadline: secondHalfDeadline ?? null,
				});
			}
		} catch (e: any) {
			return fail(400, { error: e?.message ?? 'Failed to save rules content.' });
		}

		return { success: true };
	},
};
