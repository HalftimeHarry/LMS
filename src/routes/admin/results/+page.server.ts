import { fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const pb       = await pbAdmin();
	const seasonId = url.searchParams.get('season') ?? '';
	const weekNum  = Number(url.searchParams.get('week') ?? 1);

	const seasons = await pb.collection('seasons').getFullList({ sort: '-year' }).catch(() => []) as any[];

	// No auto-default — require explicit ?season= param to prevent acting on wrong season
	const activeSeason = seasonId
		? (seasons.find((s: any) => s.id === seasonId) ?? null)
		: null;

	if (!activeSeason) {
		return { seasons, activeSeason: null, weekNum, weekSetting: null, games: [], picks: [], pickResults: [] };
	}

	// Week setting for selected week
	const weekSetting = await pb.collection('weekly_settings')
		.getFirstListItem(`season = "${activeSeason.id}" && week = ${weekNum}`, { expand: 'biggestFavoriteTeam' })
		.catch(() => null) as any;

	// Games for this week with teams expanded
	const games = await pb.collection('game_odds').getFullList({
		filter: `season = "${activeSeason.id}" && week = ${weekNum}`,
		expand: 'homeTeam,awayTeam',
		sort:   'gameTime'
	}).catch(() => []) as any[];

	// All picks for this week with entry + user + teams expanded
	const picks = weekSetting
		? await pb.collection('picks').getFullList({
				filter: `week = "${weekSetting.id}"`,
				expand: 'entry,entry.user,pickedTeams',
				sort:   'created'
		  }).catch(() => []) as any[]
		: [];

	// Existing pick_results for this week's picks
	const pickIds = picks.map((p: any) => p.id);
	let pickResults: any[] = [];
	if (pickIds.length) {
		const CHUNK = 20;
		for (let i = 0; i < pickIds.length; i += CHUNK) {
			const chunk  = pickIds.slice(i, i + CHUNK);
			const filter = chunk.map((id: string) => `pick = "${id}"`).join(' || ');
			const batch  = await pb.collection('pick_results').getFullList({ filter, expand: 'team' }).catch(() => []);
			pickResults.push(...batch);
		}
	}

	// Week nav — which weeks exist and their status
	const allWeeks = await pb.collection('weekly_settings').getFullList({
		filter: `season = "${activeSeason.id}"`,
		fields: 'id,week,status',
		sort:   'week'
	}).catch(() => []) as any[];

	return {
		seasons,
		activeSeason,
		weekNum,
		weekSetting,
		games,
		picks,
		pickResults,
		allWeeks
	};
};

export const actions: Actions = {
	/**
	 * Record game outcomes for a week.
	 * Expects form fields:
	 *   gameId_<id> = 'home' | 'away' | 'tie'   (which side won)
	 *
	 * For each game with a result:
	 *   - Determines the winning team ID
	 *   - Finds all picks that included that team
	 *   - Creates/updates pick_results (correct for winners, incorrect for losers)
	 *
	 * After all results are recorded:
	 *   - Entries whose picks are ALL correct → stay active
	 *   - Entries with ANY incorrect pick → eliminated
	 *   - Week status → results_pending (admin confirms → complete via weeks page)
	 */
	recordResults: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const weekId   = data.get('weekId')   as string;
		const seasonId = data.get('seasonId') as string;
		const weekNum  = Number(data.get('weekNum'));

		if (!weekId) return fail(400, { error: 'Week is required.' });

		// Parse game outcomes from form: gameId_<id> = home|away|tie
		const outcomes: Record<string, 'home' | 'away' | 'tie'> = {};
		for (const [key, val] of data.entries()) {
			if (key.startsWith('gameId_')) {
				const gameId = key.replace('gameId_', '');
				outcomes[gameId] = val as 'home' | 'away' | 'tie';
			}
		}

		if (!Object.keys(outcomes).length) {
			return fail(400, { error: 'No game outcomes provided.' });
		}

		// Load games to get team IDs
		const games = await pb.collection('game_odds').getFullList({
			filter: `season = "${seasonId}" && week = ${weekNum}`,
			expand: 'homeTeam,awayTeam'
		}).catch(() => []) as any[];

		// Build map: teamId → 'correct' | 'incorrect' based on outcomes
		// 'correct' = team won. Elimination logic differs by pool type:
		//   LMS:        pick a team to LOSE → eliminated if picked team WINS (result=correct)
		//   2nd Half:   pick a team to WIN  → eliminated if picked team LOSES (result=incorrect)
		const teamResult: Record<string, 'correct' | 'incorrect'> = {};
		for (const game of games) {
			const outcome = outcomes[game.id];
			if (!outcome) continue; // no result entered for this game yet
			const homeId = game.expand?.homeTeam?.id ?? game.homeTeam;
			const awayId = game.expand?.awayTeam?.id ?? game.awayTeam;
			if (outcome === 'home') {
				teamResult[homeId] = 'correct';
				teamResult[awayId] = 'incorrect';
			} else if (outcome === 'away') {
				teamResult[awayId] = 'correct';
				teamResult[homeId] = 'incorrect';
			} else {
				// tie — both teams correct (neither side loses)
				teamResult[homeId] = 'correct';
				teamResult[awayId] = 'correct';
			}
		}

		// Load all picks for this week
		const picks = await pb.collection('picks').getFullList({
			filter: `week = "${weekId}"`,
			expand: 'entry'
		}).catch(() => []) as any[];

		let resultsWritten = 0;
		let eliminated     = 0;

		// For each pick, write pick_results for each picked team
		for (const pick of picks) {
			const teams: string[] = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
			const isLms = pick.entryType === 'lms';
			let shouldEliminate = false;

			for (const teamId of teams) {
				const result = teamResult[teamId];
				if (!result) continue; // game not yet recorded — skip

				// LMS:       eliminated when picked team WINS (result=correct)
				// 2nd Half:  eliminated when picked team LOSES (result=incorrect)
				if (isLms ? result === 'correct' : result === 'incorrect') {
					shouldEliminate = true;
				}

				// Upsert pick_result
				const existing = await pb.collection('pick_results')
					.getFirstListItem(`pick = "${pick.id}" && team = "${teamId}"`)
					.catch(() => null) as any;

				try {
					if (existing) {
						await pb.collection('pick_results').update(existing.id, { result });
					} else {
						await pb.collection('pick_results').create({ pick: pick.id, team: teamId, result });
					}
					resultsWritten++;
				} catch { /* skip */ }
			}

			// Eliminate entry if pick outcome triggers elimination for this pool type
			if (shouldEliminate) {
				const entry = pick.expand?.entry ?? null;
				if (entry && entry.status === 'active') {
					await pb.collection('entries').update(entry.id, {
						status:           'eliminated',
						eliminatedWeek:   weekNum,
						eliminatedReason: isLms ? 'Picked a winning team' : 'Picked a losing team'
					}).catch(() => {});
					eliminated++;
				}
			}
		}

		// Advance week to results_pending
		await pb.collection('weekly_settings').update(weekId, { status: 'results_pending' }).catch(() => {});

		return { success: true, resultsWritten, eliminated };
	},

	/**
	 * Mark a week complete after results have been reviewed.
	 * Transitions: results_pending → complete
	 */
	/**
	 * Reset a week back to locked state — clears all pick_results, reinstates
	 * eliminated entries, and sets week status back to locked so results can
	 * be re-entered from scratch.
	 */
	resetWeekResults: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const weekId   = data.get('weekId')   as string;
		const seasonId = data.get('seasonId') as string;
		if (!weekId || !seasonId) return fail(400, { error: 'weekId and seasonId required.' });

		// Find all picks for this week
		const picks = await pb.collection('picks').getFullList({
			filter: `week = "${weekId}"`, fields: 'id'
		}).catch(() => []) as any[];

		// Delete all pick_results for those picks
		const CHUNK = 20;
		let deletedResults = 0;
		for (let i = 0; i < picks.length; i += CHUNK) {
			const chunk  = picks.slice(i, i + CHUNK);
			const filter = chunk.map((p: any) => `pick = "${p.id}"`).join(' || ');
			const results = await pb.collection('pick_results').getFullList({ filter }).catch(() => []) as any[];
			for (const r of results) {
				await pb.collection('pick_results').delete(r.id).catch(() => {});
				deletedResults++;
			}
		}

		// Find the week number so we can match eliminatedWeek
		const weekRecord = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
		const weekNum = weekRecord?.week ?? 0;

		// Reinstate entries eliminated this week
		const eliminated = await pb.collection('entries').getFullList({
			filter: `season = "${seasonId}" && status = "eliminated" && eliminatedWeek = ${weekNum}`
		}).catch(() => []) as any[];
		for (const e of eliminated) {
			await pb.collection('entries').update(e.id, {
				status: 'active', eliminatedWeek: 0, eliminatedReason: ''
			}).catch(() => {});
		}

		// Reset week status to locked
		await pb.collection('weekly_settings').update(weekId, { status: 'locked' }).catch(() => {});

		return {
			resetDone: true,
			deletedResults,
			reinstated: eliminated.length,
		};
	},

	completeWeek: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const weekId = data.get('weekId') as string;
		if (!weekId) return fail(400, { error: 'Week is required.' });
		try {
			await pb.collection('weekly_settings').update(weekId, { status: 'complete' });
		} catch (e: any) {
			return fail(400, { error: e?.message ?? 'Failed.' });
		}
		return { success: true };
	},

	/**
	 * Lock a week — closes participant pick submissions.
	 * Transitions: open → locked
	 * Also auto-assigns biggestFavoriteTeam pick to entries that haven't picked.
	 */
	lockWeek: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const weekId   = data.get('weekId')   as string;
		const seasonId = data.get('seasonId') as string;
		const weekNum  = Number(data.get('weekNum'));

		if (!weekId) return fail(400, { error: 'Week is required.' });

		// Lock the week
		await pb.collection('weekly_settings').update(weekId, { status: 'locked' }).catch(() => {});

		// Auto-pick: assign biggestFavoriteTeam to entries that haven't picked
		const weekSetting = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
		const autoTeamId  = weekSetting?.biggestFavoriteTeam ?? null;
		let   autoPicked  = 0;

		if (autoTeamId && seasonId) {
			// Active entries for this season
			const entries = await pb.collection('entries').getFullList({
				filter: `season = "${seasonId}" && status = "active"`
			}).catch(() => []) as any[];

			// Entries that already have a pick this week
			const existingPicks = await pb.collection('picks').getFullList({
				filter: `week = "${weekId}"`,
				fields: 'entry'
			}).catch(() => []) as any[];
			const pickedEntryIds = new Set(existingPicks.map((p: any) => p.entry));

			// Create auto-picks for entries that missed the deadline
			for (const entry of entries) {
				if (pickedEntryIds.has(entry.id)) continue;
				try {
					await pb.collection('picks').create({
						entry:       entry.id,
						week:        weekId,
						pickedTeams: [autoTeamId],
						entryType:   entry.entryType,
						isAutoPick:  true
					});
					autoPicked++;
				} catch { /* skip — may already exist */ }
			}
		}

		return { success: true, autoPicked };
	},

	/**
	 * Emergency pick override — admin replaces an entry's pick for a week.
	 *
	 * Accepts:
	 *   pickId    — existing pick record to update (or empty to create)
	 *   entryId   — entry the pick belongs to
	 *   weekId    — weekly_settings record id
	 *   teamIds   — comma-separated team IDs to pick (1 for LMS, 1-3 for 2nd Half)
	 *   reason    — required audit note explaining why the pick was overridden
	 *
	 * Side effects:
	 *   - Replaces pickedTeams on the pick record
	 *   - Clears isAutoPick flag
	 *   - Deletes any existing pick_results for this pick (results must be
	 *     re-recorded after the override since the team changed)
	 *   - If the entry was eliminated this week, reinstates it to active
	 *     so the new pick can be evaluated fairly
	 *   - Writes an adminNote on the pick for audit trail
	 */
	overridePick: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const pickId  = (data.get('pickId')  as string)?.trim();
		const entryId = (data.get('entryId') as string)?.trim();
		const weekId  = (data.get('weekId')  as string)?.trim();
		const teamIds = (data.get('teamIds') as string)?.split(',').map(s => s.trim()).filter(Boolean);
		const reason  = (data.get('reason')  as string)?.trim();

		if (!entryId || !weekId)        return fail(400, { error: 'Entry and week are required.' });
		if (!teamIds?.length)           return fail(400, { error: 'At least one team must be selected.' });
		if (!reason)                    return fail(400, { error: 'A reason is required for audit purposes.' });

		try {
			let pick: any;

			if (pickId) {
				// Update existing pick
				pick = await pb.collection('picks').update(pickId, {
					pickedTeams: teamIds,
					isAutoPick:  false,
					adminNote:   `[OVERRIDE ${new Date().toISOString().slice(0,16)}] ${reason}`,
				});
			} else {
				// No pick exists yet — create one
				const weekRec = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
				const entry   = await pb.collection('entries').getOne(entryId).catch(() => null) as any;
				if (!weekRec || !entry) return fail(400, { error: 'Week or entry not found.' });

				pick = await pb.collection('picks').create({
					entry:       entryId,
					week:        weekId,
					pickedTeams: teamIds,
					entryType:   entry.entryType,
					isAutoPick:  false,
					adminNote:   `[OVERRIDE ${new Date().toISOString().slice(0,16)}] ${reason}`,
				});
			}

			// Delete existing pick_results for this pick — they're now stale
			const staleResults = await pb.collection('pick_results')
				.getFullList({ filter: `pick = "${pick.id}"` })
				.catch(() => []) as any[];
			for (const r of staleResults) {
				await pb.collection('pick_results').delete(r.id).catch(() => {});
			}

			// If the entry was eliminated this week, reinstate it so the
			// corrected pick can be evaluated when results are re-recorded
			const entry = await pb.collection('entries').getOne(entryId).catch(() => null) as any;
			const weekRec = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
			if (entry?.status === 'eliminated' && entry?.eliminatedWeek === weekRec?.week) {
				await pb.collection('entries').update(entryId, {
					status:           'active',
					eliminatedWeek:   null,
					eliminatedReason: null,
				}).catch(() => {});
			}

			return { success: true, action: 'overridePick', pickId: pick.id };
		} catch (e: any) {
			return fail(400, { error: e?.message ?? 'Override failed.' });
		}
	}
};
