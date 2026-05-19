#!/usr/bin/env node
/**
 * clear-test-season.js
 *
 * Removes a test season and all associated data:
 *   pick_results → picks → entries → game_odds → weekly_settings → season
 *
 * Only operates on seasons whose name contains "[TEST]" as a safety guard.
 *
 * Run:
 *   node scripts/clear-test-season.js --season=SEASON_ID
 *
 * To list all test seasons without deleting:
 *   node scripts/clear-test-season.js --list
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));

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

async function getAll(token, collection, filter) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=500` : '?perPage=500';
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${q}`, {
    headers: { Authorization: token }
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`GET ${collection}: ${JSON.stringify(d)}`);
  return d.items ?? [];
}

async function getOne(token, collection, id) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    headers: { Authorization: token }
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`GET ${collection}/${id}: ${JSON.stringify(d)}`);
  return d;
}

async function deleteRecord(token, collection, id) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  return res.ok || res.status === 404;
}

async function deleteAll(token, collection, items, label) {
  if (!items.length) { console.log(`   No ${label} to delete`); return 0; }
  let deleted = 0;
  for (const item of items) {
    const ok = await deleteRecord(token, collection, item.id);
    process.stdout.write(ok ? '.' : 'X');
    if (ok) deleted++;
  }
  console.log(`\n   Deleted ${deleted}/${items.length} ${label}`);
  return deleted;
}

// PocketBase filter has a ~1000-char limit — chunk large OR filters
async function getAllInChunks(token, collection, ids, field) {
  const CHUNK = 20;
  const results = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk  = ids.slice(i, i + CHUNK);
    const filter = chunk.map(id => `${field} = "${id}"`).join(' || ');
    const items  = await getAll(token, collection, filter);
    results.push(...items);
  }
  return results;
}

// ---------------------------------------------------------------------------
// List mode
// ---------------------------------------------------------------------------
async function listTestSeasons(token) {
  const seasons = await getAll(token, 'seasons', 'name ~ "[TEST]"');
  if (!seasons.length) {
    console.log('No test seasons found.');
    return;
  }
  console.log(`\nTest seasons (${seasons.length}):\n`);
  for (const s of seasons) {
    console.log(`  ${s.id}  ${s.status.padEnd(10)}  ${s.name}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function clearOneSeason(token, season) {
  console.log(`\nClearing: ${season.name} (${season.id})`);

  const weeks   = await getAll(token, 'weekly_settings', `season = "${season.id}"`);
  const weekIds = weeks.map(w => w.id);

  let picks = [];
  if (weekIds.length) picks = await getAllInChunks(token, 'picks', weekIds, 'week');

  let pickResults = [];
  if (picks.length) {
    const pickIds = picks.map(p => p.id);
    pickResults = await getAllInChunks(token, 'pick_results', pickIds, 'pick');
  }

  const entries = await getAll(token, 'entries', `season = "${season.id}"`);
  const odds    = await getAll(token, 'game_odds', `season = "${season.id}"`);

  process.stdout.write('  pick_results '); await deleteAll(token, 'pick_results', pickResults, 'pick_results');
  process.stdout.write('  picks        '); await deleteAll(token, 'picks',        picks,        'picks');
  process.stdout.write('  entries      '); await deleteAll(token, 'entries',      entries,      'entries');
  process.stdout.write('  game_odds    '); await deleteAll(token, 'game_odds',    odds,         'game_odds');
  process.stdout.write('  weeks        '); await deleteAll(token, 'weekly_settings', weeks,     'weeks');

  const ok = await deleteRecord(token, 'seasons', season.id);
  console.log(`  season       ${ok ? 'deleted' : 'FAILED'}`);
}

async function main() {
  const token = await auth();
  console.log('Authenticated');

  // --list mode
  if ('list' in args) {
    await listTestSeasons(token);
    return;
  }

  // --all mode — delete every [TEST] season
  if ('all' in args) {
    const testSeasons = await getAll(token, 'seasons', 'name ~ "[TEST]"');
    if (!testSeasons.length) {
      console.log('No test seasons found.');
      return;
    }
    console.log(`Found ${testSeasons.length} test season(s) to delete.`);
    for (const season of testSeasons) {
      await clearOneSeason(token, season);
    }
    console.log('\nAll test seasons cleared.');
    return;
  }

  if (!args.season) {
    console.error('Usage:');
    console.error('  node scripts/clear-test-season.js --season=SEASON_ID');
    console.error('  node scripts/clear-test-season.js --all');
    console.error('  node scripts/clear-test-season.js --list');
    process.exit(1);
  }

  // Load and validate the season
  let season;
  try {
    season = await getOne(token, 'seasons', args.season);
  } catch {
    console.error(`Season not found: ${args.season}`);
    process.exit(1);
  }

  if (!season.name.includes('[TEST]')) {
    console.error(`Safety check failed: season "${season.name}" does not contain "[TEST]".`);
    console.error('This script only deletes test seasons. Aborting.');
    process.exit(1);
  }

  await clearOneSeason(token, season);
  console.log('\nClear complete.');
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
