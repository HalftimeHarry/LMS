import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

/**
 * Returns a PocketBase instance authenticated as superuser (PocketBase v0.23+).
 * Use for server-side data fetching where collection rules block the request.
 *
 * Throws PocketBaseUnavailableError if the backend cannot be reached, so
 * error pages can distinguish a backend outage from an application bug.
 */

export class PocketBaseUnavailableError extends Error {
	constructor(url: string, cause?: unknown) {
		const detail = cause instanceof Error ? cause.message : String(cause ?? 'unknown');
		super(`PocketBase unreachable at ${url} — ${detail}`);
		this.name = 'PocketBaseUnavailableError';
		this.cause = cause;
	}
}

export async function pbAdmin(): Promise<PocketBase> {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	pb.autoCancellation(false);

	const email = env.POCKETBASE_ADMIN_EMAIL;
	const password = env.POCKETBASE_ADMIN_PASSWORD;
	if (!PUBLIC_POCKETBASE_URL || !email || !password) {
		throw new Error('Missing PUBLIC_POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, or POCKETBASE_ADMIN_PASSWORD');
	}

	const attempts = [
		{ label: 'admins', run: async () => pb.admins.authWithPassword(email, password) },
		{ label: '_superusers', run: async () => pb.collection('_superusers').authWithPassword(email, password) },
	];

	let lastError: unknown;
	for (const attempt of attempts) {
		try {
			await attempt.run();
			if (pb.authStore.token && String(pb.authStore.token).length > 0) {
				return pb;
			}
			throw new Error(`PocketBase ${attempt.label} auth did not produce a token`);
		} catch (e: unknown) {
			lastError = e;
			const msg = e instanceof Error ? e.message : String(e);
			if (
				msg.includes('Application not found') ||
				msg.includes('fetch failed') ||
				msg.includes('ECONNREFUSED') ||
				msg.includes('ENOTFOUND') ||
				msg.includes('Failed to fetch') ||
				msg.includes('network')
			) {
				throw new PocketBaseUnavailableError(PUBLIC_POCKETBASE_URL, e);
			}
		}
	}

	throw lastError ?? new Error('PocketBase admin authentication failed');
}
