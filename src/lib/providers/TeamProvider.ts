import type PocketBase from 'pocketbase';
import { BaseProvider } from './BaseProvider';

export type Conference = 'AFC' | 'NFC';
export type Division   = 'East' | 'West' | 'North' | 'South';

export interface Team {
	id:           string;
	abbreviation: string;
	name:         string;
	city:         string;
	conference:   Conference;
	division:     Division;
}

export class TeamProvider extends BaseProvider {
	protected get collection() { return 'nfl_teams'; }

	constructor(pb: PocketBase) { super(pb); }

	/** All 32 NFL teams sorted by conference, division, name. */
	async getAll(): Promise<Team[]> {
		return this.pb.collection(this.collection)
			.getFullList<Team>({ sort: 'conference,division,name' });
	}

	/**
	 * Teams grouped by conference → division.
	 * Useful for rendering the pick grid without extra client-side work.
	 */
	async getGrouped(): Promise<Record<Conference, Record<Division, Team[]>>> {
		const teams = await this.getAll();
		const grouped = {} as Record<Conference, Record<Division, Team[]>>;

		for (const team of teams) {
			if (!grouped[team.conference]) grouped[team.conference] = {} as Record<Division, Team[]>;
			if (!grouped[team.conference][team.division]) grouped[team.conference][team.division] = [];
			grouped[team.conference][team.division].push(team);
		}

		return grouped;
	}
}
