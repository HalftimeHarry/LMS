import { fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { Actions, PageServerLoad } from './$types';

// ── helpers ───────────────────────────────────────────────────────────────────

async function fetchPicksAndResults(pb: any, weekId: string) {
	const picks = weekId
		? await pb.collection('picks').getFullList({
				filter: `week = "${weekId}"`,
				expand: 'entry,entry.user,pickedTeams',
				sort:   'created'
		  }).catch(() => []) as any[]
		: [];

	const pickIds = picks.map((p: any) => p.id);
	let pickResults: any[] = [];
	const CHUNK = 20;
	for (let i = 0; i < pickIds.length; i += CHUNK) {
		const chunk  = pickIds.slice(i, i + CHUNK);
		const filter = chunk.map((id: string) => `pick = "${id}"`).join(' || ');
		const batch  = await pb.collection('pick_results').getFullList({ filter }).catch(() => []);
		pickResults.push(...batch);
	}
	return { picks, pickResults };
}

// ── load ──────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ url, locals }) => {
	const pb        = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';
	const yearParam = url.searchParams.get('year') ?? '';
	const weekParam = url.searchParams.get('week');

	// All seasons — pool_admin sees no [TEST] seasons
	const allSeasons = await pb.collection('seasons').getFullList({ sort: '-year' }).catch(() => []) as any[];
	const seasons    = isSuperAdmin ? allSeasons : allSeasons.filter((s: any) => !s.name?.includes('[TEST]'));

	// Group real seasons into year-pairs: { year, lmsSeason, shSeason }
	const yearMap = new Map<string, { lms: any; sh: any }>();
	for (const s of seasons.filter((s: any) => !s.name?.includes('[TEST]'))) {
		const key = String(s.year ?? '');
		if (!yearMap.has(key)) yearMap.set(key, { lms: null, sh: null });
		const pair = yearMap.get(key)!;
		if (s.secondHalfEnabled && !s.lmsEnabled) pair.sh  = s;
		else                                       pair.lms = s;
	}
	const yearPairs = [...yearMap.entries()]
		.map(([year, pair]) => ({ year, lms: pair.lms, sh: pair.sh }))
		.filter(p => p.lms || p.sh)
		.sort((a, b) => Number(b.year) - Number(a.year));

	// Active pair — default to most recent
	const activePair = yearParam
		? (yearPairs.find(p => p.year === yearParam) ?? yearPairs[0] ?? null)
		: (yearPairs[0] ?? null);

	if (!activePair) {
		return { seasons, yearPairs, activePair: null, weekNum: 1, lmsWeek: null, shWeek: null, games: [], lmsPicks: [], shPicks: [], lmsPickResults: [], shPickResults: [], allWeeks: [] };
	}

	// Use LMS season as the source of truth for week nav + games (same NFL schedule)
	const anchorSeason = activePair.lms ?? activePair.sh;

	// Smart default week: locked → results_pending → open → last complete
	let weekNum = weekParam ? Number(weekParam) : 0;
	if (!weekNum) {
		const allWeeksForDefault = await pb.collection('weekly_settings').getFullList({
			filter: `season = "${anchorSeason.id}"`,
			fields: 'week,status',
			sort:   'week'
		}).catch(() => []) as any[];

		const locked         = allWeeksForDefault.find((w: any) => w.status === 'locked');
		const resultsPending = allWeeksForDefault.find((w: any) => w.status === 'results_pending');
		const firstOpen      = allWeeksForDefault.find((w: any) => w.status === 'open');
		const lastComplete   = [...allWeeksForDefault].reverse().find((w: any) => w.status === 'complete');
		weekNum = locked?.week ?? resultsPending?.week ?? firstOpen?.week ?? lastComplete?.week ?? 1;

		const { redirect } = await import('@sveltejs/kit');
		redirect(302, `/admin/results?year=${activePair.year}&week=${weekNum}`);
	}

	// Load week settings for both seasons in parallel
	const [lmsWeek, shWeek] = await Promise.all([
		activePair.lms
			? pb.collection('weekly_settings')
				.getFirstListItem(`season = "${activePair.lms.id}" && week = ${weekNum}`, { expand: 'biggestFavoriteTeam' })
				.catch(() => null)
			: null,
		activePair.sh
			? pb.collection('weekly_settings')
				.getFirstListItem(`season = "${activePair.sh.id}" && week = ${weekNum}`, { expand: 'biggestFavoriteTeam' })
				.catch(() => null)
			: null,
	]) as [any, any];

	// Games come from the LMS season (same schedule for both pools)
	const games = await pb.collection('game_odds').getFullList({
		filter: `season = "${anchorSeason.id}" && week = ${weekNum}`,
		expand: 'homeTeam,awayTeam',
		sort:   'gameTime'
	}).catch(() => []) as any[];

	// Picks + results for each pool in parallel
	const [lmsData, shData] = await Promise.all([
		lmsWeek ? fetchPicksAndResults(pb, lmsWeek.id) : { picks: [], pickResults: [] },
		shWeek  ? fetchPicksAndResults(pb, shWeek.id)  : { picks: [], pickResults: [] },
	]);

	// Week nav from anchor season
	const allWeeks = await pb.collection('weekly_settings').getFullList({
		filter: `season = "${anchorSeason.id}"`,
		fields: 'id,week,status',
		sort:   'week'
	}).catch(() => []) as any[];

	// 2H start week from season config
	const shStartWeek = activePair.sh?.secondHalfStartWeek ?? 6;

	return {
		seasons,
		yearPairs,
		activePair,
		weekNum,
		lmsWeek,
		shWeek,
		games,
		lmsPicks:       lmsData.picks,
		shPicks:        shData.picks,
		lmsPickResults: lmsData.pickResults,
		shPickResults:  shData.pickResults,
		allWeeks,
		shStartWeek,
	};
};

export const actions: Actions = {
	/**
	 * Record game outcomes for a week — applies to both LMS and 2H simultaneously.
	 *
	 * Form fields:
	 *   gameId_<id>  = 'home' | 'away' | 'tie'
	 *   lmsWeekId    = weekly_settings id for the LMS season (may be empty)
	 *   shWeekId     = weekly_settings id for the 2H season (may be empty)
	 *   lmsSeasonId  = LMS season id
	 *   shSeasonId   = 2H season id
	 *   weekNum      = NFL week number
	 *   draft        = '1' → keep weeks at locked (partial save); omit → advance to results_pending
	 *
	 * Elimination logic:
	 *   LMS:      picked team WINS or TIES  → eliminated
	 *   2H:       picked team LOSES or TIES → eliminated
	 *
	 * Draft mode: saves pick_results and fires eliminations immediately so
	 * standings update live, but leaves week status as 'locked'.
	 */
	recordResults: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const lmsWeekId  = (data.get('lmsWeekId')  as string) || null;
		const shWeekId   = (data.get('shWeekId')   as string) || null;
		const lmsSeasonId = (data.get('lmsSeasonId') as string) || null;
		const shSeasonId  = (data.get('shSeasonId')  as string) || null;
		const weekNum    = Number(data.get('weekNum'));
		const isDraft    = data.get('draft') === '1';

		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });

		// Parse game outcomes: gameId_<id> = home|away|tie
		const outcomes: Record<string, 'home' | 'away' | 'tie'> = {};
		for (const [key, val] of data.entries()) {
			if (key.startsWith('gameId_')) {
				outcomes[key.replace('gameId_', '')] = val as 'home' | 'away' | 'tie';
			}
		}
		if (!Object.keys(outcomes).length) return fail(400, { error: 'No game outcomes provided.' });

		// Load games from whichever season has them (same schedule for both)
		const anchorSeasonId = lmsSeasonId ?? shSeasonId!;
		const games = await pb.collection('game_odds').getFullList({
			filter: `season = "${anchorSeasonId}" && week = ${weekNum}`,
			expand: 'homeTeam,awayTeam'
		}).catch(() => []) as any[];

		// Build teamId → result map from entered outcomes
		const teamResult: Record<string, 'correct' | 'incorrect'> = {};
		for (const game of games) {
			const outcome = outcomes[game.id];
			if (!outcome) continue;
			const homeId = game.expand?.homeTeam?.id ?? game.homeTeam;
			const awayId = game.expand?.awayTeam?.id ?? game.awayTeam;
			if (outcome === 'home') {
				teamResult[homeId] = 'correct';
				teamResult[awayId] = 'incorrect';
			} else if (outcome === 'away') {
				teamResult[awayId] = 'correct';
				teamResult[homeId] = 'incorrect';
			} else {
				// tie — both teams eliminate pickers in both pool types
				teamResult[homeId] = 'tie';
				teamResult[awayId] = 'tie';
			}
		}

		let resultsWritten = 0;
		let eliminated     = 0;

		// Process picks for a single week record
		async function processWeek(weekId: string, seasonId: string) {
			const picks = await pb.collection('picks').getFullList({
				filter: `week = "${weekId}"`,
				expand: 'entry'
			}).catch(() => []) as any[];

			for (const pick of picks) {
				const teams: string[] = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
				const isLms = pick.entryType === 'lms';
				let shouldEliminate = false;

				for (const teamId of teams) {
					const result = teamResult[teamId];
					if (!result) continue; // game not yet entered — skip

						// Tie eliminates pickers of both teams in both pool types.
					// LMS: eliminated when picked team wins OR tied.
					// 2H:  eliminated when picked team loses OR tied.
					if (result === 'tie' || (isLms ? result === 'correct' : result === 'incorrect')) {
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

				if (shouldEliminate) {
					const entry = pick.expand?.entry ?? null;
					if (entry?.status === 'active') {
						// Determine reason — check if any picked team tied
					const pickedTeams: string[] = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
					const hasTie = pickedTeams.some((t: string) => teamResult[t] === 'tie');
					const reason = hasTie
						? 'Picked a team that tied'
						: isLms ? 'Picked a winning team' : 'Picked a losing team';

					await pb.collection('entries').update(entry.id, {
							status:           'eliminated',
							eliminatedWeek:   weekNum,
							eliminatedReason: reason,
						}).catch(() => {});
						eliminated++;
					}
				}
			}

			// Advance week status unless draft save or already complete
			if (!isDraft) {
				const weekRec = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
				if (weekRec?.status !== 'complete') {
					await pb.collection('weekly_settings').update(weekId, { status: 'results_pending' }).catch(() => {});
				}
			}
		}

		// Run both pools in parallel
		await Promise.all([
			lmsWeekId ? processWeek(lmsWeekId, lmsSeasonId!) : Promise.resolve(),
			shWeekId  ? processWeek(shWeekId,  shSeasonId!)  : Promise.resolve(),
		]);

		return { success: true, resultsWritten, eliminated, isDraft };
	},

	/**
	 * Reset results for both LMS and 2H weeks simultaneously.
	 * Clears pick_results, reinstates eliminated entries, returns weeks to locked.
	 */
	resetWeekResults: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const lmsWeekId   = (data.get('lmsWeekId')   as string) || null;
		const shWeekId    = (data.get('shWeekId')    as string) || null;
		const lmsSeasonId = (data.get('lmsSeasonId') as string) || null;
		const shSeasonId  = (data.get('shSeasonId')  as string) || null;
		const weekNum     = Number(data.get('weekNum'));

		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });

		const CHUNK = 20;
		let deletedResults = 0;
		let reinstated     = 0;

		async function resetWeek(weekId: string, seasonId: string) {
			const picks = await pb.collection('picks').getFullList({
				filter: `week = "${weekId}"`, fields: 'id'
			}).catch(() => []) as any[];

			for (let i = 0; i < picks.length; i += CHUNK) {
				const chunk  = picks.slice(i, i + CHUNK);
				const filter = chunk.map((p: any) => `pick = "${p.id}"`).join(' || ');
				const results = await pb.collection('pick_results').getFullList({ filter }).catch(() => []) as any[];
				for (const r of results) {
					await pb.collection('pick_results').delete(r.id).catch(() => {});
					deletedResults++;
				}
			}

			const elim = await pb.collection('entries').getFullList({
				filter: `season = "${seasonId}" && status = "eliminated" && eliminatedWeek = ${weekNum}`
			}).catch(() => []) as any[];
			for (const e of elim) {
				await pb.collection('entries').update(e.id, {
					status: 'active', eliminatedWeek: 0, eliminatedReason: ''
				}).catch(() => {});
				reinstated++;
			}

			await pb.collection('weekly_settings').update(weekId, { status: 'locked' }).catch(() => {});
		}

		await Promise.all([
			lmsWeekId ? resetWeek(lmsWeekId, lmsSeasonId!) : Promise.resolve(),
			shWeekId  ? resetWeek(shWeekId,  shSeasonId!)  : Promise.resolve(),
		]);

		return { resetDone: true, deletedResults, reinstated };
	},

	// Mark both LMS and 2H weeks complete simultaneously
	completeWeek: async ({ request }) => {
		const pb         = await pbAdmin();
		const data       = await request.formData();
		const lmsWeekId  = (data.get('lmsWeekId') as string) || null;
		const shWeekId   = (data.get('shWeekId')  as string) || null;
		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });
		try {
			await Promise.all([
				lmsWeekId ? pb.collection('weekly_settings').update(lmsWeekId, { status: 'complete' }) : Promise.resolve(),
				shWeekId  ? pb.collection('weekly_settings').update(shWeekId,  { status: 'complete' }) : Promise.resolve(),
			]);
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
	// Lock both LMS and 2H weeks simultaneously, auto-picking for each
	lockWeek: async ({ request }) => {
		const pb         = await pbAdmin();
		const data       = await request.formData();
		const lmsWeekId  = (data.get('lmsWeekId')   as string) || null;
		const shWeekId   = (data.get('shWeekId')    as string) || null;
		const lmsSeasonId = (data.get('lmsSeasonId') as string) || null;
		const shSeasonId  = (data.get('shSeasonId')  as string) || null;
		const weekNum    = Number(data.get('weekNum'));

		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });

		let autoPicked = 0;

		async function lockOne(weekId: string, seasonId: string) {
			await pb.collection('weekly_settings').update(weekId, { status: 'locked' }).catch(() => {});

			const weekSetting = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
			const autoTeamId  = weekSetting?.biggestFavoriteTeam ?? null;
			if (!autoTeamId) return;

			const entries = await pb.collection('entries').getFullList({
				filter: `season = "${seasonId}" && status = "active"`
			}).catch(() => []) as any[];

			const existingPicks = await pb.collection('picks').getFullList({
				filter: `week = "${weekId}"`, fields: 'entry'
			}).catch(() => []) as any[];
			const pickedEntryIds = new Set(existingPicks.map((p: any) => p.entry));

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
				} catch { /* skip */ }
			}
		}

		await Promise.all([
			lmsWeekId ? lockOne(lmsWeekId, lmsSeasonId!) : Promise.resolve(),
			shWeekId  ? lockOne(shWeekId,  shSeasonId!)  : Promise.resolve(),
		]);

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
