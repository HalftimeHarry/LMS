import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatKickoff } from '$lib/time';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatGameTimeForDisplay(iso: string | null | undefined): string {
	return formatKickoff(iso, '—');
}

export function formatCountdownDisplay(diff: number, live: boolean): string {
	if (!live || !Number.isFinite(diff)) return '—';
	const totalSeconds = Math.max(0, Math.floor(diff / 1_000));
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;
	return `${days > 0 ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function resolveCardCountdownDisplay({
	isSecondHalfPending,
	registrationDiffMs,
	registrationLive,
	picksDiffMs,
	picksLive
}: {
	isSecondHalfPending: boolean;
	registrationDiffMs: number;
	registrationLive: boolean;
	picksDiffMs: number;
	picksLive: boolean;
}): string {
	if (isSecondHalfPending && registrationLive) {
		return formatCountdownDisplay(registrationDiffMs, registrationLive);
	}

	return formatCountdownDisplay(picksDiffMs, picksLive);
}

export function resolveStatusLabelText(_isLoggedIn: boolean, label: string): string {
	return label;
}

export function isAddEntriesDisabledByPoolFilter({
	poolType,
	lmsDeadlinePast,
	secondHalfDeadlinePast
}: {
	poolType: 'all' | 'lms' | 'second_half' | string;
	lmsDeadlinePast: boolean;
	secondHalfDeadlinePast: boolean;
}): boolean {
	if (poolType === 'lms') return lmsDeadlinePast;
	if (poolType === 'second_half') return secondHalfDeadlinePast;
	// "All entries" should stay enabled as long as at least one pool is still open.
	return lmsDeadlinePast && secondHalfDeadlinePast;
}
