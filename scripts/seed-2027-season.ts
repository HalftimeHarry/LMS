/**
 * Ensures the 2027 NFL season record exists and has all required fields set.
 * Safe to re-run — updates existing record if found, creates if missing.
 *
 * Usage: pnpm seed:2027
 */

import PocketBase from 'pocketbase';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL!);

async function main() {
	await pb.admins.authWithPassword(
		process.env.POCKETBASE_ADMIN_EMAIL!,
		process.env.POCKETBASE_ADMIN_PASSWORD!
	);
	console.log(`\nConnected to ${process.env.PUBLIC_POCKETBASE_URL}\n`);

	const existing = await pb.collection('seasons').getList(1, 1, {
		filter: 'year = 2027'
	});

	const payload = {
		name:                   '2026 - 2027',
		year:                   2027,
		lmsEntryFee:            100,
		secondHalfEntryFee:     50,
		secondHalfPicksPerWeek: 1,
		regularSeasonOnly:      true
	};

	if (existing.totalItems > 0) {
		const id = existing.items[0].id;
		await pb.collection('seasons').update(id, payload);
		console.log(`  updated 2027 season (${id}): secondHalfPicksPerWeek = 1`);
	} else {
		const season = await pb.collection('seasons').create({
			...payload,
			status:            'setup',
			paymentDeadline:   null,
			notes:             null
		});
		console.log(`  created 2027 season: ${season.id}`);
	}

	console.log('\nDone.\n');
}

main().catch(e => { console.error(e?.message ?? e); process.exit(1); });
