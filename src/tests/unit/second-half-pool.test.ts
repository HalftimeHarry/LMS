/**
 * Second Half pool — unit tests for SeasonProvider static helpers.
 *
 * Covers:
 *  - Registration window (isSecondHalfOpen)
 *  - Picks-per-week ramp (secondHalfPicksForWeek)
 *  - defaultEntryType priority between LMS and 2H
 *  - Edge cases: disabled flag, boundary weeks, missing fields
 */

import { describe, it, expect } from 'vitest';
import { SeasonProvider } from '$lib/providers/SeasonProvider';
import type { Season } from '$lib/providers/SeasonProvider';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSeason(overrides: Partial<Season> = {}): Season {
	return {
		id:                      's1',
		name:                    '2027 LMS',
		year:                    2027,
		status:                  'active',
		lmsEntryFee:             100,
		secondHalfEntryFee:      50,
		secondHalfPicksPerWeek:  2,
		regularSeasonOnly:       true,
		paymentDeadline:         null,
		firstPickDeadline:       null,
		notes:                   null,
		lmsEnabled:              true,
		secondHalfEnabled:       true,
		secondHalfStartWeek:     6,
		secondHalfPicksStartWeek: 10,
		...overrides,
	};
}

const NOW = new Date('2027-09-01T12:00:00Z');
const FUTURE = new Date('2027-10-01T12:00:00Z').toISOString();
const PAST   = new Date('2027-08-01T12:00:00Z').toISOString();

// ── isSecondHalfOpen ─────────────────────────────────────────────────────────

describe('SeasonProvider.isSecondHalfOpen', () => {

	describe('season status gate', () => {
		it('returns true when season is active', () => {
			expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'active' }))).toBe(true);
		});

		it('returns false when season is open (pre-season)', () => {
			expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'open' }))).toBe(false);
		});

		it('returns false when season is setup', () => {
			expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'setup' }))).toBe(false);
		});

		it('returns false when season is complete', () => {
			expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'complete' }))).toBe(false);
		});
	});

	describe('secondHalfEnabled flag', () => {
		it('returns false when secondHalfEnabled is explicitly false', () => {
			expect(SeasonProvider.isSecondHalfOpen(
				makeSeason({ status: 'active', secondHalfEnabled: false })
			)).toBe(false);
		});

		it('returns true when secondHalfEnabled is undefined (legacy record)', () => {
			const s = makeSeason({ status: 'active' });
			delete (s as any).secondHalfEnabled;
			expect(SeasonProvider.isSecondHalfOpen(s)).toBe(true);
		});
	});

	describe('week gate (secondHalfStartWeek)', () => {
		it('returns false before the start week', () => {
			expect(SeasonProvider.isSecondHalfOpen(
				makeSeason({ secondHalfStartWeek: 6 }), 5
			)).toBe(false);
		});

		it('returns true exactly at the start week', () => {
			expect(SeasonProvider.isSecondHalfOpen(
				makeSeason({ secondHalfStartWeek: 6 }), 6
			)).toBe(true);
		});

		it('returns true after the start week', () => {
			expect(SeasonProvider.isSecondHalfOpen(
				makeSeason({ secondHalfStartWeek: 6 }), 9
			)).toBe(true);
		});

		it('defaults start week to 6 when field is absent', () => {
			const s = makeSeason({ status: 'active' });
			delete (s as any).secondHalfStartWeek;
			expect(SeasonProvider.isSecondHalfOpen(s, 5)).toBe(false);
			expect(SeasonProvider.isSecondHalfOpen(s, 6)).toBe(true);
		});

		it('skips week check when currentWeek is not provided', () => {
			// Even at week 1 context, omitting currentWeek should return true
			expect(SeasonProvider.isSecondHalfOpen(
				makeSeason({ secondHalfStartWeek: 6 })
				// no currentWeek arg
			)).toBe(true);
		});
	});
});

// ── secondHalfPicksForWeek ───────────────────────────────────────────────────

describe('SeasonProvider.secondHalfPicksForWeek', () => {

	describe('1-pick phase (weeks 6–9)', () => {
		it('returns 1 pick for week 6 (first 2H week)', () => {
			expect(SeasonProvider.secondHalfPicksForWeek(makeSeason(), 6)).toBe(1);
		});

		it('returns 1 pick for week 9 (last single-pick week)', () => {
			expect(SeasonProvider.secondHalfPicksForWeek(makeSeason(), 9)).toBe(1);
		});
	});

	describe('2-pick phase (weeks 10+)', () => {
		it('returns 2 picks at week 10 (transition week)', () => {
			expect(SeasonProvider.secondHalfPicksForWeek(makeSeason(), 10)).toBe(2);
		});

		it('returns 2 picks for week 14', () => {
			expect(SeasonProvider.secondHalfPicksForWeek(makeSeason(), 14)).toBe(2);
		});

		it('returns 2 picks for week 18 (final week)', () => {
			expect(SeasonProvider.secondHalfPicksForWeek(makeSeason(), 18)).toBe(2);
		});
	});

	describe('custom configuration', () => {
		it('respects a custom secondHalfPicksStartWeek', () => {
			const s = makeSeason({ secondHalfPicksStartWeek: 12 });
			expect(SeasonProvider.secondHalfPicksForWeek(s, 11)).toBe(1);
			expect(SeasonProvider.secondHalfPicksForWeek(s, 12)).toBe(2);
		});

		it('respects a custom secondHalfPicksPerWeek value', () => {
			const s = makeSeason({ secondHalfPicksPerWeek: 3, secondHalfPicksStartWeek: 10 });
			expect(SeasonProvider.secondHalfPicksForWeek(s, 10)).toBe(3);
		});

		it('defaults secondHalfPicksStartWeek to 10 when absent', () => {
			const s = makeSeason();
			delete (s as any).secondHalfPicksStartWeek;
			expect(SeasonProvider.secondHalfPicksForWeek(s, 9)).toBe(1);
			expect(SeasonProvider.secondHalfPicksForWeek(s, 10)).toBe(2);
		});

		it('defaults secondHalfPicksPerWeek to 2 when absent', () => {
			const s = makeSeason();
			delete (s as any).secondHalfPicksPerWeek;
			expect(SeasonProvider.secondHalfPicksForWeek(s, 10)).toBe(2);
		});
	});
});

// ── defaultEntryType with 2H context ────────────────────────────────────────

describe('SeasonProvider.defaultEntryType — second half priority', () => {

	it('returns second_half when season is active (LMS closed)', () => {
		expect(SeasonProvider.defaultEntryType(
			makeSeason({ status: 'active' }), NOW
		)).toBe('second_half');
	});

	it('returns lms when season is open and deadline is in the future', () => {
		const s = makeSeason({ status: 'open', firstPickDeadline: FUTURE });
		expect(SeasonProvider.defaultEntryType(s, NOW)).toBe('lms');
	});

	it('returns second_half when season is active and week >= 6', () => {
		expect(SeasonProvider.defaultEntryType(
			makeSeason({ status: 'active', secondHalfStartWeek: 6 }), NOW, 6
		)).toBe('second_half');
	});

	it('returns null when season is active but week < 6 (2H not open yet)', () => {
		// LMS is closed (status active), 2H not open yet (week 5 < startWeek 6)
		expect(SeasonProvider.defaultEntryType(
			makeSeason({ status: 'active', secondHalfStartWeek: 6 }), NOW, 5
		)).toBeNull();
	});

	it('returns null when both pools are disabled', () => {
		const s = makeSeason({ status: 'active', lmsEnabled: false, secondHalfEnabled: false });
		expect(SeasonProvider.defaultEntryType(s, NOW)).toBeNull();
	});

	it('returns null when season is complete', () => {
		expect(SeasonProvider.defaultEntryType(
			makeSeason({ status: 'complete' }), NOW
		)).toBeNull();
	});

	it('returns lms (not second_half) when only lmsEnabled is true', () => {
		const s = makeSeason({ status: 'open', secondHalfEnabled: false, firstPickDeadline: FUTURE });
		expect(SeasonProvider.defaultEntryType(s, NOW)).toBe('lms');
	});

	it('returns second_half (not lms) when only secondHalfEnabled is true', () => {
		const s = makeSeason({ status: 'active', lmsEnabled: false });
		expect(SeasonProvider.defaultEntryType(s, NOW)).toBe('second_half');
	});
});

// ── Entry fee helpers ────────────────────────────────────────────────────────

describe('Second Half entry fee', () => {
	it('secondHalfEntryFee is separate from lmsEntryFee', () => {
		const s = makeSeason({ lmsEntryFee: 100, secondHalfEntryFee: 50 });
		expect(s.secondHalfEntryFee).toBe(50);
		expect(s.lmsEntryFee).toBe(100);
	});

	it('secondHalfEntryFee can be zero (free pool)', () => {
		const s = makeSeason({ secondHalfEntryFee: 0 });
		expect(s.secondHalfEntryFee).toBe(0);
	});
});
