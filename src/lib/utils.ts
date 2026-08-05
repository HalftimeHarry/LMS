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
