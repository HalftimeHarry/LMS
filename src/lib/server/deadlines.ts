/** PocketBase `fields` selector for the authoritative kickoff column. */
export const KICKOFF_FIELDS = 'game_time_stamp';

/**
 * `game_time_stamp` is the only authoritative kickoff value. `gameTime` is a
 * PocketBase date mirror serialized as "YYYY-MM-DD HH:mm:ss.SSSZ", which is not
 * valid ISO 8601 and must never be used to derive deadlines.
 */
export function getKickoffIso(odds: Record<string, any> | null | undefined): string | null {
	const value = odds?.game_time_stamp;
	return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function deriveDeadlineFromKickoff(kickoffIso: string | null | undefined, minutesBefore: number): string | null {
	if (!kickoffIso) return null;
	const cutoff = new Date(kickoffIso);
	if (Number.isNaN(cutoff.getTime())) return null;
	cutoff.setMinutes(cutoff.getMinutes() - minutesBefore);
	return cutoff.toISOString();
}

export function getDeadlinePairFromKickoff(
	kickoffIso: string | null | undefined,
	fallbackPickDeadline?: string | null
): { pickDeadline: string | null; entryDeadline: string | null } {
	const pickDeadline = deriveDeadlineFromKickoff(kickoffIso, 30) ?? fallbackPickDeadline ?? null;
	const entryDeadline = deriveDeadlineFromKickoff(kickoffIso, 40);
	return { pickDeadline, entryDeadline };
}
