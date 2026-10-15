import { effectivePickDeadline } from './deadlines';

/**
 * Pure deadline-verification logic for the /admin/verify-deadlines report.
 * No PocketBase calls in here — the page assembles inputs, this module decides flags.
 */

/** Stored vs effective drift at or below this is considered a match. */
export const DEADLINE_TOLERANCE_MS = 60_000;

export type VerificationFlag =
	| 'MISSING_DATA'        // no odds / no kickoff timestamp / no stored deadline / unresolved
	| 'EARLY_LOCK'          // week is locked while its effective deadline is still in the future
	| 'OPEN_PAST_DEADLINE'  // week is open at or after its effective deadline
	| 'MISMATCH'            // stored deadline differs from effective deadline
	| 'TEST_SCHEDULE';      // intentional test-season schedule (informational, not an error)

export interface VerificationInput {
	week: number;
	status: string;
	/** Raw weekly_settings.deadline (PocketBase "YYYY-MM-DD HH:mm:ss.SSSZ" or ISO). */
	storedDeadline: string | null | undefined;
	/** Earliest active game_time_stamp for the week (ISO), or null when none. */
	firstKickoffIso: string | null | undefined;
	/** Whether the week has any active game_odds rows at all. */
	hasOdds: boolean;
	isTest: boolean;
	now: Date | number;
}

export interface DeadlineVerification {
	week: number;
	status: string;
	/** ISO 8601, or null when the stored value is missing/unparseable. */
	storedDeadline: string | null;
	/** ISO 8601, or null when no deadline can be resolved. */
	effectiveDeadline: string | null;
	/** stored − effective in minutes (positive = stored is later). Null when either side is missing. */
	diffMinutes: number | null;
	flags: VerificationFlag[];
	/** Highest-severity flag, or OK. TEST_SCHEDULE alone is informational. */
	result: VerificationFlag | 'OK';
}

/** Parse a PocketBase date ("YYYY-MM-DD HH:mm:ss.SSSZ") or ISO string. Never guesses. */
export function parsePbDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Verify one week's stored deadline against the shared effective pick deadline
 * (kickoff − 30 min; stored schedule for test seasons).
 *
 * Boundary semantics match pick validation exactly: `now >= effective` means the
 * deadline has passed (picks rejected), `now < effective` means it is still open.
 */
export function verifyWeekDeadline(input: VerificationInput): DeadlineVerification {
	const nowMs = input.now instanceof Date ? input.now.getTime() : input.now;

	const storedDate = parsePbDate(input.storedDeadline);
	const storedIso  = storedDate ? storedDate.toISOString() : null;

	// Shared effective-deadline rule — test seasons keep their intentional stored schedule.
	const effectiveIso  = effectivePickDeadline(input.firstKickoffIso ?? null, storedIso, input.isTest);
	const effectiveDate = parsePbDate(effectiveIso);
	const effectiveMs   = effectiveDate ? effectiveDate.getTime() : null;

	const flags: VerificationFlag[] = [];

	if (!input.hasOdds || !input.firstKickoffIso || !storedDate || effectiveMs === null) {
		flags.push('MISSING_DATA');
	}

	let diffMinutes: number | null = null;
	if (storedDate && effectiveMs !== null) {
		diffMinutes = Math.round((storedDate.getTime() - effectiveMs) / 60_000);
		if (Math.abs(storedDate.getTime() - effectiveMs) > DEADLINE_TOLERANCE_MS) {
			flags.push('MISMATCH');
		}
	}

	if (effectiveMs !== null) {
		if (input.status === 'locked' && nowMs < effectiveMs) flags.push('EARLY_LOCK');
		if (input.status === 'open'   && nowMs >= effectiveMs) flags.push('OPEN_PAST_DEADLINE');
	}

	if (input.isTest) flags.push('TEST_SCHEDULE');

	const result =
		(['MISSING_DATA', 'EARLY_LOCK', 'OPEN_PAST_DEADLINE', 'MISMATCH'] as const)
			.find((f) => flags.includes(f))
		?? (flags.includes('TEST_SCHEDULE') ? 'TEST_SCHEDULE' : 'OK');

	return {
		week: input.week,
		status: input.status,
		storedDeadline: storedIso,
		effectiveDeadline: effectiveMs !== null ? new Date(effectiveMs).toISOString() : null,
		diffMinutes,
		flags,
		result
	};
}

/**
 * Which season's game_odds apply to the given season. Mirrors the existing
 * season/game lookup rules: a Second Half season resolves to the LMS anchor
 * with the same "YYYY-YYYY" cycle key, then same year, then itself.
 */
export function resolveOddsSourceSeason(
	season: { id: string; name?: string | null; year?: number | string | null; lmsEnabled?: boolean; secondHalfEnabled?: boolean; secondHalfStartWeek?: number | null },
	allSeasons: Array<{ id: string; name?: string | null; year?: number | string | null; lmsEnabled?: boolean; secondHalfEnabled?: boolean; secondHalfStartWeek?: number | null }>
): typeof season {
	const isSecondHalf = (s: typeof season): boolean =>
		!!s && ((s.lmsEnabled === false && s.secondHalfEnabled !== false)
			|| String(s.name ?? '').toLowerCase().includes('second half'));

	if (!isSecondHalf(season)) return season;

	const cycleKey = (s: typeof season): string | null => {
		const match = String(s?.name ?? '').match(/(\d{4}\s*-\s*\d{4})/);
		return match ? match[1].replace(/\s+/g, '') : null;
	};

	const key = cycleKey(season);
	const byCycle = key
		? allSeasons.find((c) => c.id !== season.id && !isSecondHalf(c) && cycleKey(c) === key)
		: null;
	if (byCycle) return byCycle;

	const yearKey = String(season.year ?? '');
	const byYear = allSeasons.find((c) =>
		c.id !== season.id && !isSecondHalf(c) && String(c.year ?? '') === yearKey
	);
	return byYear ?? season;
}
