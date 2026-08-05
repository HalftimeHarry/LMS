#!/usr/bin/env node
/**
 * advance-test-season.js
 *
 * Automated scheduler that drives a test season through all week states:
 *   open → locked → results_pending → complete
 *
 * Timeline per compressed week (INTERVAL_MS = 1h or 1d):
 *   T+0              Week opens (status = open, picks accepted)
 *   T+(interval-20m) Deadline passes → lock picks (status = locked)
 *   T+(interval-10m) Simulate results → mark picks correct/incorrect (status = results_pending)
 *   T+(interval-2m)  Finalize week (status = complete), eliminate entries with wrong picks
 *   T+(interval)     Next week opens
 *
 * Results are random: each picked team has a 55% chance of winning (slight
 * favorite bias since players tend to pick favorites).
 *
 * Run:
 *   node scripts/advance-test-season.js --season=SEASON_ID --interval=1h
 *   node scripts/advance-test-season.js --season=SEASON_ID --interval=1d
 *
 * Keep this process running for the duration of the test season.
 * Ctrl+C to stop. The season state is persisted in PocketBase so you can
 * restart the process and it will resume from the current week.
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));

if (!args.season) {
  console.error('Usage: node scripts/advance-test-season.js --season=SEASON_ID --interval=1h');
  process.exit(1);
}

const SEASON_ID   = args.season;
const interval    = args.interval ?? '1h';

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
  console.error(`Unknown interval "${interval}"`);
  process.exit(1);
})();

// Phase offsets within each week
const LOCK_OFFSET    = INTERVAL_MS - 30 * 60 * 1000; // -30 min: lock picks
const RESULTS_OFFSET = INTERVAL_MS - 10 * 60 * 1000; // -10 min: simulate results
const COMPLETE_OFFSET= INTERVAL_MS -  2 * 60 * 1000; // -2 min:  complete week

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pbDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';
}
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ---------------------------------------------------------------------------
// PocketBase helpers
// ---------------------------------------------------------------------------
let _token = null;
let _tokenExpiry = 0;

async function auth() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth failed: ' + JSON.stringify(d));
  _token = d.token;
  _tokenExpiry = Date.now() + 50 * 60 * 1000; // re-auth every 50 min
  return _token;
}

async function getAll(collection, filter) {
  const token = await auth();
  const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=500` : '?perPage=500';
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${q}`, {
    headers: { Authorization: token }
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`GET ${collection}: ${JSON.stringify(d)}`);
  return d.items ?? [];
}

async function getOne(collection, id) {
  const token = await auth();
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    headers: { Authorization: token }
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`GET ${collection}/${id}: ${JSON.stringify(d)}`);
  return d;
}

async function patch(collection, id, body) {
  const token = await auth();
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body)
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`PATCH ${collection}/${id}: ${JSON.stringify(d)}`);
  return d;
}

async function post(collection, body) {
  const token = await auth();
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body)
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`POST ${collection}: ${d.message ?? JSON.stringify(d).slice(0,200)}`);
  return d;
}

// ---------------------------------------------------------------------------
// Week lifecycle actions
// ---------------------------------------------------------------------------

/**
 * Lock a week and auto-assign biggestFavoriteTeam to entries that missed
 * the pick deadline.
 */
async function lockWeek(weekRec, seasonId) {
  log(`Week ${weekRec.week}: LOCKING picks`);
  await patch('weekly_settings', weekRec.id, { status: 'locked' });

  // Auto-pick: assign biggestFavoriteTeam to entries without a pick
  const weekSetting = await getOne('weekly_settings', weekRec.id);
  const autoTeamId  = weekSetting.biggestFavoriteTeam ?? null;
  let   autoPicked  = 0;

  if (autoTeamId && seasonId) {
    const entries = await getAll('entries', `season = "${seasonId}" && status = "active"`);
    const existingPicks = await getAll('picks', `week = "${weekRec.id}"`);
    const pickedEntryIds = new Set(existingPicks.map(p => p.entry));

    for (const entry of entries) {
      if (pickedEntryIds.has(entry.id)) continue;
      try {
        await post('picks', {
          entry:       entry.id,
          week:        weekRec.id,
          pickedTeams: [autoTeamId],
          entryType:   entry.entryType,
          isAutoPick:  true,
        });
        autoPicked++;
      } catch { /* skip */ }
    }
  }

  log(`  Locked — ${autoPicked} auto-picks assigned`);
}

/**
 * Simulate game results for a week using random outcomes (55% home-team win
 * rate, 5% tie rate). Writes pick_results and advances week to results_pending.
 */
async function simulateResults(weekRec, seasonId) {
  log(`Week ${weekRec.week}: SIMULATING results`);

  // Load games for this week to determine winners
  const games = await getAll('game_odds', `season = "${seasonId}" && week = ${weekRec.week}`);
  log(`  ${games.length} games`);

  // Randomly decide each game outcome: home win 50%, away win 45%, tie 5%
  const teamResult = {}; // teamId → 'correct'|'incorrect'
  for (const game of games) {
    const roll = Math.random();
    let homeWins, awayWins;
    if (roll < 0.05) {
      homeWins = true; awayWins = true; // tie
    } else if (roll < 0.525) {
      homeWins = true; awayWins = false; // home win
    } else {
      homeWins = false; awayWins = true; // away win
    }
    if (game.homeTeam) teamResult[game.homeTeam] = homeWins ? 'correct' : 'incorrect';
    if (game.awayTeam) teamResult[game.awayTeam] = awayWins ? 'correct' : 'incorrect';
  }

  // Load all picks for this week
  const picks = await getAll('picks', `week = "${weekRec.id}"`);
  log(`  ${picks.length} picks to resolve`);

  let correct = 0, incorrect = 0;

  for (const pick of picks) {
    const teams = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
    for (const teamId of teams) {
      const result = teamResult[teamId] ?? 'incorrect'; // unknown team = incorrect
      if (result === 'correct') correct++; else incorrect++;
      try {
        const existing = await getAll('pick_results', `pick = "${pick.id}" && team = "${teamId}"`);
        if (existing.length) {
          await patch('pick_results', existing[0].id, { result });
        } else {
          await post('pick_results', { pick: pick.id, team: teamId, result, notes: 'auto-simulated' });
        }
      } catch (e) {
        log(`  Warning: pick_result error for pick ${pick.id}: ${e.message}`);
      }
    }
  }

  log(`  Results: ${correct} correct, ${incorrect} incorrect`);
  await patch('weekly_settings', weekRec.id, { status: 'results_pending' });
}

/**
 * Complete a week: eliminate entries with any incorrect pick, mark complete.
 */
async function completeWeek(weekRec) {
  log(`Week ${weekRec.week}: COMPLETING`);

  const picks = await getAll('picks', `week = "${weekRec.id}"`);
  let eliminated = 0;

  for (const pick of picks) {
    const results = await getAll('pick_results', `pick = "${pick.id}"`);
    const allCorrect = results.length > 0 && results.every(r => r.result === 'correct');

    if (!allCorrect && results.length > 0) {
      try {
        const entry = await getOne('entries', pick.entry);
        if (entry.status === 'active') {
          await patch('entries', entry.id, {
            status:           'eliminated',
            eliminatedWeek:   weekRec.week,
            eliminatedReason: 'Picked a losing team',
          });
          eliminated++;
        }
      } catch (e) {
        log(`  Warning: elimination error for entry ${pick.entry}: ${e.message}`);
      }
    }
  }

  await patch('weekly_settings', weekRec.id, { status: 'complete' });
  log(`  Week ${weekRec.week} complete — ${eliminated} entries eliminated`);
}

// ---------------------------------------------------------------------------
// Main scheduler loop
// ---------------------------------------------------------------------------
async function main() {
  log(`Starting test season scheduler`);
  log(`Season ID : ${SEASON_ID}`);
  log(`Interval  : ${interval} per NFL week`);

  // Verify season exists
  const season = await getOne('seasons', SEASON_ID);
  log(`Season    : ${season.name}`);

  // Load all weeks for this season, sorted
  const allWeeks = (await getAll('weekly_settings', `season = "${SEASON_ID}"`))
    .sort((a, b) => a.week - b.week);

  if (!allWeeks.length) {
    log('ERROR: No weeks found for this season. Did seed-test-season.js run?');
    process.exit(1);
  }

  log(`Weeks     : ${allWeeks.length} found\n`);

  // Determine the season start time from week 1's deadline
  // deadline = slotStart + INTERVAL_MS - 20min  →  slotStart = deadline - INTERVAL_MS + 20min
  const week1Deadline = new Date(allWeeks[0].deadline);
  const seasonStart   = new Date(week1Deadline.getTime() - INTERVAL_MS + 30 * 60 * 1000);

  log(`Season started at: ${seasonStart.toISOString()}`);

  // Schedule all phase transitions for all weeks
  const events = [];

  for (const weekRec of allWeeks) {
    const slotStart = new Date(seasonStart.getTime() + (weekRec.week - 1) * INTERVAL_MS);

    events.push({ time: new Date(slotStart.getTime() + LOCK_OFFSET),     action: 'lock',     weekRec });
    events.push({ time: new Date(slotStart.getTime() + RESULTS_OFFSET),  action: 'results',  weekRec });
    events.push({ time: new Date(slotStart.getTime() + COMPLETE_OFFSET), action: 'complete', weekRec });
  }

  // Sort by time
  events.sort((a, b) => a.time - b.time);

  // Skip events already in the past (handles restarts)
  const now = Date.now();
  const upcoming = events.filter(e => e.time.getTime() > now);
  const skipped  = events.length - upcoming.length;
  if (skipped) log(`Skipping ${skipped} past events (resuming mid-season)`);

  if (!upcoming.length) {
    log('All events are in the past — season may already be complete.');
    process.exit(0);
  }

  log(`${upcoming.length} events scheduled. Next: ${upcoming[0].action} week ${upcoming[0].weekRec.week} at ${upcoming[0].time.toISOString()}\n`);

  // Process events in order
  for (const event of upcoming) {
    const delay = event.time.getTime() - Date.now();
    if (delay > 0) {
      const mins = Math.round(delay / 60000);
      log(`Waiting ${mins}m for: ${event.action} week ${event.weekRec.week} at ${event.time.toISOString()}`);
      await sleep(delay);
    }

    try {
      if (event.action === 'lock')     await lockWeek(event.weekRec, SEASON_ID);
      if (event.action === 'results')  await simulateResults(event.weekRec, SEASON_ID);
      if (event.action === 'complete') await completeWeek(event.weekRec);
    } catch (e) {
      log(`ERROR during ${event.action} week ${event.weekRec.week}: ${e.message}`);
      // Continue to next event rather than crashing
    }
  }

  // Mark season complete
  log('\nAll 18 weeks processed — marking season complete');
  await patch('seasons', SEASON_ID, { status: 'complete' });
  log('Test season finished!');
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
