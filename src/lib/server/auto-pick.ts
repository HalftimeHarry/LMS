export type AutoPickPoolType = 'lms' | 'second_half';

export type AutoPickGame = {
	homeTeam?: string | null;
	awayTeam?: string | null;
	homeSpread?: number | null;
};

/**
 * Rank every team on the board from most to least preferred as an auto-pick:
 *   LMS:        biggest favourite first (most negative spread)
 *   2nd Half:   biggest underdog first  (most positive spread)
 */
export function rankAutoPickTeamsForPool(
	games: AutoPickGame[],
	poolType: AutoPickPoolType
): string[] {
	if (!Array.isArray(games) || games.length === 0) return [];

	const candidates: { teamId: string; value: number }[] = [];
	for (const game of games) {
		const spread = Number(game.homeSpread);
		if (!Number.isFinite(spread)) continue;
		if (game.homeTeam) candidates.push({ teamId: game.homeTeam, value: spread });
		if (game.awayTeam) candidates.push({ teamId: game.awayTeam, value: -spread });
	}

	// Stable sort keeps game order on tied spreads
	candidates.sort((a, b) => (poolType === 'lms' ? a.value - b.value : b.value - a.value));

	const seen = new Set<string>();
	const ranked: string[] = [];
	for (const c of candidates) {
		if (seen.has(c.teamId)) continue;
		seen.add(c.teamId);
		ranked.push(c.teamId);
	}
	return ranked;
}

export function selectAutoPickTeamForPool(
	games: AutoPickGame[],
	poolType: AutoPickPoolType
): string | null {
	return rankAutoPickTeamsForPool(games, poolType)[0] ?? null;
}

/**
 * Choose the auto-pick for a single entry: the best-ranked team the entry
 * has NOT already used this season. Falls back to the top-ranked team when
 * every candidate has been used (shouldn't happen in practice).
 */
export function selectAutoPickForEntry(
	ranked: string[],
	usedTeamIds?: ReadonlySet<string>
): string | null {
	if (!ranked.length) return null;
	if (usedTeamIds?.size) {
		const eligible = ranked.find((id) => !usedTeamIds.has(id));
		if (eligible) return eligible;
	}
	return ranked[0];
}
