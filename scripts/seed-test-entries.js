#!/usr/bin/env node
/**
 * seed-test-entries.js
 *
 * Seeds entries and picks into all existing [TEST] seasons.
 * Uses the existing test users (user1–20@blo.com) and the Turbo Nasty account.
 *
 * Per test season pair (LMS + Second Half sharing the same interval tag):
 *   - Each test user gets 1–4 entries in the LMS season
 *   - Each test user gets 0–2 entries in the Second Half season
 *   - ~65% of entries are paid/active, rest are pending_payment
 *   - Picks are seeded for weeks 1–3 for all active entries
 *     (each entry picks a unique team per week, no repeats within an entry)
 *
 * Safe to re-run — skips seasons that already have entries.
 *
 * Run:
 *   node scripts/seed-test-entries.js
 *   node scripts/seed-test-entries.js --dry-run   (print plan, no writes)
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

const PICK_WEEKS  = 3;   // seed picks for first N weeks
const PAID_RATE   = 0.65; // fraction of entries that are paid/active

const args     = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--', '').split('=')));
const DRY      = 'dry-run' in args;
const NO_PICKS = 'no-picks' in args;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pbDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function auth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth failed: ' + JSON.stringify(d));
  return d.token;
}

async function post(token, collection, body) {
  if (DRY) return { id: 'dry-' + Math.random().toString(36).slice(2, 8) };
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`POST ${collection}: ${d.message ?? JSON.stringify(d).slice(0, 200)}`);
  return d;
}

async function getAll(token, collection, filter, sort) {
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

// Derive short tag from season name: LMS-1h, 2H-1h, LMS-1d, 2H-1d
function seasonTag(season) {
  const isSecondHalf = season.name.toLowerCase().includes('second half');
  const m = season.name.match(/\((\d+)(h|d)\/week\)/);
  const interval = m ? m[1] + m[2] : '?';
  return (isSecondHalf ? '2H' : 'LMS') + '-' + interval;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (DRY) console.log('[DRY RUN — no writes]\n');

  console.log('Authenticating...');
  const token = await auth();

  // Load test seasons — group into pairs by interval tag
  const allTestSeasons = await getAll(token, 'seasons', 'name ~ "[TEST]"', 'name');
  if (!allTestSeasons.length) {
    console.log('No [TEST] seasons found. Run seed-test-season.js first.');
    process.exit(0);
  }
  console.log(`Found ${allTestSeasons.length} test season(s)`);

  // Group by interval tag (the "(Xh/week) TIMESTAMP" suffix)
  const pairs = new Map(); // tag → { lms, sh }
  for (const s of allTestSeasons) {
    // Name format: "[TEST] 2026 - 2027 LMS (1h/week) 2026-05-19T19:26"
    const tagMatch = s.name.match(/\((.+?\/week\).+)$/);
    const tag = tagMatch ? tagMatch[1] : s.name;
    if (!pairs.has(tag)) pairs.set(tag, { lms: null, sh: null });
    const entry = pairs.get(tag);
    if (s.name.toLowerCase().includes('second half')) entry.sh = s;
    else entry.lms = s;
  }

  // Load test users
  const testUsers = await getAll(token, 'users', 'email ~ "@blo.com"', 'displayName');
  if (!testUsers.length) {
    console.log('No test users found (@blo.com). Run seed-test-data.js first.');
    process.exit(0);
  }
  console.log(`${testUsers.length} test users loaded`);

  // Load NFL teams
  const teams = await getAll(token, 'nfl_teams', '', 'name');
  console.log(`${teams.length} NFL teams loaded`);

  const paymentMethods = ['check', 'venmo', 'paypal', 'zelle', 'cash'];

  let grandTotalEntries = 0;
  let grandTotalPicks   = 0;

  // Process each season pair
  for (const [tag, { lms, sh }] of pairs) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Pair: ${tag}`);

    for (const [label, season, entryType, maxPerUser] of [
      ['LMS',         lms, 'lms',         4],
      ['Second Half', sh,  'second_half',  2],
    ]) {
      if (!season) { console.log(`  [${label}] no season record — skipping`); continue; }

      // Check if already seeded
      const existing = await getAll(token, 'entries', `season = "${season.id}"`);
      if (existing.length > 0) {
        console.log(`  [${label}] ${season.name.slice(0, 50)} — already has ${existing.length} entries, skipping`);
        continue;
      }

      // Load weeks for this season
      const weeks = (await getAll(token, 'weekly_settings', `season = "${season.id}"`, 'week'))
        .sort((a, b) => a.week - b.week);
      if (!weeks.length) {
        console.log(`  [${label}] no weeks found — skipping`);
        continue;
      }

      console.log(`  [${label}] ${season.name.slice(0, 50)}`);
      console.log(`    ${weeks.length} weeks, seeding entries for ${testUsers.length} users...`);

      const tag = seasonTag(season);
      const seasonEntries = [];
      let entryCount = 0;

      for (const user of testUsers) {
        const count = rand(1, maxPerUser);
        for (let e = 1; e <= count; e++) {
          const isPaid  = Math.random() < PAID_RATE;
          const status  = isPaid ? 'active' : 'pending_payment';
          const name    = count === 1
            ? `${user.displayName} · ${tag}`
            : `${user.displayName} Entry ${e} · ${tag}`;
          try {
            const rec = await post(token, 'entries', {
              season:        season.id,
              user:          user.id,
              entryName:     name,
              entryType,
              status,
              paid:          isPaid,
              paidAt:        isPaid ? pbDate(new Date()) : null,
              paymentMethod: isPaid ? pickRandom(paymentMethods) : null,
              referredBy:    null,
            });
            seasonEntries.push({ id: rec.id, status, userId: user.id, displayName: user.displayName });
            entryCount++;
            process.stdout.write('.');
          } catch (err) {
            process.stdout.write('X');
            if (!DRY) console.error(`\n    Failed entry for ${user.displayName}: ${err.message}`);
          }
        }
      }
      console.log(`\n    ${entryCount} entries created`);
      grandTotalEntries += entryCount;

      // Seed picks for active entries, weeks 1–PICK_WEEKS (skipped with --no-picks)
      if (NO_PICKS) {
        console.log(`    Skipping picks (--no-picks)`);
      } else {
        const activeEntries = seasonEntries.filter(e => e.status === 'active');
        const pickWeeks     = weeks.slice(0, PICK_WEEKS);
        console.log(`    Seeding picks for ${activeEntries.length} active entries across ${pickWeeks.length} weeks...`);

        let pickCount = 0;
        for (const entry of activeEntries) {
          if (Math.random() < 0.15) continue; // 15% haven't submitted picks yet

          // Each entry gets a shuffled team pool — no team repeated within an entry
          const teamPool = shuffle(teams);
          let teamIdx    = 0;

          for (const week of pickWeeks) {
            if (week.week > 1 && Math.random() < 0.15) continue; // occasional missing pick on later weeks
            const team = teamPool[teamIdx++];
            if (!team) break;
            try {
              await post(token, 'picks', {
                entry:       entry.id,
                week:        week.id,
                pickedTeams: [team.id],
                entryType,
                isAutoPick:  false,
              });
              pickCount++;
              process.stdout.write('.');
            } catch (err) {
              process.stdout.write('~');
            }
          }
        }
        console.log(`\n    ${pickCount} picks created`);
        grandTotalPicks += pickCount;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SEED COMPLETE');
  console.log(`  Entries : ${grandTotalEntries}`);
  console.log(`  Picks   : ${grandTotalPicks}`);
  if (DRY) console.log('  (dry run — nothing was written)');
  console.log('='.repeat(60));
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
