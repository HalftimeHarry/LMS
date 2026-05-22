/**
 * In-memory sliding-window rate limiter for server actions.
 *
 * Keyed by an arbitrary string (e.g. IP address or email).
 * Entries are pruned lazily on each check to avoid unbounded growth.
 *
 * Not suitable for multi-instance deployments — use Redis or a shared
 * store if you run more than one server process.
 */

interface Window {
	count:     number;
	resetAt:   number; // epoch ms
}

const store = new Map<string, Window>();

/**
 * Check whether `key` has exceeded `limit` requests within `windowMs`.
 * Increments the counter on every call.
 *
 * @returns `true` when the limit is exceeded (caller should reject the request)
 */
export function isRateLimited(
	key:      string,
	limit:    number,
	windowMs: number
): boolean {
	const now = Date.now();

	// Lazy prune: remove expired entries while we're here
	for (const [k, w] of store) {
		if (w.resetAt <= now) store.delete(k);
	}

	const entry = store.get(key);

	if (!entry || entry.resetAt <= now) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}

	entry.count += 1;
	return entry.count > limit;
}

/**
 * Extract a best-effort client IP from a SvelteKit `RequestEvent`.
 * Falls back to 'unknown' when no header is present (e.g. in tests).
 */
export function clientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
		'unknown'
	);
}
