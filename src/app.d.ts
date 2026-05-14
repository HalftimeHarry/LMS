import type { RecordModel } from 'pocketbase';

declare global {
	namespace App {
		interface Locals {
			user: RecordModel | null;
			role: 'super_admin' | 'pool_admin' | 'participant' | null;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
