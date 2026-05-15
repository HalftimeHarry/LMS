#!/usr/bin/env node
/**
 * seed-test-data.js
 *
 * Creates:
 *   - 20 test users  (user1@blo.com … user20@blo.com, password MADcap(123))
 *   - 1 second_half season  (2026 - 2027 Second Half, status active)
 *   - 18 open weeks for the second_half season (deadline today 3pm PST + 7 days/week)
 *   - Entries spread across both seasons (1–7 per user, ~60% paid/active)
 *   - Picks for active entries: each entry picks a unique team per week
 *     for weeks 1–3 (~70% of active entries have picks, simulating real usage)
 *
 * Run:  node scripts/seed-test-data.js
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';
const USER_PASS   = 'MADcap(123)';
const TOTAL_USERS = 20;
const PICK_WEEKS  = 3; // seed picks for first N weeks

// Week 1 deadline: today 3pm PST = 23:00 UTC
const week1Deadline = new Date();
week1Deadline.setUTCHours(23, 0, 0, 0);

function pbDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

async function post(token, path, body) {
  const res = await fetch(`${PB_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`POST ${path} failed: ${data.message ?? JSON.stringify(data).slice(0, 120)}`);
  return data;
}

async function getAll(token, collection, filter) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=500` : '?perPage=500';
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${q}`, {
    headers: { Authorization: token }
  });
  return (await res.json()).items ?? [];
}

async function main() {
  console.log('Authenticating...');
  const token = await auth();

  // 1. Create 20 test users
  console.log('\nCreating test users...');
  const userIds = [];
  for (let i = 1; i <= TOTAL_USERS; i++) {
    const email = `user${i}@blo.com`;
    try {
      const u = await post(token, '/collections/users/records', {
        email, emailVisibility: true,
        password: USER_PASS, passwordConfirm: USER_PASS,
        displayName: `Test User ${i}`, name: `Test User ${i}`,
        role: 'participant', verified: true
      });
      userIds.push(u.id);
      process.stdout.write('.');
    } catch {
      const existing = await getAll(token, 'users', `email = "${email}"`);
      if (existing[0]) { userIds.push(existing[0].id); process.stdout.write('~'); }
      else console.error(`\nFailed to create ${email}`);
    }
  }
  console.log(`\n${userIds.length} users ready`);

  // 2. Get LMS season + its weeks
  const allSeasons = await getAll(token, 'seasons', 'status = "active"');
  const lmsSeason  = allSeasons.find(s => !s.name?.toLowerCase().includes('second half'));
  if (!lmsSeason) throw new Error('No active LMS season found');
  console.log(`\nLMS season: ${lmsSeason.name} (${lmsSeason.id})`);

  const lmsWeeks = (await getAll(token, 'weekly_settings', `season = "${lmsSeason.id}"`))
    .sort((a, b) => a.week - b.week);
  console.log(`${lmsWeeks.length} LMS weeks found`);

  // 3. Create / find Second Half season
  console.log('\nCreating Second Half season...');
  let shSeason;
  const existingSh = await getAll(token, 'seasons', 'name = "2026 - 2027 Second Half"');
  if (existingSh[0]) {
    shSeason = existingSh[0];
    console.log(`Already exists: ${shSeason.id}`);
  } else {
    shSeason = await post(token, '/collections/seasons/records', {
      name: '2026 - 2027 Second Half', year: 2026, status: 'active',
      lmsEntryFee: 100, secondHalfEntryFee: 50,
      secondHalfPicksPerWeek: 1, regularSeasonOnly: true,
      firstPickDeadline: pbDate(week1Deadline)
    });
    console.log(`Created: ${shSeason.id}`);
  }

  // 4. Create weeks for Second Half season
  console.log('\nCreating weeks for Second Half season...');
  let shWeeks = await getAll(token, 'weekly_settings', `season = "${shSeason.id}"`);
  if (shWeeks.length >= 18) {
    console.log(`Already has ${shWeeks.length} weeks, skipping`);
  } else {
    let created = 0;
    for (let w = 1; w <= 18; w++) {
      const deadline = new Date(week1Deadline.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
      try {
        await post(token, '/collections/weekly_settings/records', {
          season: shSeason.id, week: w, status: 'open', deadline: pbDate(deadline)
        });
        created++;
        process.stdout.write('.');
      } catch { process.stdout.write('~'); }
    }
    console.log(`\nCreated ${created} weeks`);
    shWeeks = await getAll(token, 'weekly_settings', `season = "${shSeason.id}"`);
  }
  shWeeks.sort((a, b) => a.week - b.week);

  // 5. Load all NFL teams
  const teams = await getAll(token, 'nfl_teams');
  if (!teams.length) throw new Error('No NFL teams found');
  console.log(`\n${teams.length} NFL teams loaded`);

  // 6. Create entries
  console.log('\nCreating entries...');
  const paymentMethods = ['check', 'venmo', 'paypal', 'zelle', 'cash'];
  const createdEntries = [];
  let totalEntries = 0;

  for (const userId of userIds) {
    const entryCount = rand(1, 7);
    const userNum    = userIds.indexOf(userId) + 1;
    for (let e = 1; e <= entryCount; e++) {
      const season    = Math.random() < 0.6 ? lmsSeason : shSeason;
      const entryType = season.id === shSeason.id ? 'second_half' : 'lms';
      const isPaid    = Math.random() < 0.6;
      const status    = isPaid ? 'active' : 'pending_payment';
      try {
        const entry = await post(token, '/collections/entries/records', {
          season: season.id, user: userId,
          entryName: `Test User ${userNum} Entry ${e}`,
          entryType, status,
          paid: isPaid,
          paidAt: isPaid ? pbDate(new Date()) : '',
          paymentMethod: isPaid ? pickRandom(paymentMethods) : '',
          referredBy: ''
        });
        createdEntries.push({ id: entry.id, seasonId: season.id, entryType, status, userId });
        totalEntries++;
        process.stdout.write('.');
      } catch { process.stdout.write('X'); }
    }
  }
  console.log(`\n${totalEntries} entries created`);

  // 7. Create picks for active entries (weeks 1-PICK_WEEKS)
  console.log(`\nCreating picks for weeks 1-${PICK_WEEKS}...`);
  const activeEntries = createdEntries.filter(e => e.status === 'active');
  let totalPicks = 0;

  for (const entry of activeEntries) {
    if (Math.random() < 0.3) continue; // 30% haven't picked yet

    const seasonWeeks = entry.seasonId === lmsSeason.id ? lmsWeeks : shWeeks;
    const pickWeeks   = seasonWeeks.slice(0, PICK_WEEKS);
    if (!pickWeeks.length) continue;

    const teamPool = shuffle(teams);
    let teamIdx    = 0;

    for (const week of pickWeeks) {
      if (week.week > 1 && Math.random() < 0.2) continue; // some skip later weeks
      const team = teamPool[teamIdx++];
      if (!team) break;
      try {
        await post(token, '/collections/picks/records', {
          entry:       entry.id,
          week:        week.id,
          pickedTeams: [team.id],
          entryType:   entry.entryType,
          isAutoPick:  false
        });
        totalPicks++;
        process.stdout.write('.');
      } catch { process.stdout.write('~'); }
    }
  }
  console.log(`\n${totalPicks} picks created`);

  console.log('\nSeed complete!');
  console.log(`  LMS season:         ${lmsSeason.name}`);
  console.log(`  Second Half season: ${shSeason.name}`);
  console.log(`  Users:              ${userIds.length}`);
  console.log(`  Entries:            ${totalEntries}  (${activeEntries.length} active)`);
  console.log(`  Picks:              ${totalPicks}`);
}

main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
