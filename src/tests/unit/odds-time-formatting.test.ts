import { describe, it, expect } from 'vitest';
import { formatGameTimeForDisplay } from '$lib/utils';
import {
	easternAbbreviation,
	easternInputValueToIso,
	formatDeadlineLong,
	hasPassed,
	toEasternInputValue
} from '$lib/time';

describe('formatGameTimeForDisplay', () => {
	it('formats UTC game times in Eastern with the correct DST-aware suffix', () => {
		expect(formatGameTimeForDisplay('2026-09-09T17:20:00.000Z')).toBe('Wed, Sep 9, 1:20 PM EDT');
		expect(formatGameTimeForDisplay('2026-01-03T18:00:00.000Z')).toBe('Sat, Jan 3, 1:00 PM EST');
	});

	it('returns a dash for missing values', () => {
		expect(formatGameTimeForDisplay(null)).toBe('—');
	});
});

describe('Eastern Time utilities', () => {
	it('reports EDT in summer and EST in winter', () => {
		expect(easternAbbreviation('2026-09-10T00:20:00.000Z')).toBe('EDT');
		expect(easternAbbreviation('2026-01-10T18:00:00.000Z')).toBe('EST');
	});

	it('renders deadlines in Eastern regardless of the runtime timezone', () => {
		expect(formatDeadlineLong('2026-09-09T23:40:00.000Z')).toBe(
			'Wednesday, September 9, 2026 at 7:40 PM EDT'
		);
	});

	it('treats a 6:00 PM Pacific check-in as 9:00 PM Eastern', () => {
		const checkIn = '2026-09-10T01:00:00.000Z'; // 6:00 PM PDT
		expect(easternAbbreviation(checkIn)).toBe('EDT');
		expect(formatDeadlineLong(checkIn)).toBe('Wednesday, September 9, 2026 at 9:00 PM EDT');
	});

	it('round-trips datetime-local values through Eastern wall time', () => {
		const iso = '2026-10-16T00:15:00.000Z'; // 8:15 PM EDT
		expect(toEasternInputValue(iso)).toBe('2026-10-15T20:15');
		expect(easternInputValueToIso('2026-10-15T20:15')).toBe(iso);
	});

	it('compares deadlines as absolute instants', () => {
		expect(hasPassed('2026-09-09T23:40:00.000Z', '2026-09-09T23:41:00.000Z')).toBe(true);
		expect(hasPassed('2026-09-09T23:40:00.000Z', '2026-09-09T23:39:00.000Z')).toBe(false);
	});
});
