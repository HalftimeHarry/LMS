import type PocketBase from 'pocketbase';
import { BaseProvider } from './BaseProvider';

export interface Season {
	id:                     string;
	name:                   string;
	year:                   number;
	status:                 'setup' | 'open' | 'active' | 'complete';
	lmsEntryFee:            number;
	secondHalfEntryFee:     number;
	secondHalfPicksPerWeek: number;
	regularSeasonOnly:      boolean;
	paymentDeadline:        string | null;
	firstPickDeadline:      string | null;
	notes:                  string | null;
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
	 * - Season status is 'open' (pre-season registration)
	 * - AND the firstPickDeadline has not yet passed (or is not set)
	 *
	 * Once the season goes 'active' the firstPickDeadline has passed,
	 * so LMS registration closes automatically.
	 */
	static isLmsOpen(season: Season, now = new Date()): boolean {
		if (season.status !== 'open') return false;
		if (!season.firstPickDeadline) return true;
		return now < new Date(season.firstPickDeadline);
	}

	/**
	 * Second Half entries open when the season is 'active'.
	 * They close when the season is 'complete'.
	 */
	static isSecondHalfOpen(season: Season): boolean {
		return season.status === 'active';
	}

	/**
	 * Returns the default entry type a participant should see
	 * based on what is currently open.
	 * - If LMS is open → 'lms'
	 * - If only Second Half is open → 'second_half'
	 * - If neither is open → null (registration closed)
	 */
	static defaultEntryType(season: Season, now = new Date()): 'lms' | 'second_half' | null {
		if (SeasonProvider.isLmsOpen(season, now)) return 'lms';
		if (SeasonProvider.isSecondHalfOpen(season)) return 'second_half';
		return null;
	}
}
