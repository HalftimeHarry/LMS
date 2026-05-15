import { describe, it, expect } from 'vitest';
import { SeasonProvider } from '$lib/providers/SeasonProvider';
import type { Season } from '$lib/providers/SeasonProvider';

function makeSeason(overrides: Partial<Season> = {}): Season {
	return {
		id:                     's1',
		name:                   'LMS 2027',
		year:                   2027,
		status:                 'open',
		lmsEntryFee:            100,
		secondHalfEntryFee:     50,
		secondHalfPicksPerWeek: 1,
		regularSeasonOnly:      true,
		paymentDeadline:        null,
		firstPickDeadline:      null,
		notes:                  null,
		...overrides
	};
}

// Fixed reference time for deterministic tests
const NOW = new Date('2027-09-01T12:00:00Z');
const BEFORE_DEADLINE = new Date('2027-08-15T12:00:00Z'); // before NOW
const AFTER_DEADLINE  = new Date('2027-09-15T12:00:00Z'); // after NOW

describe('SeasonProvider.isLmsOpen', () => {
	it('returns true when season is open and no deadline set', () => {
		expect(SeasonProvider.isLmsOpen(makeSeason({ status: 'open' }), NOW)).toBe(true);
	});

	it('returns true when season is open and deadline is in the future', () => {
		const s = makeSeason({ status: 'open', firstPickDeadline: AFTER_DEADLINE.toISOString() });
		expect(SeasonProvider.isLmsOpen(s, NOW)).toBe(true);
	});

	it('returns false when season is open but deadline has passed', () => {
		const s = makeSeason({ status: 'open', firstPickDeadline: BEFORE_DEADLINE.toISOString() });
		expect(SeasonProvider.isLmsOpen(s, NOW)).toBe(false);
	});

	it('returns false when season is active (deadline already passed)', () => {
		expect(SeasonProvider.isLmsOpen(makeSeason({ status: 'active' }), NOW)).toBe(false);
	});

	it('returns false when season is complete', () => {
		expect(SeasonProvider.isLmsOpen(makeSeason({ status: 'complete' }), NOW)).toBe(false);
	});

	it('returns false when season is setup', () => {
		expect(SeasonProvider.isLmsOpen(makeSeason({ status: 'setup' }), NOW)).toBe(false);
	});
});

describe('SeasonProvider.isSecondHalfOpen', () => {
	it('returns true when season is active', () => {
		expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'active' }))).toBe(true);
	});

	it('returns false when season is open (pre-season)', () => {
		expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'open' }))).toBe(false);
	});

	it('returns false when season is complete', () => {
		expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'complete' }))).toBe(false);
	});

	it('returns false when season is setup', () => {
		expect(SeasonProvider.isSecondHalfOpen(makeSeason({ status: 'setup' }))).toBe(false);
	});
});

describe('SeasonProvider.defaultEntryType', () => {
	it('returns lms when season is open and deadline not passed', () => {
		const s = makeSeason({ status: 'open', firstPickDeadline: AFTER_DEADLINE.toISOString() });
		expect(SeasonProvider.defaultEntryType(s, NOW)).toBe('lms');
	});

	it('returns second_half when season is active', () => {
		expect(SeasonProvider.defaultEntryType(makeSeason({ status: 'active' }), NOW)).toBe('second_half');
	});

	it('returns null when season is complete', () => {
		expect(SeasonProvider.defaultEntryType(makeSeason({ status: 'complete' }), NOW)).toBeNull();
	});

	it('returns null when season is open but deadline has passed', () => {
		const s = makeSeason({ status: 'open', firstPickDeadline: BEFORE_DEADLINE.toISOString() });
		expect(SeasonProvider.defaultEntryType(s, NOW)).toBeNull();
	});

	it('returns null when season is setup', () => {
		expect(SeasonProvider.defaultEntryType(makeSeason({ status: 'setup' }), NOW)).toBeNull();
	});
});
