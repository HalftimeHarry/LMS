#!/usr/bin/env node
/**
 * create-odds-collection.js
 *
 * Creates the `game_odds` collection in PocketBase if it doesn't exist.
 *
 * Schema:
 *   season        - relation → seasons
 *   week          - number (1-18)
 *   homeTeam      - relation → nfl_teams
 *   awayTeam      - relation → nfl_teams
 *   game_time_stamp - text ISO 8601 UTC kickoff (source of truth)
 *   gameTime      - date
 *   homeSpread    - number (negative = home favored, e.g. -7 means home -7)
 *   homeMoneyline - number (e.g. -350)
 *   awayMoneyline - number (e.g. +280)
 *   isActive      - bool (admin activates the list for the week)
 *   notes         - text (e.g. "London game", "Thanksgiving")
 *
 * Run: node scripts/create-odds-collection.js
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
  const d = await res.json();
  if (!d.token) throw new Error('Auth failed: ' + JSON.stringify(d));
  return d.token;
}

async function req(token, method, path, body) {
  const res = await fetch(`${PB_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(d)}`);
  return d;
}

async function main() {
  const token = await auth();
  console.log('Authenticated');

  // Check if collection already exists
  let exists = false;
  try {
    await req(token, 'GET', '/collections/game_odds');
    exists = true;
  } catch { /* not found */ }

  if (exists) {
    console.log('game_odds collection already exists — skipping creation');
    return;
  }

  // Fetch real collection IDs for relations
  const collections = await req(token, 'GET', '/collections?perPage=200');
  const items = collections.items ?? [];
  const seasonsId  = items.find(c => c.name === 'seasons')?.id;
  const teamsId    = items.find(c => c.name === 'nfl_teams')?.id;

  if (!seasonsId || !teamsId) {
    throw new Error(`Could not find seasons (${seasonsId}) or nfl_teams (${teamsId}) collections`);
  }

  const schema = {
    name: 'game_odds',
    type: 'base',
    fields: [
      { name: 'season',        type: 'relation', required: true,  collectionId: seasonsId, maxSelect: 1, cascadeDelete: false },
      { name: 'week',          type: 'number',   required: true,  min: 1, max: 18 },
      { name: 'homeTeam',      type: 'relation', required: true,  collectionId: teamsId,   maxSelect: 1, cascadeDelete: false },
      { name: 'awayTeam',      type: 'relation', required: true,  collectionId: teamsId,   maxSelect: 1, cascadeDelete: false },
      { name: 'game_time_stamp', type: 'text',   required: false },
      { name: 'gameTime',      type: 'date',     required: false },
      { name: 'homeSpread',    type: 'number',   required: false },
      { name: 'homeMoneyline', type: 'number',   required: false },
      { name: 'awayMoneyline', type: 'number',   required: false },
      { name: 'isActive',      type: 'bool',     required: false },
      { name: 'notes',         type: 'text',     required: false },
    ],
    listRule:   '',
    viewRule:   '',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  };

  const result = await req(token, 'POST', '/collections', schema);
  console.log('Created game_odds collection:', result.id);
}

main().catch(e => { console.error(e.message); process.exit(1); });
