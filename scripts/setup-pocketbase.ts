/**
 * Creates all required PocketBase collections and fields via the Admin API.
 * Safe to re-run — skips collections/fields that already exist.
 *
 * Usage (credentials read from .env):
 *   pnpm setup:pb
 */

import PocketBase from 'pocketbase';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const PB_URL      = process.env.PUBLIC_POCKETBASE_URL ?? '';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? '';
const ADMIN_PASS  = process.env.POCKETBASE_ADMIN_PASSWORD ?? '';

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Missing PUBLIC_POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD in .env');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

async function getCollections(): Promise<Record<string, string>> {
  const list = await pb.collections.getFullList();
  return Object.fromEntries(list.map(c => [c.name, c.id]));
}

async function ensureCollection(schema: object): Promise<string> {
  const cols = await getCollections();
  const name = (schema as { name: string }).name;
  if (cols[name]) {
    console.log(`  skip  collection "${name}" — already exists`);
    return cols[name];
  }
  const col = await pb.collections.create(schema);
  console.log(`  created collection "${name}"`);
  return col.id;
}

async function addUsersFields() {
  const cols = await getCollections();
  const usersId = cols['users'];
  if (!usersId) { console.error('users collection not found'); return; }

  const col = await pb.collections.getOne(usersId);
  const existingFields = ((col as any).fields ?? []).map((f: { name: string }) => f.name);

  const toAdd: object[] = [];
  if (!existingFields.includes('displayName')) {
    toAdd.push({ name: 'displayName', type: 'text', required: false });
  }
  if (!existingFields.includes('role')) {
    toAdd.push({
      name: 'role', type: 'select', required: false,
      values: ['super_admin', 'pool_admin', 'participant'],
      maxSelect: 1
    });
  }

  if (toAdd.length === 0) {
    console.log('  skip  users fields — already exist');
    return;
  }

  const currentFields = (col as any).fields ?? [];
  await pb.collections.update(usersId, {
    fields: [...currentFields, ...toAdd]
  });
  console.log(`  added fields to users: ${toAdd.map((f: any) => f.name).join(', ')}`);
}

async function main() {
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log(`\nConnected to ${PB_URL}\n`);

  // 1. users fields
  console.log('--- users ---');
  await addUsersFields();

  // 2. seasons
  console.log('\n--- seasons ---');
  await ensureCollection({
    name: 'seasons',
    type: 'base',
    fields: [
      { name: 'year',              type: 'number',  required: true },
      { name: 'name',              type: 'text',    required: true },
      { name: 'entryFee',          type: 'number',  required: true },
      { name: 'status',            type: 'select',  required: true,
        values: ['setup','open','active','complete'], maxSelect: 1 },
      { name: 'regularSeasonOnly', type: 'bool' },
      { name: 'paymentDeadline',   type: 'date' },
      { name: 'firstPickDeadline', type: 'date' },
      { name: 'notes',             type: 'text' }
    ]
  });

  // 3. nfl_teams
  console.log('\n--- nfl_teams ---');
  await ensureCollection({
    name: 'nfl_teams',
    type: 'base',
    fields: [
      { name: 'abbreviation', type: 'text',   required: true },
      { name: 'name',         type: 'text',   required: true },
      { name: 'city',         type: 'text',   required: true },
      { name: 'conference',   type: 'select', required: true,
        values: ['AFC','NFC'], maxSelect: 1 },
      { name: 'division',     type: 'select', required: true,
        values: ['East','West','North','South'], maxSelect: 1 }
    ]
  });

  // Need IDs for relations
  const cols = await getCollections();

  // 4. entries
  console.log('\n--- entries ---');
  await ensureCollection({
    name: 'entries',
    type: 'base',
    fields: [
      { name: 'season',           type: 'relation', required: true,
        collectionId: cols['seasons'], cascadeDelete: false, maxSelect: 1 },
      { name: 'user',             type: 'relation', required: true,
        collectionId: cols['users'],   cascadeDelete: false, maxSelect: 1 },
      { name: 'entryName',        type: 'text',   required: true },
      { name: 'status',           type: 'select', required: true,
        values: ['pending_payment','active','eliminated','winner'], maxSelect: 1 },
      { name: 'paid',             type: 'bool' },
      { name: 'paidAt',           type: 'date' },
      { name: 'paymentMethod',    type: 'select',
        values: ['check','venmo','paypal','zelle','cash','free'], maxSelect: 1 },
      { name: 'paymentNotes',     type: 'text' },
      { name: 'eliminatedWeek',   type: 'number' },
      { name: 'eliminatedReason', type: 'text' },
      { name: 'referredBy',       type: 'text' }
    ]
  });

  // 5. weekly_settings
  console.log('\n--- weekly_settings ---');
  await ensureCollection({
    name: 'weekly_settings',
    type: 'base',
    fields: [
      { name: 'season',   type: 'relation', required: true,
        collectionId: cols['seasons'],   cascadeDelete: false, maxSelect: 1 },
      { name: 'week',     type: 'number',  required: true },
      { name: 'deadline', type: 'date',    required: true },
      { name: 'status',   type: 'select',  required: true,
        values: ['open','locked','results_pending','complete'], maxSelect: 1 },
      { name: 'biggestFavoriteTeam', type: 'relation',
        collectionId: cols['nfl_teams'], cascadeDelete: false, maxSelect: 1 },
      { name: 'notes',    type: 'text' }
    ]
  });

  console.log('\nDone. Run "pnpm seed:teams" next to populate NFL teams.\n');
}

main().catch(e => { console.error(JSON.stringify(e?.response?.data ?? e?.message ?? e, null, 2)); process.exit(1); });
