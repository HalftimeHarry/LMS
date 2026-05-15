import type PocketBase from 'pocketbase';
import { BaseProvider } from './BaseProvider';

export type EntryStatus    = 'pending_payment' | 'active' | 'eliminated' | 'winner';
export type EntryType      = 'lms' | 'second_half';
export type PaymentMethod  = 'check' | 'venmo' | 'paypal' | 'zelle' | 'cash' | 'free';

export interface Entry {
	id:              string;
	season:          string;
	user:            string;
	entryName:       string;
	entryType:       EntryType;
	status:          EntryStatus;
	paid:            boolean;
	paidAt:          string | null;
	paymentMethod:   PaymentMethod | null;
	paymentNotes:    string | null;
	eliminatedWeek:  number | null;
	eliminatedReason:string | null;
	referredBy:      string | null;
	// Expanded relations — present when fetched with expand
	expand?: {
		season?: { id: string; name: string; status: string; lmsEntryFee: number; secondHalfEntryFee: number };
		user?:   { id: string; displayName: string; email: string };
	};
}

export interface EntryFilter {
	seasonId?:  string;
	status?:    EntryStatus | 'all';
	userId?:    string;
	entryType?: EntryType;
}

export class EntryProvider extends BaseProvider {
	protected get collection() { return 'entries'; }

	constructor(pb: PocketBase) { super(pb); }

	/** All entries matching the given filter, with season + user expanded. */
	async getAll(filter: EntryFilter = {}): Promise<Entry[]> {
		const parts: string[] = [];

		if (filter.seasonId)              parts.push(`season = "${filter.seasonId}"`);
		if (filter.status && filter.status !== 'all') parts.push(`status = "${filter.status}"`);
		if (filter.userId)                parts.push(`user = "${filter.userId}"`);
		if (filter.entryType)             parts.push(`entryType = "${filter.entryType}"`);

		return this.pb.collection(this.collection).getFullList<Entry>({
			filter: parts.join(' && ') || undefined,
			expand: 'season,user',
			sort:   '+entryName'
		});
	}

	/** Single entry by id, with season + user expanded. */
	async getById(id: string): Promise<Entry> {
		return this.pb.collection(this.collection).getOne<Entry>(id, { expand: 'season,user' });
	}

	/**
	 * Entries for the admin overview — minimal fields only (no expand needed).
	 * Used for pot/stats calculations to keep the payload small.
	 */
	async getStatsFields(seasonId?: string): Promise<Pick<Entry, 'id' | 'status' | 'paid' | 'paymentMethod' | 'season' | 'entryType'>[]> {
		const filter = seasonId ? `season = "${seasonId}"` : undefined;
		return this.pb.collection(this.collection).getFullList({
			fields: 'id,status,paid,paymentMethod,season,entryType',
			filter
		});
	}

	/** All entries for a given user, with season expanded. */
	async getForUser(userId: string, seasonId?: string): Promise<Entry[]> {
		return this.getAll({ userId, seasonId });
	}

	/** Entries by pool type within a season. */
	async getByType(seasonId: string, entryType: EntryType): Promise<Entry[]> {
		return this.getAll({ seasonId, entryType });
	}
}
