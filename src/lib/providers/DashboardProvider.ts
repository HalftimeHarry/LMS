export type DashboardPoolType = 'lms' | 'second_half';

export interface DashboardPoolCardViewModel {
	type: DashboardPoolType;
	title: string;
	subtitle: string;
	weekLabel: string;
	entryDeadline: string | null;
	pickDeadline: string | null;
	registrationLabel: string;
	registrationClosed: boolean;
	picksLabel: string;
	registrationLive: boolean;
	picksLive: boolean;
	registrationUrgent: boolean;
	picksUrgent: boolean;
	registrationDeadlinePassed: boolean;
	picksDeadlinePassed: boolean;
	registrationDiffMs: number;
	picksDiffMs: number;
	footerMessage: string;
	ctaHref: string | null;
	ctaText: string | null;
	myEntryCount: number;
	userHasEntry: boolean;
}

interface DashboardPoolCardInput {
	type: DashboardPoolType;
	season: { id: string; status?: string | null; secondHalfEnabled?: boolean | null; secondHalfStartWeek?: number | null };
	currentWeek: { week: number; status: string; entryDeadline?: string | null; pickDeadline?: string | null } | null;
	week6Week: { week: number; status: string; entryDeadline?: string | null; pickDeadline?: string | null } | null;
	now: number;
	entries: unknown[];
	myEntryCount: number;
	userHasEntry: boolean;
	shStartWeek?: number;
}

export class DashboardProvider {
	static buildPoolCardViewModel(input: DashboardPoolCardInput): DashboardPoolCardViewModel {
		const shStartWeek = input.shStartWeek ?? 6;
		const seasonAllowsLmsRegistration = input.season.status === 'open';
		const beforeStart = !input.currentWeek || input.currentWeek.week < shStartWeek;
		const currentPickWeek = input.currentWeek;
		const secondHalfRegistrationWeek = input.type === 'second_half' && beforeStart ? (input.week6Week ?? input.currentWeek) : null;
		const lmsRegistrationClosedBySecondHalf = input.type === 'lms' && (!!input.currentWeek && input.currentWeek.week >= shStartWeek);
		const lmsRegistrationClosedByStatus = input.type === 'lms' && !seasonAllowsLmsRegistration;
		const entryDeadline = input.type === 'second_half'
			? (beforeStart ? (secondHalfRegistrationWeek?.entryDeadline ?? null) : null)
			: (lmsRegistrationClosedBySecondHalf || lmsRegistrationClosedByStatus) ? null : (input.currentWeek?.entryDeadline ?? null);
		const pickDeadline = currentPickWeek?.pickDeadline ?? null;

		const entryDeadlineTime = entryDeadline ? new Date(entryDeadline).getTime() : NaN;
		const pickDeadlineTime = pickDeadline ? new Date(pickDeadline).getTime() : NaN;
		const entryDiffMs = Number.isFinite(entryDeadlineTime) ? entryDeadlineTime - input.now : 0;
		const pickDiffMs = Number.isFinite(pickDeadlineTime) ? pickDeadlineTime - input.now : 0;
		const entryLive = input.type === 'second_half'
			? !!secondHalfRegistrationWeek && secondHalfRegistrationWeek.status === 'open' && Number.isFinite(entryDeadlineTime) && entryDiffMs > 0
			: !(lmsRegistrationClosedBySecondHalf || lmsRegistrationClosedByStatus)
				&& !!input.currentWeek
				&& input.currentWeek.status === 'open'
				&& Number.isFinite(entryDeadlineTime)
				&& entryDiffMs > 0;
		const entryDeadlinePassed = input.type === 'second_half'
			? !!secondHalfRegistrationWeek && Number.isFinite(entryDeadlineTime) && entryDiffMs <= 0
			: lmsRegistrationClosedBySecondHalf || lmsRegistrationClosedByStatus || (Number.isFinite(entryDeadlineTime) && entryDiffMs <= 0);
		const pickLive = input.type === 'lms'
			? !!input.currentWeek && input.currentWeek.status === 'open' && Number.isFinite(pickDeadlineTime) && pickDiffMs > 0
			: !beforeStart && input.currentWeek?.status === 'open' && Number.isFinite(pickDeadlineTime) && pickDiffMs > 0;
		const pickDeadlinePassed = Number.isFinite(pickDeadlineTime) && pickDiffMs <= 0;
		const registrationClosed = input.type === 'second_half'
			? (beforeStart ? !!entryDeadline && entryDeadlinePassed : true)
			: (lmsRegistrationClosedBySecondHalf || lmsRegistrationClosedByStatus || (!!entryDeadline && entryDeadlinePassed));
		const registrationLabel = input.type === 'second_half'
			? (beforeStart
				? (entryDeadline ? (entryDeadlinePassed ? 'Registration closed' : 'Registration open') : 'Registration TBD')
				: 'Registration closed')
			: (lmsRegistrationClosedBySecondHalf || lmsRegistrationClosedByStatus)
				? 'Season registration closed'
				: (entryDeadline ? (entryDeadlinePassed ? 'Registration closed' : 'Registration open') : 'Registration TBD');
		const picksLabel = input.type === 'lms'
			? (pickDeadline ? (pickDeadlinePassed ? 'Pick deadline closed' : 'Picks open') : 'Picks TBD')
			: (beforeStart ? 'Picks pending' : (pickDeadline ? (pickDeadlinePassed ? 'Pick deadline closed' : 'Picks open') : 'Picks TBD'));
		const registrationUrgent = entryLive && entryDiffMs < 3_600_000;
		const picksUrgent = pickLive && pickDiffMs < 3_600_000;

		const footerMessage = input.type === 'lms'
			? ((lmsRegistrationClosedBySecondHalf || lmsRegistrationClosedByStatus)
				? 'LMS registration is closed for this season. Picks remain open until the current deadline.'
				: (pickDeadline && !pickDeadlinePassed
					? (picksUrgent ? '⚠ Deadline closing soon — submit your pick now.' : 'Picks are open. Submit or update your pick from each active entry below before the deadline.')
					: (pickDeadline && pickDeadlinePassed
						? 'Deadline passed. Picks are locked — no changes until results are posted.'
						: 'Picks are open. Submit or update your pick from each active entry below before the deadline.')))
			: (beforeStart && entryLive && input.myEntryCount === 0
				? 'Registration is open. Register now to join the pool.'
				: beforeStart && entryLive && input.userHasEntry
				? 'You\'re registered. Picks open at Week 6.'
				: beforeStart && !entryLive
					? 'Registration is closed.'
					: pickDeadline && pickDeadlinePassed
						? 'Deadline passed. Picks are locked — no changes until results are posted.'
						: 'Picks are open. Submit or update your Second Half pick before the deadline.');

		return {
			type: input.type,
			title: input.type === 'lms' ? 'Last Man Standing' : 'Second Half Pool',
			subtitle: input.type === 'lms' ? 'LOSER' : 'WINNER',
			weekLabel: input.type === 'lms' ? `Week ${input.currentWeek?.week ?? 1}` : (beforeStart ? `Week ${shStartWeek}` : `Week ${input.currentWeek?.week ?? shStartWeek}`),
			entryDeadline,
			pickDeadline,
			registrationLabel,
			registrationClosed,
			picksLabel,
			registrationLive: entryLive,
			picksLive: pickLive,
			registrationUrgent,
			picksUrgent,
			registrationDeadlinePassed: entryDeadlinePassed,
			picksDeadlinePassed: pickDeadlinePassed,
			registrationDiffMs: entryDiffMs,
			picksDiffMs: pickDiffMs,
			footerMessage,
			ctaHref: input.type === 'second_half' && beforeStart && entryLive ? '/dashboard/entries/new' : null,
			ctaText: input.type === 'second_half' && beforeStart && entryLive ? 'Register now →' : null,
			myEntryCount: input.myEntryCount,
			userHasEntry: input.userHasEntry
		};
	}
}
