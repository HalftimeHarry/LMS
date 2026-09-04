#!/usr/bin/env node
/**
 * preflight-audit.mjs — READ ONLY.
 *
 * Surveys the live data for go-live readiness. Makes no writes of any kind.
 *
 * Usage:
 *   node scripts/preflight-audit.mjs
 */

import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const ET = 'America/New_York';
const fmt = (iso) => {
	if (!iso) return 'null';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return `INVALID(${iso})`;
	return d.toLocaleString('en-US', {
		timeZone: ET,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	});
};

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb
	.collection('_superusers')
	.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const findings = [];
const flag = (level, msg) => findings.push({ level, msg });

const section = (title) => console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);

// ── Seasons ──────────────────────────────────────────────────────────────────
section('SEASONS');
const seasons = await pb.collection('seasons').getFullList({ sort: '-year' });
for (const s of seasons) {
	const test = s.name?.includes('[TEST]');
	console.log(
		`${test ? '[TEST] ' : '       '}${s.id}  ${String(s.name).padEnd(28)} status=${String(s.status).padEnd(9)} year=${s.year} shStartWeek=${s.secondHalfStartWeek ?? '-'} lmsFee=${s.lmsEntryFee ?? '-'} shFee=${s.secondHalfEntryFee ?? '-'}`
	);
	if (test && (s.status === 'active' || s.status === 'open')) {
		flag('CRITICAL', `Test season "${s.name}" is ${s.status} — players could see it.`);
	}
}
const live = seasons.filter((s) => !s.name?.includes('[TEST]') && (s.status === 'active' || s.status === 'open'));
console.log(`\nLive (non-test) active/open seasons: ${live.length}`);
if (live.length === 0) flag('CRITICAL', 'No active/open live season.');

// ── Per-season detail ────────────────────────────────────────────────────────
for (const season of seasons) {
	const isTest = season.name?.includes('[TEST]');
	section(`SEASON: ${season.name}  (${season.id})${isTest ? '  ** TEST **' : ''}`);

	const [weeks, odds, entries, picks, results] = await Promise.all([
		pb.collection('weekly_settings').getFullList({ filter: `season = "${season.id}"`, sort: 'week' }),
		pb.collection('game_odds').getFullList({ filter: `season = "${season.id}"`, sort: 'week' }),
		pb.collection('entries').getFullList({ filter: `season = "${season.id}"`, expand: 'user' }),
		pb.collection('picks').getFullList({ filter: `entry.season = "${season.id}"` }).catch(() => []),
		pb.collection('pick_results').getFullList({ filter: `season = "${season.id}"` }).catch(() => [])
	]);

	// Weeks
	console.log(`\n-- weekly_settings: ${weeks.length} rows`);
	const byStatus = {};
	for (const w of weeks) byStatus[w.status] = (byStatus[w.status] ?? 0) + 1;
	console.log(`   statuses: ${JSON.stringify(byStatus)}`);

	const missingWeeks = [];
	for (let i = 1; i <= 18; i++) if (!weeks.find((w) => w.week === i)) missingWeeks.push(i);
	if (missingWeeks.length && !isTest) {
		console.log(`   MISSING weeks: ${missingWeeks.join(', ')}`);
		flag('WARN', `${season.name}: weekly_settings missing weeks ${missingWeeks.join(', ')}`);
	}

	// Deadline vs first kickoff per week
	console.log('\n-- week deadline vs first kickoff (expect deadline = kickoff - 30 min)');
	for (const w of weeks) {
		const weekOdds = odds
			.filter((o) => o.week === w.week && o.game_time_stamp)
			.sort((a, b) => new Date(a.game_time_stamp) - new Date(b.game_time_stamp));
		const first = weekOdds[0]?.game_time_stamp ?? null;
		let delta = '';
		if (first && w.deadline) {
			const mins = Math.round((new Date(first) - new Date(w.deadline)) / 60000);
			delta = `${mins} min before kickoff`;
			if (mins !== 30) {
				delta += '  <-- NOT 30';
				if (!isTest) flag('WARN', `${season.name} wk${w.week}: deadline is ${mins} min before kickoff, expected 30.`);
			}
		} else if (!w.deadline) {
			delta = 'NO DEADLINE';
			if (!isTest) flag('WARN', `${season.name} wk${w.week}: weekly_settings.deadline is empty.`);
		}
		console.log(
			`   wk${String(w.week).padStart(2)} ${String(w.status).padEnd(16)} games=${String(weekOdds.length).padStart(2)} kickoff=${fmt(first).padEnd(34)} deadline=${fmt(w.deadline).padEnd(34)} ${delta}`
		);
	}

	// Odds integrity
	console.log(`\n-- game_odds: ${odds.length} rows`);
	const noStamp = odds.filter((o) => !o.game_time_stamp);
	const noSpread = odds.filter((o) => o.homeSpread == null);
	const inactive = odds.filter((o) => o.isActive === false);
	console.log(`   missing game_time_stamp: ${noStamp.length}${noStamp.length ? ' -> ' + noStamp.map((o) => `${o.id}(wk${o.week})`).join(', ') : ''}`);
	console.log(`   missing homeSpread     : ${noSpread.length}`);
	console.log(`   isActive === false     : ${inactive.length}`);
	if (noStamp.length && !isTest) flag('WARN', `${season.name}: ${noStamp.length} game_odds row(s) with no kickoff timestamp.`);

	// Entries
	console.log(`\n-- entries: ${entries.length} rows`);
	const eStatus = {};
	const eType = {};
	for (const e of entries) {
		eStatus[e.status] = (eStatus[e.status] ?? 0) + 1;
		eType[e.entryType] = (eType[e.entryType] ?? 0) + 1;
	}
	console.log(`   by status: ${JSON.stringify(eStatus)}`);
	console.log(`   by type  : ${JSON.stringify(eType)}`);
	const orphanUser = entries.filter((e) => !e.expand?.user);
	if (orphanUser.length) {
		console.log(`   ORPHAN (no user record): ${orphanUser.length}`);
		flag('WARN', `${season.name}: ${orphanUser.length} entries reference a missing user.`);
	}
	const testish = entries.filter((e) => /test|demo|dummy|fake/i.test(e.entryName ?? ''));
	if (testish.length) {
		console.log(`   test-looking names: ${testish.map((e) => e.entryName).join(', ')}`);
		if (!isTest) flag('REVIEW', `${season.name}: ${testish.length} entries look like test data: ${testish.map((e) => e.entryName).join(', ')}`);
	}
	for (const e of entries) {
		console.log(`   ${e.id} ${String(e.entryName).padEnd(26)} ${String(e.entryType).padEnd(12)} ${String(e.status).padEnd(16)} user=${e.expand?.user?.email ?? e.user}`);
	}

	// Picks / results left over from testing
	console.log(`\n-- picks: ${picks.length} rows   pick_results: ${results.length} rows`);
	if (picks.length && !isTest) {
		const byWeek = {};
		for (const p of picks) byWeek[p.week] = (byWeek[p.week] ?? 0) + 1;
		console.log(`   picks by week: ${JSON.stringify(byWeek)}`);
		flag('REVIEW', `${season.name}: ${picks.length} pick(s) already exist before go-live — confirm these are real, not leftover test picks.`);
	}
	if (results.length && !isTest) {
		flag('REVIEW', `${season.name}: ${results.length} pick_results row(s) already exist before go-live.`);
	}
}

// ── Users ────────────────────────────────────────────────────────────────────
section('USERS');
const users = await pb.collection('users').getFullList({ sort: 'created' });
const roles = {};
for (const u of users) roles[u.role ?? 'none'] = (roles[u.role ?? 'none'] ?? 0) + 1;
console.log(`total: ${users.length}   roles: ${JSON.stringify(roles)}`);
const testUsers = users.filter((u) => /test|demo|dummy|example\.com|\+test/i.test(`${u.email} ${u.displayName}`));
if (testUsers.length) {
	console.log(`\ntest-looking users (${testUsers.length}):`);
	for (const u of testUsers) console.log(`   ${u.id} ${String(u.email).padEnd(34)} ${u.displayName ?? ''} role=${u.role ?? '-'}`);
	flag('REVIEW', `${testUsers.length} user account(s) look like test data.`);
}
if (!roles.super_admin) flag('WARN', 'No super_admin user found.');

// ── Summary ──────────────────────────────────────────────────────────────────
section('FINDINGS');
if (findings.length === 0) {
	console.log('No issues detected.');
} else {
	const order = { CRITICAL: 0, WARN: 1, REVIEW: 2 };
	findings.sort((a, b) => order[a.level] - order[b.level]);
	for (const f of findings) console.log(`[${f.level}] ${f.msg}`);
}
console.log('\n(Read-only audit — nothing was modified.)');
