import { describe, expect, it } from 'vitest';
import { selectAutoPickTeamForPool } from '$lib/server/auto-pick';

describe('selectAutoPickTeamForPool', () => {
	it('uses the biggest favorite for LMS entries', () => {
		const games = [
			{ homeTeam: 'h1', awayTeam: 'a1', homeSpread: -7 },
			{ homeTeam: 'h2', awayTeam: 'a2', homeSpread: -3 },
		];

		expect(selectAutoPickTeamForPool(games as any[], 'lms')).toBe('h1');
	});

	it('uses the biggest underdog for second_half entries', () => {
		const games = [
			{ homeTeam: 'h1', awayTeam: 'a1', homeSpread: -7 },
			{ homeTeam: 'h2', awayTeam: 'a2', homeSpread: 10 },
			{ homeTeam: 'h3', awayTeam: 'a3', homeSpread: 4 },
		];

		expect(selectAutoPickTeamForPool(games as any[], 'second_half')).toBe('h2');
	});
});
