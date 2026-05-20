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

	try {
		await pb.collection('_superusers').authWithPassword(
			env.POCKETBASE_ADMIN_EMAIL,
			env.POCKETBASE_ADMIN_PASSWORD
		);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		// Catch Railway 404, network timeouts, DNS failures, etc.
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
		throw e;
	}

	return pb;
}
