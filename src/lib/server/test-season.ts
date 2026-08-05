/**
 * Test season management — seed, clear, reset.
 * Used by both the admin UI actions and the seed scripts.
 */

import type PocketBase from 'pocketbase';

export type TestInterval = '1h' | '1d';
export type TestSeedMode = 'with-picks' | 'no-picks';

const INTERVAL_MS: Record<TestInterval, number> = {
	'1h': 60 * 60 * 1000,
	'1d': 24 * 60 * 60 * 1000,
};

// Dynamic anchor: Week 1 starts 5 minutes from now so deadlines are always in the future.
function makeSeasonStart() {
	return new Date(Date.now() + 5 * 60 * 1000);
}

// Weighted spread pool
const SPREADS = [
	-1, -1.5, -2, -2.5, -3, -3, -3, -3.5, -4, -4.5,
	-5, -5.5, -6, -6.5, -7, -7, -7.5, -8, -9, -9.5,
	-10, -10.5, -11, -12, -13, -13.5, -14,
];

function randomSpread() {
	const s = SPREADS[Math.floor(Math.random() * SPREADS.length)];
	return Math.random() < 0.5 ? s : -s;
}

function spreadToMoneyline(spread: number) {
	const table: [number, number][] = [
		[0, -110], [1, -120], [1.5, -130], [2, -140],
		[2.5, -145], [3, -165], [3.5, -175], [4, -190],
		[4.5, -200], [5, -210], [5.5, -220], [6, -230],
		[6.5, -245], [7, -275], [7.5, -290], [8, -310],
		[9, -330], [10, -380], [10.5, -400], [11, -420],
		[12, -450], [13, -500], [13.5, -525], [14, -550],
	];
	const abs = Math.abs(spread);
	const row = table.find(([s]) => s >= abs) ?? table[table.length - 1];
	const favML = row[1];
	const dogML = Math.round(-favML * 0.75);
	return spread <= 0
		? { homeML: favML, awayML: dogML }
		: { homeML: dogML, awayML: favML };
}

function pbDate(d: Date) {
	return d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 2026 NFL schedule
const SCHEDULE = [
	{ week:1,  games:[{away:'NE',home:'SEA'},{away:'SF',home:'LAR'},{away:'CHI',home:'CAR'},{away:'TB',home:'CIN'},{away:'BAL',home:'IND'},{away:'BUF',home:'HOU'},{away:'NO',home:'DET'},{away:'NYJ',home:'TEN'},{away:'ATL',home:'PIT'},{away:'CLE',home:'JAX'},{away:'ARI',home:'LAC'},{away:'GB',home:'MIN'},{away:'MIA',home:'LV'},{away:'WAS',home:'PHI'},{away:'DAL',home:'NYG'},{away:'DEN',home:'KC'}]},
	{ week:2,  games:[{away:'DET',home:'BUF'},{away:'MIN',home:'CHI'},{away:'PHI',home:'TEN'},{away:'GB',home:'NYJ'},{away:'CAR',home:'ATL'},{away:'NO',home:'BAL'},{away:'CIN',home:'HOU'},{away:'CLE',home:'TB'},{away:'PIT',home:'NE'},{away:'LV',home:'LAC'},{away:'JAX',home:'DEN'},{away:'WAS',home:'DAL'},{away:'SEA',home:'ARI'},{away:'MIA',home:'SF'},{away:'IND',home:'KC'},{away:'NYG',home:'LAR'}]},
	{ week:3,  games:[{away:'ATL',home:'GB'},{away:'KC',home:'MIA'},{away:'HOU',home:'IND'},{away:'TEN',home:'NYG'},{away:'NE',home:'JAX'},{away:'CIN',home:'PIT'},{away:'CAR',home:'CLE'},{away:'NYJ',home:'DET'},{away:'SEA',home:'WAS'},{away:'LAC',home:'BUF'},{away:'MIN',home:'TB'},{away:'ARI',home:'SF'},{away:'BAL',home:'DAL'},{away:'LV',home:'NO'},{away:'LAR',home:'DEN'},{away:'PHI',home:'CHI'}]},
	{ week:4,  games:[{away:'PIT',home:'CLE'},{away:'IND',home:'WAS'},{away:'TEN',home:'BAL'},{away:'ARI',home:'NYG'},{away:'JAX',home:'CIN'},{away:'NE',home:'BUF'},{away:'DAL',home:'HOU'},{away:'LAR',home:'PHI'},{away:'GB',home:'TB'},{away:'NYJ',home:'CHI'},{away:'MIA',home:'MIN'},{away:'DEN',home:'SF'},{away:'LAC',home:'SEA'},{away:'KC',home:'LV'},{away:'DET',home:'CAR'},{away:'ATL',home:'NO'}]},
	{ week:5,  games:[{away:'TB',home:'DAL'},{away:'PHI',home:'JAX'},{away:'LV',home:'NE'},{away:'HOU',home:'TEN'},{away:'CLE',home:'NYJ'},{away:'IND',home:'PIT'},{away:'CIN',home:'MIA'},{away:'MIN',home:'NO'},{away:'NYG',home:'WAS'},{away:'DEN',home:'LAC'},{away:'CHI',home:'GB'},{away:'DET',home:'ARI'},{away:'SF',home:'SEA'},{away:'BAL',home:'ATL'},{away:'BUF',home:'LAR'}]},
	{ week:6,  games:[{away:'SEA',home:'DEN'},{away:'HOU',home:'JAX'},{away:'NYJ',home:'NE'},{away:'PIT',home:'TB'},{away:'CAR',home:'PHI'},{away:'CHI',home:'ATL'},{away:'TEN',home:'IND'},{away:'NO',home:'NYG'},{away:'BAL',home:'CLE'},{away:'ARI',home:'LAR'},{away:'LAC',home:'KC'},{away:'BUF',home:'LV'},{away:'DAL',home:'GB'},{away:'WAS',home:'SF'}]},
	{ week:7,  games:[{away:'NE',home:'CHI'},{away:'PIT',home:'NO'},{away:'CLE',home:'TEN'},{away:'MIA',home:'NYJ'},{away:'IND',home:'MIN'},{away:'CIN',home:'BAL'},{away:'NYG',home:'HOU'},{away:'TB',home:'CAR'},{away:'SF',home:'ATL'},{away:'DEN',home:'ARI'},{away:'LAR',home:'LV'},{away:'GB',home:'DET'},{away:'KC',home:'SEA'},{away:'DAL',home:'PHI'}]},
	{ week:8,  games:[{away:'CAR',home:'GB'},{away:'TEN',home:'CIN'},{away:'IND',home:'JAX'},{away:'CLE',home:'PIT'},{away:'BAL',home:'BUF'},{away:'ATL',home:'TB'},{away:'MIN',home:'DET'},{away:'ARI',home:'DAL'},{away:'LV',home:'NYJ'},{away:'LAC',home:'LAR'},{away:'KC',home:'DEN'},{away:'NE',home:'MIA'},{away:'PHI',home:'WAS'},{away:'CHI',home:'SEA'}]},
	{ week:9,  games:[{away:'JAX',home:'BAL'},{away:'CIN',home:'ATL'},{away:'NYJ',home:'KC'},{away:'CLE',home:'NO'},{away:'DEN',home:'CAR'},{away:'DAL',home:'IND'},{away:'DET',home:'MIA'},{away:'NYG',home:'PHI'},{away:'LAR',home:'WAS'},{away:'LV',home:'SF'},{away:'HOU',home:'LAC'},{away:'ARI',home:'SEA'},{away:'GB',home:'NE'},{away:'TB',home:'CHI'},{away:'BUF',home:'MIN'}]},
	{ week:10, games:[{away:'WAS',home:'NYG'},{away:'NE',home:'DET'},{away:'BUF',home:'NYJ'},{away:'MIA',home:'IND'},{away:'KC',home:'ATL'},{away:'MIN',home:'GB'},{away:'JAX',home:'TEN'},{away:'HOU',home:'CLE'},{away:'CAR',home:'NO'},{away:'LAR',home:'ARI'},{away:'SEA',home:'LV'},{away:'SF',home:'DAL'},{away:'PIT',home:'CIN'},{away:'LAC',home:'BAL'}]},
	{ week:11, games:[{away:'IND',home:'HOU'},{away:'ARI',home:'KC'},{away:'TB',home:'DET'},{away:'JAX',home:'NYG'},{away:'MIA',home:'BUF'},{away:'TEN',home:'DAL'},{away:'BAL',home:'CAR'},{away:'NO',home:'CHI'},{away:'NYJ',home:'LAC'},{away:'PIT',home:'PHI'},{away:'LV',home:'DEN'},{away:'MIN',home:'SF'},{away:'CIN',home:'WAS'}]},
	{ week:12, games:[{away:'GB',home:'LAR'},{away:'CHI',home:'DET'},{away:'PHI',home:'DAL'},{away:'KC',home:'BUF'},{away:'DEN',home:'PIT'},{away:'BAL',home:'HOU'},{away:'NO',home:'CIN'},{away:'NYJ',home:'MIA'},{away:'ATL',home:'MIN'},{away:'NYG',home:'IND'},{away:'LV',home:'CLE'},{away:'TEN',home:'JAX'},{away:'WAS',home:'ARI'},{away:'SEA',home:'SF'},{away:'NE',home:'LAC'},{away:'CAR',home:'TB'}]},
	{ week:13, games:[{away:'KC',home:'LAR'},{away:'WAS',home:'ARI'},{away:'DET',home:'ATL'},{away:'LAC',home:'TB'},{away:'CIN',home:'CLE'},{away:'SF',home:'NYG'},{away:'GB',home:'NO'},{away:'JAX',home:'CHI'},{away:'PHI',home:'ARI'},{away:'MIA',home:'DEN'},{away:'CAR',home:'MIN'},{away:'BUF',home:'NE'},{away:'HOU',home:'PIT'},{away:'DAL',home:'SEA'}]},
	{ week:14, games:[{away:'MIN',home:'NE'},{away:'DEN',home:'NYJ'},{away:'ATL',home:'CLE'},{away:'CHI',home:'MIA'},{away:'HOU',home:'WAS'},{away:'NO',home:'CAR'},{away:'IND',home:'PHI'},{away:'TB',home:'BAL'},{away:'TEN',home:'DET'},{away:'LAC',home:'LV'},{away:'KC',home:'CIN'},{away:'LAR',home:'SF'},{away:'NYG',home:'SEA'},{away:'BUF',home:'GB'},{away:'PIT',home:'JAX'}]},
	{ week:15, games:[{away:'SF',home:'LAC'},{away:'SEA',home:'PHI'},{away:'CHI',home:'BUF'},{away:'JAX',home:'HOU'},{away:'BAL',home:'PIT'},{away:'CLE',home:'NYG'},{away:'IND',home:'TEN'},{away:'MIA',home:'GB'},{away:'NO',home:'TB'},{away:'CIN',home:'CAR'},{away:'ATL',home:'WAS'},{away:'NYJ',home:'ARI'},{away:'DAL',home:'LAR'},{away:'DEN',home:'LV'},{away:'DET',home:'MIN'},{away:'NE',home:'KC'}]},
	{ week:16, games:[{away:'HOU',home:'PHI'},{away:'GB',home:'CHI'},{away:'BUF',home:'DEN'},{away:'LAR',home:'SEA'},{away:'TB',home:'ATL'},{away:'WAS',home:'MIN'},{away:'CAR',home:'PIT'},{away:'CIN',home:'IND'},{away:'NE',home:'NYJ'},{away:'CLE',home:'BAL'},{away:'LAC',home:'MIA'},{away:'ARI',home:'LV'},{away:'SF',home:'KC'},{away:'JAX',home:'DAL'},{away:'NYG',home:'DET'}]},
	{ week:17, games:[{away:'BAL',home:'CIN'},{away:'LAR',home:'TB'},{away:'DEN',home:'NE'},{away:'KC',home:'LAC'},{away:'WAS',home:'JAX'},{away:'BUF',home:'MIA'},{away:'PIT',home:'TEN'},{away:'MIN',home:'NYJ'},{away:'NO',home:'ATL'},{away:'SEA',home:'CAR'},{away:'IND',home:'CLE'},{away:'NYG',home:'DAL'},{away:'LV',home:'ARI'},{away:'DET',home:'CHI'},{away:'PHI',home:'SF'},{away:'HOU',home:'GB'}]},
	{ week:18, games:[{away:'NYJ',home:'BUF'},{away:'JAX',home:'IND'},{away:'LV',home:'KC'},{away:'TEN',home:'HOU'},{away:'LAC',home:'DEN'},{away:'MIA',home:'NE'},{away:'CLE',home:'CIN'},{away:'PIT',home:'BAL'},{away:'CHI',home:'MIN'},{away:'DET',home:'GB'},{away:'DAL',home:'WAS'},{away:'TB',home:'NO'},{away:'PHI',home:'NYG'},{away:'SEA',home:'LAR'},{away:'ATL',home:'CAR'},{away:'SF',home:'ARI'}]},
];

// ---------------------------------------------------------------------------
// Seed a test season pair (LMS + Second Half)
// ---------------------------------------------------------------------------
export async function seedTestSeasonPair(pb: PocketBase, interval: TestInterval, mode: TestSeedMode = 'with-picks'): Promise<{
	lmsId: string;
	shId:  string;
	lmsName: string;
	shName:  string;
}> {
	const intervalMs  = INTERVAL_MS[interval];
	const seasonStart = makeSeasonStart();
	const tag         = `(${interval}/week) ${seasonStart.toISOString().slice(0, 16)}`;

	// Load teams
	const teams      = await pb.collection('nfl_teams').getFullList({ sort: 'name' });
	const teamByAbbr = Object.fromEntries(teams.map((t: any) => [t.abbreviation, t]));

	// Load test users
	const testUsers = await pb.collection('users').getFullList({
		filter: 'email ~ "@blo.com"',
		sort:   'displayName',
	});

	const paymentMethods = ['check', 'venmo', 'paypal', 'zelle', 'cash'];

	async function createSeason(name: string, isSecondHalf: boolean) {
		const firstPaymentDeadline = new Date(seasonStart.getTime() + intervalMs - 30 * 60 * 1000);
		return pb.collection('seasons').create({
			name,
			year:                    2026,
			status:                  'active',
			lmsEntryFee:             100,
			secondHalfEntryFee:      50,
			secondHalfPicksPerWeek:  2,
			regularSeasonOnly:       true,
			lmsEnabled:              !isSecondHalf,
			secondHalfEnabled:       isSecondHalf,
			secondHalfStartWeek:     6,
			secondHalfPicksStartWeek: 10,
			paymentDeadline:         pbDate(firstPaymentDeadline),
		});
	}

	async function createWeeks(seasonId: string) {
		const recs = [];
		for (let w = 1; w <= 18; w++) {
			const slotStart = new Date(seasonStart.getTime() + (w - 1) * intervalMs);
			const deadline  = new Date(slotStart.getTime() + intervalMs - 30 * 60 * 1000);
			const rec = await pb.collection('weekly_settings').create({
				season: seasonId, week: w, status: 'open', deadline: pbDate(deadline),
			});
			recs.push(rec);
		}
		return recs;
	}

	async function createOdds(seasonId: string) {
		for (const weekData of SCHEDULE) {
			const slotStart = new Date(seasonStart.getTime() + (weekData.week - 1) * intervalMs);
			const spacing   = weekData.games.length > 1 ? (intervalMs * 0.9) / (weekData.games.length - 1) : 0;
			for (let i = 0; i < weekData.games.length; i++) {
				const game     = weekData.games[i];
				const gameTime = new Date(slotStart.getTime() + i * spacing);
				const homeTeam = teamByAbbr[game.home];
				const awayTeam = teamByAbbr[game.away];
				if (!homeTeam || !awayTeam) continue;
				const spread = randomSpread();
				const { homeML, awayML } = spreadToMoneyline(spread);
				try {
					const kickoffIso = pbDate(gameTime);
					await pb.collection('game_odds').create({
						season: seasonId, week: weekData.week,
						homeTeam: homeTeam.id, awayTeam: awayTeam.id,
						game_time_stamp: kickoffIso,
						homeSpread: spread, homeMoneyline: homeML, awayMoneyline: awayML,
						isActive: true,
					});
				} catch { /* skip */ }
			}
		}
	}

	async function seedEntries(seasonId: string, entryType: 'lms' | 'second_half', weeks: any[]) {
		const seasonTag = entryType === 'lms' ? `LMS-${interval}` : `2H-${interval}`;

		if (mode === 'no-picks') {
			// Clean state: exactly 1 entry per user, all paid + active, no picks
			for (const user of testUsers) {
				const name = `${(user as any).displayName} · ${seasonTag}`;
				try {
					await pb.collection('entries').create({
						season: seasonId, user: (user as any).id,
						entryName: name, entryType, status: 'active',
						paid: true, paidAt: pbDate(new Date()),
						paymentMethod: 'venmo', referredBy: null,
					});
				} catch { /* skip */ }
			}
			return; // no picks seeded
		}

		// with-picks mode: random counts, random paid status, picks for weeks 1-3
		const maxPerUser = entryType === 'lms' ? 4 : 2;
		const pickWeeks  = weeks.slice(0, 3);

		for (const user of testUsers) {
			const count  = rand(1, maxPerUser);
			const isPaid = Math.random() < 0.65;
			const status = isPaid ? 'active' : 'pending_payment';
			const newEntries: any[] = [];

			for (let e = 1; e <= count; e++) {
				const name = count === 1
					? `${(user as any).displayName} · ${seasonTag}`
					: `${(user as any).displayName} Entry ${e} · ${seasonTag}`;
				try {
					const rec = await pb.collection('entries').create({
						season: seasonId, user: (user as any).id,
						entryName: name, entryType, status,
						paid:          isPaid,
						paidAt:        isPaid ? pbDate(new Date()) : null,
						paymentMethod: isPaid ? pickRandom(paymentMethods) : null,
						referredBy:    null,
					});
					newEntries.push({ id: rec.id, status });
				} catch { /* skip */ }
			}

			// Seed picks for active entries
			for (const entry of newEntries.filter(e => e.status === 'active')) {
				if (Math.random() < 0.15) continue;
				const pool = shuffle(teams);
				let idx = 0;
				for (const week of pickWeeks) {
					if (week.week > 1 && Math.random() < 0.15) continue;
					const team = pool[idx++] as any;
					if (!team) break;
					try {
						await pb.collection('picks').create({
							entry: entry.id, week: week.id,
							pickedTeams: [team.id], entryType, isAutoPick: false,
						});
					} catch { /* skip */ }
				}
			}
		}
	}

	// Create LMS season
	const lmsSeason = await createSeason(`[TEST] 2026 - 2027 LMS ${tag}`, false) as any;
	const lmsWeeks  = await createWeeks(lmsSeason.id);
	await createOdds(lmsSeason.id);
	await seedEntries(lmsSeason.id, 'lms', lmsWeeks);

	// Create Second Half season
	const shSeason = await createSeason(`[TEST] 2026 - 2027 Second Half ${tag}`, true) as any;
	const shWeeks  = await createWeeks(shSeason.id);
	await createOdds(shSeason.id);
	await seedEntries(shSeason.id, 'second_half', shWeeks);

	return {
		lmsId:   lmsSeason.id,
		shId:    shSeason.id,
		lmsName: lmsSeason.name,
		shName:  shSeason.name,
	};
}

// ---------------------------------------------------------------------------
// Clear a single test season and all its data
// ---------------------------------------------------------------------------
export async function clearTestSeason(pb: PocketBase, seasonId: string): Promise<{
	deleted: { pickResults: number; picks: number; entries: number; odds: number; weeks: number };
}> {
	// Safety: only [TEST] seasons
	const season = await pb.collection('seasons').getOne(seasonId) as any;
	if (!season.name?.includes('[TEST]')) {
		throw new Error(`Season "${season.name}" is not a test season.`);
	}

	const weeks   = await pb.collection('weekly_settings').getFullList({ filter: `season = "${seasonId}"` });
	const weekIds = weeks.map((w: any) => w.id);

	// Picks via week IDs (chunked)
	const CHUNK = 20;
	const picks: any[] = [];
	for (let i = 0; i < weekIds.length; i += CHUNK) {
		const chunk  = weekIds.slice(i, i + CHUNK);
		const filter = chunk.map((id: string) => `week = "${id}"`).join(' || ');
		const items  = await pb.collection('picks').getFullList({ filter });
		picks.push(...items);
	}

	const pickIds = picks.map((p: any) => p.id);
	const pickResults: any[] = [];
	for (let i = 0; i < pickIds.length; i += CHUNK) {
		const chunk  = pickIds.slice(i, i + CHUNK);
		const filter = chunk.map((id: string) => `pick = "${id}"`).join(' || ');
		const items  = await pb.collection('pick_results').getFullList({ filter });
		pickResults.push(...items);
	}

	const entries = await pb.collection('entries').getFullList({ filter: `season = "${seasonId}"` });
	const odds    = await pb.collection('game_odds').getFullList({ filter: `season = "${seasonId}"` });

	// Delete in dependency order
	for (const r of pickResults) await pb.collection('pick_results').delete(r.id).catch(() => {});
	for (const p of picks)       await pb.collection('picks').delete(p.id).catch(() => {});
	for (const e of entries)     await pb.collection('entries').delete(e.id).catch(() => {});
	for (const o of odds)        await pb.collection('game_odds').delete(o.id).catch(() => {});
	for (const w of weeks)       await pb.collection('weekly_settings').delete(w.id).catch(() => {});
	await pb.collection('seasons').delete(seasonId);

	return {
		deleted: {
			pickResults: pickResults.length,
			picks:       picks.length,
			entries:     entries.length,
			odds:        odds.length,
			weeks:       weeks.length,
		},
	};
}
