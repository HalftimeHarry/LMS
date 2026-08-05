import type PocketBase from 'pocketbase';
import { BaseProvider } from './BaseProvider';

export interface Season {
	id:                      string;
	name:                    string;
	year:                    number;
	status:                  'setup' | 'open' | 'active' | 'complete';
	lmsEntryFee:             number;
	secondHalfEntryFee:      number;
	secondHalfPicksPerWeek:  number;
	regularSeasonOnly:       boolean;
	paymentDeadline:         string | null;
	notes:                   string | null;
	// Pool toggles — may be absent on older records (treat undefined as true/default)
	lmsEnabled?:              boolean;
	secondHalfEnabled?:       boolean;
	secondHalfStartWeek?:     number;   // week registration opens (default 6)
	secondHalfPicksStartWeek?: number;  // week picks increase to secondHalfPicksPerWeek (default 10)
	// Shared operating cost deducted proportionally from each pool's payout
	maintenanceFee?:          number;
}

export class SeasonProvider extends BaseProvider {
	protected get collection() { return 'seasons'; }

	constructor(pb: PocketBase) { super(pb); }

	/** All seasons sorted newest first. */
	async getAll(): Promise<Season[]> {
		return this.pb.collection(this.collection)
			.getFullList<Season>({ sort: '-year' });
	}

	/** The current active or open season, or null if none. */
	async getActive(): Promise<Season | null> {
		const all = await this.getAll();
		return all.find(s => s.status === 'active' || s.status === 'open') ?? null;
	}

	/** Single season by id. */
	async getById(id: string): Promise<Season> {
		return this.pb.collection(this.collection).getOne<Season>(id);
	}

	// ── Entry window helpers ──────────────────────────────────────────────────
	// These are the single source of truth for whether a participant can
	// self-register a given entry type. Admin actions bypass these checks.

	/**
	 * LMS entries are open when:
	 * - lmsEnabled is true (admin toggle)
	 * - Season status is 'open' (pre-season registration)
	 *
	 * Deadline enforcement now happens from game_odds kickoff cutoffs
	 * (30 minutes before first active game for the relevant week).
	 */
	static isLmsOpen(season: Season, _now = new Date()): boolean {
		if (season.lmsEnabled === false) return false;
		if (season.status !== 'open') return false;
		return true;
	}

	/**
	 * Second Half entries open when:
	 * - secondHalfEnabled is true (admin toggle)
	 * - Season status is 'active'
	 * - Now is before the week-6 pick deadline (when week6Deadline is provided)
	 *   OR current week >= secondHalfStartWeek (legacy fallback when no deadline given)
	 *
	 * week6Deadline: ISO string of the weekly_settings.deadline for week 6 of the
	 * paired LMS season. When provided this is the canonical entry cutoff — players
	 * must register before the first week-6 game kicks off.
	 *
	 * currentWeek is used as a fallback when week6Deadline is not available.
	 */
	static isSecondHalfOpen(
		season:        Season,
		currentWeek?:  number,
		week6Deadline?: string | null,
		now = new Date()
	): boolean {
		if (season.secondHalfEnabled === false) return false;
		if (season.status !== 'active') return false;

		if (week6Deadline) {
			// Primary: entry window closes at the week-6 pick deadline
			return now < new Date(week6Deadline);
		}

		// Fallback: use week number when no deadline record exists yet
		if (currentWeek !== undefined) {
			const startWeek = season.secondHalfStartWeek ?? 6;
			if (currentWeek < startWeek) return false;
		}
		return true;
	}

	/**
	 * Returns the default entry type a participant should see
	 * based on what is currently open.
	 * - If LMS is open → 'lms'
	 * - If only Second Half is open → 'second_half'
	 * - If neither is open → null (registration closed)
	 */
	static defaultEntryType(
		season:         Season,
		now             = new Date(),
		currentWeek?:   number,
		week6Deadline?: string | null
	): 'lms' | 'second_half' | null {
		if (SeasonProvider.isLmsOpen(season, now)) return 'lms';
		if (SeasonProvider.isSecondHalfOpen(season, currentWeek, week6Deadline, now)) return 'second_half';
		return null;
	}

	/**
	 * How many picks a Second Half entry should make in a given week.
	 * Returns 1 before secondHalfPicksStartWeek (default 10),
	 * then secondHalfPicksPerWeek (default 2) from that week onward.
	 */
	static secondHalfPicksForWeek(season: Season, weekNumber: number): number {
		const startWeek = season.secondHalfPicksStartWeek ?? 10;
		if (weekNumber < startWeek) return 1;
		return season.secondHalfPicksPerWeek ?? 2;
	}
}
