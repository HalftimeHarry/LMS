import { describe, expect, it } from 'vitest';
import {
	parsePbDate,
	resolveOddsSourceSeason,
	verifyWeekDeadline
} from '$lib/server/deadline-verification';

// Week 6 production data: first kickoff Thu 8:15 PM EDT → effective deadline 7:45 PM EDT
const WK6_KICKOFF   = '2026-10-16T00:15:00.000Z';
const WK6_EFFECTIVE = '2026-10-15T23:45:00.000Z';
const BEFORE = new Date('2026-10-15T17:55:00.000Z'); // ~6h before the deadline

const base = {
	week: 6,
	status: 'open',
	storedDeadline: '2026-10-15 23:45:00.000Z',
	firstKickoffIso: WK6_KICKOFF,
	hasOdds: true,
	isTest: false,
	now: BEFORE
};

describe('verifyWeekDeadline — happy path', () => {
	it('OK when stored matches kickoff − 30 min and week is open before it', () => {
		const v = verifyWeekDeadline(base);
		expect(v.result).toBe('OK');
		expect(v.flags).toEqual([]);
		expect(v.effectiveDeadline).toBe(WK6_EFFECTIVE);
		expect(v.storedDeadline).toBe('2026-10-15T23:45:00.000Z');
		expect(v.diffMinutes).toBe(0);
	});
});

describe('verifyWeekDeadline — mismatch detection', () => {
	it('flags a stale stored deadline that differs from the effective deadline', () => {
		const v = verifyWeekDeadline({ ...base, storedDeadline: '2026-10-15 17:35:00.000Z' });
		expect(v.result).toBe('MISMATCH');
		expect(v.flags).toContain('MISMATCH');
		expect(v.effectiveDeadline).toBe(WK6_EFFECTIVE); // effective is always kickoff-derived
		expect(v.diffMinutes).toBe(-370); // stored is 370 min earlier than effective
	});

	it('ignores drift within the 1-minute tolerance', () => {
		const v = verifyWeekDeadline({ ...base, storedDeadline: '2026-10-15T23:44:30.100Z' });
		expect(v.flags).not.toContain('MISMATCH');
		expect(v.result).toBe('OK');
	});
});

describe('verifyWeekDeadline — early locking', () => {
	it('flags a week locked while its effective deadline is still in the future', () => {
		const v = verifyWeekDeadline({ ...base, status: 'locked', now: BEFORE });
		expect(v.result).toBe('EARLY_LOCK');
		expect(v.flags).toContain('EARLY_LOCK');
	});

	it('does not flag a lock after the effective deadline has passed', () => {
		const v = verifyWeekDeadline({
			...base,
			status: 'locked',
			now: new Date('2026-10-15T23:50:00.000Z')
		});
		expect(v.flags).not.toContain('EARLY_LOCK');
		expect(v.result).toBe('OK');
	});
});

describe('verifyWeekDeadline — deadline boundary (matches pick validation: now >= cutoff rejects)', () => {
	it('flags an open week at exactly the effective deadline', () => {
		const v = verifyWeekDeadline({ ...base, now: new Date('2026-10-15T23:45:00.000Z') });
		expect(v.result).toBe('OPEN_PAST_DEADLINE');
		expect(v.flags).toContain('OPEN_PAST_DEADLINE');
	});

	it('flags an open week after the effective deadline', () => {
		const v = verifyWeekDeadline({ ...base, now: new Date('2026-10-15T23:45:00.001Z') });
		expect(v.flags).toContain('OPEN_PAST_DEADLINE');
	});

	it('does not flag an open week 1ms before the effective deadline', () => {
		const v = verifyWeekDeadline({ ...base, now: new Date('2026-10-15T23:44:59.999Z') });
		expect(v.flags).toEqual([]);
		expect(v.result).toBe('OK');
	});

	it('locked exactly at the effective deadline is not an early lock', () => {
		const v = verifyWeekDeadline({ ...base, status: 'locked', now: new Date(WK6_EFFECTIVE) });
		expect(v.flags).not.toContain('EARLY_LOCK');
	});
});

describe('verifyWeekDeadline — missing data', () => {
	it('flags missing odds for a real season', () => {
		const v = verifyWeekDeadline({ ...base, hasOdds: false, firstKickoffIso: null });
		expect(v.result).toBe('MISSING_DATA');
		expect(v.flags).toContain('MISSING_DATA');
		// stored deadline still resolves as the effective fallback
		expect(v.effectiveDeadline).toBe('2026-10-15T23:45:00.000Z');
	});

	it('flags odds rows that lack a kickoff timestamp', () => {
		const v = verifyWeekDeadline({ ...base, hasOdds: true, firstKickoffIso: null });
		expect(v.result).toBe('MISSING_DATA');
	});

	it('flags a missing stored deadline', () => {
		const v = verifyWeekDeadline({ ...base, storedDeadline: null });
		expect(v.result).toBe('MISSING_DATA');
		// effective still derives from kickoff
		expect(v.effectiveDeadline).toBe(WK6_EFFECTIVE);
		expect(v.storedDeadline).toBeNull();
		expect(v.diffMinutes).toBeNull();
	});

	it('flags an unresolved deadline when neither kickoff nor stored exist', () => {
		const v = verifyWeekDeadline({ ...base, hasOdds: false, firstKickoffIso: null, storedDeadline: null });
		expect(v.result).toBe('MISSING_DATA');
		expect(v.effectiveDeadline).toBeNull();
	});

	it('flags an unparseable stored deadline as missing', () => {
		const v = verifyWeekDeadline({ ...base, storedDeadline: 'not-a-date' });
		expect(v.flags).toContain('MISSING_DATA');
		expect(v.storedDeadline).toBeNull();
	});
});

describe('verifyWeekDeadline — intentional test-season schedules', () => {
	it('test seasons keep their stored deadline and get the informational flag', () => {
		const v = verifyWeekDeadline({
			...base,
			isTest: true,
			storedDeadline: '2026-10-15 18:05:00.000Z' // accelerated test schedule, ≠ kickoff − 30
		});
		expect(v.effectiveDeadline).toBe('2026-10-15T18:05:00.000Z');
		expect(v.flags).toContain('TEST_SCHEDULE');
		expect(v.flags).not.toContain('MISMATCH');
		expect(v.result).toBe('TEST_SCHEDULE'); // informational, not an error
	});

	it('a test season locked before its test deadline is still an early lock', () => {
		const v = verifyWeekDeadline({
			...base,
			isTest: true,
			status: 'locked',
			storedDeadline: '2026-10-15 23:45:00.000Z',
			now: BEFORE
		});
		expect(v.flags).toContain('EARLY_LOCK');
		expect(v.flags).toContain('TEST_SCHEDULE');
		expect(v.result).toBe('EARLY_LOCK'); // real problem outranks the info flag
	});
});

describe('parsePbDate', () => {
	it('parses PocketBase "YYYY-MM-DD HH:mm:ss.SSSZ" values', () => {
		expect(parsePbDate('2026-10-15 23:45:00.000Z')?.toISOString()).toBe(WK6_EFFECTIVE);
	});
	it('parses ISO values unchanged', () => {
		expect(parsePbDate(WK6_EFFECTIVE)?.toISOString()).toBe(WK6_EFFECTIVE);
	});
	it('returns null for empty/invalid values', () => {
		expect(parsePbDate(null)).toBeNull();
		expect(parsePbDate('')).toBeNull();
		expect(parsePbDate('  ')).toBeNull();
		expect(parsePbDate('garbage')).toBeNull();
	});
});

describe('resolveOddsSourceSeason', () => {
	const lms = { id: 'lms1', name: '2026 - 2027 LMS', year: 2027, lmsEnabled: true, secondHalfEnabled: true };
	const sh  = { id: 'sh1',  name: '2026 - 2027 Second Half', year: 2026, lmsEnabled: false, secondHalfEnabled: true };

	it('Second Half seasons resolve to the LMS anchor via the cycle key', () => {
		expect(resolveOddsSourceSeason(sh, [lms, sh]).id).toBe('lms1');
	});

	it('falls back to same-year matching when the cycle key does not match', () => {
		const shOddYear = { ...sh, name: 'Second Half Pool', year: 2027 };
		expect(resolveOddsSourceSeason(shOddYear, [lms, shOddYear]).id).toBe('lms1');
	});

	it('non-Second-Half seasons are their own odds source', () => {
		expect(resolveOddsSourceSeason(lms, [lms, sh]).id).toBe('lms1');
	});

	it('a Second Half season with no anchor falls back to itself', () => {
		expect(resolveOddsSourceSeason(sh, [sh]).id).toBe('sh1');
	});
});
