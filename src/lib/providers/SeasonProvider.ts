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
}
