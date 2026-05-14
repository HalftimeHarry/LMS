/**
 * Seed all 32 NFL teams into PocketBase.
 *
 * Usage:
 *   POCKETBASE_URL=https://... POCKETBASE_ADMIN_EMAIL=... POCKETBASE_ADMIN_PASSWORD=... \
 *   npx tsx scripts/seed-nfl-teams.ts
 *
 * Or with a local .env:
 *   npx dotenv -e .env -- npx tsx scripts/seed-nfl-teams.ts
 */

import PocketBase from 'pocketbase';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const PB_URL      = process.env.PUBLIC_POCKETBASE_URL ?? '';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL    ?? '';
const ADMIN_PASS  = process.env.POCKETBASE_ADMIN_PASSWORD ?? '';

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Missing POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD');
  process.exit(1);
}

const teams: { abbreviation: string; name: string; city: string; conference: 'AFC' | 'NFC'; division: 'East' | 'West' | 'North' | 'South' }[] = [
  // AFC East
  { abbreviation: 'BUF', name: 'Bills',     city: 'Buffalo',       conference: 'AFC', division: 'East' },
  { abbreviation: 'MIA', name: 'Dolphins',  city: 'Miami',         conference: 'AFC', division: 'East' },
  { abbreviation: 'NE',  name: 'Patriots',  city: 'New England',   conference: 'AFC', division: 'East' },
  { abbreviation: 'NYJ', name: 'Jets',      city: 'New York',      conference: 'AFC', division: 'East' },
  // AFC North
  { abbreviation: 'BAL', name: 'Ravens',    city: 'Baltimore',     conference: 'AFC', division: 'North' },
  { abbreviation: 'CIN', name: 'Bengals',   city: 'Cincinnati',    conference: 'AFC', division: 'North' },
  { abbreviation: 'CLE', name: 'Browns',    city: 'Cleveland',     conference: 'AFC', division: 'North' },
  { abbreviation: 'PIT', name: 'Steelers',  city: 'Pittsburgh',    conference: 'AFC', division: 'North' },
  // AFC South
  { abbreviation: 'HOU', name: 'Texans',    city: 'Houston',       conference: 'AFC', division: 'South' },
  { abbreviation: 'IND', name: 'Colts',     city: 'Indianapolis',  conference: 'AFC', division: 'South' },
  { abbreviation: 'JAX', name: 'Jaguars',   city: 'Jacksonville',  conference: 'AFC', division: 'South' },
  { abbreviation: 'TEN', name: 'Titans',    city: 'Tennessee',     conference: 'AFC', division: 'South' },
  // AFC West
  { abbreviation: 'DEN', name: 'Broncos',   city: 'Denver',        conference: 'AFC', division: 'West' },
  { abbreviation: 'KC',  name: 'Chiefs',    city: 'Kansas City',   conference: 'AFC', division: 'West' },
  { abbreviation: 'LV',  name: 'Raiders',   city: 'Las Vegas',     conference: 'AFC', division: 'West' },
  { abbreviation: 'LAC', name: 'Chargers',  city: 'Los Angeles',   conference: 'AFC', division: 'West' },
  // NFC East
  { abbreviation: 'DAL', name: 'Cowboys',   city: 'Dallas',        conference: 'NFC', division: 'East' },
  { abbreviation: 'NYG', name: 'Giants',    city: 'New York',      conference: 'NFC', division: 'East' },
  { abbreviation: 'PHI', name: 'Eagles',    city: 'Philadelphia',  conference: 'NFC', division: 'East' },
  { abbreviation: 'WAS', name: 'Commanders',city: 'Washington',    conference: 'NFC', division: 'East' },
  // NFC North
  { abbreviation: 'CHI', name: 'Bears',     city: 'Chicago',       conference: 'NFC', division: 'North' },
  { abbreviation: 'DET', name: 'Lions',     city: 'Detroit',       conference: 'NFC', division: 'North' },
  { abbreviation: 'GB',  name: 'Packers',   city: 'Green Bay',     conference: 'NFC', division: 'North' },
  { abbreviation: 'MIN', name: 'Vikings',   city: 'Minnesota',     conference: 'NFC', division: 'North' },
  // NFC South
  { abbreviation: 'ATL', name: 'Falcons',   city: 'Atlanta',       conference: 'NFC', division: 'South' },
  { abbreviation: 'CAR', name: 'Panthers',  city: 'Carolina',      conference: 'NFC', division: 'South' },
  { abbreviation: 'NO',  name: 'Saints',    city: 'New Orleans',   conference: 'NFC', division: 'South' },
  { abbreviation: 'TB',  name: 'Buccaneers',city: 'Tampa Bay',     conference: 'NFC', division: 'South' },
  // NFC West
  { abbreviation: 'ARI', name: 'Cardinals', city: 'Arizona',       conference: 'NFC', division: 'West' },
  { abbreviation: 'LAR', name: 'Rams',      city: 'Los Angeles',   conference: 'NFC', division: 'West' },
  { abbreviation: 'SF',  name: '49ers',     city: 'San Francisco', conference: 'NFC', division: 'West' },
  { abbreviation: 'SEA', name: 'Seahawks',  city: 'Seattle',       conference: 'NFC', division: 'West' },
];

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log(`Connected to ${PB_URL}`);

  // Check existing teams to avoid duplicates
  const existing = await pb.collection('nfl_teams').getFullList({ fields: 'abbreviation' });
  const existingAbbrs = new Set(existing.map((t) => t.abbreviation));

  let created = 0;
  let skipped = 0;

  for (const team of teams) {
    if (existingAbbrs.has(team.abbreviation)) {
      console.log(`  skip  ${team.abbreviation} — already exists`);
      skipped++;
      continue;
    }
    await pb.collection('nfl_teams').create(team);
    console.log(`  added ${team.abbreviation} ${team.city} ${team.name}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
