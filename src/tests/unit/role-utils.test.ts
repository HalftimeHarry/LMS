import { describe, it, expect } from 'vitest';
import { roleHome, isAdminRole, picksRequired } from '$lib/server/role-utils';

describe('roleHome', () => {
	it('sends super_admin to /admin', () => {
		expect(roleHome('super_admin')).toBe('/admin');
	});

	it('sends pool_admin to /admin', () => {
		expect(roleHome('pool_admin')).toBe('/admin');
	});

	it('sends participant to /dashboard', () => {
		expect(roleHome('participant')).toBe('/dashboard');
	});

	it('sends null role to /dashboard', () => {
		expect(roleHome(null)).toBe('/dashboard');
	});

	it('sends unknown role to /dashboard', () => {
		expect(roleHome('guest')).toBe('/dashboard');
	});
});

describe('isAdminRole', () => {
	it('returns true for super_admin', () => {
		expect(isAdminRole('super_admin')).toBe(true);
	});

	it('returns true for pool_admin', () => {
		expect(isAdminRole('pool_admin')).toBe(true);
	});

	it('returns false for participant', () => {
		expect(isAdminRole('participant')).toBe(false);
	});

	it('returns false for null', () => {
		expect(isAdminRole(null)).toBe(false);
	});
});

describe('picksRequired', () => {
	it('always returns 1 for lms regardless of overrides', () => {
		expect(picksRequired('lms', 3, 2)).toBe(1);
		expect(picksRequired('lms', null, null)).toBe(1);
	});

	it('uses week override for second_half when set', () => {
		expect(picksRequired('second_half', 3, 1)).toBe(3);
	});

	it('falls back to season default when no week override', () => {
		expect(picksRequired('second_half', null, 2)).toBe(2);
	});

	it('falls back to 1 when both overrides are null', () => {
		expect(picksRequired('second_half', null, null)).toBe(1);
	});

	it('uses week override of 2 over season default of 3', () => {
		expect(picksRequired('second_half', 2, 3)).toBe(2);
	});
});
