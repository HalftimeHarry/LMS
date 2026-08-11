import { describe, it, expect } from 'vitest';
import { isAddEntriesDisabledByPoolFilter } from '../../lib/utils';

describe('admin entries UI gating - Add Entries disabled state', () => {
	it('disables for LMS filter only when LMS deadline has passed', () => {
		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'lms',
			lmsDeadlinePast: false,
			secondHalfDeadlinePast: true
		})).toBe(false);

		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'lms',
			lmsDeadlinePast: true,
			secondHalfDeadlinePast: false
		})).toBe(true);
	});

	it('disables for 2nd Half filter only when 2nd Half deadline has passed', () => {
		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'second_half',
			lmsDeadlinePast: true,
			secondHalfDeadlinePast: false
		})).toBe(false);

		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'second_half',
			lmsDeadlinePast: false,
			secondHalfDeadlinePast: true
		})).toBe(true);
	});

	it('for All entries, stays enabled while at least one pool is open', () => {
		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'all',
			lmsDeadlinePast: false,
			secondHalfDeadlinePast: false
		})).toBe(false);

		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'all',
			lmsDeadlinePast: true,
			secondHalfDeadlinePast: false
		})).toBe(false);

		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'all',
			lmsDeadlinePast: false,
			secondHalfDeadlinePast: true
		})).toBe(false);

		expect(isAddEntriesDisabledByPoolFilter({
			poolType: 'all',
			lmsDeadlinePast: true,
			secondHalfDeadlinePast: true
		})).toBe(true);
	});
});
