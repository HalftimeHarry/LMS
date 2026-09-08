<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolveDefaultEntryType } from '$lib/utils';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const users       = $derived(data.users       as any[]);
	const entriesByUser = $derived(data.entriesByUser as Record<string, any[]>);

	// ── Selection ─────────────────────────────────────────────────────────────
	let selected = $state<Set<string>>(new Set());

	const allSelected = $derived(users.length > 0 && selected.size === users.length);
	const someSelected = $derived(selected.size > 0);

	function toggleAll() {
		if (allSelected) {
			selected = new Set();
		} else {
			selected = new Set(users.map((u: any) => u.id));
		}
	}

	function toggleOne(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function summarizeEntryCounts(entries: any[] = []) {
		const lms = entries.filter((e: any) => e.entryType === 'lms').length;
		const secondHalf = entries.filter((e: any) => e.entryType === 'second_half').length;
		return { total: entries.length, lms, secondHalf };
	}

	// ── Confirmation state ────────────────────────────────────────────────────
	type PendingUser  = { id: string; name: string; entries: any[] };
	type PendingDelete = { ids: string[]; users: PendingUser[]; totalEntries: number };
	let pending = $state<PendingDelete | null>(null);

	function requestDelete(ids: string[]) {
		const pendingUsers: PendingUser[] = ids.map(id => {
			const u       = users.find((u: any) => u.id === id) as any;
			const entries = entriesByUser[id] ?? [];
			return { id, name: u?.displayName ?? u?.email ?? id, entries };
		});
		const totalEntries = pendingUsers.reduce((sum, u) => sum + u.entries.length, 0);
		pending = { ids, users: pendingUsers, totalEntries };
	}

	function cancelDelete() {
		pending = null;
	}

	// ── Search + sort ─────────────────────────────────────────────────────────
	let search   = $state('');
	type SortCol = 'name' | 'email' | 'entries';
	type SortDir = 'asc' | 'desc';
	let sortCol  = $state<SortCol>('name');
	let sortDir  = $state<SortDir>('asc');

	function toggleSort(col: SortCol) {
		if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortCol = col; sortDir = 'asc'; }
	}

	let addEntryOpen = $state(false);
	let addEntryUserId = $state('');
	let addEntrySeasonId = $state('');
	let addEntryType = $state<'lms' | 'second_half'>('lms');
	let addEntryCount = $state(1);
	let addEntryBaseName = $state('LMS');
	let addEntryReferredBy = $state('');
	let addEntryComplimentary = $state(false);
	let addEntryPlayerSearch = $state('');
	let addEntryDropdownOpen = $state(false);

	const addEntrySeasons = $derived((data.seasons as any[]) ?? []);
	const addEntryDefaultSeason = $derived(
		addEntrySeasons.find((s: any) => s.status === 'open' || s.status === 'active')
		?? addEntrySeasons[0]
		?? null
	);

	const addEntrySelectedUser = $derived(users.find((u: any) => u.id === addEntryUserId) ?? null);
	const addEntrySelectedSeason = $derived(addEntrySeasons.find((s: any) => s.id === addEntrySeasonId) ?? null);
	const addEntryHasLms = $derived((() => {
		const season = addEntrySelectedSeason ?? addEntryDefaultSeason;
		return !season || season.lmsEnabled !== false;
	})());
	const addEntryHasSh = $derived((() => {
		const season = addEntrySelectedSeason ?? addEntryDefaultSeason;
		return !season || season.secondHalfEnabled !== false;
	})());
	const addEntryLmsDeadline = $derived((addEntrySeasonId && (data.deadlineMap as Record<string, string> | undefined)?.[addEntrySeasonId]) || null);
	const addEntryShDeadline = $derived((addEntrySeasonId && (data.shDeadlineMap as Record<string, string> | undefined)?.[addEntrySeasonId]) || null);
	const addEntryCanSelectLms = $derived(addEntryHasLms && !(addEntryLmsDeadline && Date.now() > new Date(addEntryLmsDeadline).getTime()));
	const addEntryCanSelectSh = $derived(addEntryHasSh && !(addEntryShDeadline && Date.now() > new Date(addEntryShDeadline).getTime()));

	function openAddEntryModal(userId?: string) {
		const chosenUser = userId ? users.find((u: any) => u.id === userId) ?? null : null;
		const filteredMatch = !userId && search.trim()
			? filtered.find((u: any) => u.displayName || u.email)
			: null;
		addEntryUserId = chosenUser?.id ?? filteredMatch?.id ?? '';
		addEntrySeasonId = addEntryDefaultSeason?.id ?? '';
		addEntryType = resolveDefaultEntryType({
			lmsAvailable: addEntryCanSelectLms,
			secondHalfAvailable: addEntryCanSelectSh
		});
		addEntryCount = 1;
		addEntryReferredBy = '';
		addEntryComplimentary = false;
		const selectedPerson = users.find((u: any) => u.id === addEntryUserId) ?? null;
		addEntryBaseName = selectedPerson
			? `${selectedPerson.displayName ?? 'Player'} ${addEntryType === 'second_half' ? '2nd Half' : 'LMS'}`
			: (addEntryType === 'second_half' ? '2nd Half' : 'LMS');
		addEntryPlayerSearch = selectedPerson?.displayName ?? selectedPerson?.email ?? '';
		addEntryDropdownOpen = false;
		addEntryOpen = true;
	}
	function closeAddEntryModal() {
		addEntryOpen = false;
	}
	$effect(() => {
		if (addEntryDefaultSeason && !addEntrySeasonId) addEntrySeasonId = addEntryDefaultSeason.id;
		if (addEntrySelectedUser && !addEntryUserId) addEntryUserId = addEntrySelectedUser.id;
		if (!addEntrySelectedUser && addEntryUserId) addEntryUserId = '';
		if (addEntryType === 'second_half' && !addEntryCanSelectSh && addEntryCanSelectLms) addEntryType = 'lms';
		if (addEntryType === 'lms' && !addEntryCanSelectLms && addEntryCanSelectSh) addEntryType = 'second_half';
		if (!addEntrySelectedUser?.displayName) {
			addEntryBaseName = addEntryType === 'second_half' ? '2nd Half' : 'LMS';
		} else if (addEntryUserId && addEntrySelectedUser) {
			addEntryBaseName = addEntryType === 'second_half'
				? `${addEntrySelectedUser.displayName} 2nd Half`
				: `${addEntrySelectedUser.displayName} LMS`;
		}
	});

	const filtered = $derived((() => {
		const q = search.trim().toLowerCase();
		let result = users.filter((u: any) =>
			!q ||
			(u.displayName ?? '').toLowerCase().includes(q) ||
			(u.email ?? '').toLowerCase().includes(q)
		);
		result = result.slice().sort((a: any, b: any) => {
			let cmp = 0;
			if (sortCol === 'name') {
				cmp = (a.displayName ?? '').localeCompare(b.displayName ?? '', undefined, { sensitivity: 'base' });
			} else if (sortCol === 'email') {
				cmp = (a.email ?? '').localeCompare(b.email ?? '', undefined, { sensitivity: 'base' });
			} else {
				cmp = (entriesByUser[a.id]?.length ?? 0) - (entriesByUser[b.id]?.length ?? 0);
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return result;
	})());

	// ── After successful delete ───────────────────────────────────────────────
	$effect(() => {
		if ((form as any)?.success) {
			selected = new Set();
			pending  = null;
			invalidateAll();
		}
	});

	// ── Scroll-to-top ─────────────────────────────────────────────────────────
	let scrollEl      = $state<HTMLElement | null>(null);
	let showScrollTop = $state(false);

	function onScroll() {
		showScrollTop = (scrollEl?.scrollTop ?? 0) > 100;
	}
	function scrollToTop() {
		scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head><title>Manage Participants — Admin</title></svelte:head>

<div class="relative flex min-h-[calc(100vh-9rem)] flex-col rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

	<!-- Header -->
	<div class="px-5 py-4">
		<h1 class="text-xl font-bold text-white">Manage Participants</h1>
		<p class="mt-0.5 text-sm text-gray-500">{users.length} participant{users.length !== 1 ? 's' : ''} registered</p>
		<div class="mt-3 flex items-start gap-2.5 rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-3 py-2.5">
			<svg class="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
			</svg>
			<p class="text-xs text-yellow-600">
				Deleting a participant permanently removes their account and all associated entries. Existing pick history tied to those entries will lose its user link and cannot be recovered. Only delete accounts you are certain should be removed.
			</p>
		</div>
	</div>

	<!-- Toasts -->
	{#if (form as any)?.error}
		<div class="mx-5 mb-3 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">
			{(form as any).error}
		</div>
	{/if}
	{#if (form as any)?.success}
		<div class="mx-5 mb-3 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
			✅ {(form as any).deleted} participant{(form as any).deleted !== 1 ? 's' : ''} deleted.
		</div>
	{/if}

	<!-- Search + bulk delete bar -->
	<div class="flex flex-wrap items-center gap-3 border-t border-gray-800 px-4 py-3">
			<input
				type="text"
				placeholder="Search name or email…"
				bind:value={search}
				class="rounded border border-gray-700 bg-gray-900 py-1.5 pl-3 pr-3 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none w-56"
			/>
			<span class="ml-auto text-xs text-gray-600">{filtered.length} of {users.length} shown</span>
			{#if someSelected}
				<span class="text-xs text-gray-500">{selected.size} selected</span>
				<button type="button" onclick={() => selected = new Set()}
					class="text-xs text-gray-600 hover:text-gray-400">Clear</button>
				<button
					type="button"
					onclick={() => requestDelete([...selected])}
					class="flex items-center gap-1.5 rounded border border-red-700 bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/60"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
					</svg>
					Delete {selected.size} selected
				</button>
			{/if}
		</div>

		<!-- Table -->
		<div class="flex-1 overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="sticky top-0 z-10 border-b border-gray-800 bg-[#0a0a0a] text-xs font-medium uppercase tracking-wider text-gray-500">
						<th class="w-10 px-4 py-3"></th>
						<th class="px-4 py-3 text-left">
							<button type="button" onclick={() => toggleSort('name')}
								class="flex items-center gap-1 hover:text-white transition {sortCol === 'name' ? 'text-[#c9a84c]' : ''}">
								Name
								<span class="text-[10px]">{sortCol === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-left">
							<button type="button" onclick={() => toggleSort('email')}
								class="flex items-center gap-1 hover:text-white transition {sortCol === 'email' ? 'text-[#c9a84c]' : ''}">
								Email
								<span class="text-[10px]">{sortCol === 'email' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-center">
							<button type="button" onclick={() => toggleSort('entries')}
								class="flex items-center justify-center gap-1 w-full hover:text-white transition {sortCol === 'entries' ? 'text-[#c9a84c]' : ''}">
								Entries
								<span class="text-[10px]">{sortCol === 'entries' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-left">Joined</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as user (user.id)}
						{@const userEntries = entriesByUser[user.id] ?? []}
						{@const counts = summarizeEntryCounts(userEntries)}
						{@const isSelected  = selected.has(user.id)}
						<tr class="border-b border-gray-800/40 transition hover:bg-white/[0.02]
							{isSelected ? 'bg-red-950/10' : ''}">

							<!-- Checkbox -->
							<td class="px-4 py-3">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleOne(user.id)}
									class="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-[#c9a84c]"
								/>
							</td>

							<!-- Name -->
							<td class="px-4 py-3">
								<p class="font-medium text-white">{user.displayName ?? '—'}</p>
							</td>

							<!-- Email -->
							<td class="px-4 py-3 text-gray-400">{user.email}</td>

							<!-- Entries -->
							<td class="px-4 py-3 text-center">
								{#if counts.total > 0}
									<span class="font-mono text-xs font-semibold text-red-400">
										{counts.lms} LMS / {counts.secondHalf} 2nd
									</span>
								{:else}
									<span class="font-mono text-sm text-green-500">0</span>
								{/if}
							</td>

							<!-- Joined -->
							<td class="px-4 py-3 text-xs text-gray-500">
								{new Date(user.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
							</td>

							<!-- Delete single -->
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-2">
									<button
										type="button"
										onclick={() => openAddEntryModal(user.id)}
										class="rounded border border-[#c9a84c] bg-[rgba(201,168,76,0.10)] px-2.5 py-1 text-xs font-medium text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.18)]"
									>
										Add Entry
									</button>
									<button
										type="button"
										onclick={() => requestDelete([user.id])}
										class="rounded border border-red-800 bg-red-950/40 px-2.5 py-1 text-xs text-red-400 transition hover:bg-red-900/60"
									>
										Delete
									</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-600">
								{search ? 'No participants match your search.' : 'No participants yet.'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div><!-- end scroll container -->
	<!-- Back to top -->
	{#if showScrollTop}
		<button
			type="button"
			onclick={scrollToTop}
			class="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-[rgba(201,168,76,0.3)] bg-black/90 px-3 py-1.5 text-xs font-medium text-[#c9a84c] shadow-lg backdrop-blur-sm transition hover:bg-[rgba(201,168,76,0.1)]"
		>
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
			</svg>
			Top
		</button>
	{/if}

{#if addEntryOpen}
	{@const chosenSeason = addEntrySelectedSeason ?? addEntryDefaultSeason}
	<button type="button" class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onclick={closeAddEntryModal} aria-label="Close add entry modal"></button>
	<div class="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6">
		<div class="flex h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#0a0a0a] shadow-2xl">
			<div class="flex items-center justify-between border-b border-gray-800 px-6 py-4">
				<div>
					<h2 class="text-xl font-bold text-white">Add Entry</h2>
					<p class="text-sm text-gray-500">Default is LMS; switch to 2nd Half when needed.</p>
				</div>
				<button type="button" onclick={closeAddEntryModal} class="rounded p-1 text-gray-500 hover:text-white">✕</button>
			</div>
			<div class="flex-1 overflow-y-auto p-6">
				<form method="POST" action="?/createEntries" use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') closeAddEntryModal();
					};
				}} class="space-y-5">
					<input type="hidden" name="seasonId" value={addEntrySeasonId} />
					<input type="hidden" name="userId" value={addEntryUserId} />
					<input type="hidden" name="entryType" value={addEntryType} />
					<input type="hidden" name="count" value={addEntryCount} />
					<input type="hidden" name="baseName" value={addEntryBaseName} />
					<input type="hidden" name="referredBy" value={addEntryReferredBy} />
					{#if addEntryComplimentary}
						<input type="hidden" name="complimentary" value="true" />
					{/if}
					<div class="space-y-2">
						<fieldset class="space-y-2">
							<legend class="text-sm font-medium text-gray-300">Participant</legend>
							{#if addEntryUserId}
								<div class="flex items-center gap-3 rounded-lg border border-green-800 bg-green-950/30 px-4 py-3 text-base text-white">
									<div class="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-green-300">
										{(addEntrySelectedUser?.displayName ?? addEntrySelectedUser?.email ?? 'P')[0].toUpperCase()}
									</div>
									<div>
										<p class="font-semibold">{addEntrySelectedUser?.displayName ?? 'Selected participant'}</p>
										<p class="text-sm text-green-300">{addEntrySelectedUser?.email ?? ''}</p>
									</div>
								</div>
							{:else}
								<div class="relative">
									<label class="sr-only" for="add-entry-player-search">Search participant</label>
									<input id="add-entry-player-search" type="text" bind:value={addEntryPlayerSearch} onfocus={() => addEntryDropdownOpen = true} oninput={() => { addEntryDropdownOpen = true; addEntryUserId = ''; }} placeholder="Search participant…" class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
									{#if addEntryDropdownOpen && addEntryPlayerSearch.trim()}
										<ul class="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 py-1">
											{#each users.filter((u: any) => `${u.displayName ?? ''} ${u.email ?? ''}`.toLowerCase().includes(addEntryPlayerSearch.toLowerCase())) as user}
												<li>
													<button type="button" onclick={() => { addEntryUserId = user.id; addEntryPlayerSearch = user.displayName || user.email; addEntryDropdownOpen = false; }} class="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800">{user.displayName || '—'} <span class="text-xs text-gray-500">{user.email}</span></button>
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							{/if}
						</fieldset>
					</div>
					<div class="space-y-2">
						<label for="add-entry-season" class="text-sm font-medium text-gray-300">Season</label>
						<select id="add-entry-season" bind:value={addEntrySeasonId} class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-base text-white focus:border-[#c9a84c] focus:outline-none">
							{#each addEntrySeasons as season}
								<option value={season.id}>{season.name}</option>
							{/each}
						</select>
					</div>
					{#if addEntryHasLms && addEntryHasSh}
						<div class="space-y-2">
							<p class="text-sm font-medium text-gray-300">Pool type</p>
							<div class="grid grid-cols-2 gap-2">
								<label class="flex items-center gap-2 rounded-lg border px-4 py-3 text-base {addEntryCanSelectLms && addEntryType === 'lms' ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-white' : 'border-gray-700 text-gray-400'}">
									<input type="radio" bind:group={addEntryType} value="lms" disabled={!addEntryCanSelectLms} class="h-4 w-4 accent-[#c9a84c]" />
									<span>LMS</span>
								</label>
								<label class="flex items-center gap-2 rounded-lg border px-4 py-3 text-base {addEntryCanSelectSh && addEntryType === 'second_half' ? 'border-blue-500 bg-blue-950/30 text-white' : 'border-gray-700 text-gray-400'}">
									<input type="radio" bind:group={addEntryType} value="second_half" disabled={!addEntryCanSelectSh} class="h-4 w-4 accent-blue-400" />
									<span>2nd Half</span>
								</label>
							</div>
						</div>
					{/if}
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="add-entry-count" class="text-sm font-medium text-gray-300">Entries</label>
							<input id="add-entry-count" type="number" min="1" max="20" bind:value={addEntryCount} class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-base text-white focus:border-[#c9a84c] focus:outline-none" />
						</div>
						<div class="space-y-2">
							<label for="add-entry-base-name" class="text-sm font-medium text-gray-300">Base name</label>
							<input id="add-entry-base-name" type="text" bind:value={addEntryBaseName} class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-base text-white focus:border-[#c9a84c] focus:outline-none" />
						</div>
					</div>
					<div class="space-y-2">
						<label for="add-entry-referred-by" class="text-sm font-medium text-gray-300">Referred by <span class="text-gray-500">(optional)</span></label>
						<input id="add-entry-referred-by" type="text" bind:value={addEntryReferredBy} placeholder="Referrer" class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-base text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
					</div>
					<label class="flex items-center gap-3 rounded-lg border border-gray-700 px-4 py-3">
						<input type="checkbox" bind:checked={addEntryComplimentary} class="h-4 w-4 accent-green-500" />
						<div>
							<p class="text-base font-medium text-white">Complimentary entry</p>
							<p class="text-sm text-gray-500">Marks as paid immediately.</p>
						</div>
					</label>
					<div class="flex items-center justify-end gap-3 border-t border-gray-800 pt-4">
						<button type="button" onclick={closeAddEntryModal} class="text-sm text-gray-500 hover:text-white">Cancel</button>
						<button type="submit" disabled={!addEntryUserId || !addEntrySeasonId || !addEntryBaseName.trim()} class="rounded-lg bg-[#c9a84c] px-5 py-2.5 text-base font-semibold text-black disabled:opacity-40">Create</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

</div><!-- end single card -->

<!-- ── Confirmation dialog ─────────────────────────────────────────────────── -->
{#if pending}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
		onclick={cancelDelete}
		aria-label="Cancel"
	></button>

	<!-- Dialog -->
	<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-800 bg-[#0d0d0d] p-6 shadow-2xl">

		<!-- Warning icon + title -->
		<div class="mb-4 flex items-start gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-800 bg-red-950/60">
				<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
				</svg>
			</div>
			<div>
				<h2 class="text-base font-bold text-white">
					Delete {pending.ids.length === 1 ? 'participant' : `${pending.ids.length} participants`}?
				</h2>
				<p class="mt-1 text-sm text-red-400 font-medium">This cannot be undone.</p>
			</div>
		</div>

		<!-- Who is being deleted + their entries -->
		<div class="mb-4 max-h-48 overflow-y-auto space-y-2">
			{#each pending.users as u}
				<div class="rounded-lg border {u.entries.length > 0 ? 'border-red-900/60 bg-red-950/20' : 'border-gray-800 bg-black/40'} px-3 py-2">
					<p class="text-sm font-medium {u.entries.length > 0 ? 'text-red-300' : 'text-gray-300'}">{u.name}</p>
					{#if u.entries.length > 0}
						<p class="mt-0.5 text-xs text-red-500 font-medium">
							⚠️ {u.entries.length} entr{u.entries.length === 1 ? 'y' : 'ies'} will be deleted:
						</p>
						<ul class="mt-1 space-y-0.5">
							{#each u.entries as entry}
								<li class="text-xs text-red-400/80">— {entry.entryName} <span class="text-red-900">({entry.entryType?.toUpperCase()} · {entry.status})</span></li>
							{/each}
						</ul>
					{:else}
						<p class="mt-0.5 text-xs text-gray-600">No entries</p>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Stronger warning when entries are involved -->
		{#if pending.totalEntries > 0}
			<div class="mb-4 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2.5 text-xs text-red-400 space-y-1">
				<p class="font-semibold">❌ {pending.totalEntries} pool entr{pending.totalEntries === 1 ? 'y' : 'ies'} will be permanently deleted.</p>
				<p class="text-red-500">Pick history linked to these entries will lose its user association and cannot be recovered.</p>
			</div>
		{:else}
			<div class="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-3 py-2.5 text-xs text-yellow-600">
				<p>⚠️ The account and login access will be permanently removed.</p>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				type="button"
				onclick={cancelDelete}
				class="flex-1 rounded border border-gray-700 bg-gray-900 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
			>
				Cancel
			</button>

			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
				class="flex-1"
			>
				{#each pending.ids as id}
					<input type="hidden" name="ids" value={id} />
				{/each}
				<button
					type="submit"
					class="w-full rounded border border-red-700 bg-red-950/80 py-2 text-sm font-bold text-red-400 transition hover:bg-red-900"
				>
					Yes, delete permanently
				</button>
			</form>
		</div>
	</div>
{/if}
