<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { createEntriesController } from '$lib/controllers';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 10_000); // 10s is enough for deadline checks
		return () => clearInterval(id);
	});

	const ctrl = createEntriesController(data.entries as any[]);
	// Keep controller in sync when page data reloads after form actions or URL filter changes
	$effect(() => {
		ctrl.setEntries(data.entries as any[]);
		// Server already filters by status — keep controller's statusFilter in sync
		// so the client-side derived doesn't double-filter and hide results
		ctrl.statusFilter = (data.statusFilter ?? 'all') as any;
	});

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

	const paymentMethods: { value: string; label: string }[] = [
		{ value: 'check',  label: 'Check'  },
		{ value: 'venmo',  label: 'Venmo'  },
		{ value: 'paypal', label: 'PayPal' },
		{ value: 'zelle',  label: 'Zelle'  },
		{ value: 'cash',   label: 'Cash'   },
		{ value: 'free',   label: 'Free / Complimentary' },
	];

	let selectedMethod: Record<string, string> = $state({});
	let createLoading  = $state(false);
	let showCreateForm = $state(false);
	let modalStep      = $state(1); // 1 = player, 2 = configure, 3 = review
	let entryCount     = $state(1);
	let referredBy     = $state('');

	function openModal() {
		playerSearch     = '';
		selectedUserId   = '';
		selectedSeasonId = defaultSeason?.id ?? '';
		entryType        = 'lms';
		complimentary    = false;
		entryCount       = 1;
		referredBy       = '';
		modalStep        = 1;
		showCreateForm   = true;
		// baseName is set reactively by $effect based on selectedUser + entryType
	}
	function closeModal() {
		showCreateForm = false;
	}
	function nextStep() { modalStep = Math.min(modalStep + 1, 3); }
	function prevStep() { modalStep = Math.max(modalStep - 1, 1); }

	// Step 1 valid when a player is selected
	const step1Valid = $derived(!!selectedUserId);
	// Step 2 valid when season + baseName filled
	const step2Valid = $derived(!!selectedSeasonId && baseName.trim().length >= 2);

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

	// Entry type — default lms; auto-set when season only supports one pool
	let entryType     = $state('lms');
	let complimentary = $state(false);

	const modalHasLms = $derived((() => {
		const s = (data.seasons as any[]).find((s: any) => s.id === selectedSeasonId);
		return !s || s.lmsEnabled !== false;
	})());
	const modalHasSh = $derived((() => {
		const s = (data.seasons as any[]).find((s: any) => s.id === selectedSeasonId);
		return !s || s.secondHalfEnabled !== false;
	})());

	$effect(() => {
		if (modalHasLms && !modalHasSh) entryType = 'lms';
		if (!modalHasLms && modalHasSh) entryType = 'second_half';
		// Auto-switch when deadline flips
		if (!canSelectLms && entryType === 'lms')          entryType = 'second_half';
		if (!canSelectSh  && entryType === 'second_half')  entryType = 'lms';
	});

	// Base name — auto-fills from player + entry type, stays editable
	let baseName = $state('LMS');
	$effect(() => {
		if (!selectedUser?.displayName) {
			baseName = entryType === 'second_half' ? '2nd Half' : 'LMS';
		} else {
			baseName = entryType === 'second_half'
				? `${selectedUser.displayName} 2nd Half`
				: `${selectedUser.displayName} LMS`;
		}
	});

	// Client-side search and pool type filter delegated to controller
	const visibleEntries = $derived(ctrl.filtered);

	// Deadline helpers — keyed by seasonId
	const deadlineMap        = $derived(data.deadlineMap as Record<string, string>);
	const PST = 'America/Los_Angeles';
	function fmtDeadline(iso: string) {
		return new Date(iso).toLocaleString('en-US', {
			timeZone: PST, month: 'short', day: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}
	function deadlineDiff(iso: string) { return new Date(iso).getTime() - now; }

	// LMS deadline — 20 min before week 1 first kickoff
	const activeDeadline     = $derived((data.lmsEntryDeadline as string | null) ?? null);
	const activeDeadlinePast = $derived(activeDeadline ? now > new Date(activeDeadline).getTime() : false);
	// LMS is only available before the Week 1 pick deadline; Second Half only after
	const canSelectLms = $derived(!activeDeadlinePast);
	const canSelectSh  = $derived(activeDeadlinePast);
	const activeDeadlineDiff = $derived(activeDeadline ? deadlineDiff(activeDeadline) : 0);
	const activeDeadlineDays = $derived(activeDeadlineDiff > 0 ? Math.floor(activeDeadlineDiff / 86_400_000) : 0);
	const activeDeadlineH    = $derived(activeDeadlineDiff > 0 ? Math.floor((activeDeadlineDiff % 86_400_000) / 3_600_000) : 0);
	const activeDeadlineM    = $derived(activeDeadlineDiff > 0 ? Math.floor((activeDeadlineDiff % 3_600_000) / 60_000) : 0);
	const activeDeadlineS    = $derived(activeDeadlineDiff > 0 ? Math.floor((activeDeadlineDiff % 60_000) / 1_000) : 0);

	// 2H deadline — 20 min before week 6 first kickoff
	const shDeadline     = $derived((data.shEntryDeadline as string | null) ?? null);
	const shDeadlinePast = $derived(shDeadline ? now > new Date(shDeadline).getTime() : false);
	const shDeadlineDiff = $derived(shDeadline ? deadlineDiff(shDeadline) : 0);
	const shDeadlineDays = $derived(shDeadlineDiff > 0 ? Math.floor(shDeadlineDiff / 86_400_000) : 0);
	const shDeadlineH    = $derived(shDeadlineDiff > 0 ? Math.floor((shDeadlineDiff % 86_400_000) / 3_600_000) : 0);
	const shDeadlineM    = $derived(shDeadlineDiff > 0 ? Math.floor((shDeadlineDiff % 3_600_000) / 60_000) : 0);
	const shDeadlineS    = $derived(shDeadlineDiff > 0 ? Math.floor((shDeadlineDiff % 60_000) / 1_000) : 0);

	// Which deadline applies to the current pool type filter
	const currentDeadlinePast = $derived(filterPoolType === 'second_half' ? shDeadlinePast : activeDeadlinePast);
	const currentDeadlineDiff = $derived(filterPoolType === 'second_half' ? shDeadlineDiff : activeDeadlineDiff);
	const currentDeadlineDays = $derived(filterPoolType === 'second_half' ? shDeadlineDays : activeDeadlineDays);
	const currentDeadlineH    = $derived(filterPoolType === 'second_half' ? shDeadlineH    : activeDeadlineH);
	const currentDeadlineM    = $derived(filterPoolType === 'second_half' ? shDeadlineM    : activeDeadlineM);
	const currentDeadlineS    = $derived(filterPoolType === 'second_half' ? shDeadlineS    : activeDeadlineS);
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

	// ── Stats (all entries, unfiltered — separate from the filtered list) ───
	const activeSeason    = $derived(data.activeSeason as any);
	const allEntries      = $derived(data.statsAll as any[]);
	const lmsFee          = $derived((activeSeason?.lmsEntryFee        ?? 0) as number);
	const shFee           = $derived((activeSeason?.secondHalfEntryFee ?? 0) as number);
	const lmsEntries      = $derived(allEntries.filter((e: any) => e.entryType === 'lms'));
	const shEntries       = $derived(allEntries.filter((e: any) => e.entryType === 'second_half'));
	const lmsCount        = $derived(lmsEntries.length);
	const shCount         = $derived(shEntries.length);
	const totalCount      = $derived(lmsCount + shCount);
	const lmsRevenue      = $derived(lmsFee * lmsEntries.filter((e: any) => e.paid && e.paymentMethod !== 'free').length);
	const shRevenue       = $derived(shFee  * shEntries.filter((e: any)  => e.paid && e.paymentMethod !== 'free').length);
	const totalPot        = $derived(lmsRevenue + shRevenue);
	const maintFee        = $derived((activeSeason?.maintenanceFee ?? 0) as number);
	const lmsNetPayout    = $derived(Math.max(0, lmsRevenue - maintFee));
	let maintFeeInput     = $state(String(maintFee));
	$effect(() => { maintFeeInput = String(maintFee); });
	const paidCount       = $derived(allEntries.filter((e: any) => e.paid).length);
	const freeCount       = $derived(allEntries.filter((e: any) => e.paymentMethod === 'free').length);
	const pendingCount    = $derived(allEntries.filter((e: any) => e.status === 'pending_payment').length);
	const activeCount     = $derived(allEntries.filter((e: any) => e.status === 'active').length);
	const eliminatedCount = $derived(allEntries.filter((e: any) => e.status === 'eliminated').length);
	const registeredCount = $derived(new Set(allEntries.map((e: any) => e.user)).size);

	let statsOpen = $state(true);

	// Local filter state — kept in sync with URL params so selects reflect current state
	let filterStatus   = $state(data.statusFilter ?? 'all');
	let filterPoolType = $state(data.poolType     ?? 'all');
	$effect(() => {
		filterStatus   = data.statusFilter ?? 'all';
		filterPoolType = data.poolType     ?? 'all';
	});

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

	// Inline rename
	let renamingId    = $state<string | null>(null);
	let renameValue   = $state('');
	function startRename(entry: any) {
		renamingId  = entry.id;
		renameValue = entry.entryName;
	}
	function cancelRename() {
		renamingId = null;
		renameValue = '';
	}

	// Bulk delete
	let bulkDeleteConfirm = $state(false);
	let deleteConfirmId   = $state<string | null>(null);
	async function handleBulkDelete() {
		if (!bulkDeleteConfirm) { bulkDeleteConfirm = true; return; }
		bulkDeleteConfirm = false;
		const result = await ctrl.bulkDelete();
		if (result.success) await invalidateAll();
	}

	// Keep old handler alias for eliminated confirm reset
	async function handleBulkInactive() {
		bulkStatusValue = 'eliminated';
		await handleBulkStatus();
	}
</script>

<svelte:head><title>Entries — Admin</title></svelte:head>

<!-- ── Single card ────────────────────────────────────────────────────────── -->
<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">

<!-- Header: title + filters + add button -->
<div class="p-4">
	<div class="flex flex-wrap items-center justify-between gap-4">

		<!-- Title + deadlines -->
		<div>
			<h1 class="text-2xl font-bold text-white">Entries & Payments</h1>
			{#if activeSeason}
				<div class="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5">
					{#if activeDeadline}
						<p class="text-sm {activeDeadlinePast ? 'text-red-400' : 'text-yellow-400'}">
							LMS · {activeDeadlinePast ? '⚠ closed' : 'deadline'} {fmtDeadline(activeDeadline)}
						</p>
					{/if}
					{#if shDeadline}
						<p class="text-sm {shDeadlinePast ? 'text-red-400' : 'text-blue-400'}">
							2nd Half · {shDeadlinePast ? '⚠ closed' : 'deadline'} {fmtDeadline(shDeadline)}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Filters + button -->
		<div class="flex flex-wrap items-center gap-3">
			<!-- Pool type filter -->
			<select
				bind:value={filterPoolType}
				onchange={() => updateFilter('poolType', filterPoolType)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				<option value="all">All entries</option>
				<option value="lms">LMS only</option>
				<option value="second_half">2nd Half only</option>
			</select>

			<!-- Status filter -->
			<div class="flex items-center gap-1.5">
				<select
					bind:value={filterStatus}
					onchange={() => updateFilter('status', filterStatus)}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
				>
					{#each statusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<InfoTip text="pending_payment — registered but not yet paid. active — paid and in the pool. eliminated — picked incorrectly and removed from contention." />
			</div>

			<button
			type="button"
			onclick={openModal}
			disabled={currentDeadlinePast}
			title={currentDeadlinePast ? 'Entry deadline has passed — no new entries can be added' : 'Add new entries'}
			class="rounded-lg px-5 py-2.5 text-base font-semibold text-white transition
				{currentDeadlinePast
					? 'cursor-not-allowed bg-gray-700 opacity-50'
					: 'bg-green-600 hover:bg-green-500'}"
		>
			{#if currentDeadlinePast}
				Entries Closed
			{:else}
				+ Add Entries
				{#if currentDeadlineDiff > 0}
					<span class="ml-2 font-mono text-xs font-normal opacity-80">
						{#if currentDeadlineDays > 0}{currentDeadlineDays}d {/if}{String(currentDeadlineH).padStart(2,'0')}:{String(currentDeadlineM).padStart(2,'0')}:{String(currentDeadlineS).padStart(2,'0')}
					</span>
				{/if}
			{/if}
		</button>
		</div><!-- /filters + button -->

	</div><!-- /flex row -->
</div><!-- /header section -->

<!-- Stats + description (collapsible) -->
<div class="border-t border-gray-800">
	<!-- Toggle header -->
	<button
		type="button"
		onclick={() => statsOpen = !statsOpen}
		class="flex w-full items-center justify-between px-5 py-3 text-left"
	>
		<span class="text-sm font-semibold text-gray-300">
			{#if activeSeason}{activeSeason.name} Stats{:else}Season Stats{/if}
		</span>
		<span class="text-xs text-gray-600">{statsOpen ? '▲ collapse' : '▼ expand'}</span>
	</button>

	{#if statsOpen}
		<!-- Stat tiles -->
		{#if activeSeason}

		<!-- Maintenance fee input -->
		<div class="flex items-center gap-4 border-t border-gray-800 px-5 py-3">
			<label for="maintFeeInput" class="text-xs font-medium text-gray-500 shrink-0">Maintenance fee ($)</label>
			<form method="POST" action="?/saveMaintenance" use:enhance={() => {
				return async ({ update }) => { await update(); await invalidateAll(); };
			}} class="flex items-center gap-2">
				<input type="hidden" name="seasonId" value={activeSeason.id} />
				<input
					id="maintFeeInput"
					type="number"
					name="maintenanceFee"
					min="0"
					step="1"
					bind:value={maintFeeInput}
					class="w-28 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
				/>
				<button type="submit"
					class="rounded border border-[rgba(201,168,76,0.4)] px-3 py-1 text-xs text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.1)]">
					Save
				</button>
			</form>
			{#if Number(maintFeeInput) > 0}
				{@const previewNet = Math.max(0, lmsRevenue - Number(maintFeeInput))}
				<p class="text-xs text-gray-600">LMS net payout: <span class="text-white font-medium">${previewNet.toLocaleString()}</span></p>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-px border-t border-gray-800 sm:grid-cols-4">
			<!-- Total Pot -->
			<div class="bg-black/60 px-5 py-4">
				<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Total Pot</p>
				<p class="mt-1 text-2xl font-bold text-white">${(maintFee > 0 ? lmsNetPayout + shRevenue : totalPot).toLocaleString()}</p>
				{#if maintFee > 0}
					<p class="mt-0.5 text-xs text-gray-600">Gross ${totalPot.toLocaleString()} − ${maintFee.toLocaleString()} fee</p>
				{/if}
				<p class="mt-0.5 text-xs text-gray-600">{freeCount} free · {paidCount - freeCount} paid</p>
			</div>
			<!-- Total Entries -->
			<div class="bg-black/60 px-5 py-4">
				<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Total Entries</p>
				<p class="mt-1 text-2xl font-bold text-white">{totalCount}</p>
				<p class="mt-0.5 text-xs text-gray-600">LMS {lmsCount} · 2H {shCount}</p>
			</div>
			<!-- Paid -->
			<div class="bg-black/60 px-5 py-4">
				<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Paid</p>
				<p class="mt-1 text-2xl font-bold text-white">{paidCount}</p>
				<p class="mt-0.5 text-xs text-gray-600">{freeCount} free · {pendingCount} pending</p>
			</div>
			<!-- Active / Eliminated -->
			<div class="bg-black/60 px-5 py-4">
				<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Active / Eliminated</p>
				<p class="mt-1 text-2xl font-bold text-white">{activeCount} / {eliminatedCount}</p>
				<p class="mt-0.5 text-xs text-gray-600">{registeredCount} registered users</p>
			</div>
		</div>
		{/if}

		<!-- Description cards -->
		<div class="grid gap-px border-t border-gray-800 sm:grid-cols-3">
			<div class="bg-black/40 px-4 py-3 text-sm text-gray-400">
				<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Manage Entries</p>
				Add, edit, and delete player entries. Each entry is one shot at the pool — a player can hold multiple.
			</div>
			<div class="bg-black/40 px-4 py-3 text-sm text-gray-400">
				<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Collect Payments</p>
				Mark entries as paid once you've received the fee. Unpaid entries stay in <span class="text-yellow-400">pending_payment</span> and won't receive picks until activated.
			</div>
			<div class="bg-black/40 px-4 py-3 text-sm text-gray-400 sm:rounded-br-xl">
				<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">Use the Filters</p>
				Filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees, or pick a season to scope bulk actions before week 1 locks.
			</div>
		</div>
	{/if}
</div><!-- /stats section -->

<!-- Toasts -->
{#if form?.action === 'create' && form?.success}
	<div class="mx-4 mt-3 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
		Created: {(form.created as string[]).join(', ')}
	</div>
{/if}
{#if form?.error}
	<div class="mx-4 mt-3 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">{form.error}</div>
{/if}

<!-- ── Add Entries Modal ──────────────────────────────────────────────────── -->
{#if showCreateForm}
{@const createDeadline = deadlineMap[selectedSeasonId]}
{@const createDeadlinePast = createDeadline ? now > new Date(createDeadline).getTime() : false}
{@const selectedSeason = (data.seasons as any[]).find((s: any) => s.id === selectedSeasonId)}

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
	onclick={closeModal}
	aria-label="Close modal"
></button>

<!-- Modal panel -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<div class="relative w-full max-w-lg rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#0a0a0a] shadow-2xl"
		style="background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%), #0a0a0a;">

		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[rgba(201,168,76,0.15)] px-6 py-4">
			<div>
				<h2 class="text-base font-bold text-white">Add Entries</h2>
				<p class="mt-0.5 text-xs text-gray-500">
					Step {modalStep} of 3 —
					{#if modalStep === 1}Select player{:else if modalStep === 2}Configure entry{:else}Review &amp; confirm{/if}
				</p>
			</div>
			<button type="button" onclick={closeModal}
				class="rounded p-1.5 text-gray-500 transition hover:bg-gray-800 hover:text-white"
				aria-label="Close">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		</div>

		<!-- Step indicators -->
		<div class="flex items-center gap-0 border-b border-gray-800 px-6 py-3">
			{#each [
				{ n: 1, label: 'Player'    },
				{ n: 2, label: 'Configure' },
				{ n: 3, label: 'Review'    },
			] as step}
				<div class="flex items-center gap-0">
					<div class="flex items-center gap-2">
						<div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
							{modalStep > step.n  ? 'bg-green-600 text-white' :
							 modalStep === step.n ? 'bg-[#c9a84c] text-black' :
							                        'bg-gray-800 text-gray-500'}">
							{#if modalStep > step.n}✓{:else}{step.n}{/if}
						</div>
						<span class="text-xs {modalStep === step.n ? 'text-white font-medium' : 'text-gray-600'}">{step.label}</span>
					</div>
					{#if step.n < 3}
						<div class="mx-3 h-px w-8 {modalStep > step.n ? 'bg-green-700' : 'bg-gray-800'}"></div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Error banner -->
		{#if form?.error}
			<div class="mx-6 mt-4 rounded border border-red-800 bg-red-950/60 px-4 py-2.5 text-sm text-red-400">{form.error}</div>
		{/if}

		<!-- ── Step 1: Select Player ── -->
		{#if modalStep === 1}
		<div class="px-6 py-5">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Search for a participant</p>
			<div class="relative">
				<input
					type="text"
					autocomplete="off"
					placeholder="Name or email…"
					bind:value={playerSearch}
					onfocus={() => dropdownOpen = true}
					oninput={() => { dropdownOpen = true; selectedUserId = ''; }}
					class="w-full rounded-lg border bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none
						{selectedUserId ? 'border-[#c9a84c]' : 'border-gray-700 focus:border-[#c9a84c]'}"
				/>
				{#if dropdownOpen && filteredParticipants.length > 0}
					<button type="button" class="fixed inset-0 z-10" onclick={() => dropdownOpen = false} aria-label="Close"></button>
					<ul class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 py-1 shadow-xl">
						{#each filteredParticipants as u}
							<li>
								<button type="button" onclick={() => selectUser(u)}
									class="w-full px-4 py-2.5 text-left text-sm transition hover:bg-gray-800
										{selectedUserId === u.id ? 'bg-gray-800 text-[#c9a84c]' : 'text-gray-200'}">
									<span class="font-medium">{u.displayName || '—'}</span>
									<span class="ml-2 text-xs text-gray-500">{u.email}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				{#if dropdownOpen && filteredParticipants.length === 0 && playerSearch.trim()}
					<div class="absolute z-20 mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-gray-500">No participants found.</div>
				{/if}
			</div>

			{#if selectedUser}
				<div class="mt-4 flex items-center gap-3 rounded-lg border border-green-800 bg-green-950/30 px-4 py-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-green-300">
						{(selectedUser.displayName || selectedUser.email)[0].toUpperCase()}
					</div>
					<div>
						<p class="text-sm font-semibold text-white">{selectedUser.displayName || '—'}</p>
						<p class="text-xs text-gray-400">{selectedUser.email}</p>
					</div>
					<span class="ml-auto text-green-400">✓</span>
				</div>
			{/if}
		</div>

		<!-- Step 1 footer -->
		<div class="flex items-center justify-between border-t border-gray-800 px-6 py-4">
			<button type="button" onclick={closeModal} class="text-sm text-gray-500 hover:text-gray-300">Cancel</button>
			<button type="button" onclick={nextStep} disabled={!step1Valid}
				class="rounded-lg bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40">
				Next →
			</button>
		</div>

		<!-- ── Step 2: Configure Entry ── -->
		{:else if modalStep === 2}
		<div class="px-6 py-5 flex flex-col gap-4">

			{#if createDeadlinePast}
				<div class="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
					⚠ The first pick deadline for this season has passed — new entries cannot be added.
				</div>
			{/if}

			<!-- Season -->
			<div class="flex flex-col gap-1.5">
				<label class="text-xs font-medium text-gray-400">Season</label>
				<select bind:value={selectedSeasonId}
					class="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
					{#each data.seasons as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>

			<!-- Pool type — only shown when season supports both pools -->
			{#if modalHasLms && modalHasSh}
			<div class="flex flex-col gap-1.5">
				<p class="text-xs font-medium text-gray-400">Pool type</p>
				<div class="grid grid-cols-2 gap-2">
					<label class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition
						{!canSelectLms ? 'cursor-not-allowed opacity-40 border-gray-800 text-gray-600' : 'cursor-pointer'}
						{canSelectLms && entryType === 'lms' ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-white' : ''}
						{canSelectLms && entryType !== 'lms' ? 'border-gray-700 text-gray-400 hover:border-gray-600' : ''}">
						<input type="radio" bind:group={entryType} value="lms" disabled={!canSelectLms} class="accent-[#c9a84c]" />
						<span>LMS Full Season</span>
					</label>
					<label class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition
						{!canSelectSh ? 'cursor-not-allowed opacity-40 border-gray-800 text-gray-600' : 'cursor-pointer'}
						{canSelectSh && entryType === 'second_half' ? 'border-blue-500 bg-blue-950/30 text-white' : ''}
						{canSelectSh && entryType !== 'second_half' ? 'border-gray-700 text-gray-400 hover:border-gray-600' : ''}">
						<input type="radio" bind:group={entryType} value="second_half" disabled={!canSelectSh} class="accent-blue-400" />
						<span>Second Half</span>
					</label>
				</div>
				<p class="text-xs text-gray-600">
					{#if canSelectLms}LMS available until Week 1 pick deadline · Second Half opens after{:else}Second Half available · LMS closed after Week 1 deadline{/if}
				</p>
			</div>
			{/if}

			<!-- Count + base name side by side -->
			<div class="grid grid-cols-2 gap-3">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-gray-400">Number of entries</label>
					<input type="number" min="1" max="20" bind:value={entryCount}
						class="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
					<p class="text-xs text-gray-600">Max 20. Suffix added when &gt; 1.</p>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-medium text-gray-400">Entry base name</label>
					<input type="text" bind:value={baseName} placeholder="e.g. Dustin Entry"
						class="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
				</div>
			</div>

			<!-- Referred by -->
			<div class="flex flex-col gap-1.5">
				<label class="text-xs font-medium text-gray-400">Referred by <span class="text-gray-600">(optional)</span></label>
				<input type="text" bind:value={referredBy} placeholder="Referring player's name"
					class="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<!-- Complimentary -->
			<label class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition
				{complimentary ? 'border-green-700 bg-green-950/30' : 'border-gray-700 hover:border-gray-600'}">
				<input type="checkbox" bind:checked={complimentary} class="h-4 w-4 accent-green-500" />
				<div>
					<p class="text-sm font-medium text-white">Complimentary entry</p>
					<p class="text-xs text-gray-500">Marks as paid immediately — no payment required.</p>
				</div>
				{#if complimentary}
					<span class="ml-auto rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">Free</span>
				{/if}
			</label>
		</div>

		<!-- Step 2 footer -->
		<div class="flex items-center justify-between border-t border-gray-800 px-6 py-4">
			<button type="button" onclick={prevStep} class="text-sm text-gray-500 hover:text-gray-300">← Back</button>
			<button type="button" onclick={nextStep} disabled={!step2Valid || createDeadlinePast}
				class="rounded-lg bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40">
				Review →
			</button>
		</div>

		<!-- ── Step 3: Review & Submit ── -->
		{:else}
		<form method="POST" action="?/createEntries"
			use:enhance={() => {
				createLoading = true;
				return async ({ result, update }) => {
					await update();
					createLoading = false;
					if (result.type === 'success') closeModal();
					else modalStep = 2; // bounce back to configure on error
				};
			}}
		>
			<!-- Hidden fields -->
			<input type="hidden" name="seasonId"      value={selectedSeasonId} />
			<input type="hidden" name="userId"        value={selectedUserId} />
			<input type="hidden" name="entryType"     value={entryType} />
			<input type="hidden" name="count"         value={entryCount} />
			<input type="hidden" name="baseName"      value={baseName} />
			<input type="hidden" name="referredBy"    value={referredBy} />
			{#if complimentary}
				<input type="hidden" name="complimentary" value="true" />
			{/if}

			<div class="px-6 py-5">
				<p class="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Confirm details</p>
				<dl class="flex flex-col gap-3 text-sm">
					<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
						<dt class="text-gray-500">Player</dt>
						<dd class="font-semibold text-white">{selectedUser?.displayName || selectedUser?.email || '—'}</dd>
					</div>
					<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
						<dt class="text-gray-500">Season</dt>
						<dd class="text-right text-gray-300">{selectedSeason?.name ?? '—'}</dd>
					</div>
					<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
						<dt class="text-gray-500">Pool type</dt>
						<dd>
							{#if entryType === 'lms'}
								<span class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] px-2 py-0.5 text-xs font-semibold text-[#c9a84c]">LMS</span>
							{:else}
								<span class="rounded border border-blue-800 bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-400">2nd Half</span>
							{/if}
						</dd>
					</div>
					<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
						<dt class="text-gray-500">Entries</dt>
						<dd class="text-gray-300">
							{#if entryCount === 1}
								<span class="font-semibold text-white">{baseName}</span>
							{:else}
								<span class="font-semibold text-white">{entryCount}×</span>
								<span class="ml-1 text-gray-400">{baseName} 1 … {baseName} {entryCount}</span>
							{/if}
						</dd>
					</div>
					{#if referredBy}
						<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
							<dt class="text-gray-500">Referred by</dt>
							<dd class="text-gray-300">{referredBy}</dd>
						</div>
					{/if}
					<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
						<dt class="text-gray-500">Payment</dt>
						<dd>
							{#if complimentary}
								<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs font-semibold text-green-400">Free / Complimentary</span>
							{:else}
								<span class="text-yellow-400">Pending payment</span>
							{/if}
						</dd>
					</div>
				</dl>
			</div>

			<!-- Step 3 footer -->
			<div class="flex items-center justify-between border-t border-gray-800 px-6 py-4">
				<button type="button" onclick={prevStep} class="text-sm text-gray-500 hover:text-gray-300">← Back</button>
				<button type="submit" disabled={createLoading}
					class="rounded-lg bg-[#c9a84c] px-6 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40">
					{createLoading ? 'Creating…' : `Create ${entryCount > 1 ? entryCount + ' entries' : 'entry'}`}
				</button>
			</div>
		</form>
		{/if}

	</div>
</div>
{/if}

<!-- Search + select + bulk actions — sticky inside the card -->
<div class="sticky top-0 z-10 border-t border-gray-800 bg-black/95 p-4 backdrop-blur-sm">



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

		<!-- Sort buttons -->
		<div class="flex items-center gap-1 shrink-0">
			<span class="text-xs text-gray-600 mr-1">Sort:</span>
			{#each ([['name','Name'],['player','Player'],['status','Status'],['paid','Paid']] as const) as [col, label]}
				<button
					type="button"
					onclick={() => ctrl.toggleSort(col)}
					class="flex items-center gap-0.5 rounded border px-2 py-1 text-xs transition
						{ctrl.sortCol === col
							? 'border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] text-[#c9a84c]'
							: 'border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-300'}"
				>
					{label}
					{#if ctrl.sortCol === col}
						<span class="text-[9px]">{ctrl.sortDir === 'asc' ? '▲' : '▼'}</span>
					{/if}
				</button>
			{/each}
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
						<option value={m.value}>{m.label}</option>
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

			<div class="h-4 w-px bg-[rgba(201,168,76,0.3)]"></div>

			<!-- Bulk delete -->
			{#if bulkDeleteConfirm}
				<span class="text-xs text-red-400">Delete {ctrl.selectedIds.size} entries? This cannot be undone.</span>
				<button
					onclick={handleBulkDelete}
					disabled={ctrl.bulkLoading}
					class="rounded border border-red-700 bg-red-950/60 px-3 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-950 disabled:opacity-40"
				>{ctrl.bulkLoading ? 'Deleting…' : 'Confirm Delete'}</button>
				<button
					onclick={() => bulkDeleteConfirm = false}
					class="text-xs text-gray-500 hover:text-gray-300"
				>Cancel</button>
			{:else}
				<button
					onclick={handleBulkDelete}
					disabled={ctrl.bulkLoading}
					class="rounded border border-red-900 bg-red-950/30 px-3 py-1 text-xs font-medium text-red-500 transition hover:bg-red-950/60 disabled:opacity-40"
				>Delete selected</button>
			{/if}

			<button
				onclick={() => { ctrl.clearSelection(); bulkConfirm = false; bulkDeleteConfirm = false; deleteConfirmId = null; bulkPaidMethod = ''; bulkStatusValue = ''; }}
				class="ml-auto text-xs text-gray-500 hover:text-gray-300"
			>Clear selection</button>

			{#if ctrl.bulkError}
				<p class="w-full text-xs text-red-400">{ctrl.bulkError}</p>
			{/if}
		</div>
	{/if}
</div><!-- /sticky search bar -->

<!-- Entry list -->
<div class="border-t border-gray-800 overflow-y-auto max-h-[60vh] divide-y divide-gray-800/60">
{#if visibleEntries.length === 0}
	<div class="p-12 text-center">
		<p class="text-gray-400">{ctrl.search ? 'No entries match your search.' : 'No entries match this filter.'}</p>
	</div>
{:else}
		{#each visibleEntries as entry, i}

			<!-- Row -->
			<div
				class="min-w-0 p-5 transition
					{ctrl.selectedIds.has(entry.id)
						? 'bg-purple-950/40'
						: 'hover:bg-white/[0.02]'}"
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
							{#if renamingId === entry.id}
								<form
									method="POST"
									action="?/renameEntry"
									use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); cancelRename(); }}
									class="flex items-center gap-1.5"
								>
									<input type="hidden" name="id" value={entry.id} />
									<input
										type="text"
										name="name"
										bind:value={renameValue}
										class="rounded border border-[#c9a84c]/60 bg-gray-900 px-2 py-0.5 text-sm font-semibold text-white focus:border-[#c9a84c] focus:outline-none"
										onkeydown={(e) => e.key === 'Escape' && cancelRename()}
									/>
									<button type="submit" class="rounded border border-green-800 bg-green-950/40 px-2 py-0.5 text-xs text-green-400 hover:bg-green-950/70">Save</button>
									<button type="button" onclick={cancelRename} class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs text-gray-400 hover:text-white">✕</button>
								</form>
							{:else}
								<button
									type="button"
									onclick={() => startRename(entry)}
									class="font-semibold text-white hover:text-[#c9a84c] transition-colors text-left"
									title="Click to rename"
								>{entry.entryName}</button>
							{/if}
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
										<option value={m.value}>{m.label}</option>
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
							{#if deleteConfirmId === entry.id}
								<form method="POST" action="?/deleteEntry"
									use:enhance={() => async ({ update }) => { deleteConfirmId = null; await update(); await invalidateAll(); }}
								>
									<input type="hidden" name="id" value={entry.id} />
									<button type="submit"
										class="rounded border border-red-500 bg-red-950/40 px-3 py-1 text-xs text-red-400 transition hover:bg-red-900/60"
									>Confirm</button>
								</form>
								<button
									type="button"
									onclick={() => deleteConfirmId = null}
									class="rounded border border-gray-700 px-3 py-1 text-xs text-gray-400 transition hover:bg-gray-800"
								>Cancel</button>
							{:else}
								<button
									type="button"
									onclick={() => deleteConfirmId = entry.id}
									class="rounded border border-red-900 px-3 py-1 text-xs text-red-500 transition hover:bg-red-950/40"
								>Delete</button>
							{/if}
						{:else}
							<span class="rounded border border-gray-800 px-3 py-1 text-xs text-gray-600" title="Delete window closed — deadline passed">
								Locked
							</span>
						{/if}

					</div>
					</div><!-- /entry text -->
				</div><!-- /entry info + checkbox -->
			</div><!-- /row -->
		{/each}
{/if}
</div><!-- /entry list -->

</div><!-- /single card -->
