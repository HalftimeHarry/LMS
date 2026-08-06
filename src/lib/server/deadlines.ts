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
