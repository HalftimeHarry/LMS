import { describe, it, expect } from 'vitest';
import { formatGameTimeForDisplay } from '$lib/utils';

describe('formatGameTimeForDisplay', () => {
	it('formats UTC game times with an EST suffix', () => {
		expect(formatGameTimeForDisplay('2026-09-09T17:20:00.000Z')).toBe('Wed, Sep 9, 1:20 PM EST');
	});
});
