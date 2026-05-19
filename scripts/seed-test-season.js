#!/usr/bin/env node
/**
 * seed-test-season.js
 *
 * Creates a self-contained test season that compresses NFL time:
 *   --interval=1h  → each NFL week = 1 real hour  (full season in 18h)
 *   --interval=1d  → each NFL week = 1 real day   (full season in 18d)
 *
 * What it creates:
 *   - A new season record tagged as a test season (name includes "[TEST]")
 *   - 18 weekly_settings records with deadlines spaced by the interval
 *     Deadline = first game kickoff of that week MINUS 20 minutes (compressed)
 *   - game_odds records cloned from the real 2026 schedule with randomized
 *     spreads/moneylines and game times mapped into the compressed timeline
 *
 * The season ID is printed at the end — pass it to advance-test-season.js
 * and clear-test-season.js.
 *
 * Run:
 *   node scripts/seed-test-season.js --interval=1h
 *   node scripts/seed-test-season.js --interval=1d
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args     = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const interval = args.interval ?? '1h';

const INTERVAL_MS = (() => {
  if (interval === '1h') return 60 * 60 * 1000;
  if (interval === '1d') return 24 * 60 * 60 * 1000;
  const m = interval.match(/^(\d+)(h|d|m)$/);
  if (m) {
    const n = parseInt(m[1]);
    if (m[2] === 'h') return n * 60 * 60 * 1000;
    if (m[2] === 'd') return n * 24 * 60 * 60 * 1000;
    if (m[2] === 'm') return n * 60 * 1000;
  }
  console.error(`Unknown interval "${interval}". Use e.g. 1h, 6h, 1d`);
  process.exit(1);
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pbDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';
}

// Weighted spread pool — realistic NFL distribution
const SPREADS = [
  -1, -1.5, -2, -2.5, -3, -3, -3, -3.5, -4, -4.5,
  -5, -5.5, -6, -6.5, -7, -7, -7.5, -8, -9, -9.5,
  -10, -10.5, -11, -12, -13, -13.5, -14,
];

function randomSpread() {
  // 50/50 home vs away favored
  const s = SPREADS[Math.floor(Math.random() * SPREADS.length)];
  return Math.random() < 0.5 ? s : -s;
}

function spreadToMoneyline(spread) {
  const table = [
    [0,   -110], [1,   -120], [1.5, -130], [2,   -140],
    [2.5, -145], [3,   -165], [3.5, -175], [4,   -190],
    [4.5, -200], [5,   -210], [5.5, -220], [6,   -230],
    [6.5, -245], [7,   -275], [7.5, -290], [8,   -310],
    [9,   -330], [10,  -380], [10.5,-400], [11,  -420],
    [12,  -450], [13,  -500], [13.5,-525], [14,  -550],
  ];
  const abs = Math.abs(spread);
  const row = table.find(([s]) => s >= abs) ?? table[table.length - 1];
  const favML = row[1];
  const dogML = Math.round(-favML * 0.75);
  return spread <= 0
    ? { homeML: favML, awayML: dogML }
    : { homeML: dogML, awayML: favML };
}

// ---------------------------------------------------------------------------
// PocketBase helpers
// ---------------------------------------------------------------------------
async function auth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth failed: ' + JSON.stringify(d));
  return d.token;
}

async function post(token, collection, body) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body)
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`POST ${collection}: ${d.message ?? JSON.stringify(d).slice(0,200)}`);
  return d;
}

async function getAll(token, collection, filter) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=500` : '?perPage=500';
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${q}`, {
    headers: { Authorization: token }
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`GET ${collection}: ${JSON.stringify(d)}`);
  return d.items ?? [];
}

// ---------------------------------------------------------------------------
// 2026 NFL schedule — away/home pairs per week (no real dates needed;
// game times are computed from the compressed interval at seed time)
// ---------------------------------------------------------------------------
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
// Helpers — create one season record + its weeks + game_odds
// ---------------------------------------------------------------------------
async function createSeasonRecord(token, name, isSecondHalf, seasonStart) {
  const firstPickDeadline = new Date(seasonStart.getTime() + INTERVAL_MS - 20 * 60 * 1000);
  return post(token, 'seasons', {
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
    firstPickDeadline:       pbDate(firstPickDeadline),
    paymentDeadline:         pbDate(firstPickDeadline),
  });
}

async function createWeeks(token, seasonId, seasonStart) {
  const recs = [];
  for (let w = 1; w <= 18; w++) {
    const slotStart = new Date(seasonStart.getTime() + (w - 1) * INTERVAL_MS);
    const deadline  = new Date(slotStart.getTime() + INTERVAL_MS - 20 * 60 * 1000);
    const rec = await post(token, 'weekly_settings', {
      season: seasonId, week: w, status: 'open', deadline: pbDate(deadline),
    });
    recs.push(rec);
    process.stdout.write('.');
  }
  return recs;
}

async function createOdds(token, seasonId, teamByAbbr, seasonStart) {
  let created = 0, errors = 0;
  for (const weekData of SCHEDULE) {
    const slotStart = new Date(seasonStart.getTime() + (weekData.week - 1) * INTERVAL_MS);
    const games     = weekData.games;
    const spacing   = games.length > 1 ? (INTERVAL_MS * 0.9) / (games.length - 1) : 0;
    for (let i = 0; i < games.length; i++) {
      const game     = games[i];
      const gameTime = new Date(slotStart.getTime() + i * spacing);
      const homeTeam = teamByAbbr[game.home];
      const awayTeam = teamByAbbr[game.away];
      if (!homeTeam || !awayTeam) { errors++; continue; }
      const spread = randomSpread();
      const { homeML, awayML } = spreadToMoneyline(spread);
      try {
        await post(token, 'game_odds', {
          season: seasonId, week: weekData.week,
          homeTeam: homeTeam.id, awayTeam: awayTeam.id,
          gameTime: pbDate(gameTime),
          homeSpread: spread, homeMoneyline: homeML, awayMoneyline: awayML,
          isActive: true,
        });
        created++;
        process.stdout.write('.');
      } catch { errors++; }
    }
  }
  return { created, errors };
}

// ---------------------------------------------------------------------------
// Main — creates two season records (LMS + Second Half) to mirror real data
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nSeeding test season pair  [interval = ${interval} per NFL week]`);

  const token = await auth();
  console.log('Authenticated');

  const teamRecords = await getAll(token, 'nfl_teams');
  const teamByAbbr  = Object.fromEntries(teamRecords.map(t => [t.abbreviation, t]));
  console.log(`${teamRecords.length} NFL teams loaded`);

  const seasonStart = new Date();
  const tag         = `(${interval}/week) ${seasonStart.toISOString().slice(0,16)}`;
  const lmsName     = `[TEST] 2026 - 2027 LMS ${tag}`;
  const shName      = `[TEST] 2026 - 2027 Second Half ${tag}`;

  // --- LMS season ---
  console.log('\n[1/2] Creating LMS season...');
  const lmsSeason = await createSeasonRecord(token, lmsName, false, seasonStart);
  console.log(`  ID: ${lmsSeason.id}`);

  console.log('  Creating 18 weeks...');
  await createWeeks(token, lmsSeason.id, seasonStart);
  console.log(' done');

  console.log('  Creating game odds...');
  const lmsOdds = await createOdds(token, lmsSeason.id, teamByAbbr, seasonStart);
  console.log(`\n  ${lmsOdds.created} games, ${lmsOdds.errors} errors`);

  // --- Second Half season ---
  console.log('\n[2/2] Creating Second Half season...');
  const shSeason = await createSeasonRecord(token, shName, true, seasonStart);
  console.log(`  ID: ${shSeason.id}`);

  console.log('  Creating 18 weeks...');
  await createWeeks(token, shSeason.id, seasonStart);
  console.log(' done');

  console.log('  Creating game odds...');
  const shOdds = await createOdds(token, shSeason.id, teamByAbbr, seasonStart);
  console.log(`\n  ${shOdds.created} games, ${shOdds.errors} errors`);

  // --- Summary ---
  console.log('\n' + '='.repeat(60));
  console.log('TEST SEASON PAIR READY');
  console.log('='.repeat(60));
  console.log(`Interval      : ${interval}/week`);
  console.log(`LMS ID        : ${lmsSeason.id}`);
  console.log(`Second Half ID: ${shSeason.id}`);
  console.log(`Started       : ${seasonStart.toISOString()}`);
  console.log(`Week 1 ends   : ${new Date(seasonStart.getTime() + INTERVAL_MS).toISOString()}`);
  console.log(`\nTo run the scheduler (run both):`);
  console.log(`  node scripts/advance-test-season.js --season=${lmsSeason.id} --interval=${interval}`);
  console.log(`  node scripts/advance-test-season.js --season=${shSeason.id} --interval=${interval}`);
  console.log(`\nTo clean up:`);
  console.log(`  node scripts/clear-test-season.js --all`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });


