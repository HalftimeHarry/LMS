import type { Week, WeekStatus } from '$lib/providers';
import type { EntryType } from '$lib/providers';

/**
 * Controller for the admin weekly settings view.
 *
 * Owns:
 * - Pool type scope: which pool type the admin is currently configuring
 * - Season scope: which season is selected
 * - Filtered week list (second_half only shows weeks >= 10)
 * - Per-week favorite team selection state
 * - Loading/error state for inline actions
 */
export function createWeeksController(initialWeeks: Week[] = [], initialPoolType: EntryType = 'lms', shStartWeek = 6) {
	// ── Scope ─────────────────────────────────────────────────────────────────
	let poolType  = $state<EntryType>(initialPoolType);
	let seasonId  = $state('');

	// ── Week data ─────────────────────────────────────────────────────────────
	let weeks     = $state<Week[]>(initialWeeks);

	// Per-week favorite team selection (keyed by week id)
	let favoriteTeam = $state<Record<string, string>>({});

	// ── Derived filtered weeks ────────────────────────────────────────────────
	// Second Half pool only plays from secondHalfStartWeek onward
	const filtered = $derived(() =>
		poolType === 'second_half'
			? weeks.filter(w => w.week >= shStartWeek)
			: weeks
	);

	// ── Status progression ────────────────────────────────────────────────────
	const STATUS_NEXT: Record<WeekStatus, WeekStatus | null> = {
		open:            'locked',
		locked:          'results_pending',
		results_pending: 'complete',
		complete:        null
	};

	const STATUS_LABEL: Record<WeekStatus, string> = {
		open:            'Lock Week',
		locked:          'Results Pending',
		results_pending: 'Mark Complete',
		complete:        'Complete'
	};

	function nextStatus(current: WeekStatus): WeekStatus | null {
		return STATUS_NEXT[current];
	}

	function advanceLabel(current: WeekStatus): string {
		return STATUS_LABEL[current];
	}

	// ── Sync ──────────────────────────────────────────────────────────────────
	function setWeeks(next: Week[]) {
		weeks = next;
		// Seed favorite team state from loaded data
		for (const w of next) {
			if (!(w.id in favoriteTeam)) {
				favoriteTeam[w.id] = w.biggestFavoriteTeam ?? '';
			}
		}
	}

	function setFavoriteTeam(weekId: string, teamId: string) {
		favoriteTeam = { ...favoriteTeam, [weekId]: teamId };
	}

	return {
		// Scope
		get poolType()   { return poolType; },
		set poolType(v)  { poolType = v; },
		get seasonId()   { return seasonId; },
		set seasonId(v)  { seasonId = v; },

		// Data
		get weeks()      { return weeks; },
		get filtered()   { return filtered(); },
		get favoriteTeam(){ return favoriteTeam; },

		// Methods
		setWeeks,
		setFavoriteTeam,
		nextStatus,
		advanceLabel
	};
}

export type WeeksController = ReturnType<typeof createWeeksController>;
