import { pbAdmin } from '$lib/server/pb-admin';
import { deriveDeadlineFromKickoff } from '$lib/server/deadlines';
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

	// Fetch week 1 kickoff-derived LMS deadlines: pick deadline (30 min before kickoff) and entry cutoff (40 min before kickoff)
	let lmsDeadline: string | null = null;
	let lmsEntryDeadline: string | null = null;
	if (season) {
		const week1Odds = await pb.collection('game_odds')
			.getFirstListItem(
				`season = "${season.id}" && week = 1 && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			)
			.catch(() => null) as any;

		const kickoff = week1Odds?.game_time_stamp ?? week1Odds?.gameTime;
		lmsDeadline = deriveDeadlineFromKickoff(kickoff, 30);
		lmsEntryDeadline = deriveDeadlineFromKickoff(kickoff, 40);
	}

	// Fetch week 6 kickoff-derived 2H entry cutoff (40 min before kickoff) and weekly pick deadline (30 min before kickoff)
	let week6Deadline: string | null = null;
	let week6PickDeadline: string | null = null;
	let week6Id: string | null = null;
	if (season) {
		const shStartWeek = season.secondHalfStartWeek ?? 6;
		const week6Odds = await pb.collection('game_odds')
			.getFirstListItem(
				`season = "${season.id}" && week = ${shStartWeek} && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			)
			.catch(() => null) as any;

		const week6Kickoff = week6Odds?.game_time_stamp ?? week6Odds?.gameTime;
		week6Deadline = deriveDeadlineFromKickoff(week6Kickoff, 40);
		week6PickDeadline = deriveDeadlineFromKickoff(week6Kickoff, 30);

		const week6 = await pb.collection('weekly_settings')
			.getFirstListItem(`season = "${season.id}" && week = ${shStartWeek}`, { fields: 'id,deadline' })
			.catch(() => null) as any;
		if (!week6Deadline) week6Deadline = week6?.deadline ?? null;
		if (!week6PickDeadline) week6PickDeadline = week6?.deadline ?? null;
		week6Id = week6?.id ?? null;
	}

	return { season, lmsDeadline, lmsEntryDeadline, week6Deadline, week6PickDeadline, week6Id, canEditRules };
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

		const secondHalfDeadline = parseLocalDateTime(secondHalfDeadlineRaw);
		if (secondHalfDeadlineRaw && !secondHalfDeadline) {
			return fail(400, { error: 'Invalid second half deadline value.' });
		}

		try {
			await pb.collection('seasons').update(seasonId, {
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
