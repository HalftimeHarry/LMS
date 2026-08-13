export type AutoPickPoolType = 'lms' | 'second_half';

export type AutoPickGame = {
	homeTeam?: string | null;
	awayTeam?: string | null;
	homeSpread?: number | null;
};

export function selectAutoPickTeamForPool(
	games: AutoPickGame[],
	poolType: AutoPickPoolType
): string | null {
	if (!Array.isArray(games) || games.length === 0) return null;

	let bestTeamId: string | null = null;
	let bestValue: number = poolType === 'lms' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

	for (const game of games) {
		const spread = Number(game.homeSpread);
		if (!Number.isFinite(spread)) continue;

		const candidates = [
			{ teamId: game.homeTeam ?? null, value: spread },
			{ teamId: game.awayTeam ?? null, value: -spread },
		];

		for (const candidate of candidates) {
			if (!candidate.teamId) continue;

			if (poolType === 'lms') {
				if (candidate.value < bestValue) {
					bestValue = candidate.value;
					bestTeamId = candidate.teamId;
				}
			} else {
				if (candidate.value > bestValue) {
					bestValue = candidate.value;
					bestTeamId = candidate.teamId;
				}
			}
		}
	}

	return bestTeamId;
}
