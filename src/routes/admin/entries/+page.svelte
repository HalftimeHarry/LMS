<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { createEntriesController } from '$lib/controllers';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ctrl = createEntriesController(data.entries as any[]);
	// Keep controller in sync when page data reloads after form actions
	$effect(() => ctrl.setEntries(data.entries as any[]));

	const statusOptions = [
		{ value: 'pending_payment', label: 'Pending Payment' },
		{ value: 'active',          label: 'Active' },
		{ value: 'eliminated',      label: 'Eliminated' },
		{ value: 'all',             label: 'All' },
	];

	const statusColors: Record<string, string> = {
		pending_payment: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		active:          'bg-green-950/60 text-green-400 border-green-800',
		eliminated:      'bg-red-950/60 text-red-400 border-red-800',
		winner:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	const entryTypeBadge: Record<string, string> = {
		lms:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.3)]',
		second_half:  'bg-blue-950/60 text-blue-400 border-blue-800',
	};

	const paymentMethods = ['check', 'venmo', 'paypal', 'zelle', 'cash', 'free'];

	let selectedMethod: Record<string, string> = $state({});
	let createLoading = $state(false);
	let showCreateForm = $state(false);

	// --- Player search ---
	let playerSearch   = $state('');
	let selectedUserId = $state('');
	let dropdownOpen   = $state(false);

	const participants = $derived(data.participants as any[]);
	const seasons      = $derived(data.seasons      as any[]);
	const entries      = $derived(data.entries      as any[]);

	const filteredParticipants = $derived(
		playerSearch.trim() === ''
			? participants
			: participants.filter((u) =>
				`${u.displayName} ${u.email}`.toLowerCase().includes(playerSearch.toLowerCase())
			)
	);

	const selectedUser = $derived(
		participants.find((u) => u.id === selectedUserId)
	);

	function selectUser(u: { id: string; displayName: string; email: string }) {
		selectedUserId = u.id;
		playerSearch   = u.displayName || u.email;
		dropdownOpen   = false;
	}

	// Default to the active/open season
	const defaultSeason = $derived(
		seasons.find((s) => s.status === 'open' || s.status === 'active')
		?? seasons[0]
		?? null
	);
	let selectedSeasonId = $state('');
	$effect(() => { if (defaultSeason && !selectedSeasonId) selectedSeasonId = defaultSeason.id; });

	// Base name — writable so it auto-fills when a player is selected but stays editable
	let baseName = $state('Entry');
	$effect(() => {
		baseName = selectedUser?.displayName ? `${selectedUser.displayName} Entry` : 'Entry';
	});

	// Entry type — default lms
	let entryType     = $state('lms');
	let complimentary = $state(false);

	// Client-side search and pool type filter delegated to controller
	const visibleEntries = $derived(ctrl.filtered);

	// Deadline helpers — keyed by seasonId
	const deadlineMap = $derived(data.deadlineMap as Record<string, string>);
	const now = Date.now();
	function canDelete(entry: any): boolean {
		const dl = deadlineMap[entry.season];
		return !dl || now < new Date(dl).getTime();
	}
	function deadlineLabel(entry: any): string {
		const dl = deadlineMap[entry.season];
		if (!dl) return '';
		const d = new Date(dl);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set(key, value);
		goto(`?${params.toString()}`, { replaceState: true });
	}

	// Bulk mark paid
	let bulkPaidMethod  = $state('');
	let bulkPaidLoading = $state(false);
	async function handleBulkPaid() {
		if (!bulkPaidMethod) return;
		bulkPaidLoading = true;
		const result = await ctrl.bulkMarkPaid(bulkPaidMethod);
		bulkPaidLoading = false;
		if (result.success) { bulkPaidMethod = ''; await invalidateAll(); }
	}

	// Bulk set status
	let bulkStatusValue = $state('');
	let bulkConfirm     = $state(false);
	async function handleBulkStatus() {
		if (!bulkStatusValue) return;
		if (bulkStatusValue === 'eliminated' && !bulkConfirm) { bulkConfirm = true; return; }
		bulkConfirm = false;
		const result = await ctrl.bulkSetStatus(bulkStatusValue);
		if (result.success) { bulkStatusValue = ''; await invalidateAll(); }
	}

	// Keep old handler alias for eliminated confirm reset
	async function handleBulkInactive() {
		bulkStatusValue = 'eliminated';
		await handleBulkStatus();
	}
</script>

<svelte:head><title>Entries — Admin</title></svelte:head>

<div class="mb-2 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-2xl font-bold text-white">Entries & Payments</h1>
	<div class="flex flex-wrap items-center gap-3">
		<!-- Season filter -->
		<div class="flex items-center gap-1.5">
			<select
				value={data.seasonFilter ?? ''}
				onchange={(e) => updateFilter('season', (e.target as HTMLSelectElement).value)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				<option value="">All seasons</option>
				{#each data.seasons as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
			<InfoTip text="Filter entries by season. Select a specific season to see its delete deadline and focus bulk actions on that pool." />
		</div>
		<!-- Status filter -->
		<div class="flex items-center gap-1.5">
			<select
				value={data.statusFilter}
				onchange={(e) => updateFilter('status', (e.target as HTMLSelectElement).value)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				{#each statusOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
			<InfoTip text="pending_payment — registered but not yet paid. active — paid and in the pool. eliminated — picked incorrectly and removed from contention. Filter to pending_payment to process outstanding fees." />
		</div>

		<button
			onclick={() => showCreateForm = !showCreateForm}
			class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]"
		>+ Add Entries</button>
	</div>
</div>

<!-- Description card -->
<div class="mb-6 grid gap-3 sm:grid-cols-3">
	<div class="rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-400">
		<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Manage Entries</p>
		Add, edit, and delete player entries. Each entry is one shot at the pool — a player can hold multiple.
	</div>
	<div class="rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-400">
		<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Collect Payments</p>
		Mark entries as paid once you've received the fee. Unpaid entries stay in <span class="text-yellow-400">pending_payment</span> and won't receive picks until activated.
	</div>
	<div class="rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-400">
		<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Use the Filters</p>
		Filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees, or pick a season to scope bulk actions before week 1 locks.
	</div>
</div>

<!-- Success toast -->
{#if form?.action === 'create' && form?.success}
	<div class="mb-4 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
		Created: {(form.created as string[]).join(', ')}
	</div>
{/if}
{#if form?.action === 'create' && form?.error}
	<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">{form.error}</div>
{/if}

<!-- Create entries form -->
{#if showCreateForm}
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
	<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Add Entries for a Player</h2>
	<form
		method="POST"
		action="?/createEntries"
		use:enhance={() => {
			createLoading = true;
			return async ({ update }) => {
				await update();
				createLoading = false;
				showCreateForm = false;
				playerSearch = '';
				selectedUserId = '';
				selectedSeasonId = defaultSeason?.id ?? '';
				baseName = 'Entry';
				entryType = 'lms';
				complimentary = false;
			};
		}}
		class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
	>
		<!-- Season -->
		<div class="flex flex-col gap-1">
			<label for="seasonId" class="text-xs font-medium text-gray-400">Season</label>
			<select id="seasonId" name="seasonId" required
				bind:value={selectedSeasonId}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
				{#each data.seasons as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		</div>

		<!-- Player search -->
		<div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
			<label for="playerSearch" class="text-xs font-medium text-gray-400">Player</label>
			<!-- Hidden field carries the actual userId -->
			<input type="hidden" name="userId" value={selectedUserId} />
			<div class="relative">
				<input
					id="playerSearch"
					type="text"
					autocomplete="off"
					placeholder="Search by name or email…"
					bind:value={playerSearch}
					onfocus={() => dropdownOpen = true}
					oninput={() => { dropdownOpen = true; selectedUserId = ''; }}
					class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none
						{selectedUserId ? 'border-[#c9a84c]' : ''}"
				/>
				{#if dropdownOpen && filteredParticipants.length > 0}
					<!-- Backdrop to close dropdown -->
					<button
						type="button"
						class="fixed inset-0 z-10"
						onclick={() => dropdownOpen = false}
						aria-label="Close"
					></button>
					<ul class="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 py-1 shadow-xl">
						{#each filteredParticipants as u}
							<li>
								<button
									type="button"
									onclick={() => selectUser(u)}
									class="w-full px-3 py-2 text-left text-sm hover:bg-gray-800
										{selectedUserId === u.id ? 'bg-gray-800 text-[#c9a84c]' : 'text-gray-200'}"
								>
									<span class="font-medium">{u.displayName || '—'}</span>
									<span class="ml-2 text-xs text-gray-500">{u.email}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				{#if dropdownOpen && filteredParticipants.length === 0 && playerSearch.trim() !== ''}
					<div class="absolute z-20 mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-500">
						No participants found.
					</div>
				{/if}
			</div>
			{#if selectedUser}
				<p class="text-xs text-green-400">✅ {selectedUser.displayName || selectedUser.email}</p>
			{/if}
		</div>

		<!-- Entry type -->
		<div class="flex flex-col gap-2">
			<p class="text-xs font-medium text-gray-400">Entry type</p>
			<div class="flex gap-3">
				<label class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition
					{entryType === 'lms' ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}">
					<input type="radio" name="entryType" value="lms" bind:group={entryType} class="accent-[#c9a84c]" />
					LMS Full Season
				</label>
				<label class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition
					{entryType === 'second_half' ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}">
					<input type="radio" name="entryType" value="second_half" bind:group={entryType} class="accent-[#c9a84c]" />
					Second Half
				</label>
			</div>
		</div>

		<!-- Number of entries -->
		<div class="flex flex-col gap-1">
			<label for="count" class="text-xs font-medium text-gray-400">Number of entries</label>
			<input id="count" name="count" type="number" min="1" max="20" value="1" required
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
			<p class="text-xs text-gray-600">More than 1 appends a number suffix automatically.</p>
		</div>

		<!-- Base name -->
		<div class="flex flex-col gap-1">
			<label for="baseName" class="text-xs font-medium text-gray-400">Entry base name</label>
			<input id="baseName" name="baseName" type="text" required
				bind:value={baseName}
				placeholder="e.g. Dustin Entry"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			<p class="text-xs text-gray-600">Single entry uses this name as-is (unless they already have entries).</p>
		</div>

		<!-- Referred by -->
		<div class="flex flex-col gap-1">
			<label for="referredBy" class="text-xs font-medium text-gray-400">Referred by (optional)</label>
			<input id="referredBy" name="referredBy" type="text"
				placeholder="Referring player's name"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
		</div>

		<!-- Complimentary -->
		<div class="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
			<label class="flex cursor-pointer items-center gap-2.5">
				<input
					type="checkbox"
					name="complimentary"
					value="true"
					bind:checked={complimentary}
					class="h-4 w-4 rounded border-gray-600 bg-gray-900 accent-[#c9a84c]"
				/>
				<span class="text-sm text-gray-300">Complimentary entry</span>
			</label>
			{#if complimentary}
				<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">Free — no payment required</span>
			{/if}
		</div>

		<!-- Submit -->
		<div class="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
			<button type="submit" disabled={createLoading || !selectedUserId}
				class="rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{createLoading ? 'Creating…' : 'Create entries'}
			</button>
			<button type="button" onclick={() => { showCreateForm = false; playerSearch = ''; selectedUserId = ''; selectedSeasonId = defaultSeason?.id ?? ''; baseName = 'Entry'; complimentary = false; }}
				class="rounded border border-gray-700 px-4 py-2.5 text-sm text-gray-400 transition hover:bg-gray-800">
				Cancel
			</button>
		</div>
	</form>
</div>
{/if}

<!-- Search + select + bulk actions card -->
<div class="mb-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">

	<!-- Deadline notice — shown when a single season is selected -->
	{#if data.seasonFilter && deadlineMap[data.seasonFilter]}
		{@const dl = deadlineMap[data.seasonFilter]}
		{@const isPast = now > new Date(dl).getTime()}
		<div class="mb-3 flex items-center gap-2 text-xs {isPast ? 'text-red-400' : 'text-yellow-400'}">
			<span class="font-semibold">{isPast ? '⚠️ Delete window closed' : '🕐 Delete deadline'}:</span>
			<span>{new Date(dl).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
			{#if isPast}<span class="text-gray-500">— use status change to remove entries</span>{/if}
		</div>
	{/if}

	<!-- Row 1: search + count + select-all -->
	<div class="flex flex-wrap items-center gap-3">
		<div class="relative flex-1 min-w-48">
			<svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
			</svg>
			<input
				type="text"
				placeholder="Search entries or player name…"
				bind:value={ctrl.search}
				class="w-full rounded border border-gray-700 bg-gray-900 py-1.5 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
			/>
			{#if ctrl.search}
				<button onclick={() => ctrl.search = ''} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" aria-label="Clear">✕</button>
			{/if}
		</div>

		<p class="text-sm text-gray-500 shrink-0">
			{visibleEntries.length}{visibleEntries.length !== entries.length ? ` of ${entries.length}` : ''} entr{entries.length === 1 ? 'y' : 'ies'}
		</p>

		{#if visibleEntries.length > 0}
			<label class="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 shrink-0">
				<input
					type="checkbox"
					checked={ctrl.allSelected}
					onchange={() => ctrl.allSelected ? ctrl.clearSelection() : ctrl.selectAll()}
					class="accent-[#c9a84c]"
				/>
				Select all
			</label>
		{/if}
	</div>

	<!-- Row 2: bulk actions — only when entries are selected -->
	{#if ctrl.selectedIds.size > 0}
		<div class="mt-3 flex flex-wrap items-center gap-3 border-t border-[rgba(201,168,76,0.2)] pt-3">
			<span class="text-sm font-semibold text-[#c9a84c]">{ctrl.selectedIds.size} selected</span>
			<div class="h-4 w-px bg-[rgba(201,168,76,0.3)]"></div>

			<!-- Bulk mark paid -->
			<div class="flex items-center gap-2">
				<select
					bind:value={bulkPaidMethod}
					class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-[#c9a84c] focus:outline-none"
				>
					<option value="">Method…</option>
					{#each paymentMethods as m}
						<option value={m}>{m}</option>
					{/each}
				</select>
				<button
					onclick={handleBulkPaid}
					disabled={!bulkPaidMethod || bulkPaidLoading}
					class="rounded border border-green-800 bg-green-950/40 px-3 py-1 text-xs font-medium text-green-400 transition hover:bg-green-950/70 disabled:opacity-40"
				>{bulkPaidLoading ? 'Marking…' : 'Mark All Paid'}</button>
				<InfoTip text="Marks all selected entries as paid using the chosen method and sets their status to active. Select a payment method first." />
			</div>

			<div class="h-4 w-px bg-[rgba(201,168,76,0.3)]"></div>

			<!-- Bulk set status -->
			<div class="flex items-center gap-2">
				<select
					bind:value={bulkStatusValue}
					class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-[#c9a84c] focus:outline-none"
				>
					<option value="">Set status…</option>
					{#each statusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<button
					onclick={handleBulkStatus}
					disabled={!bulkStatusValue || ctrl.bulkLoading}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-800 disabled:opacity-40"
				>{ctrl.bulkLoading ? 'Updating…' : 'Apply'}</button>
				<InfoTip text="Override the status of all selected entries. Use 'eliminated' to remove entries that shouldn't continue, or 'active' to reinstate entries after a correction." />
			</div>

			<button
				onclick={() => { ctrl.clearSelection(); bulkConfirm = false; bulkPaidMethod = ''; bulkStatusValue = ''; }}
				class="ml-auto text-xs text-gray-500 hover:text-gray-300"
			>Clear selection</button>

			{#if ctrl.bulkError}
				<p class="w-full text-xs text-red-400">{ctrl.bulkError}</p>
			{/if}
		</div>
	{/if}
</div>

{#if visibleEntries.length === 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">{ctrl.search ? 'No entries match your search.' : 'No entries match this filter.'}</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each visibleEntries as entry, i}

			<!-- Card -->
			<div
				class="min-w-0 rounded-xl border p-5 backdrop-blur-sm transition
					{ctrl.selectedIds.has(entry.id)
						? 'border-purple-700 bg-purple-950/60'
						: 'border-[rgba(201,168,76,0.3)] bg-black/75'}"
			>
				<div class="flex flex-wrap items-start justify-between gap-4">
					<!-- Entry info -->
					<div class="flex items-start gap-3">
						<!-- Checkbox + row number -->
						<div class="flex flex-col items-center gap-1 pt-0.5">
							<input
								type="checkbox"
								checked={ctrl.selectedIds.has(entry.id)}
								onchange={() => ctrl.toggleSelect(entry.id)}
								class="h-4 w-4 cursor-pointer accent-[#c9a84c]"
								aria-label="Select entry"
							/>
							<span class="text-xs font-bold text-[#c9a84c]">{i + 1}</span>
						</div>
						<div>
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-semibold text-white">{entry.entryName}</p>
							<span class="rounded border px-2 py-0.5 text-xs font-medium {entryTypeBadge[entry.entryType] ?? 'border-gray-700 text-gray-400'}">
								{entry.entryType === 'lms' ? 'LMS' : '2nd Half'}
							</span>
						</div>

						<p class="mt-0.5 text-sm text-gray-400">
							{entry.expand?.user?.displayName ?? entry.expand?.user?.email ?? 'Unknown user'}
							· {entry.expand?.season?.name ?? '—'}
						</p>
						{#if entry.referredBy}
							<p class="mt-0.5 text-xs text-gray-500">Referred by: {entry.referredBy}</p>
						{/if}
						{#if entry.paid && entry.paymentMethod}
							<p class="mt-1 text-xs text-green-400">
								{entry.paymentMethod === 'free' ? 'Free entry' : `Paid via ${entry.paymentMethod}`}
								{#if entry.paidAt && entry.paymentMethod !== 'free'} on {new Date(entry.paidAt).toLocaleDateString()}{/if}
							</p>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex flex-wrap items-center gap-2">
						<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[entry.status] ?? ''}">
							{entry.status.replace('_', ' ')}
						</span>

						{#if !entry.paid}
							<!-- Mark paid -->
							<form method="POST" action="?/markPaid"
								use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
								class="flex items-center gap-2"
							>
							<InfoTip text="Record payment for this entry. Select the method the player used to pay, then click Mark Paid. This sets the entry to active and records the payment date." />
								<input type="hidden" name="id" value={entry.id} />
								<select
									name="paymentMethod"
									bind:value={selectedMethod[entry.id]}
									class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-[#c9a84c] focus:outline-none"
								>
									<option value="">Method…</option>
									{#each paymentMethods as m}
										<option value={m}>{m}</option>
									{/each}
								</select>
								<button
									type="submit"
									disabled={!selectedMethod[entry.id]}
									class="rounded border border-green-800 bg-green-950/40 px-3 py-1 text-xs text-green-400 transition hover:bg-green-950/70 disabled:opacity-40"
								>Mark Paid</button>
							</form>
						{:else}
							<!-- Mark unpaid -->
							<form method="POST" action="?/markUnpaid"
								use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
							>
								<input type="hidden" name="id" value={entry.id} />
								<button type="submit"
									class="rounded border border-gray-700 px-3 py-1 text-xs text-gray-400 transition hover:bg-gray-800">
									Undo Paid
								</button>
							</form>
						{/if}

						<!-- Delete — only before first-game deadline -->
						{#if canDelete(entry)}
							<form method="POST" action="?/deleteEntry"
								use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}
							>
								<input type="hidden" name="id" value={entry.id} />
								<button
									type="submit"
									onclick={(e) => { if (!confirm(`Delete "${entry.entryName}"?`)) e.preventDefault(); }}
									class="rounded border border-red-900 px-3 py-1 text-xs text-red-500 transition hover:bg-red-950/40"
								>Delete</button>
							</form>
						{:else}
							<span class="rounded border border-gray-800 px-3 py-1 text-xs text-gray-600" title="Delete window closed — deadline passed">
								Locked
							</span>
						{/if}

					</div>
					</div><!-- /entry text -->
				</div><!-- /entry info + checkbox -->
			</div><!-- /card -->
		{/each}
	</div>
{/if}
