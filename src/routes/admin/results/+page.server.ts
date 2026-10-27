import { fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import {
	clearResultsDraftOutcomes,
	loadResultsDraftOutcomes,
	saveResultsDraftOutcomes,
} from '$lib/server/adminResultsDraftStore';
import { rankAutoPickTeamsForPool, selectAutoPickForEntry } from '$lib/server/auto-pick';
import type { Actions, PageServerLoad } from './$types';

async function getWeekDeadlineMs(pb: any, weekId: string): Promise<number | null> {
	const week = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
	if (!week?.deadline) return null;
	const ms = new Date(week.deadline).getTime();
	return Number.isFinite(ms) ? ms : null;
}

async function validateResultsActionWindow(pb: any, weekIds: string[]) {
	const nowMs = Date.now();

	for (const weekId of weekIds.filter(Boolean)) {
		const deadlineMs = await getWeekDeadlineMs(pb, weekId);
		if (!deadlineMs) {
			return fail(400, { error: `Missing deadline for week ${weekId}.` });
		}
		if (nowMs < deadlineMs) {
			return fail(403, {
				error: `Results are not active for this week until after ${new Date(deadlineMs).toISOString()}.`
			});
		}
	}

	return null;
}

function hasExplicitFinalResult(game: any): boolean {
	const candidates = [
		game?.resultStatus,
		game?.result_status,
		game?.finalStatus,
		game?.final_status,
		game?.status,
		game?.isFinal,
		game?.is_final,
		game?.finalized,
		game?.isFinalized,
	];

	for (const value of candidates) {
		if (typeof value === 'boolean') {
			if (value) return true;
			continue;
		}
		if (typeof value !== 'string') continue;
		const normalized = value.trim().toLowerCase();
		if (!normalized) continue;
		if (['final', 'finalized', 'official', 'complete', 'ended'].includes(normalized)) return true;
		if (['pending', 'draft', 'scheduled', 'in_progress', 'in-progress', 'postponed', 'cancelled', 'delayed', 'not_started', 'not-started', 'not started'].includes(normalized)) return false;
	}

	if (
		(game?.homeScore != null && game?.awayScore != null) ||
		(game?.home_score != null && game?.away_score != null)
	) {
		return true;
	}

	return false;
}

async function validateFinalizedResultsBeforeConfirmation(pb: any, weekId: string, seasonId: string, poolType: 'lms' | 'second_half') {
	const week = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
	if (!week) {
		return fail(404, { error: 'Week not found for winner confirmation.' });
	}
	if (week.status !== 'complete') {
		return fail(400, {
			error: `Relevant ${poolType === 'lms' ? 'LMS' : 'Second Half'} results must be final before confirming a payout.`,
		});
	}

	const games = await pb.collection('game_odds').getFullList({
		filter: `season = "${seasonId}" && week = ${Number(week.week ?? 0)}`,
	}).catch(() => []) as any[];

	if (!games.length) {
		return fail(400, {
			error: 'No relevant game results are available yet for this week.',
		});
	}

	const unresolvedGames = games.filter((game: any) => !hasExplicitFinalResult(game));
	if (unresolvedGames.length) {
		const sample = unresolvedGames.slice(0, 3).map((game: any) => game.id || game.homeTeam || game.awayTeam || 'game').join(', ');
		return fail(400, {
			error: `Relevant ${poolType === 'lms' ? 'LMS' : 'Second Half'} games are still pending or missing an explicit final-result status: ${sample}${unresolvedGames.length > 3 ? ', ...' : ''}.`,
		});
	}

	return null;
}

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

function normalizeTeamList(pickedTeams?: string[] | string | null): string[] {
	if (Array.isArray(pickedTeams)) return [...new Set(pickedTeams.filter(Boolean))];
	if (pickedTeams) return [pickedTeams].filter(Boolean);
	return [];
}

function isProvisionalZeroSurvivorWinner(entry: any): boolean {
	const reason = String(entry?.eliminatedReason ?? '').trim();
	if (!reason) return false;
	const normalized = reason.toLowerCase();
	return (
		normalized.includes('zero-survivor') ||
		normalized.includes('equal split award pending confirmation') ||
		normalized.includes('winner candidate pending admin')
	);
}

function getEntryCorrectPickTotals(
	entries: Array<{ id: string; status?: string; season?: string; entryType?: string }>,
	picks: Array<{ id: string; entry: string; week: string; pickedTeams?: string[] | string | null; isAutoPick?: boolean }>,
	teamResult: Record<string, 'correct' | 'incorrect' | 'tie'>
) {
	const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
	const counts = new Map<string, number>();
	let unresolved = false;

	for (const entry of entries) counts.set(entry.id, 0);

	for (const pick of picks) {
		if (!entryMap.has(pick.entry)) continue;
		const selectedTeams = normalizeTeamList(pick.pickedTeams);
		if (!selectedTeams.length) continue;

		for (const teamId of selectedTeams) {
			if (!teamId) continue;
			if (!(teamId in teamResult)) {
				unresolved = true;
				continue;
			}
			if (teamResult[teamId] === 'correct') {
				counts.set(pick.entry, (counts.get(pick.entry) ?? 0) + 1);
			}
		}
	}

	return { counts, unresolved, maxCorrect: Math.max(0, ...[...counts.values()]) };
}

export function _calculatePerEntryShareAmounts(potCents: number, winnerEntryIds: string[]) {
	const winners = [...new Set(winnerEntryIds.filter(Boolean))];
	if (!winners.length) return { shares: [], totalCents: 0, perShareCents: 0, remainderCents: 0 };
	const totalCents = Math.max(0, Math.round(potCents));
	const perShareCents = Math.floor(totalCents / winners.length);
	const remainderCents = totalCents - (perShareCents * winners.length);
	const shares = winners.map((entryId, index) => ({
		entryId,
		cents: perShareCents + (index < remainderCents ? 1 : 0),
	}));
	return { shares, totalCents, perShareCents, remainderCents };
}

type ZeroSurvivorResolutionStatus = 'continue' | 'pending' | 'pending_results' | 'winner_candidate' | 'tie_required' | 'confirmed';

export function _getZeroSurvivorWinnerResolution(params: {
	seasonId: string;
	weekId: string;
	weekNum: number;
	entries: Array<{ id: string; status?: string; season?: string; entryType?: string }>;
	picks: Array<{ id: string; entry: string; week: string; pickedTeams?: string[] | string | null; isAutoPick?: boolean }>;
	teamResult: Record<string, 'correct' | 'incorrect' | 'tie'>;
	poolType?: 'lms' | 'second_half';
	remainingActiveEntryIds?: string[];
}): {
	status: ZeroSurvivorResolutionStatus;
	reason: string;
	weekNum: number;
	seasonId: string;
	weekId: string;
	entriesEnteringWeek: number;
	remainingActiveEntries?: string[];
	maxCorrectPicks: number;
	highestRankedEntries: string[];
	needsAdminConfirmation: boolean;
} {
	const {
		seasonId,
		weekId,
		weekNum,
		entries,
		picks,
		teamResult,
		poolType = 'second_half',
		remainingActiveEntryIds,
	} = params;

	const eligibleEntries = entries.filter((entry) =>
		entry.season === seasonId &&
		entry.entryType === poolType
	);
	const entrants = eligibleEntries.filter((entry) => entry.status === 'active');
	const remainingActive = new Set((remainingActiveEntryIds ?? []).filter(Boolean));
	const baselineEligible = remainingActive.size
		? eligibleEntries.filter((entry) => remainingActive.has(entry.id))
		: entrants;

	if (entrants.length === 0 && baselineEligible.length === 0) {
		return {
			status: 'continue',
			reason: 'no_active_entries',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length,
			maxCorrectPicks: 0,
			highestRankedEntries: [],
			needsAdminConfirmation: false,
		};
	}

	if (remainingActive.size > 0 && entrants.length === 0 && poolType === 'lms') {
		return {
			status: 'tie_required',
			reason: 'all_remaining_lms_entries_eliminated_same_week',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length,
			remainingActiveEntries: [...remainingActive],
			maxCorrectPicks: 0,
			highestRankedEntries: baselineEligible.map((entry) => entry.id),
			needsAdminConfirmation: true,
		};
	}

	if (remainingActive.size > 0 && (entrants.length === 0 || remainingActive.size === eligibleEntries.length) && poolType === 'second_half') {
		const weekOnlyPicks = picks.filter((pick) => pick.week === weekId && remainingActive.has(pick.entry));
		const { counts, unresolved, maxCorrect } = getEntryCorrectPickTotals(baselineEligible, weekOnlyPicks, teamResult);
		const candidates = baselineEligible.filter((entry) => (counts.get(entry.id) ?? 0) === maxCorrect);
		if (unresolved) {
			return {
				status: 'pending_results',
				reason: 'unresolved_games_for_final_week',
				weekNum,
				seasonId,
				weekId,
				entriesEnteringWeek: baselineEligible.length,
				remainingActiveEntries: [...remainingActive],
				maxCorrectPicks: maxCorrect,
				highestRankedEntries: candidates.map((entry) => entry.id),
				needsAdminConfirmation: false,
			};
		}
		if (candidates.length === 1) {
			return {
				status: 'winner_candidate',
				reason: 'single_highest_score',
				weekNum,
				seasonId,
				weekId,
				entriesEnteringWeek: baselineEligible.length,
				remainingActiveEntries: [...remainingActive],
				maxCorrectPicks: maxCorrect,
				highestRankedEntries: candidates.map((entry) => entry.id),
				needsAdminConfirmation: true,
			};
		}
		if (candidates.length > 1) {
			return {
				status: 'tie_required',
				reason: 'multiple_entries_tied_for_highest_score',
				weekNum,
				seasonId,
				weekId,
				entriesEnteringWeek: baselineEligible.length,
				remainingActiveEntries: [...remainingActive],
				maxCorrectPicks: maxCorrect,
				highestRankedEntries: candidates.map((entry) => entry.id),
				needsAdminConfirmation: true,
			};
		}
	}

	const { counts, unresolved, maxCorrect } = getEntryCorrectPickTotals(entrants, picks, teamResult);
	const candidates = entrants.filter((entry) => (counts.get(entry.id) ?? 0) === maxCorrect);

	if (unresolved) {
		return {
			status: 'pending_results',
			reason: 'unresolved_games_for_final_week',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length || entrants.length,
			remainingActiveEntries: [...remainingActive],
			maxCorrectPicks: maxCorrect,
			highestRankedEntries: candidates.map((entry) => entry.id),
			needsAdminConfirmation: false,
		};
	}

	if (remainingActive.size === 1) {
		return {
			status: 'winner_candidate',
			reason: 'single_survivor_after_final_week',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length || entrants.length,
			remainingActiveEntries: [...remainingActive],
			maxCorrectPicks: maxCorrect,
			highestRankedEntries: [...remainingActive],
			needsAdminConfirmation: true,
		};
	}

	if (remainingActive.size > 1) {
		return {
			status: 'tie_required',
			reason: 'multiple_survivors_after_final_week',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length || entrants.length,
			remainingActiveEntries: [...remainingActive],
			maxCorrectPicks: maxCorrect,
			highestRankedEntries: [...remainingActive],
			needsAdminConfirmation: true,
		};
	}

	if (candidates.length === 1) {
		return {
			status: 'winner_candidate',
			reason: 'single_highest_score',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length || entrants.length,
			remainingActiveEntries: [...remainingActive],
			maxCorrectPicks: maxCorrect,
			highestRankedEntries: candidates.map((entry) => entry.id),
			needsAdminConfirmation: true,
		};
	}

	if (candidates.length > 1) {
		return {
			status: 'tie_required',
			reason: 'multiple_entries_tied_for_highest_score',
			weekNum,
			seasonId,
			weekId,
			entriesEnteringWeek: baselineEligible.length || entrants.length,
			remainingActiveEntries: [...remainingActive],
			maxCorrectPicks: maxCorrect,
			highestRankedEntries: candidates.map((entry) => entry.id),
			needsAdminConfirmation: true,
		};
	}

	return {
		status: 'continue',
		reason: 'not_zero_survivor_condition',
		weekNum,
		seasonId,
		weekId,
		entriesEnteringWeek: baselineEligible.length || entrants.length,
		remainingActiveEntries: [...remainingActive],
		maxCorrectPicks: maxCorrect,
		highestRankedEntries: candidates.map((entry) => entry.id),
		needsAdminConfirmation: false,
	};
}

const AUTO_ZERO_SURVIVOR_RESOLUTION_DISABLED = true;

async function persistZeroSurvivorResolution(pb: any, params: {
	seasonId: string;
	weekId: string;
	weekNum: number;
	entries: Array<{ id: string; status?: string; season?: string; entryType?: string }>;
	picks: Array<{ id: string; entry: string; week: string; pickedTeams?: string[] | string | null; isAutoPick?: boolean }>;
	teamResult: Record<string, 'correct' | 'incorrect' | 'tie'>;
	poolType?: 'lms' | 'second_half';
}) {
	const poolType = params.poolType ?? 'second_half';
	const resolution = _getZeroSurvivorWinnerResolution({
		...params,
		poolType,
		remainingActiveEntryIds: params.entries.filter((entry) => entry.status === 'active').map((entry) => entry.id),
	});

	if (AUTO_ZERO_SURVIVOR_RESOLUTION_DISABLED) {
		return resolution;
	}

	if (resolution.status === 'continue' || resolution.status === 'pending_results') {
		return resolution;
	}

	const winnerIds = new Set(resolution.highestRankedEntries ?? []);
	if (!winnerIds.size) {
		return resolution;
	}

	for (const entry of params.entries) {
		if (!winnerIds.has(entry.id)) continue;
		if (entry.status === 'winner') continue;
		const reason = resolution.reason === 'all_remaining_lms_entries_eliminated_same_week'
			? 'All remaining entries were eliminated in the same week — equal split award pending confirmation'
			: resolution.status === 'tie_required'
				? 'Zero-survivor tie candidate pending admin resolution'
				: 'Zero-survivor winner candidate pending admin confirmation';
		await pb.collection('entries').update(entry.id, {
			status: 'winner',
			eliminatedWeek: null,
			eliminatedReason: reason,
		}).catch(() => {});
	}

	return resolution;
}

// ── load ──────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ url, locals }) => {
	const pb        = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';
	const serverNow = Date.now();
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
		return {
			seasons,
			yearPairs,
			activePair: null,
			weekNum: 1,
			lmsWeek: null,
			shWeek: null,
			games: [],
			lmsPicks: [],
			shPicks: [],
			lmsPickResults: [],
			shPickResults: [],
			allWeeks: [],
			serverNow,
			draftOutcomes: {},
		};
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
		sort:   'game_time_stamp'
	}).catch(() => []) as any[];

	// Picks + results for each pool in parallel
	const [lmsData, shData] = await Promise.all([
		lmsWeek ? fetchPicksAndResults(pb, lmsWeek.id) : { picks: [], pickResults: [] },
		shWeek  ? fetchPicksAndResults(pb, shWeek.id)  : { picks: [], pickResults: [] },
	]);

	// Week nav from anchor season
	const allWeeks = await pb.collection('weekly_settings').getFullList({
		filter: `season = "${anchorSeason.id}"`,
		fields: 'id,week,status,deadline',
		sort:   'week'
	}).catch(() => []) as any[];

	// 2H start week from season config
	const shStartWeek = activePair.sh?.secondHalfStartWeek ?? 6;
	const draftOutcomes = loadResultsDraftOutcomes(activePair.year, weekNum);

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
		serverNow,
		draftOutcomes,
	};
};

export const actions: Actions = {
	confirmWinnerResolution: async ({ request }) => {
		const pb = await pbAdmin().catch(() => null);
		if (!pb) return fail(503, { error: 'Unable to connect to the results database.' });
		const data = await request.formData();
		const seasonId = String(data.get('seasonId') ?? '').trim();
		const weekId = String(data.get('weekId') ?? '').trim();
		const winnerEntryId = String(data.get('winnerEntryId') ?? '').trim();
		const tieResolution = String(data.get('tieResolution') ?? '').trim();
		const poolType = String(data.get('poolType') ?? 'second_half').trim() as 'lms' | 'second_half';
		if (!seasonId || !weekId) return fail(400, { error: 'Season and week are required.' });

		const finalGuard = await validateFinalizedResultsBeforeConfirmation(pb, weekId, seasonId, poolType);
		if (finalGuard) return finalGuard;

		const candidateEntries = await pb.collection('entries').getFullList({
			filter: `season = "${seasonId}" && entryType = "${poolType}" && status = "winner"`,
		}).catch(() => []) as any[];

		if (!candidateEntries.length) {
			return fail(400, { error: `No ${poolType === 'lms' ? 'LMS' : 'Second Half'} zero-survivor winner candidate is pending confirmation.` });
		}

		const confirmed = winnerEntryId ? candidateEntries.filter((entry) => entry.id === winnerEntryId) : candidateEntries;
		if (!confirmed.length) return fail(400, { error: 'Selected winner entry is not eligible.' });

		if (candidateEntries.length > 0 && candidateEntries.every((entry) => entry.status === 'winner')) {
			return {
				success: true,
				winnerEntryId: winnerEntryId || candidateEntries[0]?.id || null,
				winnerResolution: {
					seasonId,
					weekId,
					status: winnerEntryId ? 'confirmed' : 'tie_required',
					confirmedWinner: winnerEntryId || candidateEntries[0]?.id || null,
					needsAdminConfirmation: false,
				},
			};
		}

		for (const entry of candidateEntries) {
			const isConfirmed = winnerEntryId ? entry.id === winnerEntryId : !!tieResolution || candidateEntries.length === 1;
			if (isConfirmed) {
				await pb.collection('entries').update(entry.id, {
					status: 'winner',
					eliminatedWeek: null,
					eliminatedReason: tieResolution
						? `Resolved by admin: ${tieResolution}`
						: 'Winner confirmed by admin',
				}).catch(() => {});
			} else {
				await pb.collection('entries').update(entry.id, {
					status: 'active',
					eliminatedWeek: null,
					eliminatedReason: null,
				}).catch(() => {});
			}
		}

		return {
			success: true,
			winnerEntryId: winnerEntryId || null,
			winnerResolution: {
				seasonId,
				weekId,
				status: winnerEntryId ? 'confirmed' : 'tie_required',
				confirmedWinner: winnerEntryId || null,
				needsAdminConfirmation: false,
			},
		};
	},
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
		let pb: any;
		try {
			pb = await pbAdmin();
		} catch (error) {
			console.error(
				'[admin/results] PocketBase admin connection failed',
				error instanceof Error ? error.message : error
			);
			return fail(503, {
				error: 'Unable to connect to the results database. Check the PocketBase service and Netlify environment variables, then try again.'
			});
		}
		const data = await request.formData();

		const lmsWeekId  = (data.get('lmsWeekId')  as string) || null;
		const shWeekId   = (data.get('shWeekId')   as string) || null;
		const lmsSeasonId = (data.get('lmsSeasonId') as string) || null;
		const shSeasonId  = (data.get('shSeasonId')  as string) || null;
		const weekNum    = Number(data.get('weekNum'));
		const isDraft    = data.get('draft') === '1';
		const draftYear  = data.get('year');

		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });
		const windowError = await validateResultsActionWindow(pb, [lmsWeekId, shWeekId].filter(Boolean) as string[]);
		if (windowError) return windowError;

		// Parse game outcomes: gameId_<id> = home|away|tie
		const outcomes: Record<string, 'home' | 'away' | 'tie'> = {};
		for (const [key, val] of data.entries()) {
			if (key.startsWith('gameId_')) {
				outcomes[key.replace('gameId_', '')] = val as 'home' | 'away' | 'tie';
			}
		}
		if (!Object.keys(outcomes).length) return fail(400, { error: 'No game outcomes provided.' });
		if (draftYear && String(draftYear).trim()) {
			if (isDraft) saveResultsDraftOutcomes(String(draftYear), weekNum, outcomes);
			else        clearResultsDraftOutcomes(String(draftYear), weekNum);
		}

		// Load games from whichever season has them (same schedule for both)
		const anchorSeasonId = lmsSeasonId ?? shSeasonId!;
		// 2H start week — read from the 2H season when present, else the LMS season
		let shStartWeek = 6;
		const configSeasonId = shSeasonId ?? lmsSeasonId;
		if (configSeasonId) {
			const cfgSeason = await pb.collection('seasons')?.getOne(configSeasonId).catch(() => null) as any;
			shStartWeek = cfgSeason?.secondHalfStartWeek ?? 6;
		}
		const shEntrySnapshot = shSeasonId && shWeekId && weekNum >= shStartWeek
			? await (pb.collection('entries')?.getFullList?.({
				filter: `season = "${shSeasonId}" && entryType = "second_half" && status = "active"`
			}) ?? Promise.resolve([]))
				.catch(() => []) as any[]
			: [];
			const lmsEntrySnapshot = lmsSeasonId && lmsWeekId
				? await (pb.collection('entries')?.getFullList?.({
					filter: `season = "${lmsSeasonId}" && entryType = "lms" && status = "active"`
				}) ?? Promise.resolve([]))
					.catch(() => []) as any[]
			: [];
			const shEntrantIdsBefore = shEntrySnapshot.map((entry: any) => entry.id);
		const games = await pb.collection('game_odds').getFullList({
			filter: `season = "${anchorSeasonId}" && week = ${weekNum}`,
			expand: 'homeTeam,awayTeam'
		}).catch(() => []) as any[];

		// Build teamId → result map from entered outcomes
		const teamResult: Record<string, 'correct' | 'incorrect' | 'tie'> = {};
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
		const zeroSurvivorResolution = {
			weekId: null as string | null,
			seasonId: null as string | null,
			weekNum: null as number | null,
			entries: [] as any[],
			picks: [] as any[],
			status: 'pending' as 'pending' | 'pending_results' | 'winner_candidate' | 'tie_required' | 'confirmed' | 'continue',
			maxCorrectPicks: 0,
			highestRankedEntries: [] as string[],
			needsAdminConfirmation: false,
		};

		// Process picks for a single week record
		async function processWeek(weekId: string, seasonId: string, poolType?: 'lms' | 'second_half') {
			if (poolType === 'second_half' && weekNum < shStartWeek) {
				return;
			}

			const picks = await pb.collection('picks').getFullList({
				filter: `week = "${weekId}"`,
				expand: 'entry'
			}).catch(() => []) as any[];

			for (const pick of picks) {
				const teams: string[] = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
				const resolvedEntryType = pick.entryType ?? pick.expand?.entry?.entryType ?? null;
				const isLms = resolvedEntryType === 'lms';
				// 2H pool hasn't started yet — never write results or eliminate 2H picks.
				// (2H entries pick on this same week record, so the week-level guard above
				//  is not enough on its own.)
				if (resolvedEntryType === 'second_half' && weekNum < shStartWeek) continue;
				if (poolType === 'second_half' && weekId === shWeekId) {
					zeroSurvivorResolution.weekId = weekId;
					zeroSurvivorResolution.seasonId = seasonId;
					zeroSurvivorResolution.weekNum = weekNum;
				}
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
			lmsWeekId ? processWeek(lmsWeekId, lmsSeasonId!, 'lms') : Promise.resolve(),
			shWeekId  ? processWeek(shWeekId,  shSeasonId!, 'second_half') : Promise.resolve(),
		]);

		if (!AUTO_ZERO_SURVIVOR_RESOLUTION_DISABLED) {
			if (shWeekId && shSeasonId && weekNum >= shStartWeek) {
				const allWeekPicks = (await pb.collection('picks').getFullList({
					filter: `week = "${shWeekId}"`,
					expand: 'entry'
				}).catch(() => []) as any[]).map((pick: any) => ({
					id: pick.id,
					entry: pick.entry,
					week: pick.week,
					pickedTeams: pick.pickedTeams,
					isAutoPick: pick.isAutoPick,
				}));
				const zeroSurvivor = _getZeroSurvivorWinnerResolution({
					seasonId: shSeasonId,
					weekId: shWeekId,
					weekNum,
					entries: shEntrySnapshot,
					picks: allWeekPicks,
					teamResult,
					poolType: 'second_half',
					remainingActiveEntryIds: shEntrySnapshot.filter((entry: any) => entry.status === 'active').map((entry: any) => entry.id),
				});
				if (zeroSurvivor.status !== 'continue') {
					zeroSurvivorResolution.status = zeroSurvivor.status;
					zeroSurvivorResolution.entries = shEntrySnapshot;
					zeroSurvivorResolution.picks = allWeekPicks;
					zeroSurvivorResolution.maxCorrectPicks = zeroSurvivor.maxCorrectPicks;
					zeroSurvivorResolution.highestRankedEntries = zeroSurvivor.highestRankedEntries;
					zeroSurvivorResolution.needsAdminConfirmation = zeroSurvivor.needsAdminConfirmation;
					if (zeroSurvivor.status === 'winner_candidate' || zeroSurvivor.status === 'tie_required') {
						await persistZeroSurvivorResolution(pb, {
							seasonId: shSeasonId,
							weekId: shWeekId,
							weekNum,
							entries: shEntrySnapshot,
							picks: allWeekPicks,
							teamResult,
							poolType: 'second_half',
						});
					}
				}
			}

			if (lmsWeekId && lmsSeasonId) {
				const remainingActiveIds = lmsEntrySnapshot.map((entry: any) => entry.id);
				const allWeekPicks = (await pb.collection('picks').getFullList({
					filter: `week = "${lmsWeekId}"`,
					expand: 'entry'
				}).catch(() => []) as any[]).map((pick: any) => ({
					id: pick.id,
					entry: pick.entry,
					week: pick.week,
					pickedTeams: pick.pickedTeams,
					isAutoPick: pick.isAutoPick,
				}));
				const zeroSurvivor = _getZeroSurvivorWinnerResolution({
					seasonId: lmsSeasonId,
					weekId: lmsWeekId,
					weekNum,
					entries: lmsEntrySnapshot,
					picks: allWeekPicks,
					teamResult,
					poolType: 'lms',
					remainingActiveEntryIds: remainingActiveIds,
				});
				if (zeroSurvivor.status !== 'continue' && (zeroSurvivor.status === 'tie_required' || zeroSurvivor.status === 'winner_candidate')) {
					zeroSurvivorResolution.status = zeroSurvivor.status;
					zeroSurvivorResolution.weekId = lmsWeekId;
					zeroSurvivorResolution.seasonId = lmsSeasonId;
					zeroSurvivorResolution.weekNum = weekNum;
					zeroSurvivorResolution.entries = lmsEntrySnapshot;
					zeroSurvivorResolution.picks = allWeekPicks;
					zeroSurvivorResolution.maxCorrectPicks = zeroSurvivor.maxCorrectPicks;
					zeroSurvivorResolution.highestRankedEntries = zeroSurvivor.highestRankedEntries;
					zeroSurvivorResolution.needsAdminConfirmation = zeroSurvivor.needsAdminConfirmation;
					await persistZeroSurvivorResolution(pb, {
						seasonId: lmsSeasonId,
						weekId: lmsWeekId,
						weekNum,
						entries: lmsEntrySnapshot,
						picks: allWeekPicks,
						teamResult,
						poolType: 'lms',
					});
				}
			}
		}

		if (AUTO_ZERO_SURVIVOR_RESOLUTION_DISABLED) {
			return { success: true, resultsWritten, eliminated, isDraft };
		}

		return { success: true, resultsWritten, eliminated, isDraft, zeroSurvivorResolution };
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
		const draftYear   = data.get('year');

		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });
		const windowError = await validateResultsActionWindow(pb, [lmsWeekId, shWeekId].filter(Boolean) as string[]);
		if (windowError) return windowError;

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

			const provisionalWinners = await pb.collection('entries').getFullList({
				filter: `season = "${seasonId}" && status = "winner" && eliminatedReason ~ "Zero-survivor"`
			}).catch(() => []) as any[];
			for (const e of provisionalWinners) {
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
		if (draftYear && String(draftYear).trim()) {
			clearResultsDraftOutcomes(String(draftYear), weekNum);
		}

		return { resetDone: true, deletedResults, reinstated };
	},

	// Mark both LMS and 2H weeks complete simultaneously
	completeWeek: async ({ request }) => {
		const pb         = await pbAdmin();
		const data       = await request.formData();
		const lmsWeekId  = (data.get('lmsWeekId') as string) || null;
		const shWeekId   = (data.get('shWeekId')  as string) || null;
		const weekNum    = Number(data.get('weekNum'));
		const draftYear  = data.get('year');
		if (!lmsWeekId && !shWeekId) return fail(400, { error: 'At least one week ID is required.' });
		const windowError = await validateResultsActionWindow(pb, [lmsWeekId, shWeekId].filter(Boolean) as string[]);
		if (windowError) return windowError;
		try {
			await Promise.all([
				lmsWeekId ? pb.collection('weekly_settings').update(lmsWeekId, { status: 'complete' }) : Promise.resolve(),
				shWeekId  ? pb.collection('weekly_settings').update(shWeekId,  { status: 'complete' }) : Promise.resolve(),
			]);
			if (draftYear && String(draftYear).trim()) {
				clearResultsDraftOutcomes(String(draftYear), weekNum);
			}
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
		const windowError = await validateResultsActionWindow(pb, [lmsWeekId, shWeekId].filter(Boolean) as string[]);
		if (windowError) return windowError;

		// 2H start week gates auto-picks for 2H entries
		let shStartWeek = 6;
		const configSeasonId = shSeasonId ?? lmsSeasonId;
		if (configSeasonId) {
			const cfgSeason = await pb.collection('seasons')?.getOne(configSeasonId).catch(() => null) as any;
			shStartWeek = cfgSeason?.secondHalfStartWeek ?? 6;
		}

		let autoPicked = 0;

		async function lockOne(weekId: string, seasonId: string) {
			await pb.collection('weekly_settings').update(weekId, { status: 'locked' }).catch(() => {});

			const weekSetting = await pb.collection('weekly_settings').getOne(weekId).catch(() => null) as any;
		const storedAutoTeamId = weekSetting?.biggestFavoriteTeam ?? null;

		// Rank auto-pick candidates from active odds so each entry receives the
		// biggest favourite/underdog it hasn't already used this season
		const odds = await pb.collection('game_odds').getFullList({
			filter: `season = "${seasonId}" && week = ${weekNum} && isActive = true`
		}).catch(() => []) as any[];
		const lmsRanked = rankAutoPickTeamsForPool(odds, 'lms');
		const shRanked  = rankAutoPickTeamsForPool(odds, 'second_half');
		if (!lmsRanked.length && !shRanked.length && !storedAutoTeamId) return;

		const entries = await pb.collection('entries').getFullList({
			filter: `season = "${seasonId}" && status = "active"`
		}).catch(() => []) as any[];

		const existingPicks = await pb.collection('picks').getFullList({
			filter: `week = "${weekId}"`, fields: 'entry'
		}).catch(() => []) as any[];
		const pickedEntryIds = new Set(existingPicks.map((p: any) => p.entry));

		// Teams each entry has already used this season — auto-picks must skip them
		const seasonPicks = await pb.collection('picks').getFullList({
			filter: `week.season = "${seasonId}"`, fields: 'entry,pickedTeams'
		}).catch(() => []) as any[];
		const usedByEntry = new Map<string, Set<string>>();
		for (const p of seasonPicks) {
			const teams: string[] = Array.isArray(p.pickedTeams) ? p.pickedTeams : [p.pickedTeams];
			const used = usedByEntry.get(p.entry) ?? new Set<string>();
			for (const t of teams) if (t) used.add(t);
			usedByEntry.set(p.entry, used);
		}

		for (const entry of entries) {
			if (pickedEntryIds.has(entry.id)) continue;
			// 2H pool hasn't started yet — don't auto-pick for 2H entries
			if (entry.entryType === 'second_half' && weekNum < shStartWeek) continue;
			const ranked     = entry.entryType === 'second_half' ? shRanked : lmsRanked;
			const autoTeamId = selectAutoPickForEntry(ranked, usedByEntry.get(entry.id)) ?? storedAutoTeamId;
			if (!autoTeamId) continue;
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

		const windowError = await validateResultsActionWindow(pb, [weekId]);
		if (windowError) return windowError;

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
