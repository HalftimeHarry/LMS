import type { Entry, EntryStatus, EntryType, PaymentMethod } from '$lib/providers';

/**
 * Controller for the admin entries view.
 *
 * Owns:
 * - View state: search text, season filter, status filter, pool type scope, bulk selection
 * - Derived filtered list
 * - Bulk action: set entries to not_active (eliminated)
 *
 * Does NOT own data fetching (that's EntryProvider) or server mutations
 * (those stay in +page.server.ts actions). The controller calls server
 * actions via fetch/form submission and the server re-runs the load.
 */
export function createEntriesController(initialEntries: Entry[] = []) {
	// ── View state ────────────────────────────────────────────────────────────
	let entries      = $state<Entry[]>(initialEntries);
	let search       = $state('');
	let seasonId     = $state('');
	let statusFilter = $state<EntryStatus | 'all'>('pending_payment');
	let poolType     = $state<EntryType | 'all'>('all');

	// Bulk selection — set of entry ids
	let selectedIds  = $state<Set<string>>(new Set());

	// Per-entry payment method selection (for the Mark Paid dropdown)
	let paymentMethod = $state<Record<string, PaymentMethod | ''>>({});

	// Loading state for bulk actions
	let bulkLoading  = $state(false);
	let bulkError    = $state<string | null>(null);

	// ── Derived filtered list ─────────────────────────────────────────────────
	const filtered = $derived(() => {
		let result = entries;

		if (poolType !== 'all') {
			result = result.filter(e => e.entryType === poolType);
		}

		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(e =>
				e.entryName.toLowerCase().includes(q) ||
				(e.expand?.user?.displayName ?? '').toLowerCase().includes(q) ||
				(e.expand?.user?.email ?? '').toLowerCase().includes(q)
			);
		}

		return result;
	});

	// ── Selection helpers ─────────────────────────────────────────────────────
	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		next.has(id) ? next.delete(id) : next.add(id);
		selectedIds = next;
	}

	function selectAll() {
		selectedIds = new Set(filtered().map(e => e.id));
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	const allSelected = $derived(
		filtered().length > 0 && filtered().every(e => selectedIds.has(e.id))
	);

	// ── Bulk: set not_active (eliminated) ────────────────────────────────────
	/**
	 * Submits a bulk status change to the server action ?/bulkSetInactive.
	 * Passes the selected entry ids as a FormData array.
	 * Caller should invalidate/reload after this resolves.
	 */
	async function bulkSetInactive(): Promise<{ success: boolean; error?: string }> {
		if (selectedIds.size === 0) return { success: false, error: 'No entries selected.' };

		bulkLoading = true;
		bulkError   = null;

		try {
			const fd = new FormData();
			for (const id of selectedIds) fd.append('ids', id);

			const res  = await fetch('?/bulkSetInactive', { method: 'POST', body: fd });
			const json = await res.json().catch(() => ({}));

			if (!res.ok) {
				bulkError = json?.data?.error ?? 'Bulk action failed.';
				return { success: false, error: bulkError ?? undefined };
			}

			clearSelection();
			return { success: true };
		} catch (e: unknown) {
			bulkError = (e as Error)?.message ?? 'Unexpected error.';
			return { success: false, error: bulkError ?? undefined };
		} finally {
			bulkLoading = false;
		}
	}

	// ── Sync entries when page data reloads ──────────────────────────────────
	function setEntries(next: Entry[]) {
		entries = next;
		// Clear selection when data refreshes to avoid stale ids
		clearSelection();
	}

	return {
		// State (readable externally)
		get entries()       { return entries; },
		get search()        { return search; },
		set search(v)       { search = v; },
		get seasonId()      { return seasonId; },
		set seasonId(v)     { seasonId = v; },
		get statusFilter()  { return statusFilter; },
		set statusFilter(v) { statusFilter = v; },
		get poolType()      { return poolType; },
		set poolType(v)     { poolType = v; },
		get selectedIds()   { return selectedIds; },
		get paymentMethod() { return paymentMethod; },
		set paymentMethod(v){ paymentMethod = v; },
		get bulkLoading()   { return bulkLoading; },
		get bulkError()     { return bulkError; },

		// Derived
		get filtered()      { return filtered(); },
		get allSelected()   { return allSelected; },

		// Methods
		toggleSelect,
		selectAll,
		clearSelection,
		bulkSetInactive,
		setEntries
	};
}

export type EntriesController = ReturnType<typeof createEntriesController>;
