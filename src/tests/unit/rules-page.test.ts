import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rulesPagePath = path.resolve(__dirname, '../../routes/dashboard/rules/+page.svelte');
const rulesText = fs.readFileSync(rulesPagePath, 'utf8');

describe('public rules', () => {
	it('contains the LMS zero-survivor split-pot explanation', () => {
		expect(rulesText).toContain('What Happens If Everyone Is Eliminated?');
		expect(rulesText).toContain('In the main LMS pool, if every remaining entry is eliminated during the same week');
		expect(rulesText).toContain('1/10 of the pot');
		expect(rulesText).toContain('Shares are awarded per entry, not per person');
		expect(rulesText).toContain('All relevant game results must be final before payouts are confirmed.');
	});

	it('keeps the Second Half zero-survivor explanation on cumulative scoring and equal splits', () => {
		expect(rulesText).toContain('In the Second Half Pool, each entry must correctly select the required number of winning NFL teams each week to remain alive.');
		expect(rulesText).toContain('If every remaining entry is eliminated during the same week');
		expect(rulesText).toContain('cumulative correct picks across the Second Half pool');
		expect(rulesText).toContain('split the Second Half pot equally, per entry');
		expect(rulesText).toContain('All relevant NFL game results must be final before winners and payouts are confirmed.');
	});

	it('clearly states the two-pick weekly survival requirement', () => {
		expect(rulesText).toContain('Weeks 6–9 require');
		expect(rulesText).toContain('Week 10 onward');
		expect(rulesText).toContain('pick <strong class="text-white">two teams</strong> and both must win');
		expect(rulesText).toContain('both must win');
	});

	it('shows the cumulative-scoring example for tied leaders', () => {
		expect(rulesText).toContain('Ten entries remain entering Week 10.');
		expect(rulesText).toContain('four entries are tied at 12 correct picks');
		expect(rulesText).toContain('split the Second Half pot equally, per entry');
	});

	it('removes contradictory zero-survivor language and stale deadlines', () => {
		expect(rulesText).not.toContain('Picks need to be in by 9:55 AM EST.');
		expect(rulesText).not.toContain('Picks from previous weeks do not count toward this tiebreaker');
		expect(rulesText).not.toContain('approved tiebreaker procedure');
		expect(rulesText).not.toContain('number of correct picks made during that final elimination week');
	});

	it('is visible through the public rules interface', () => {
		expect(rulesText).toContain('Second Half Pool Rules');
		expect(rulesText).toContain('What Happens If Everyone Is Eliminated?');
	});
});
