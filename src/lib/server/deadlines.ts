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

/** Picks close this many minutes before the week's first kickoff. */
export const PICK_DEADLINE_MINUTES = 30;

/**
 * Test seasons (`[TEST]` in the name) run on an intentionally accelerated schedule:
 * their stored `weekly_settings.deadline` values are pushed forward from "now" and
 * are decoupled from real kickoff times. That behavior must be preserved.
 */
export function isTestSeason(season: { name?: string | null } | null | undefined): boolean {
	return Boolean(season?.name?.includes('[TEST]'));
}

/**
 * Resolve the effective pick deadline for a week.
 * - Test seasons: the stored `weekly_settings.deadline` (intentional accelerated schedule).
 * - Real seasons: earliest active `game_odds` kickoff − 30 min; falls back to the stored
 *   deadline when no odds exist. Never derives anything from the `gameTime` mirror.
 */
export function effectivePickDeadline(
	kickoffIso: string | null | undefined,
	storedDeadline: string | null | undefined,
	isTest: boolean
): string | null {
	if (isTest) return storedDeadline ?? null;
	return deriveDeadlineFromKickoff(kickoffIso, PICK_DEADLINE_MINUTES) ?? storedDeadline ?? null;
}

/**
 * PocketBase-SDK variant: fetches the earliest active kickoff for a season/week and
 * resolves the effective pick deadline. Pass the season record (not just the id) so
 * test seasons keep their stored deadlines.
 */
export async function resolveEffectivePickDeadline(
	pb: any,
	season: { id: string; name?: string | null } | null | undefined,
	weekNum: number,
	storedDeadline?: string | null
): Promise<string | null> {
	if (!season) return storedDeadline ?? null;
	if (isTestSeason(season)) return storedDeadline ?? null;
	const odds = await pb.collection('game_odds').getFirstListItem(
		`season = "${season.id}" && week = ${weekNum} && isActive = true`,
		{ sort: 'game_time_stamp', fields: KICKOFF_FIELDS }
	).catch(() => null) as any;
	return effectivePickDeadline(getKickoffIso(odds), storedDeadline, false);
}
