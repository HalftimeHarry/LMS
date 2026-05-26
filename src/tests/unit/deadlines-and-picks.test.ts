/**
 * Tests for entry deadlines and 2H picks-per-week ramp.
 *
 * Entry deadlines (20 min before first kickoff):
 *   LMS  → week 1  first kickoff − 20 min
 *   2H   → secondHalfStartWeek (default 6) first kickoff − 20 min
 *
 * 2H picks-per-week ramp:
 *   Weeks 6–9  (before secondHalfPicksStartWeek, default 10) → 1 pick
 *   Week 10+   (from secondHalfPicksStartWeek onward)        → secondHalfPicksPerWeek (default 2)
 *
 * Pick deadline per week:
 *   weekly_settings.deadline = 20 min before first kickoff of that week
 *   Stored in PocketBase; derived from game_odds when odds are imported.
 */

import { describe, it, expect } from 'vitest';
import { SeasonProvider } from '$lib/providers/SeasonProvider';
import { WeekProvider }   from '$lib/providers/WeekProvider';
import type { Season }    from '$lib/providers/SeasonProvider';
import type { Week }      from '$lib/providers/WeekProvider';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSeason(overrides: Partial<Season> = {}): Season {
	return {
		id:                       's1',
		name:                     '2026-2027 LMS',
		year:                     2026,
		status:                   'active',
		lmsEntryFee:              100,
		secondHalfEntryFee:       50,
		secondHalfPicksPerWeek:   2,
		regularSeasonOnly:        false,
		paymentDeadline:          null,
		firstPickDeadline:        null,
		notes:                    null,
		lmsEnabled:               true,
		secondHalfEnabled:        true,
		secondHalfStartWeek:      6,
		secondHalfPicksStartWeek: 10,
		...overrides,
	};
}

function makeWeek(week: number, overrides: Partial<Week> = {}): Week {
	return {
		id:                     `w${week}`,
		season:                 's1',
		week,
		status:                 'open',
		deadline:               `2026-09-${String(week).padStart(2,'0')}T20:00:00Z`,
		secondHalfPicksPerWeek: null,
		biggestFavoriteTeam:    null,
		...overrides,
	};
}

// ── Entry deadline derivation (20 min before kickoff) ─────────────────────────

describe('Entry deadline — 20 min before first kickoff', () => {

	it('LMS deadline is 20 min before week 1 kickoff', () => {
		const kickoff  = new Date('2026-09-09T20:20:00Z'); // 1:20 PM PDT
		const expected = new Date('2026-09-09T20:00:00Z'); // 1:00 PM PDT

		const deadline = new Date(kickoff);
		deadline.setMinutes(deadline.getMinutes() - 20);

		expect(deadline.toISOString()).toBe(expected.toISOString());
	});

	it('2H deadline is 20 min before week 6 kickoff', () => {
		const kickoff  = new Date('2026-10-14T00:15:00Z'); // 5:15 PM PDT
		const expected = new Date('2026-10-13T23:55:00Z'); // 4:55 PM PDT

		const deadline = new Date(kickoff);
		deadline.setMinutes(deadline.getMinutes() - 20);

		expect(deadline.toISOString()).toBe(expected.toISOString());
	});

	it('deadline is exactly 20 minutes before kickoff — not 19, not 21', () => {
		const kickoff = new Date('2026-09-09T20:20:00Z');
		const deadline = new Date(kickoff);
		deadline.setMinutes(deadline.getMinutes() - 20);

		const diffMs = kickoff.getTime() - deadline.getTime();
		expect(diffMs).toBe(20 * 60 * 1000);
	});

	it('deadline falls on the previous hour when kickoff is on the hour', () => {
		const kickoff  = new Date('2026-09-09T20:00:00Z'); // exactly 1:00 PM PDT
		const expected = new Date('2026-09-09T19:40:00Z'); // 12:40 PM PDT

		const deadline = new Date(kickoff);
		deadline.setMinutes(deadline.getMinutes() - 20);

		expect(deadline.toISOString()).toBe(expected.toISOString());
	});

	it('deadline falls on the previous day when kickoff is early morning', () => {
		const kickoff  = new Date('2026-09-09T00:10:00Z');
		const expected = new Date('2026-09-08T23:50:00Z');

		const deadline = new Date(kickoff);
		deadline.setMinutes(deadline.getMinutes() - 20);

		expect(deadline.toISOString()).toBe(expected.toISOString());
	});
});

// ── isSecondHalfOpen — registration window ────────────────────────────────────

describe('SeasonProvider.isSecondHalfOpen', () => {
	const SEASON = makeSeason();

	it('open when now is before week 6 deadline', () => {
		const week6Deadline = '2026-10-14T23:55:00Z';
		const now = new Date('2026-09-01T00:00:00Z'); // well before
		expect(SeasonProvider.isSecondHalfOpen(SEASON, undefined, week6Deadline, now)).toBe(true);
	});

	it('closed when now is after week 6 deadline', () => {
		const week6Deadline = '2026-10-14T23:55:00Z';
		const now = new Date('2026-10-15T00:00:00Z'); // after deadline
		expect(SeasonProvider.isSecondHalfOpen(SEASON, undefined, week6Deadline, now)).toBe(false);
	});

	it('closed exactly at the deadline moment', () => {
		const week6Deadline = '2026-10-14T23:55:00Z';
		const now = new Date(week6Deadline);
		expect(SeasonProvider.isSecondHalfOpen(SEASON, undefined, week6Deadline, now)).toBe(false);
	});

	it('open 1 second before deadline', () => {
		const week6Deadline = '2026-10-14T23:55:00Z';
		const now = new Date(new Date(week6Deadline).getTime() - 1000);
		expect(SeasonProvider.isSecondHalfOpen(SEASON, undefined, week6Deadline, now)).toBe(true);
	});

	it('closed when secondHalfEnabled is false regardless of deadline', () => {
		const season = makeSeason({ secondHalfEnabled: false });
		const week6Deadline = '2026-10-14T23:55:00Z';
		const now = new Date('2026-09-01T00:00:00Z');
		expect(SeasonProvider.isSecondHalfOpen(season, undefined, week6Deadline, now)).toBe(false);
	});

	it('falls back to currentWeek >= secondHalfStartWeek when no deadline provided', () => {
		const season = makeSeason({ secondHalfStartWeek: 6 });
		expect(SeasonProvider.isSecondHalfOpen(season, 5)).toBe(false);
		expect(SeasonProvider.isSecondHalfOpen(season, 6)).toBe(true);
		expect(SeasonProvider.isSecondHalfOpen(season, 7)).toBe(true);
	});
});

// ── 2H picks-per-week ramp ────────────────────────────────────────────────────

describe('SeasonProvider.secondHalfPicksForWeek — picks ramp at week 10', () => {
	const SEASON = makeSeason({
		secondHalfStartWeek:      6,
		secondHalfPicksStartWeek: 10,
		secondHalfPicksPerWeek:   2,
	});

	// Weeks 6–9: 1 pick
	it.each([6, 7, 8, 9])('week %i → 1 pick (before ramp)', (week) => {
		expect(SeasonProvider.secondHalfPicksForWeek(SEASON, week)).toBe(1);
	});

	// Week 10+: 2 picks
	it.each([10, 11, 12, 13, 14, 15, 16, 17, 18])('week %i → 2 picks (at/after ramp)', (week) => {
		expect(SeasonProvider.secondHalfPicksForWeek(SEASON, week)).toBe(2);
	});

	it('ramp week is configurable via secondHalfPicksStartWeek', () => {
		const season = makeSeason({ secondHalfPicksStartWeek: 12, secondHalfPicksPerWeek: 3 });
		expect(SeasonProvider.secondHalfPicksForWeek(season, 11)).toBe(1);
		expect(SeasonProvider.secondHalfPicksForWeek(season, 12)).toBe(3);
		expect(SeasonProvider.secondHalfPicksForWeek(season, 18)).toBe(3);
	});

	it('defaults to 2 picks when secondHalfPicksPerWeek is not set', () => {
		const season = makeSeason({ secondHalfPicksPerWeek: undefined as any });
		expect(SeasonProvider.secondHalfPicksForWeek(season, 10)).toBe(2);
	});

	it('defaults ramp to week 10 when secondHalfPicksStartWeek is not set', () => {
		const season = makeSeason({ secondHalfPicksStartWeek: undefined as any });
		expect(SeasonProvider.secondHalfPicksForWeek(season, 9)).toBe(1);
		expect(SeasonProvider.secondHalfPicksForWeek(season, 10)).toBe(2);
	});
});

// ── WeekProvider.picksForWeek — per-week override ─────────────────────────────

describe('WeekProvider.picksForWeek — week-level override takes precedence', () => {

	it('uses week-level secondHalfPicksPerWeek when set', () => {
		const week = makeWeek(10, { secondHalfPicksPerWeek: 3 });
		expect(WeekProvider.picksForWeek('second_half', week, 2)).toBe(3);
	});

	it('falls back to season default when week-level is null', () => {
		const week = makeWeek(10, { secondHalfPicksPerWeek: null });
		expect(WeekProvider.picksForWeek('second_half', week, 2)).toBe(2);
	});

	it('always returns 1 for LMS regardless of week setting', () => {
		const week = makeWeek(10, { secondHalfPicksPerWeek: 3 });
		expect(WeekProvider.picksForWeek('lms', week, 2)).toBe(1);
	});
});

// ── Full ramp scenario: weeks 6–18 ───────────────────────────────────────────

describe('2H picks ramp — full season scenario (weeks 6–18)', () => {
	const SEASON = makeSeason();

	const expected: Record<number, number> = {
		6: 1, 7: 1, 8: 1, 9: 1,          // registration + early weeks
		10: 2, 11: 2, 12: 2, 13: 2,       // ramp kicks in at week 10
		14: 2, 15: 2, 16: 2, 17: 2, 18: 2
	};

	for (const [week, picks] of Object.entries(expected)) {
		it(`week ${week} → ${picks} pick(s)`, () => {
			expect(SeasonProvider.secondHalfPicksForWeek(SEASON, Number(week))).toBe(picks);
		});
	}
});

// ── Pick deadline vs entry deadline ──────────────────────────────────────────

describe('Pick deadline vs entry deadline distinction', () => {

	it('entry deadline (registration close) = week 6 kickoff − 20 min', () => {
		// This is when new 2H entries can no longer be created
		const week6Kickoff = new Date('2026-10-14T00:15:00Z');
		const entryDeadline = new Date(week6Kickoff);
		entryDeadline.setMinutes(entryDeadline.getMinutes() - 20);

		expect(entryDeadline.toISOString()).toBe('2026-10-13T23:55:00.000Z');
	});

	it('pick deadline = each week kickoff − 20 min (same formula, different week)', () => {
		// Week 10 pick deadline — participants must submit 2 picks before this
		const week10Kickoff = new Date('2026-11-11T18:20:00Z'); // example
		const pickDeadline = new Date(week10Kickoff);
		pickDeadline.setMinutes(pickDeadline.getMinutes() - 20);

		const diffMs = week10Kickoff.getTime() - pickDeadline.getTime();
		expect(diffMs).toBe(20 * 60 * 1000);
	});

	it('entry deadline is before the first pick deadline (week 6 deadline = both)', () => {
		// For week 6: entry deadline === pick deadline (same kickoff)
		const week6Kickoff   = new Date('2026-10-14T00:15:00Z');
		const entryDeadline  = new Date(week6Kickoff.getTime() - 20 * 60_000);
		const pickDeadline   = new Date(week6Kickoff.getTime() - 20 * 60_000);

		expect(entryDeadline.toISOString()).toBe(pickDeadline.toISOString());
	});

	it('LMS entry deadline (week 1) is earlier than 2H entry deadline (week 6)', () => {
		const lmsDeadline = new Date('2026-09-09T20:00:00Z');  // week 1 kickoff − 20 min
		const shDeadline  = new Date('2026-10-13T23:55:00Z');  // week 6 kickoff − 20 min

		expect(lmsDeadline.getTime()).toBeLessThan(shDeadline.getTime());
	});
});
