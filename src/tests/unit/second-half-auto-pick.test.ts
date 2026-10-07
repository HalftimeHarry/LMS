import { describe, expect, it } from 'vitest';
import { rankAutoPickTeamsForPool, selectAutoPickForEntry, selectAutoPickTeamForPool } from '$lib/server/auto-pick';

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

describe('rankAutoPickTeamsForPool', () => {
	it('ranks LMS candidates biggest-favourite first', () => {
		const games = [
			{ homeTeam: 'h1', awayTeam: 'a1', homeSpread: -7 },
			{ homeTeam: 'h2', awayTeam: 'a2', homeSpread: -3 },
		];

		expect(rankAutoPickTeamsForPool(games as any[], 'lms')).toEqual(['h1', 'h2', 'a2', 'a1']);
	});

	it('ranks second_half candidates biggest-underdog first', () => {
		const games = [
			{ homeTeam: 'h1', awayTeam: 'a1', homeSpread: -7 },
			{ homeTeam: 'h2', awayTeam: 'a2', homeSpread: 10 },
		];

		expect(rankAutoPickTeamsForPool(games as any[], 'second_half')).toEqual(['h2', 'a1', 'h1', 'a2']);
	});
});

describe('selectAutoPickForEntry', () => {
	it('skips teams the entry has already used', () => {
		expect(selectAutoPickForEntry(['h1', 'h2', 'a2'], new Set(['h1']))).toBe('h2');
	});

	it('returns the top team when nothing is used', () => {
		expect(selectAutoPickForEntry(['h1', 'h2'], new Set())).toBe('h1');
		expect(selectAutoPickForEntry(['h1', 'h2'])).toBe('h1');
	});

	it('falls back to the top team when every candidate is used', () => {
		expect(selectAutoPickForEntry(['h1', 'h2'], new Set(['h1', 'h2']))).toBe('h1');
	});

	it('returns null for an empty board', () => {
		expect(selectAutoPickForEntry([])).toBeNull();
	});
});
