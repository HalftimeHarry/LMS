import type PocketBase from 'pocketbase';

/**
 * Base class for all data providers.
 *
 * Providers own data fetching only — no mutations, no view state.
 * Instantiate with an authenticated PocketBase client (typically from pbAdmin()).
 * Each subclass targets one PocketBase collection and exposes typed query methods.
 */
export abstract class BaseProvider {
	protected pb: PocketBase;

	constructor(pb: PocketBase) {
		this.pb = pb;
	}

	/** Collection name this provider targets. Defined by each subclass. */
	protected abstract get collection(): string;
}
