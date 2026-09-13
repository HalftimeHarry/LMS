import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('pbAdmin', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		process.env.PUBLIC_POCKETBASE_URL = 'https://pb.example.com';
		process.env.POCKETBASE_ADMIN_EMAIL = 'admin@example.com';
		process.env.POCKETBASE_ADMIN_PASSWORD = 'secret';
	});

	it('authenticates with the PocketBase superuser endpoint', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? 'GET';
			if (method === 'POST' && url.endsWith('/api/collections/_superusers/auth-with-password')) {
				return new Response(JSON.stringify({ token: 'ok-token' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			throw new Error(`Unexpected fetch: ${method} ${url}`);
		});

		vi.stubGlobal('fetch', fetchMock as any);

		const { pbAdmin } = await import('../../lib/server/pb-admin');
		const pb = await pbAdmin();
		expect(pb).toBeTruthy();
		expect(pb.authStore.token).toBe('ok-token');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
