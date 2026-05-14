/**
 * Adds entryType to entries collection and lmsEntryFee + secondHalfEntryFee to seasons.
 * Safe to re-run — skips fields that already exist.
 *
 * Usage: pnpm migrate:entry-types
 */

import PocketBase from 'pocketbase';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL!);

async function addFields(collectionName: string, fields: object[]) {
	const col = await pb.collections.getOne(collectionName);
	const existing = new Set(((col as any).fields ?? []).map((f: any) => f.name));

	const toAdd = fields.filter((f: any) => !existing.has(f.name));
	if (toAdd.length === 0) {
		console.log(`  skip  ${collectionName} — fields already exist`);
		return;
	}

	await pb.collections.update(col.id, {
		fields: [...((col as any).fields ?? []), ...toAdd]
	});
	console.log(`  updated ${collectionName}: added ${toAdd.map((f: any) => f.name).join(', ')}`);
}

async function main() {
	await pb.admins.authWithPassword(
		process.env.POCKETBASE_ADMIN_EMAIL!,
		process.env.POCKETBASE_ADMIN_PASSWORD!
	);
	console.log(`\nConnected to ${process.env.PUBLIC_POCKETBASE_URL}\n`);

	// entries: add entryType
	await addFields('entries', [
		{
			name: 'entryType',
			type: 'select',
			required: true,
			values: ['lms', 'second_half'],
			maxSelect: 1
		}
	]);

	// seasons: add lmsEntryFee and secondHalfEntryFee
	await addFields('seasons', [
		{ name: 'lmsEntryFee',        type: 'number', required: false },
		{ name: 'secondHalfEntryFee', type: 'number', required: false }
	]);

	console.log('\nDone.\n');
}

main().catch(e => { console.error(e?.message ?? e); process.exit(1); });
