import PocketBase, { AsyncAuthStore } from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { writable, derived } from 'svelte/store';
import type { RecordModel } from 'pocketbase';

// Auth store that switches between localStorage (remember me) and sessionStorage
function makeBrowserStore(key: string, storage: Storage) {
	return new AsyncAuthStore({
		save: async (serialized) => storage.setItem(key, serialized),
		clear: async () => storage.removeItem(key),
		initial: storage.getItem(key) ?? ''
	});
}

function createPocketBase() {
	// SSR: use default in-memory store
	if (typeof window === 'undefined') {
		return new PocketBase(PUBLIC_POCKETBASE_URL);
	}
	// Client: prefer localStorage token, fall back to sessionStorage
	const stored =
		localStorage.getItem('pb_auth') ?? sessionStorage.getItem('pb_auth') ?? '';
	const storage = localStorage.getItem('pb_auth') !== null ? localStorage : sessionStorage;
	const store = makeBrowserStore('pb_auth', storage);
	return new PocketBase(PUBLIC_POCKETBASE_URL, store);
}

export const pb = createPocketBase();

// Reactive current user store
export const currentUser = writable<RecordModel | null>(
	pb.authStore.record ?? null
);

pb.authStore.onChange(() => {
	currentUser.set(pb.authStore.record ?? null);
});

// Derived role helpers
export const userRole = derived(
	currentUser,
	($u) => ($u?.role as 'super_admin' | 'pool_admin' | 'participant' | null) ?? null
);

export const isSuperAdmin = derived(userRole, ($r) => $r === 'super_admin');
export const isPoolAdmin  = derived(userRole, ($r) => $r === 'super_admin' || $r === 'pool_admin');
export const isAdmin      = derived(userRole, ($r) => $r === 'super_admin' || $r === 'pool_admin');

/**
 * Call after a successful login to persist the token to the right storage.
 * @param remember - true = localStorage (survives browser restart), false = sessionStorage only
 */
export function persistAuth(remember: boolean) {
	if (typeof window === 'undefined') return;
	const token = pb.authStore.token;
	const record = pb.authStore.record;
	if (!token || !record) return;

	if (remember) {
		localStorage.setItem('pb_auth', JSON.stringify({ token, record }));
		sessionStorage.removeItem('pb_auth');
	} else {
		sessionStorage.setItem('pb_auth', JSON.stringify({ token, record }));
		localStorage.removeItem('pb_auth');
	}
}

export function signOut() {
	pb.authStore.clear();
	localStorage.removeItem('pb_auth');
	sessionStorage.removeItem('pb_auth');
	currentUser.set(null);
}
