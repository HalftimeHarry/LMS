import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock before importing the action so the module sees the mock
vi.mock('pocketbase', () => {
	const MockPocketBase = vi.fn(function (this: any) {
		this.autoCancellation = vi.fn();
		this.collection       = vi.fn().mockReturnThis();
		this.authWithPassword = vi.fn();
		this.authStore        = {
			token:   'mock-token',
			record:  { id: 'u1', role: 'participant', displayName: 'Test User' },
			isValid: true
		};
	});
	return { default: MockPocketBase };
});

import PocketBase from 'pocketbase';
import { actions } from '../../routes/login/+page.server';

function makeFormData(fields: Record<string, string>) {
	return { get: (key: string) => fields[key] ?? null } as unknown as FormData;
}

function makeCookies() {
	return { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
}

async function runAction(formFields: Record<string, string>, cookies = makeCookies()) {
	let location = '';
	let result: any = null;
	try {
		result = await actions.default({
			request: { formData: async () => makeFormData(formFields) } as any,
			cookies: cookies as any
		} as any);
	} catch (e: any) {
		location = e?.location ?? '';
	}
	return { location, result, cookies };
}

function mockPbWithRole(role: string, authFails = false) {
	vi.mocked(PocketBase).mockImplementation(function (this: any) {
		this.autoCancellation = vi.fn();
		this.collection       = vi.fn().mockReturnThis();
		this.authWithPassword = authFails
			? vi.fn().mockRejectedValue(new Error('Invalid credentials'))
			: vi.fn().mockResolvedValue({});
		this.authStore = {
			token:   'mock-token',
			record:  authFails ? null : { id: 'u1', role, displayName: 'Test' },
			isValid: !authFails
		};
	} as any);
}

describe('login action', () => {
	beforeEach(() => mockPbWithRole('participant'));

	it('sets pb_auth cookie and redirects participant to /dashboard', async () => {
		const cookies = makeCookies();
		const { location } = await runAction({ email: 'a@b.com', password: 'pass123' }, cookies);

		expect(cookies.set).toHaveBeenCalledWith('pb_auth', expect.any(String), expect.any(Object));
		expect(location).toBe('/dashboard');
	});

	it('redirects pool_admin to /admin', async () => {
		mockPbWithRole('pool_admin');
		const { location } = await runAction({ email: 'admin@b.com', password: 'pass123' });
		expect(location).toBe('/admin');
	});

	it('redirects super_admin to /admin', async () => {
		mockPbWithRole('super_admin');
		const { location } = await runAction({ email: 'super@b.com', password: 'pass123' });
		expect(location).toBe('/admin');
	});

	it('honours explicit ?redirect= param over role default', async () => {
		const { location } = await runAction({
			email: 'a@b.com', password: 'pass', redirect: '/dashboard/picks?entry=abc'
		});
		expect(location).toBe('/dashboard/picks?entry=abc');
	});

	it('returns fail(400) on wrong credentials', async () => {
		mockPbWithRole('participant', true);
		const { result } = await runAction({ email: 'a@b.com', password: 'wrong' });
		expect(result?.status).toBe(400);
		expect(result?.data?.error).toBe('Invalid email or password.');
	});
});
