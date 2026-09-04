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

## Deadlines

`game_time_stamp` is the **only** authoritative kickoff value. `gameTime` is a PocketBase
`date` mirror serialized as `"YYYY-MM-DD HH:mm:ss.SSSZ"`, which is not valid ISO 8601.

- Derive deadlines from `game_time_stamp` only — use `getKickoffIso` and `KICKOFF_FIELDS`
  from [src/lib/server/deadlines.ts](../../src/lib/server/deadlines.ts).
- Never write `odds.game_time_stamp ?? odds.gameTime`. A missing timestamp must yield a
  null deadline, not a fallback.

## Display

Eastern Time (`America/New_York`) is the canonical player timezone. All player-facing
dates, times, and deadline calculations resolve against Eastern regardless of the
browser or server timezone.

- Use the shared helpers in [src/lib/time.ts](../../src/lib/time.ts) — `formatKickoff`,
  `formatDeadlineLong`, `formatDeadlineShort`, `formatEasternDateTime`, `formatEasternDate`,
  `easternAbbreviation`, `toEasternInputValue`, `easternInputValueToIso`.
- Never call `toLocaleString`/`toLocaleDateString` without a `timeZone` on a player-facing
  surface — that silently renders in the viewer's device timezone.
- Never hardcode an `EST`/`EDT` suffix; `timeZoneName: 'short'` derives it per date.
- Admin pages stay on Pacific (`ADMIN_TIME_ZONE`).
- If a time looks wrong in the UI, the data is wrong — do not "fix" it by changing the
  timezone in the formatter.
