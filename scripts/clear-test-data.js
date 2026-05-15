#!/usr/bin/env node
/**
 * clear-test-data.js
 *
 * Removes all test data created by seed-test-data.js:
 *   - Picks for any test user entry (both LMS and Second Half seasons)
 *   - Entries belonging to test users
 *   - Weekly settings for the Second Half season
 *   - The Second Half season itself
 *   - Test users (user1@blo.com … user20@blo.com)
 *
 * Does NOT touch:
 *   - The LMS season or its weeks
 *   - Real users (non @blo.com emails)
 *   - Turbo Nasty / admin accounts or their picks
 *
 * Run:  node scripts/clear-test-data.js
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

async function auth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
  });
  const { token } = await res.json();
  if (!token) throw new Error('Admin auth failed');
  return token;
}

async function getAll(token, collection, filter) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=500` : '?perPage=500';
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${q}`, {
    headers: { Authorization: token }
  });
  return (await res.json()).items ?? [];
}

async function deleteRecord(token, collection, id) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: 'DELETE',
    headers: { Authorization: token }
  });
  return res.ok;
}

async function deleteAll(token, collection, items, label) {
  if (!items.length) { console.log(`   No ${label} to delete`); return 0; }
  let deleted = 0;
  for (const item of items) {
    const ok = await deleteRecord(token, collection, item.id);
    process.stdout.write(ok ? '.' : 'X');
    if (ok) deleted++;
  }
  console.log(`\n   Deleted ${deleted} / ${items.length} ${label}`);
  return deleted;
}

// PocketBase filter has a 1000-char limit — chunk large OR filters
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

async function main() {
  console.log('Authenticating...');
  const token = await auth();

  // 1. Find test users
  console.log('\nFinding test users (@blo.com)...');
  const testUsers   = await getAll(token, 'users', 'email ~ "@blo.com"');
  const testUserIds = testUsers.map(u => u.id);
  console.log(`   Found ${testUsers.length} test users`);

  // 2. Find Second Half season
  console.log('\nFinding Second Half season...');
  const shSeasons = await getAll(token, 'seasons', 'name = "2026 - 2027 Second Half"');
  const shSeason  = shSeasons[0] ?? null;
  console.log(shSeason ? `   Found: ${shSeason.id}` : '   Not found');

  // 3. Find all entries for test users (both seasons)
  let testEntries = [];
  if (testUserIds.length) {
    console.log('\nFinding entries for test users...');
    testEntries = await getAllInChunks(token, 'entries', testUserIds, 'user');
    console.log(`   Found ${testEntries.length} entries`);
  }

  // 4. Delete picks for all test entries (covers LMS + Second Half picks)
  if (testEntries.length) {
    console.log('\nDeleting picks for test entries...');
    const testEntryIds = testEntries.map(e => e.id);
    const picks = await getAllInChunks(token, 'picks', testEntryIds, 'entry');
    await deleteAll(token, 'picks', picks, 'picks');
  } else {
    console.log('\n   No test entries — skipping picks');
  }

  // 5. Delete entries for test users
  if (testEntries.length) {
    console.log('\nDeleting entries...');
    await deleteAll(token, 'entries', testEntries, 'entries');
  }

  // 6. Delete weeks for Second Half season
  if (shSeason) {
    console.log('\nDeleting weeks for Second Half season...');
    const weeks = await getAll(token, 'weekly_settings', `season = "${shSeason.id}"`);
    await deleteAll(token, 'weekly_settings', weeks, 'weeks');
  }

  // 7. Delete Second Half season
  if (shSeason) {
    console.log('\nDeleting Second Half season...');
    const ok = await deleteRecord(token, 'seasons', shSeason.id);
    console.log(ok ? '   Deleted' : '   Failed');
  }

  // 8. Delete test users
  if (testUsers.length) {
    console.log('\nDeleting test users...');
    await deleteAll(token, 'users', testUsers, 'users');
  }

  console.log('\nClear complete — all test data removed');
}

main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
