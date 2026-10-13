import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rulesPagePath = path.resolve(__dirname, '../../routes/dashboard/rules/+page.svelte');
const rulesText = fs.readFileSync(rulesPagePath, 'utf8');

describe('2nd Half public rules', () => {
	it('contains the zero-survivor winner-resolution explanation', () => {
		expect(rulesText).toContain('What Happens If Everyone Is Eliminated?');
		expect(rulesText).toContain('If every remaining entry is eliminated during the same week');
		expect(rulesText).toContain('most correct picks');
		expect(rulesText).toContain('All relevant NFL game results must be final before a winner is confirmed.');
	});

	it('clearly states the two-pick weekly survival requirement', () => {
		expect(rulesText).toContain('Week 10');
		expect(rulesText).toContain('pick <strong class="text-white">2 teams</strong> per week — both must win');
		expect(rulesText).toContain('two winning teams');
	});

	it('shows the example for the final-week tiebreaker', () => {
		expect(rulesText).toContain('Ten entries remain entering Week 10');
		expect(rulesText).toContain('Four entries correctly pick one of their two teams');
		expect(rulesText).toContain('tied for the highest position');
	});

	it('does not promise an arbitrary winner when multiple entries tie', () => {
		expect(rulesText).toContain('those entries remain tied for the winning position');
		expect(rulesText).not.toContain('will be declared the sole winner');
	});

	it('is visible through the public rules interface', () => {
		expect(rulesText).toContain('Second Half Pool Rules');
		expect(rulesText).toContain('What Happens If Everyone Is Eliminated?');
	});
});
