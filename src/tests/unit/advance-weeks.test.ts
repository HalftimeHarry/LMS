import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockResponse = { ok: boolean; json: () => Promise<any> };

function jsonResponse(data: any, ok = true): MockResponse {
	return {
		ok,
		json: async () => data,
	};
}

describe('advance-weeks scheduler', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		process.env.PUBLIC_POCKETBASE_URL = 'https://pb.example.com';
		process.env.POCKETBASE_ADMIN_EMAIL = 'admin@example.com';
		process.env.POCKETBASE_ADMIN_PASSWORD = 'secret';
	});

	it('locks the week but does not create auto-picks when active odds are missing/inactive', async () => {
		vi.doMock('@netlify/functions', () => ({
			schedule: (_cron: string, fn: any) => fn,
		}));

		const pastDeadline = new Date(Date.now() - 60_000).toISOString();
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? 'GET';

			if (url.endsWith('/api/collections/_superusers/auth-with-password') && method === 'POST') {
				return jsonResponse({ token: 'token-123' });
			}

			if (url.includes('/api/collections/seasons/records?') && method === 'GET') {
				return jsonResponse({
					items: [{ id: 's1', name: '2027 LMS', status: 'active' }],
				});
			}

			if (url.includes('/api/collections/weekly_settings/records?') && method === 'GET') {
				return jsonResponse({
					items: [{
						id: 'w1',
						season: 's1',
						week: 1,
						status: 'open',
						deadline: pastDeadline,
					}],
				});
			}

			if (url.includes('/api/collections/weekly_settings/records/w1') && method === 'PATCH') {
				return jsonResponse({ id: 'w1' });
			}

			if (url.includes('/api/collections/game_odds/records?') && method === 'GET') {
				const u = new URL(url);
				const filter = decodeURIComponent(u.searchParams.get('filter') ?? '');
				expect(filter).toContain('isActive = true');
				// Simulate no ACTIVE odds found (either missing odds or only inactive odds exist)
				return jsonResponse({ items: [] });
			}

			throw new Error(`Unexpected fetch: ${method} ${url}`);
		});

		vi.stubGlobal('fetch', fetchMock as any);

		const { handler } = await import('../../../netlify/functions/advance-weeks');
		const result = await (handler as any)();

		expect(result.statusCode).toBe(200);

		const urls = fetchMock.mock.calls.map(([input, init]) => ({
			url: String(input),
			method: (init?.method ?? 'GET') as string,
		}));

		expect(urls.some((c) =>
			c.method === 'PATCH' && c.url.includes('/api/collections/weekly_settings/records/w1')
		)).toBe(true);

		expect(urls.some((c) =>
			c.method === 'POST' && c.url.includes('/api/collections/picks/records')
		)).toBe(false);
	});

	it('creates auto-picks for active entries missing picks when active odds exist', async () => {
		vi.doMock('@netlify/functions', () => ({
			schedule: (_cron: string, fn: any) => fn,
		}));

		const pastDeadline = new Date(Date.now() - 60_000).toISOString();
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? 'GET';

			if (url.endsWith('/api/collections/_superusers/auth-with-password') && method === 'POST') {
				return jsonResponse({ token: 'token-123' });
			}

			if (url.includes('/api/collections/seasons/records?') && method === 'GET') {
				return jsonResponse({
					items: [{ id: 's1', name: '2027 LMS', status: 'active' }],
				});
			}

			if (url.includes('/api/collections/weekly_settings/records?') && method === 'GET') {
				return jsonResponse({
					items: [{
						id: 'w1',
						season: 's1',
						week: 1,
						status: 'open',
						deadline: pastDeadline,
					}],
				});
			}

			if (url.includes('/api/collections/weekly_settings/records/w1') && method === 'PATCH') {
				return jsonResponse({ id: 'w1' });
			}

			if (url.includes('/api/collections/game_odds/records?') && method === 'GET') {
				const u = new URL(url);
				const filter = decodeURIComponent(u.searchParams.get('filter') ?? '');
				if (filter.includes('isActive = true')) {
					return jsonResponse({
						items: [{
							id: 'g1',
							homeSpread: -7,
							homeTeam: 'team-home',
							awayTeam: 'team-away',
						}],
					});
				}
				return jsonResponse({ items: [] });
			}

			if (url.includes('/api/collections/entries/records?') && method === 'GET') {
				return jsonResponse({
					items: [
						{ id: 'e1', season: 's1', status: 'active', entryType: 'lms' },
						{ id: 'e2', season: 's1', status: 'active', entryType: 'second_half' },
					],
				});
			}

			if (url.includes('/api/collections/picks/records?') && method === 'GET') {
				return jsonResponse({ items: [] });
			}

			if (url.includes('/api/collections/picks/records') && method === 'POST') {
				return jsonResponse({ id: 'new-pick' });
			}

			throw new Error(`Unexpected fetch: ${method} ${url}`);
		});

		vi.stubGlobal('fetch', fetchMock as any);

		const { handler } = await import('../../../netlify/functions/advance-weeks');
		const result = await (handler as any)();

		expect(result.statusCode).toBe(200);

		const pickPosts = fetchMock.mock.calls
			.filter(([input, init]) => {
				const url = String(input);
				const method = init?.method ?? 'GET';
				return method === 'POST' && url.includes('/api/collections/picks/records');
			})
			.map(([, init]) => JSON.parse(String(init?.body ?? '{}')));

		expect(pickPosts).toHaveLength(2);
		expect(pickPosts).toEqual(expect.arrayContaining([
			expect.objectContaining({
				entry: 'e1',
				week: 'w1',
				pickedTeams: ['team-home'],
				isAutoPick: true,
			}),
			expect.objectContaining({
				entry: 'e2',
				week: 'w1',
				pickedTeams: ['team-home'],
				isAutoPick: true,
			}),
		]));
	});

	it.each(Array.from({ length: 18 }, (_, i) => i + 1))(
		'happy path applies for week %i: locks and auto-picks missing entries',
		async (weekNum) => {
			vi.doMock('@netlify/functions', () => ({
				schedule: (_cron: string, fn: any) => fn,
			}));

			const pastDeadline = new Date(Date.now() - 60_000).toISOString();
			const weekId = `w${weekNum}`;
			const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				const method = init?.method ?? 'GET';

				if (url.endsWith('/api/collections/_superusers/auth-with-password') && method === 'POST') {
					return jsonResponse({ token: 'token-123' });
				}

				if (url.includes('/api/collections/seasons/records?') && method === 'GET') {
					return jsonResponse({
						items: [{ id: 's1', name: '2027 LMS', status: 'active' }],
					});
				}

				if (url.includes('/api/collections/weekly_settings/records?') && method === 'GET') {
					return jsonResponse({
						items: [{
							id: weekId,
							season: 's1',
							week: weekNum,
							status: 'open',
							deadline: pastDeadline,
						}],
					});
				}

				if (url.includes(`/api/collections/weekly_settings/records/${weekId}`) && method === 'PATCH') {
					return jsonResponse({ id: weekId });
				}

				if (url.includes('/api/collections/game_odds/records?') && method === 'GET') {
					const u = new URL(url);
					const filter = decodeURIComponent(u.searchParams.get('filter') ?? '');
					expect(filter).toContain(`week = ${weekNum}`);
					expect(filter).toContain('isActive = true');
					return jsonResponse({
						items: [{
							id: `g${weekNum}`,
							homeSpread: -6,
							homeTeam: 'team-home',
							awayTeam: 'team-away',
						}],
					});
				}

				if (url.includes('/api/collections/entries/records?') && method === 'GET') {
					return jsonResponse({
						items: [
							{ id: 'e1', season: 's1', status: 'active', entryType: 'lms' },
						],
					});
				}

				if (url.includes('/api/collections/picks/records?') && method === 'GET') {
					return jsonResponse({ items: [] });
				}

				if (url.includes('/api/collections/picks/records') && method === 'POST') {
					return jsonResponse({ id: `pick-${weekNum}` });
				}

				throw new Error(`Unexpected fetch: ${method} ${url}`);
			});

			vi.stubGlobal('fetch', fetchMock as any);

			const { handler } = await import('../../../netlify/functions/advance-weeks');
			const result = await (handler as any)();

			expect(result.statusCode).toBe(200);

			const pickPosts = fetchMock.mock.calls
				.filter(([input, init]) => {
					const url = String(input);
					const method = init?.method ?? 'GET';
					return method === 'POST' && url.includes('/api/collections/picks/records');
				})
				.map(([, init]) => JSON.parse(String(init?.body ?? '{}')));

			expect(pickPosts).toHaveLength(1);
			expect(pickPosts[0]).toEqual(expect.objectContaining({
				entry: 'e1',
				week: weekId,
				pickedTeams: ['team-home'],
				isAutoPick: true,
			}));
		}
	);
});
