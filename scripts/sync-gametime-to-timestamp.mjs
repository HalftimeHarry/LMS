#!/usr/bin/env node
/**
 * sync-gametime-to-timestamp.mjs
 *
 * Forces game_odds.gameTime to match game_odds.game_time_stamp for every record
 * in the active season. Records with a blank game_time_stamp are skipped.
 *
 * Usage:
 *   node scripts/sync-gametime-to-timestamp.mjs
 */

import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb
	.collection('_superusers')
	.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const seasons = await pb.collection('seasons').getFullList();
const season = seasons.find((s) => s.status === 'active' || s.status === 'open') || seasons[0];
if (!season) throw new Error('No season found');

const records = await pb.collection('game_odds').getFullList({ filter: `season = "${season.id}"` });

let updated = 0;
let alreadyMatching = 0;
let skipped = 0;
let failed = 0;

for (const record of records) {
	if (!record.game_time_stamp) {
		skipped++;
		console.warn(`Skipped ${record.id} (week ${record.week}) — blank game_time_stamp`);
		continue;
	}

	const target = new Date(record.game_time_stamp).toISOString();
	if (record.gameTime && new Date(record.gameTime).toISOString() === target) {
		alreadyMatching++;
		continue;
	}

	try {
		await pb.collection('game_odds').update(record.id, { gameTime: target });
		updated++;
	} catch (error) {
		failed++;
		console.warn(`Failed ${record.id} (week ${record.week}): ${error.message}`);
	}
}

console.log(
	`\nDone. Updated: ${updated}, already matching: ${alreadyMatching}, skipped: ${skipped}, failed: ${failed}`
);
