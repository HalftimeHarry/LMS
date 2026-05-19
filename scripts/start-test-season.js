#!/usr/bin/env node
/**
 * start-test-season.js
 *
 * Finds all active test seasons for a given interval and starts the
 * advance-test-season.js scheduler for each one in parallel.
 *
 * Usage:
 *   node scripts/start-test-season.js --interval=1h
 *   node scripts/start-test-season.js --interval=1d
 *
 * What it does:
 *   1. Queries PocketBase for all [TEST] seasons matching the interval
 *   2. Starts one advance-test-season.js child process per season
 *   3. Streams all output to the terminal with a [LMS] / [2H] prefix
 *   4. Exits when all seasons are complete (or Ctrl+C to stop early)
 *
 * Timeline per compressed week:
 *   T+0              Week opens — picks accepted, admin can manage entries freely
 *   T+(interval-20m) Picks LOCKED for participants (deadline passes)
 *   T+(interval-2m)  Admin entry window closes — results simulated, week completes
 *   T+(interval)     Next week opens
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PB_URL      = 'https://pocketbase-production-2547.up.railway.app';
const ADMIN_EMAIL = 'ddinsmore8@gmail.com';
const ADMIN_PASS  = 'MADcap(123)';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args     = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const interval = args.interval ?? '1h';

if (!['1h','1d'].includes(interval) && !/^\d+(h|d|m)$/.test(interval)) {
  console.error('Usage: node scripts/start-test-season.js --interval=1h|1d');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// PocketBase
// ---------------------------------------------------------------------------
async function auth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS })
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth failed');
  return d.token;
}

async function getAll(token, collection, filter) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=500` : '?perPage=500';
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${q}`, {
    headers: { Authorization: token }
  });
  const d = await res.json();
  return d.items ?? [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function label(name) {
  if (name.toLowerCase().includes('second half')) return '[2H] ';
  return '[LMS]';
}

function color(name) {
  // ANSI: gold for LMS, blue for Second Half
  return name.toLowerCase().includes('second half') ? '\x1b[34m' : '\x1b[33m';
}

const RESET = '\x1b[0m';

function prefixedLog(seasonName, line) {
  const c   = color(seasonName);
  const lbl = label(seasonName);
  console.log(`${c}${lbl}${RESET} ${line}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nStarting test season schedulers  [interval = ${interval}/week]\n`);

  const token   = await auth();
  const seasons = await getAll(token, 'seasons', `name ~ "[TEST]" && name ~ "(${interval}/week)"`);

  if (!seasons.length) {
    console.error(`No test seasons found for interval "${interval}".`);
    console.error(`Run first:  node scripts/seed-test-season.js --interval=${interval}`);
    process.exit(1);
  }

  // Filter to active/open only
  const active = seasons.filter(s => s.status === 'active' || s.status === 'open');
  if (!active.length) {
    console.error('All matching test seasons are already complete.');
    console.error(`Run:  node scripts/clear-test-season.js --all  then re-seed.`);
    process.exit(1);
  }

  console.log(`Found ${active.length} season(s) to advance:`);
  active.forEach(s => console.log(`  ${label(s.name)} ${s.id}  ${s.name}`));
  console.log('');

  // Print the timeline so admin knows what to expect
  const INTERVAL_MS = (() => {
    if (interval === '1h') return 60 * 60 * 1000;
    if (interval === '1d') return 24 * 60 * 60 * 1000;
    const m = interval.match(/^(\d+)(h|d|m)$/);
    if (m) {
      const n = parseInt(m[1]);
      if (m[2] === 'h') return n * 60 * 60 * 1000;
      if (m[2] === 'd') return n * 24 * 60 * 60 * 1000;
      if (m[2] === 'm') return n * 60 * 1000;
    }
    return 60 * 60 * 1000;
  })();

  const fmt = ms => {
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  };

  console.log('Timeline per NFL week:');
  console.log(`  T+0                  Week opens — picks accepted, admin can manage entries`);
  console.log(`  T+${fmt(INTERVAL_MS - 20*60*1000).padEnd(18)} Participant picks LOCKED (20 min before kickoff)`);
  console.log(`  T+${fmt(INTERVAL_MS -  2*60*1000).padEnd(18)} Admin window closes — results simulated`);
  console.log(`  T+${fmt(INTERVAL_MS).padEnd(18)} Next week opens`);
  console.log('');
  console.log('Press Ctrl+C to stop all schedulers.\n');

  // Spawn one child process per season
  const advancerPath = join(__dirname, 'advance-test-season.js');
  const children = [];

  for (const season of active) {
    const child = spawn('node', [advancerPath, `--season=${season.id}`, `--interval=${interval}`], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const name = season.name;

    child.stdout.on('data', data => {
      data.toString().split('\n').filter(Boolean).forEach(line => prefixedLog(name, line));
    });
    child.stderr.on('data', data => {
      data.toString().split('\n').filter(Boolean).forEach(line => prefixedLog(name, `ERROR: ${line}`));
    });
    child.on('exit', code => {
      prefixedLog(name, `Scheduler exited (code ${code})`);
    });

    children.push(child);
  }

  // Forward Ctrl+C to all children
  process.on('SIGINT', () => {
    console.log('\nStopping all schedulers...');
    children.forEach(c => c.kill('SIGINT'));
    process.exit(0);
  });

  // Wait for all children to finish
  await Promise.all(children.map(c => new Promise(resolve => c.on('exit', resolve))));
  console.log('\nAll schedulers finished.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
