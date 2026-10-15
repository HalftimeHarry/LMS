/**
 * reconcile-week-deadlines.mjs
 *
 * DRY-RUN by default. Compares each week's stored `weekly_settings.deadline`
 * against the kickoff-derived pick deadline (earliest active game_odds
 * `game_time_stamp` − 30 min) for every NON-test season and prints a report.
 *
 * Never touches `game_odds` (game_time_stamp / gameTime are authoritative).
 *
 * Usage:
 *   node scripts/reconcile-week-deadlines.mjs                 # dry-run report
 *   node scripts/reconcile-week-deadlines.mjs --apply \
 *        --season-id <id> --week <n>                          # update ONE week's deadline
 *
 * --apply refuses to run without both --season-id and --week, so it can never
 * blindly rewrite all seasons.
 */
import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const args = process.argv.slice(2);
const APPLY      = args.includes('--apply');
const seasonArg  = args[args.indexOf('--season-id') + 1];
const weekArg    = Number(args[args.indexOf('--week') + 1]);

if (APPLY && (!seasonArg || !Number.isFinite(weekArg))) {
	console.error('Refusing to apply: --apply requires --season-id <id> AND --week <n> (one week at a time).');
	process.exit(1);
}

const PICK_DEADLINE_MS = 30 * 60 * 1000;
const TOLERANCE_MS     = 60 * 1000; // 1 min — ignore sub-minute drift

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb.collection('_superusers').authWithPassword(
	process.env.POCKETBASE_ADMIN_EMAIL,
	process.env.POCKETBASE_ADMIN_PASSWORD
);

const fmtET = (value) => {
	const d = new Date(typeof value === 'string' && !value.includes('T') ? value.replace(' ', 'T') : value);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString('en-US', {
		timeZone: 'America/New_York',
		weekday: 'short', month: 'short', day: 'numeric',
		hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
	});
};
const pbDate = (d) => d.toISOString().replace('T', ' ').slice(0, 23) + 'Z';

const seasons = await pb.collection('seasons').getFullList({ sort: '-year' });
const realSeasons = seasons.filter((s) => !s.name?.includes('[TEST]'));
const testCount   = seasons.length - realSeasons.length;

console.log(APPLY
	? `APPLY mode — single week only: season=${seasonArg} week=${weekArg}`
	: 'DRY RUN — no changes will be written.');
console.log(`Seasons: ${realSeasons.length} real, ${testCount} [TEST] skipped (intentional stored schedule).\n`);

const rows = [];
for (const season of realSeasons) {
	const weeks = await pb.collection('weekly_settings').getFullList({
		filter: `season = "${season.id}"`, sort: 'week'
	});
	const odds = await pb.collection('game_odds').getFullList({
		filter: `season = "${season.id}" && isActive = true`,
		fields: 'week,game_time_stamp'
	}).catch(() => []);

	// Earliest kickoff per week
	const kickoffByWeek = new Map();
	for (const g of odds) {
		const ts = typeof g.game_time_stamp === 'string' ? g.game_time_stamp.trim() : '';
		if (!ts) continue;
		const ms = new Date(ts).getTime();
		if (Number.isNaN(ms)) continue;
		const wk = Number(g.week);
		if (!kickoffByWeek.has(wk) || ms < kickoffByWeek.get(wk)) kickoffByWeek.set(wk, ms);
	}

	for (const w of weeks) {
		const kickoffMs = kickoffByWeek.get(Number(w.week));
		const proposed  = kickoffMs !== undefined ? new Date(kickoffMs - PICK_DEADLINE_MS) : null;
		const storedMs  = w.deadline ? new Date(String(w.deadline).replace(' ', 'T')).getTime() : NaN;

		let verdict;
		if (proposed === null)                                  verdict = 'NO_ODDS';
		else if (Number.isNaN(storedMs))                        verdict = 'MISSING_STORED';
		else if (Math.abs(storedMs - proposed.getTime()) <= TOLERANCE_MS) verdict = 'OK';
		else                                                    verdict = 'MISMATCH';

		rows.push({
			seasonId: season.id, season: season.name, week: w.week, status: w.status,
			stored: Number.isNaN(storedMs) ? '—' : fmtET(w.deadline),
			proposed: proposed ? fmtET(proposed) : '—',
			proposedDate: proposed,
			deltaMin: proposed && !Number.isNaN(storedMs)
				? Math.round((storedMs - proposed.getTime()) / 60000) : null,
			verdict
		});
	}
}

const mismatches = rows.filter((r) => r.verdict === 'MISMATCH' || r.verdict === 'MISSING_STORED');
console.log(`weeks checked: ${rows.length} | OK: ${rows.filter(r => r.verdict === 'OK').length} | MISMATCH: ${mismatches.length} | NO_ODDS: ${rows.filter(r => r.verdict === 'NO_ODDS').length}\n`);

for (const r of rows.filter((r) => r.verdict !== 'OK')) {
	const delta = r.deltaMin === null ? '' : ` (stored ${r.deltaMin > 0 ? '+' : ''}${r.deltaMin} min)`;
	console.log(
		`${r.verdict.padEnd(15)} ${r.season} wk${r.week} [${r.status}]\n` +
		`  stored:   ${r.stored}\n` +
		`  proposed: ${r.proposed}${delta}`
	);
}

if (!APPLY) {
	console.log('\nDry run complete. To fix one week: --apply --season-id <id> --week <n>');
	process.exit(0);
}

// ── Targeted apply: exactly one week ────────────────────────────────────────
const target = rows.find((r) => r.seasonId === seasonArg && Number(r.week) === weekArg);
if (!target) {
	console.error(`No weekly_settings row found for season=${seasonArg} week=${weekArg}.`);
	process.exit(1);
}
if (!target.proposedDate) {
	console.error(`No active odds for season=${seasonArg} week=${weekArg} — nothing to derive from.`);
	process.exit(1);
}
if (target.verdict === 'OK') {
	console.log('Stored deadline already matches kickoff − 30 min. Nothing to do.');
	process.exit(0);
}

const weekRec = await pb.collection('weekly_settings').getFirstListItem(
	`season = "${seasonArg}" && week = ${weekArg}`
);
const newValue = pbDate(target.proposedDate);
await pb.collection('weekly_settings').update(weekRec.id, { deadline: newValue });
console.log(`\nUpdated ${target.season} wk${target.week}: deadline → ${newValue} (${fmtET(newValue)})`);
console.log('Week status left untouched.');
