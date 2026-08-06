import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatGameTimeForDisplay(iso: string | null | undefined): string {
	if (!iso) return '—';

	const formatted = new Date(iso).toLocaleString('en-US', {
		timeZone: 'America/New_York',
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	return `${formatted} EST`;
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
