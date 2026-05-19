# Test Season

Run a full 18-week LMS season in compressed time to catch bugs before the real season starts.

## How it works

Each NFL week maps to a configurable real-time interval (`1h` or `1d`). Within each interval:

| Offset | Event |
|---|---|
| T+0 | Week opens — picks accepted |
| T+(interval − 20 min) | Picks locked — deadline passes |
| T+(interval − 10 min) | Results simulated — picks marked correct/incorrect (55% win rate) |
| T+(interval − 2 min) | Week complete — losing entries eliminated |
| T+(interval) | Next week opens |

Game odds are cloned from the real 2026 NFL schedule with randomized spreads and moneylines. Game times within each week are spread evenly across the interval window, so the "first game" lock trigger fires at the right time.

---

## Quick start

### 1. Seed the test season

```bash
# 18-hour test (1 hour per NFL week)
node scripts/seed-test-season.js --interval=1h

# 18-day test (1 day per NFL week)
node scripts/seed-test-season.js --interval=1d

# Custom — e.g. 6 hours per week
node scripts/seed-test-season.js --interval=6h
```

The script prints a **Season ID** at the end. Copy it.

### 2. Start the scheduler (keep this running)

```bash
node scripts/advance-test-season.js --season=SEASON_ID --interval=1h
```

This process drives all week transitions automatically. Keep it running for the duration of the test. If it crashes or you restart it, it will skip past events and resume from the current point.

### 3. Clean up when done

```bash
# Delete one specific test season and all its data
node scripts/clear-test-season.js --season=SEASON_ID

# List all test seasons (to find IDs)
node scripts/clear-test-season.js --list
```

---

## npm shortcuts

```bash
npm run test-season:seed    -- --interval=1h
npm run test-season:advance -- --season=SEASON_ID --interval=1h
npm run test-season:clear   -- --season=SEASON_ID
npm run test-season:list
```

---

## Running two tests in parallel

You can run multiple test seasons simultaneously — each gets its own season ID and isolated data. For example:

```bash
# Terminal 1 — hourly test
node scripts/seed-test-season.js --interval=1h
# → Season ID: abc123
node scripts/advance-test-season.js --season=abc123 --interval=1h

# Terminal 2 — daily test
node scripts/seed-test-season.js --interval=1d
# → Season ID: def456
node scripts/advance-test-season.js --season=def456 --interval=1d
```

Clean up each independently:

```bash
node scripts/clear-test-season.js --season=abc123
node scripts/clear-test-season.js --season=def456
```

---

## Safety

- `clear-test-season.js` refuses to delete any season whose name does not contain `[TEST]`.
- Test seasons are named `[TEST] 2026 Season (Xh/week) TIMESTAMP` so they are easy to identify in the admin UI.
- Real season data (the 2026 LMS season, real users, real entries) is never touched.

---

## What gets tested

- Pick submission window (open/locked state)
- 20-minute pre-game lock trigger
- Auto-elimination of entries with wrong picks
- Standings grid updates across multiple weeks
- Second-half entry registration window
- Admin week management UI
- Odds display and biggest-favorite auto-pick suggestion
