import { describe, it, expect } from 'vitest';
import {
	seasonSchema,
	entryRequestSchema,
	adminCreateEntriesSchema,
	submitPickSchema,
	recordPickResultSchema,
	paymentSchema
} from '$lib/schemas';

// ── seasonSchema ─────────────────────────────────────────────────────────────

describe('seasonSchema', () => {
	const valid = {
		name:                   'LMS 2027',
		year:                   2027,
		lmsEntryFee:            100,
		secondHalfEntryFee:     50,
		secondHalfPicksPerWeek: 1
	};

	it('accepts a valid season', () => {
		expect(seasonSchema.safeParse(valid).success).toBe(true);
	});

	it('coerces string numbers for year and fees', () => {
		const result = seasonSchema.safeParse({ ...valid, year: '2027', lmsEntryFee: '100', secondHalfEntryFee: '50' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.year).toBe(2027);
			expect(result.data.lmsEntryFee).toBe(100);
		}
	});

	it('rejects year below 2020', () => {
		expect(seasonSchema.safeParse({ ...valid, year: 2019 }).success).toBe(false);
	});

	it('rejects year above 2040', () => {
		expect(seasonSchema.safeParse({ ...valid, year: 2041 }).success).toBe(false);
	});

	it('rejects negative entry fee', () => {
		expect(seasonSchema.safeParse({ ...valid, lmsEntryFee: -10 }).success).toBe(false);
	});

	it('rejects secondHalfPicksPerWeek above 3', () => {
		expect(seasonSchema.safeParse({ ...valid, secondHalfPicksPerWeek: 4 }).success).toBe(false);
	});

	it('rejects secondHalfPicksPerWeek below 1', () => {
		expect(seasonSchema.safeParse({ ...valid, secondHalfPicksPerWeek: 0 }).success).toBe(false);
	});

	it('defaults secondHalfPicksPerWeek to 1 when omitted', () => {
		const { secondHalfPicksPerWeek: _, ...without } = valid;
		const result = seasonSchema.safeParse(without);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.secondHalfPicksPerWeek).toBe(1);
	});

	it('rejects name shorter than 2 characters', () => {
		expect(seasonSchema.safeParse({ ...valid, name: 'X' }).success).toBe(false);
	});
});

// ── entryRequestSchema ────────────────────────────────────────────────────────

describe('entryRequestSchema', () => {
	const valid = {
		seasonId:  'abc123',
		entryType: 'lms' as const,
		entryName: 'Dustin Entry'
	};

	it('accepts a valid lms entry request', () => {
		expect(entryRequestSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts second_half entry type', () => {
		expect(entryRequestSchema.safeParse({ ...valid, entryType: 'second_half' }).success).toBe(true);
	});

	it('rejects unknown entry type', () => {
		expect(entryRequestSchema.safeParse({ ...valid, entryType: 'full_season' }).success).toBe(false);
	});

	it('rejects entry name shorter than 2 characters', () => {
		expect(entryRequestSchema.safeParse({ ...valid, entryName: 'X' }).success).toBe(false);
	});

	it('rejects entry name longer than 50 characters', () => {
		expect(entryRequestSchema.safeParse({ ...valid, entryName: 'A'.repeat(51) }).success).toBe(false);
	});

	it('rejects missing seasonId', () => {
		expect(entryRequestSchema.safeParse({ ...valid, seasonId: '' }).success).toBe(false);
	});
});

// ── adminCreateEntriesSchema ──────────────────────────────────────────────────

describe('adminCreateEntriesSchema', () => {
	const valid = {
		seasonId:  'abc123',
		userId:    'user456',
		entryType: 'lms' as const,
		count:     1,
		baseName:  'Dustin Entry'
	};

	it('accepts valid admin entry creation', () => {
		expect(adminCreateEntriesSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects count above 20', () => {
		expect(adminCreateEntriesSchema.safeParse({ ...valid, count: 21 }).success).toBe(false);
	});

	it('rejects count below 1', () => {
		expect(adminCreateEntriesSchema.safeParse({ ...valid, count: 0 }).success).toBe(false);
	});

	it('coerces string count', () => {
		const result = adminCreateEntriesSchema.safeParse({ ...valid, count: '3' });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.count).toBe(3);
	});
});

// ── submitPickSchema ──────────────────────────────────────────────────────────

describe('submitPickSchema', () => {
	const validLms = {
		entryId:   'entry1',
		weekId:    'week1',
		entryType: 'lms' as const,
		teamIds:   ['team1']
	};

	it('accepts a valid LMS pick (1 team)', () => {
		expect(submitPickSchema.safeParse(validLms).success).toBe(true);
	});

	it('accepts a valid second_half pick with 2 teams', () => {
		const pick = { ...validLms, entryType: 'second_half' as const, teamIds: ['t1', 't2'] };
		expect(submitPickSchema.safeParse(pick).success).toBe(true);
	});

	it('accepts a valid second_half pick with 3 teams', () => {
		const pick = { ...validLms, entryType: 'second_half' as const, teamIds: ['t1', 't2', 't3'] };
		expect(submitPickSchema.safeParse(pick).success).toBe(true);
	});

	it('rejects empty teamIds array', () => {
		expect(submitPickSchema.safeParse({ ...validLms, teamIds: [] }).success).toBe(false);
	});

	it('rejects more than 3 teams', () => {
		expect(submitPickSchema.safeParse({ ...validLms, teamIds: ['t1', 't2', 't3', 't4'] }).success).toBe(false);
	});

	it('rejects missing entryId', () => {
		expect(submitPickSchema.safeParse({ ...validLms, entryId: '' }).success).toBe(false);
	});

	it('rejects missing weekId', () => {
		expect(submitPickSchema.safeParse({ ...validLms, weekId: '' }).success).toBe(false);
	});

	it('rejects invalid entryType', () => {
		expect(submitPickSchema.safeParse({ ...validLms, entryType: 'full' }).success).toBe(false);
	});
});

// ── recordPickResultSchema ────────────────────────────────────────────────────

describe('recordPickResultSchema', () => {
	const valid = { pickId: 'pick1', teamId: 'team1', result: 'correct' as const };

	it('accepts correct result', () => {
		expect(recordPickResultSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts incorrect result', () => {
		expect(recordPickResultSchema.safeParse({ ...valid, result: 'incorrect' }).success).toBe(true);
	});

	it('accepts pending result', () => {
		expect(recordPickResultSchema.safeParse({ ...valid, result: 'pending' }).success).toBe(true);
	});

	it('rejects unknown result value', () => {
		expect(recordPickResultSchema.safeParse({ ...valid, result: 'wrong' }).success).toBe(false);
	});
});

// ── paymentSchema ─────────────────────────────────────────────────────────────

describe('paymentSchema', () => {
	it.each(['check', 'venmo', 'paypal', 'zelle', 'cash', 'free'])(
		'accepts payment method: %s',
		(method) => {
			expect(paymentSchema.safeParse({ entryId: 'e1', paymentMethod: method }).success).toBe(true);
		}
	);

	it('rejects unknown payment method', () => {
		expect(paymentSchema.safeParse({ entryId: 'e1', paymentMethod: 'bitcoin' }).success).toBe(false);
	});
});
