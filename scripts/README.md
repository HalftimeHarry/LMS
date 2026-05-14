# Scripts

Automation and maintenance scripts.

| Script | Purpose | Schedule |
|--------|---------|----------|
| `lock-picks.ts` | Lock weekly picks before game time | Thu 3:00 PM PST |
| `auto-pick.ts` | Assign auto-picks for users who missed the deadline | Thu 3:00 PM PST |
| `update-eliminations.ts` | Mark eliminated players after results are in | Mon/Tue post-game |
| `import-scores.ts` | Pull NFL game results from data provider | Hourly Sun/Mon |

Run via GitHub Actions (`.github/workflows/`) or Railway scheduled jobs.
