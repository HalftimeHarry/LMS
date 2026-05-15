/**
 * Returns the home route for a given role.
 * pool_admin and super_admin manage the pool — they have no participant dashboard.
 */
export function roleHome(role: string | null): string {
	return role === 'super_admin' || role === 'pool_admin' ? '/admin' : '/dashboard';
}

/**
 * Returns true if the role should be blocked from participant dashboard routes.
 * Rules and standings are exempt — they are visible to all authenticated users.
 */
export function isAdminRole(role: string | null): boolean {
	return role === 'super_admin' || role === 'pool_admin';
}

/**
 * Resolves how many picks are required for a given entry type this week.
 * LMS always requires exactly 1 (pick the loser).
 * Second Half uses the week-level override if set, otherwise falls back to the season default.
 */
export function picksRequired(
	entryType: 'lms' | 'second_half',
	weekOverride: number | null | undefined,
	seasonDefault: number | null | undefined
): number {
	if (entryType === 'lms') return 1;
	return weekOverride ?? seasonDefault ?? 1;
}
