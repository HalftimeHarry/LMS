---
applyTo: '**'
---

# Protected data: NFL kickoff times

`game_odds.game_time_stamp` and `game_odds.gameTime` are verified against the official
NFL schedule and are correct as-is. Both fields hold the same UTC instant.

## Rules

- Do NOT modify `game_time_stamp` or `gameTime` values in the database.
- Do NOT run [scripts/import-game-times-from-csv.js](../../scripts/import-game-times-from-csv.js)
  or [scripts/sync-gametime-to-timestamp.mjs](../../scripts/sync-gametime-to-timestamp.mjs)
  unless the user explicitly asks for a kickoff-time re-import.
- Do NOT change the schedule CSV embedded in `import-game-times-from-csv.js`.
- Seeding, migration, or maintenance scripts must not overwrite these fields as a side effect.
- Kickoff times in the CSV are Eastern Time and stored as UTC. Never write ET wall-clock
  values directly into these fields.

## Display

Kickoffs render via `formatGameTimeForDisplay` in [src/lib/utils.ts](../../src/lib/utils.ts),
which formats in `America/New_York`. If a time looks wrong in the UI, the data is wrong —
do not "fix" it by changing the timezone in the formatter.
