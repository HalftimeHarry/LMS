import type PocketBase from 'pocketbase';
import { BaseProvider } from './BaseProvider';
import type { EntryType } from './EntryProvider';

export type WeekStatus = 'open' | 'locked' | 'results_pending' | 'complete';

export interface Week {
	id:                     string;
	season:                 string;
	week:                   number;
	deadline:               string;
	status:                 WeekStatus;
	biggestFavoriteTeam:    string | null;
	notes:                  string | null;
	// null = use season default; explicit value overrides for this week only
	secondHalfPicksPerWeek: number | null;
	expand?: {
		biggestFavoriteTeam?: { id: string; abbreviation: string; name: string; city: string };
	};
}

export interface WeekFilter {
	seasonId:             string;
	/** When set, only returns weeks relevant to the given pool type. */
	poolType?:            EntryType;
	/** First week of the 2H pool — filters out earlier weeks when poolType is second_half. Defaults to 6. */
	secondHalfStartWeek?: number;
}

export class WeekProvider extends BaseProvider {
	protected get collection() { return 'weekly_settings'; }

	constructor(pb: PocketBase) { super(pb); }

	/** All weeks for a season, sorted by week number. */
	async getAll(filter: WeekFilter): Promise<Week[]> {
		const parts = [`season = "${filter.seasonId}"`];

		// Second Half pool only participates from secondHalfStartWeek onward (default 6)
		if (filter.poolType === 'second_half') {
			const startWeek = filter.secondHalfStartWeek ?? 6;
			parts.push(`week >= ${startWeek}`);
		}

		return this.pb.collection(this.collection).getFullList<Week>({
			filter: parts.join(' && '),
			expand: 'biggestFavoriteTeam',
			sort:   '+week'
		});
	}

	/** The current open week for a season, or null. */
	async getOpenWeek(seasonId: string): Promise<Week | null> {
		try {
			return await this.pb.collection(this.collection).getFirstListItem<Week>(
				`season = "${seasonId}" && status = "open"`,
				{ sort: '+week', expand: 'biggestFavoriteTeam' }
			);
		} catch {
			return null;
		}
	}

	/** The most recent non-complete week (open, locked, or results_pending). */
	async getCurrentWeek(seasonId: string): Promise<Week | null> {
		try {
			return await this.pb.collection(this.collection).getFirstListItem<Week>(
				`season = "${seasonId}" && (status = "open" || status = "locked" || status = "results_pending")`,
				{ sort: '-week', expand: 'biggestFavoriteTeam' }
			);
		} catch {
			return null;
		}
	}

	/** Single week by id. */
	async getById(id: string): Promise<Week> {
		return this.pb.collection(this.collection).getOne<Week>(id, {
			expand: 'biggestFavoriteTeam'
		});
	}

	/**
	 * Resolves the effective picks-per-week count for a second_half entry.
	 * Week-level override takes precedence over the season default.
	 * LMS always returns 1.
	 */
	static picksForWeek(
		poolType: EntryType,
		week: Pick<Week, 'secondHalfPicksPerWeek'>,
		seasonDefault: number
	): number {
		if (poolType === 'lms') return 1;
		return week.secondHalfPicksPerWeek ?? seasonDefault ?? 1;
	}
}
