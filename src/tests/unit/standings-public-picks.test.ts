import { describe, expect, it } from 'vitest';

import { _getActiveEntryIdsForPickBreakdown } from '../../routes/dashboard/standings/+page.server';

describe('standings public pick breakdown', () => {
	it('excludes eliminated entries from live team percentages', () => {
		const entries = [
			{ id: 'a1', status: 'active' },
			{ id: 'a2', status: 'active' },
			{ id: 'e1', status: 'eliminated' },
			{ id: 'e2', status: 'eliminated' },
			{ id: 'p1', status: 'pending_payment' },
		];

		const activeIds = _getActiveEntryIdsForPickBreakdown(entries);
		expect([...activeIds]).toEqual(['a1', 'a2']);
		expect(activeIds.has('e1')).toBe(false);
		expect(activeIds.has('p1')).toBe(false);
	});
});
