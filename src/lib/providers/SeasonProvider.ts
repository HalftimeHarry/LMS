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
	firstPickDeadline:       string | null;
	notes:                   string | null;
	// Pool toggles — may be absent on older records (treat undefined as true/default)
	lmsEnabled?:              boolean;
	secondHalfEnabled?:       boolean;
	secondHalfStartWeek?:     number;   // week registration opens (default 6)
	secondHalfPicksStartWeek?: number;  // week picks increase to secondHalfPicksPerWeek (default 10)
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
	 * - AND the firstPickDeadline has not yet passed (or is not set)
	 *
	 * Once the season goes 'active' the firstPickDeadline has passed,
	 * so LMS registration closes automatically.
	 */
	static isLmsOpen(season: Season, now = new Date()): boolean {
		if (season.lmsEnabled === false) return false;
		if (season.status !== 'open') return false;
		if (!season.firstPickDeadline) return true;
		return now < new Date(season.firstPickDeadline);
	}

	/**
	 * Second Half entries open when:
	 * - secondHalfEnabled is true (admin toggle)
	 * - Season status is 'active'
	 * - Current week >= secondHalfStartWeek (default 6)
	 *
	 * currentWeek is optional — if not provided the week check is skipped
	 * (admin-side calls that don't have week context still work).
	 */
	static isSecondHalfOpen(season: Season, currentWeek?: number): boolean {
		if (season.secondHalfEnabled === false) return false;
		if (season.status !== 'active') return false;
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
	static defaultEntryType(season: Season, now = new Date(), currentWeek?: number): 'lms' | 'second_half' | null {
		if (SeasonProvider.isLmsOpen(season, now)) return 'lms';
		if (SeasonProvider.isSecondHalfOpen(season, currentWeek)) return 'second_half';
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
