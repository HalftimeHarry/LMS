# Second Half Pool — Rules, Logic & Tests

The Second Half pool is an optional mid-season entry that runs alongside the main LMS pool. Players join at week 6, pick winners each week, and must pick two teams per week from week 10 onward.

---

## Pool rules

| Rule | Value |
|------|-------|
| Registration opens | Week 6 (configurable via `secondHalfStartWeek`) |
| Entry fee | Separate from LMS (`secondHalfEntryFee`) |
| Picks per week (weeks 6–9) | 1 |
| Picks per week (weeks 10–18) | 2 (configurable via `secondHalfPicksPerWeek`) |
| Pick ramp week | Week 10 (configurable via `secondHalfPicksStartWeek`) |
| Elimination | Picked team loses |
| Team reuse | Each team can only be picked once per season |

---

## Season configuration fields

All fields live on the `seasons` PocketBase collection and are exposed via `SeasonProvider`.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `secondHalfEnabled` | `boolean` | `true` | Master toggle — disables the pool entirely when `false` |
| `secondHalfEntryFee` | `number` | — | Entry fee in dollars |
| `secondHalfStartWeek` | `number` | `6` | First week participants can register |
| `secondHalfPicksPerWeek` | `number` | `2` | Picks required per week once the ramp kicks in |
| `secondHalfPicksStartWeek` | `number` | `10` | Week the pick count increases to `secondHalfPicksPerWeek` |

---

## Registration window (`SeasonProvider.isSecondHalfOpen`)

Second Half registration is open when **all** of the following are true:

1. `secondHalfEnabled !== false`
2. `season.status === 'active'` (LMS has already started)
3. `currentWeek >= secondHalfStartWeek` (default 6) — only checked when `currentWeek` is provided

Admin-side calls that don't have week context omit `currentWeek` and skip the week check.

```ts
SeasonProvider.isSecondHalfOpen(season)              // admin — no week check
SeasonProvider.isSecondHalfOpen(season, currentWeek) // participant — enforces start week
```

---

## Picks per week (`SeasonProvider.secondHalfPicksForWeek`)

```ts
SeasonProvider.secondHalfPicksForWeek(season, weekNumber)
// → 1  for weeks < secondHalfPicksStartWeek (default 10)
// → 2  for weeks >= secondHalfPicksStartWeek (uses secondHalfPicksPerWeek)
```

**Important:** the pick submission action (`dashboard/picks/+page.server.ts`) does **not** apply this ramp. It reads `week.secondHalfPicksPerWeek ?? season.secondHalfPicksPerWeek` directly. The ramp is enforced by the seeder and the UI pick form — not the server action. This is intentional: the week record can carry a per-week override.

---

## Auto-pick

At the pick deadline the scheduled function (`netlify/functions/advance-weeks.ts`) assigns auto-picks to entries that missed the deadline:

- **LMS entries** → biggest favorite (most negative spread) from active odds
- **Second Half entries** → biggest underdog (most positive spread) from active odds

The auto-pick team is derived from `game_odds` where `isActive = true`. If no active odds exist for the week, no auto-picks fire.

The `weekly_settings.biggestFavoriteTeam` field stores the committed auto-pick team once the scheduler runs. The admin UI shows **locked in** when this field is set, or **preview** when it's still derived from current odds.

---

## Running the tests

```sh
pnpm test
```

All tests run in Node via Vitest — no browser or live PocketBase instance required.

---

## Test coverage

### `src/tests/unit/second-half-pool.test.ts` — 30 tests

Unit tests for `SeasonProvider` static helpers. No mocks needed — pure logic.

**`isSecondHalfOpen`**
- Season status gate: `active` → open; `open`, `setup`, `complete` → closed
- `secondHalfEnabled: false` closes registration; `undefined` (legacy record) stays open
- Week boundary: closed before `secondHalfStartWeek`, open at and after it
- Default start week of 6 when field is absent
- No-week-arg bypass (admin calls)

**`secondHalfPicksForWeek`**
- Returns 1 for weeks 6–9 (before ramp)
- Returns 2 at week 10 and beyond
- Respects custom `secondHalfPicksStartWeek` and `secondHalfPicksPerWeek`
- Defaults both fields correctly when absent

**`defaultEntryType`**
- Returns `second_half` when season is active (LMS closed)
- Returns `lms` when season is open and deadline is in the future
- Returns `null` when active but week < 6 (gap before 2H opens)
- Returns `null` when both pools disabled or season complete
- Handles single-pool-enabled cases correctly

**Entry fee**
- `secondHalfEntryFee` is independent of `lmsEntryFee`
- Zero fee (free pool) is valid

---

### `src/tests/integration/second-half-picks.test.ts` — 19 tests

Integration tests for the `dashboard/picks` action. PocketBase is mocked via `vi.fn()`.

**Pick count enforcement**
- Rejects 1 team when season requires 2
- Accepts 2 teams when season requires 2
- Rejects 3 teams when only 2 required
- Rejects 0 teams
- Week-level `secondHalfPicksPerWeek` override takes priority over season default

**Upsert behaviour**
- Creates a new pick record when none exists for the entry+week
- Updates the existing pick record (replaces both teams), does not create a duplicate

**Access control**
- `401` when unauthenticated
- `403` when entry belongs to a different user
- `400` when week is `locked` or `results_pending`
- `404` when entry or week does not exist

**Schema validation**
- `400` when `entryId`, `weekId`, or `entryType` is missing/invalid

**PocketBase error handling**
- `400` when `picks.create` throws
- `400` when `picks.update` throws

**Redirect**
- Successful submission redirects to `/dashboard`

---

### `src/tests/integration/entries-admin.test.ts` — updated

The existing delete-block tests were updated to:
- Use a past deadline (`2020-01-01`) so tests are not date-sensitive
- Match the actual error message (`/deadline has passed/i`)
- Add a new test confirming `[TEST]` seasons bypass the deadline gate entirely
