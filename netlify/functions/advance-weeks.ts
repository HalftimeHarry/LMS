import { schedule } from '@netlify/functions';

/**
 * Scheduled function — runs every 2 minutes.
 *
 * Drives ALL active seasons (real + test) through the week lifecycle:
 *   open → locked → results_pending → complete
 *
 * Phase offsets are derived from each week's deadline:
 *   deadline          = lock time  (picks close)
 *   deadline + 10 min = results    (simulate outcomes)
 *   deadline + 18 min = complete   (eliminate entries, open next week)
 *
 * For real seasons, results are NOT simulated — the admin records them
 * manually via the Results page. Only [TEST] seasons get auto-simulated results.
 */

const PB_URL      = process.env.PUBLIC_POCKETBASE_URL!;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL!;
const ADMIN_PASS  = process.env.POCKETBASE_ADMIN_PASSWORD!;

// Minutes after the deadline each phase fires
const RESULTS_DELAY_MS  = 10 * 60 * 1000; // +10 min
const COMPLETE_DELAY_MS = 18 * 60 * 1000; // +18 min

// ---------------------------------------------------------------------------
// PocketBase helpers
// ---------------------------------------------------------------------------
let _token    = '';
let _tokenExp = 0;

async function auth(): Promise<string> {
	if (_token && Date.now() < _tokenExp) return _token;
	const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
	});
	const d = await res.json();
	if (!d.token) throw new Error('PB auth failed: ' + JSON.stringify(d));
	_token    = d.token;
	_tokenExp = Date.now() + 50 * 60 * 1000;
	return _token;
}

async function pbGet(collection: string, filter?: string, sort?: string): Promise<any[]> {
	const token = await auth();
	const params = new URLSearchParams({ perPage: '500' });
	if (filter) params.set('filter', filter);
	if (sort)   params.set('sort', sort);
	const res = await fetch(`${PB_URL}/api/collections/${collection}/records?${params}`, {
		headers: { Authorization: token },
	});
	const d = await res.json();
	if (!res.ok) throw new Error(`GET ${collection}: ${JSON.stringify(d)}`);
	return d.items ?? [];
}

async function pbGetOne(collection: string, id: string): Promise<any> {
	const token = await auth();
	const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
		headers: { Authorization: token },
	});
	const d = await res.json();
	if (!res.ok) throw new Error(`GET ${collection}/${id}: ${JSON.stringify(d)}`);
	return d;
}

async function pbPatch(collection: string, id: string, body: object): Promise<any> {
	const token = await auth();
	const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
		method:  'PATCH',
		headers: { 'Content-Type': 'application/json', Authorization: token },
		body:    JSON.stringify(body),
	});
	const d = await res.json();
	if (!res.ok) throw new Error(`PATCH ${collection}/${id}: ${JSON.stringify(d)}`);
	return d;
}

async function pbPost(collection: string, body: object): Promise<any> {
	const token = await auth();
	const res = await fetch(`${PB_URL}/api/collections/${collection}/records`, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json', Authorization: token },
		body:    JSON.stringify(body),
	});
	const d = await res.json();
	if (!res.ok) throw new Error(`POST ${collection}: ${JSON.stringify(d).slice(0, 200)}`);
	return d;
}

async function pbGetInChunks(collection: string, ids: string[], field: string): Promise<any[]> {
	const CHUNK = 20;
	const results: any[] = [];
	for (let i = 0; i < ids.length; i += CHUNK) {
		const chunk  = ids.slice(i, i + CHUNK);
		const filter = chunk.map(id => `${field} = "${id}"`).join(' || ');
		const items  = await pbGet(collection, filter);
		results.push(...items);
	}
	return results;
}

// ---------------------------------------------------------------------------
// Week lifecycle
// ---------------------------------------------------------------------------

/**
 * Derive the biggest favorite from active game odds for a given season/week.
 * Returns the team ID with the largest absolute spread (most favored).
 * If two teams tie, one is chosen at random.
 */
async function deriveBiggestFavorite(seasonId: string, weekNum: number): Promise<string | null> {
	const games = await pbGet('game_odds',
		`season = "${seasonId}" && week = ${weekNum} && isActive = true`
	);
	if (!games.length) return null;

	let bestTeamId: string | null = null;
	let bestSpread = 0; // most negative homeSpread = home is biggest favorite

	for (const game of games) {
		const spread = game.homeSpread as number | null;
		if (spread == null) continue;

		// Home team is favorite when spread < 0; away team when spread > 0
		const homeAbs = Math.abs(spread);
		if (homeAbs > bestSpread) {
			bestSpread  = homeAbs;
			bestTeamId  = spread < 0 ? game.homeTeam : game.awayTeam;
		} else if (homeAbs === bestSpread && bestTeamId) {
			// Tie — pick randomly between current best and this candidate
			if (Math.random() < 0.5) {
				bestTeamId = spread < 0 ? game.homeTeam : game.awayTeam;
			}
		}
	}

	return bestTeamId;
}

async function lockWeek(week: any, seasonId: string, log: string[]): Promise<void> {
	if (week.status !== 'open') return;
	log.push(`Week ${week.week}: locking`);
	await pbPatch('weekly_settings', week.id, { status: 'locked' });

	// Derive biggest favorite from odds (ignore manually-set field)
	const autoTeamId = await deriveBiggestFavorite(seasonId, week.week);
	if (!autoTeamId) {
		log.push(`  no active odds found — skipping auto-pick`);
		return;
	}

	// Persist it back onto the week record so the UI can display it
	await pbPatch('weekly_settings', week.id, { biggestFavoriteTeam: autoTeamId }).catch(() => {});

	const entries       = await pbGet('entries', `season = "${seasonId}" && status = "active"`);
	const existingPicks = await pbGet('picks', `week = "${week.id}"`);
	const pickedIds     = new Set(existingPicks.map((p: any) => p.entry));
	let   autoPicked    = 0;

	for (const entry of entries) {
		if (pickedIds.has(entry.id)) continue;
		try {
			await pbPost('picks', {
				entry:       entry.id,
				week:        week.id,
				pickedTeams: [autoTeamId],
				entryType:   entry.entryType,
				isAutoPick:  true,
			});
			autoPicked++;
		} catch { /* skip individual failures */ }
	}
	log.push(`  auto-pick team: ${autoTeamId} — picked for ${autoPicked} entries`);
}

async function simulateResults(week: any, seasonId: string, log: string[]): Promise<void> {
	if (week.status !== 'locked') return;
	log.push(`Week ${week.week}: simulating results`);

	// Random game outcomes — home 52.5% win, away 42.5%, tie 5%
	const games      = await pbGet('game_odds', `season = "${seasonId}" && week = ${week.week}`);
	const teamResult: Record<string, 'correct' | 'incorrect'> = {};

	for (const game of games) {
		const roll = Math.random();
		const homeWins = roll < 0.525;
		const awayWins = roll >= 0.05 && !homeWins;
		if (game.homeTeam) teamResult[game.homeTeam] = homeWins ? 'correct' : 'incorrect';
		if (game.awayTeam) teamResult[game.awayTeam] = awayWins ? 'correct' : 'incorrect';
	}

	const picks = await pbGet('picks', `week = "${week.id}"`);
	let correct = 0, incorrect = 0;

	for (const pick of picks) {
		const teams = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
		for (const teamId of teams) {
			const result = teamResult[teamId] ?? 'incorrect';
			result === 'correct' ? correct++ : incorrect++;
			try {
				const existing = await pbGet('pick_results', `pick = "${pick.id}" && team = "${teamId}"`);
				if (existing.length) {
					await pbPatch('pick_results', existing[0].id, { result });
				} else {
					await pbPost('pick_results', { pick: pick.id, team: teamId, result, notes: 'auto-simulated' });
				}
			} catch { /* skip */ }
		}
	}

	log.push(`  ${correct} correct, ${incorrect} incorrect across ${picks.length} picks`);
	await pbPatch('weekly_settings', week.id, { status: 'results_pending' });
}

async function completeWeek(week: any, seasonId: string, log: string[]): Promise<void> {
	if (week.status !== 'results_pending') return;
	log.push(`Week ${week.week}: completing`);

	const picks = await pbGet('picks', `week = "${week.id}"`);
	let eliminated = 0;

	for (const pick of picks) {
		const results = await pbGet('pick_results', `pick = "${pick.id}"`);
		if (!results.length) continue;
		const isLms = pick.entryType === 'lms';
		// LMS:      eliminated when picked team WINS (result=correct)
		// 2nd Half: eliminated when picked team LOSES (result=incorrect)
		const shouldEliminate = isLms
			? results.some((r: any) => r.result === 'correct')
			: results.some((r: any) => r.result === 'incorrect');
		if (!shouldEliminate) continue;
		try {
			const entry = await pbGetOne('entries', pick.entry);
			if (entry.status === 'active') {
				await pbPatch('entries', entry.id, {
					status:           'eliminated',
					eliminatedWeek:   week.week,
					eliminatedReason: isLms ? 'Picked a winning team' : 'Picked a losing team',
				});
				eliminated++;
			}
		} catch { /* skip */ }
	}

	await pbPatch('weekly_settings', week.id, { status: 'complete' });
	log.push(`  ${eliminated} entries eliminated`);

	// Open the next week if it exists and is still in setup
	const nextWeeks = await pbGet('weekly_settings',
		`season = "${seasonId}" && week = ${week.week + 1}`);
	if (nextWeeks[0] && nextWeeks[0].status === 'open') {
		log.push(`  Week ${week.week + 1} already open`);
	}

	// Check if all weeks are complete → mark season complete
	const allWeeks = await pbGet('weekly_settings', `season = "${seasonId}"`);
	const allDone  = allWeeks.every((w: any) => w.status === 'complete');
	if (allDone) {
		await pbPatch('seasons', seasonId, { status: 'complete' });
		log.push(`  Season ${seasonId} marked complete`);
	}
}

// ---------------------------------------------------------------------------
// Main logic
// ---------------------------------------------------------------------------
async function advanceWeeks(): Promise<void> {
	const now = Date.now();
	const log: string[] = [`advance-weeks fired at ${new Date().toISOString()}`];

	// All active/open seasons
	const seasons = await pbGet('seasons', 'status = "active" || status = "open"');
	log.push(`${seasons.length} active season(s)`);

	for (const season of seasons) {
		const isTest = season.name?.includes('[TEST]');
		const weeks  = await pbGet('weekly_settings', `season = "${season.id}"`, '+week');

		for (const week of weeks) {
			const deadline    = new Date(week.deadline).getTime();
			const resultsAt   = deadline + RESULTS_DELAY_MS;
			const completeAt  = deadline + COMPLETE_DELAY_MS;

			// Lock: deadline has passed and week is still open
			if (now >= deadline && week.status === 'open') {
				await lockWeek(week, season.id, log);
			}

			// Simulate results: only for [TEST] seasons
			if (isTest && now >= resultsAt && week.status === 'locked') {
				await simulateResults(week, season.id, log);
			}

			// Complete: for test seasons auto-complete; real seasons need manual results first
			if (now >= completeAt && week.status === 'results_pending') {
				await completeWeek(week, season.id, log);
			}
		}
	}

	console.log(log.join('\n'));
}

// Netlify scheduled function — runs every 2 minutes
export const handler = schedule('*/2 * * * *', async () => {
	try {
		await advanceWeeks();
		return { statusCode: 200 };
	} catch (e: any) {
		console.error('advance-weeks error:', e.message);
		return { statusCode: 500, body: e.message };
	}
});
