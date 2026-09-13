export function isWeekResultsComplete(gamesEntered: number, gamesTotal: number): boolean {
	if (!Number.isFinite(gamesEntered) || !Number.isFinite(gamesTotal)) return false;
	if (gamesTotal <= 0) return false;
	return gamesEntered >= gamesTotal;
}
