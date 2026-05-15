#!/usr/bin/env node
/**
 * seed-fake-spreads.js
 *
 * Assigns realistic fake NFL spreads + moneylines to all game_odds records
 * and activates all games. Spreads are randomly generated in the range
 * typical for NFL games: -14 to +14 in 0.5 increments, weighted toward
 * smaller spreads (most games are within a touchdown).
 *
 * Moneylines are derived from the spread using standard NFL conversion.
 *
 * Run: node scripts/seed-fake-spreads.js
 */

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

// Weighted spread pool — more games close, fewer blowouts
const SPREADS = [
  -1, -1.5, -2, -2.5, -3, -3, -3, -3.5, -4, -4.5,
  -5, -5.5, -6, -6.5, -7, -7, -7.5, -8, -9, -9.5,
  -10, -10.5, -11, -12, -13, -13.5, -14,
];

/** Convert spread to approximate moneyline (home team) */
function spreadToMoneyline(spread) {
  // Rough NFL conversion table
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
  const favML  = row[1];           // negative = favorite
  const dogML  = Math.round(-favML * 0.75); // underdog always positive, slightly less than implied
  return spread <= 0
    ? { homeML: favML, awayML: dogML }   // home favored
    : { homeML: dogML, awayML: favML };  // away favored
}

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

async function patch(token, collection, id, body) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body)
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`PATCH ${id}: ${JSON.stringify(d)}`);
  return d;
}

async function main() {
  const token = await auth();
  console.log('Authenticated');

  const games = await getAll(token, 'game_odds');
  console.log(`Found ${games.length} games`);

  let updated = 0;
  for (const game of games) {
    const spread = SPREADS[Math.floor(Math.random() * SPREADS.length)];
    const { homeML, awayML } = spreadToMoneyline(spread);

    await patch(token, 'game_odds', game.id, {
      homeSpread:    spread,
      homeMoneyline: homeML,
      awayMoneyline: awayML,
      isActive:      true,
    });
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated}/${games.length}…`);
  }

  console.log(`\nDone — updated ${updated} games with fake spreads and activated all.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
