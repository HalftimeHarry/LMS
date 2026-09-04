/**
 * Canonical time handling for player-facing surfaces.
 *
 * All instants are stored in UTC. Everything a player sees, and every business
 * rule that decides whether a player is early, on time, or late, resolves
 * against Eastern Time — never the browser or server timezone.
 */

export const PLAYER_TIME_ZONE = 'America/New_York';

/** Admin surfaces intentionally stay on Pacific Time. */
export const ADMIN_TIME_ZONE = 'America/Los_Angeles';

export type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
	if (value == null || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** "EST" or "EDT" for the given instant (defaults to now). */
export function easternAbbreviation(value?: DateInput): string {
	const date = toDate(value) ?? new Date();
	const part = new Intl.DateTimeFormat('en-US', {
		timeZone: PLAYER_TIME_ZONE,
		timeZoneName: 'short'
	})
		.formatToParts(date)
		.find((p) => p.type === 'timeZoneName');
	return part?.value ?? 'ET';
}

/** Eastern UTC offset in minutes for the given instant (-300 for EST, -240 for EDT). */
export function easternOffsetMinutes(value: DateInput): number {
	const date = toDate(value) ?? new Date();
	const label = new Intl.DateTimeFormat('en-US', {
		timeZone: PLAYER_TIME_ZONE,
		timeZoneName: 'shortOffset'
	})
		.formatToParts(date)
		.find((p) => p.type === 'timeZoneName')?.value;

	const match = String(label ?? '').match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
	if (!match) return -300;
	const sign = match[1] === '+' ? 1 : -1;
	return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Base formatter. Always renders in Eastern with the correct EST/EDT suffix. */
export function formatEastern(
	value: DateInput,
	options: Intl.DateTimeFormatOptions,
	fallback = '—'
): string {
	const date = toDate(value);
	if (!date) return fallback;
	return date.toLocaleString('en-US', {
		timeZone: PLAYER_TIME_ZONE,
		timeZoneName: 'short',
		...options
	});
}

/** "Wed, Sep 9, 8:20 PM EDT" */
export function formatKickoff(value: DateInput, fallback = '—'): string {
	return formatEastern(
		value,
		{ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
		fallback
	);
}

/** "Wednesday, September 9, 2026 at 7:40 PM EDT" */
export function formatDeadlineLong(value: DateInput, fallback = 'TBD'): string {
	return formatEastern(
		value,
		{
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		},
		fallback
	);
}

/** "4:40 PM PDT" — clock time only, in Pacific. */
export function formatPacificTime(value: DateInput, fallback = ''): string {
	const date = toDate(value);
	if (!date) return fallback;
	return date.toLocaleTimeString('en-US', {
		timeZone: ADMIN_TIME_ZONE,
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	});
}

/** "Wednesday, September 9, 2026 at 7:40 PM EDT (4:40 PM PDT)" */
export function formatDeadlineLongDual(value: DateInput, fallback = 'TBD'): string {
	const eastern = formatDeadlineLong(value, fallback);
	const pacific = formatPacificTime(value);
	return pacific ? `${eastern} (${pacific})` : eastern;
}

/** "Wed, Sep 9, 7:40 PM EDT" */
export function formatDeadlineShort(value: DateInput, fallback = 'TBD'): string {
	return formatEastern(
		value,
		{ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
		fallback
	);
}

/** "September 9, 2026 at 7:40 PM EDT" */
export function formatEasternDateTime(value: DateInput, fallback = 'TBD'): string {
	return formatEastern(
		value,
		{ month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
		fallback
	);
}

/** "Sep 9" — date only, no timezone suffix. */
export function formatEasternDate(value: DateInput, fallback = 'TBD'): string {
	const date = toDate(value);
	if (!date) return fallback;
	return date.toLocaleDateString('en-US', {
		timeZone: PLAYER_TIME_ZONE,
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Whether the instant has passed. Both sides are absolute UTC instants, so a
 * player in California and a player in New York get the same verdict.
 */
export function hasPassed(deadline: DateInput, now: DateInput = new Date()): boolean {
	const cutoff = toDate(deadline);
	const current = toDate(now);
	if (!cutoff || !current) return false;
	return current.getTime() > cutoff.getTime();
}

/** Milliseconds until the deadline; negative once it has passed. */
export function msUntil(deadline: DateInput, now: DateInput = new Date()): number | null {
	const cutoff = toDate(deadline);
	const current = toDate(now);
	if (!cutoff || !current) return null;
	return cutoff.getTime() - current.getTime();
}

/** Renders a UTC instant as the "YYYY-MM-DDTHH:mm" Eastern wall time a `datetime-local` input expects. */
export function toEasternInputValue(value: DateInput): string {
	const date = toDate(value);
	if (!date) return '';
	const shifted = new Date(date.getTime() + easternOffsetMinutes(date) * 60_000);
	return shifted.toISOString().slice(0, 16);
}

/** Parses a `datetime-local` value as Eastern wall time and returns the UTC instant. */
export function easternInputValueToIso(value: string | null | undefined): string | null {
	if (!value) return null;
	const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	if (!match) return null;

	const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
	let utcMs = Date.UTC(year, month - 1, day, hour, minute);

	// Two passes settle the offset across DST boundaries.
	for (let i = 0; i < 2; i++) {
		const next = Date.UTC(year, month - 1, day, hour, minute) - easternOffsetMinutes(utcMs) * 60_000;
		if (next === utcMs) break;
		utcMs = next;
	}

	return new Date(utcMs).toISOString();
}
