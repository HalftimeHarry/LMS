import { describe, it, expect } from 'vitest';
import { WeekProvider } from '$lib/providers/WeekProvider';

describe('WeekProvider.picksForWeek', () => {
	// LMS always returns 1 regardless of any overrides
	describe('LMS pool type', () => {
		it('returns 1 with no week override', () => {
			expect(WeekProvider.picksForWeek('lms', { secondHalfPicksPerWeek: null }, 1)).toBe(1);
		});

		it('returns 1 even when week has an override', () => {
			expect(WeekProvider.picksForWeek('lms', { secondHalfPicksPerWeek: 3 }, 1)).toBe(1);
		});

		it('returns 1 even when season default is higher', () => {
			expect(WeekProvider.picksForWeek('lms', { secondHalfPicksPerWeek: null }, 3)).toBe(1);
		});
	});

	// Second Half: week override takes precedence over season default
	describe('second_half pool type', () => {
		it('uses week override when set', () => {
			expect(WeekProvider.picksForWeek('second_half', { secondHalfPicksPerWeek: 2 }, 1)).toBe(2);
		});

		it('uses week override of 3', () => {
			expect(WeekProvider.picksForWeek('second_half', { secondHalfPicksPerWeek: 3 }, 1)).toBe(3);
		});

		it('falls back to season default when week override is null', () => {
			expect(WeekProvider.picksForWeek('second_half', { secondHalfPicksPerWeek: null }, 2)).toBe(2);
		});

		it('falls back to season default of 3', () => {
			expect(WeekProvider.picksForWeek('second_half', { secondHalfPicksPerWeek: null }, 3)).toBe(3);
		});

		it('week override of 1 takes precedence over season default of 3', () => {
			expect(WeekProvider.picksForWeek('second_half', { secondHalfPicksPerWeek: 1 }, 3)).toBe(1);
		});
	});
});
