<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import InfoTip from '$lib/components/InfoTip.svelte';
	let { data }: { data: PageData } = $props();

	const isSuperAdmin = $derived(data.role === 'super_admin');

	// Test seasons
	const testSeasons   = $derived((data.seasons as any[]).filter((s: any) => s.name?.includes('[TEST]')));
	const testSeasons1h = $derived(testSeasons.filter((s: any) => s.name?.includes('(1h/week)')));
	const testSeasons1d = $derived(testSeasons.filter((s: any) => s.name?.includes('(1d/week)')));

	// Test season management
	let testBusy    = $state(false);
	let testMessage = $state('');
	let testError   = $state('');
	// Inline confirm state — stores the seasonId pending clear, or interval pending reset
	let clearConfirmId    = $state<string | null>(null);
	let resetConfirmGroup = $state<string | null>(null);

	async function submitTestAction(action: string, formData: FormData) {
		testBusy    = true;
		testMessage = '';
		testError   = '';
		try {
			const res  = await fetch(`?/${action}`, { method: 'POST', body: formData });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				testError = json?.data?.error ?? 'Action failed.';
			} else {
				testMessage = action === 'clearTestSeason'
					? 'Season cleared.'
					: action === 'seedTestSeason'
					? 'Test season seeded — weeks advancing automatically.'
					: 'Reset complete — fresh test season ready.';
				await invalidateAll();
			}
		} catch (e: any) {
			testError = e.message;
		} finally {
			testBusy = false;
		}
	}

	// Default to the first active LMS (non-second-half) season
	const defaultSeasonId = (data.seasons as any[]).find(
		s => !s.name?.toLowerCase().includes('second half') && (s.status === 'active' || s.status === 'open')
	)?.id ?? (data.seasons as any[])[0]?.id ?? '';

	let selectedSeasonId = $state(defaultSeasonId);

	const selectedSeason = $derived(
		(data.seasons as any[]).find(s => s.id === selectedSeasonId) ?? null
	);
	const selectedData = $derived(
		(data.seasonDataMap as any)[selectedSeasonId] ?? null
	);
	const selectedPoolType = $derived((() => {
		const season = selectedSeason as any;
		if (!season) return 'all';
		const byFlags = season.lmsEnabled === false && season.secondHalfEnabled !== false;
		const byName = String(season.name ?? '').toLowerCase().includes('second half');
		return byFlags || byName ? 'second_half' : 'lms';
	})();

	const poolTableEntries = $derived((selectedData?.tableEntries as any[] ?? []).filter((entry: any) => {
		if (!selectedSeason) return true;
		return selectedPoolType === 'all' ? true : entry.entryType === selectedPoolType;
	}));

	const poolStats = $derived((() => {
		const rows = poolTableEntries;
		if (!selectedSeason || rows.length === 0) return selectedData?.stats ?? null;

		const paidRows = rows.filter((entry: any) => entry.paid && entry.paymentMethod !== 'free');
		const freeRows = rows.filter((entry: any) => entry.paid && entry.paymentMethod === 'free');
		const maintenanceFee = Number((selectedSeason as any)?.maintenanceFee ?? 0);
		const feeFor = (entry: any) => entry.entryType === 'lms'
			? Number((selectedSeason as any)?.lmsEntryFee ?? 0)
			: Number((selectedSeason as any)?.secondHalfEntryFee ?? 0);
		const paidTotal = paidRows.reduce((sum: number, entry: any) => sum + feeFor(entry), 0);
		const poolTotalEntries = rows.length;
		const poolLmsEntries = rows.filter((entry: any) => entry.entryType === 'lms').length;
		const poolShEntries = rows.filter((entry: any) => entry.entryType === 'second_half').length;
		const poolPending = rows.filter((entry: any) => entry.status === 'pending_payment').length;
		return {
			totalUsers: new Set(rows.map((entry: any) => entry.user)).size,
			totalEntries: poolTotalEntries,
			lmsEntries: poolLmsEntries,
			secondHalfEntries: poolShEntries,
			paidEntries: rows.filter((entry: any) => entry.paid).length,
			freeEntries: freeRows.length,
			pendingPayment: poolPending,
			activeEntries: rows.filter((entry: any) => entry.status === 'active').length,
			eliminatedEntries: rows.filter((entry: any) => entry.status === 'eliminated').length,
			lmsPot: selectedPoolType === 'lms' ? paidRows.filter((entry: any) => entry.entryType === 'lms').reduce((sum: number, entry: any) => sum + feeFor(entry), 0) : 0,
			secondHalfPot: selectedPoolType === 'second_half' ? paidRows.filter((entry: any) => entry.entryType === 'second_half').reduce((sum: number, entry: any) => sum + feeFor(entry), 0) : 0,
			potEstimate: paidTotal,
			maintenanceFee,
			lmsNetPayout: Math.max(0, selectedPoolType === 'lms' ? paidTotal - maintenanceFee : 0),
		};
	})());

	function adminEntriesHref(status?: 'pending_payment') {
		const params = new URLSearchParams();
		if (selectedPoolType !== 'all') params.set('poolType', selectedPoolType);
		if (status) params.set('status', status);
		const query = params.toString();
		return query ? `/admin/entries?${query}` : '/admin/entries';
	}
	const stats                 = $derived(selectedData?.stats                 ?? null);
	const currentWeek           = $derived(selectedData?.currentWeek           ?? null);
	const tableEntries          = $derived(selectedData?.tableEntries          ?? []);

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 10_000);
		return () => clearInterval(id);
	});

	const paymentMethods = [
		{ value: 'cash', label: 'Cash' },
		{ value: 'venmo', label: 'Venmo' },
		{ value: 'check', label: 'Check' },
		{ value: 'paypal', label: 'PayPal' },
		{ value: 'zelle', label: 'Zelle' },
		{ value: 'free', label: 'Free' }
	];

	let pendingApprovalEntry = $state<any | null>(null);
	let paymentMethodChoice = $state('cash');
	let paymentBusy = $state(false);
	let paymentError = $state('');
	let paymentMessage = $state('');
	let pendingDeleteEntry = $state<any | null>(null);
	let deleteBusy = $state(false);
	let deleteError = $state('');

	function openPaymentApproval(entry: any) {
		pendingApprovalEntry = entry;
		paymentMethodChoice = 'cash';
		paymentError = '';
	}

	function closePaymentApproval() {
		pendingApprovalEntry = null;
		paymentBusy = false;
		paymentError = '';
	}

	function openDeleteEntry(entry: any) {
		pendingDeleteEntry = entry;
		deleteError = '';
	}

	function closeDeleteEntry() {
		pendingDeleteEntry = null;
		deleteBusy = false;
		deleteError = '';
	}

	async function approvePendingPayment() {
		if (!pendingApprovalEntry) return;
		paymentBusy = true;
		paymentError = '';
		paymentMessage = '';
		try {
			const fd = new FormData();
			fd.append('id', pendingApprovalEntry.id);
			fd.append('paymentMethod', paymentMethodChoice);

			const res = await fetch('?/approveEntryPayment', { method: 'POST', body: fd });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				paymentError = json?.data?.error ?? 'Failed to approve payment.';
				return;
			}

			paymentMessage = `Payment approved for ${pendingApprovalEntry.entryName}.`;
			closePaymentApproval();
			await invalidateAll();
		} catch (e: any) {
			paymentError = e?.message ?? 'Failed to approve payment.';
		} finally {
			paymentBusy = false;
		}
	}

	const seasonStatusColors: Record<string, string> = {
		setup:    'border-gray-700 bg-gray-900 text-gray-400',
		open:     'border-green-800 bg-green-950/60 text-green-400',
		active:   'border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] text-[#c9a84c]',
		complete: 'border-gray-700 bg-gray-900 text-gray-500'
	};

	const seasonStatusLabel: Record<string, string> = {
		setup:    'Setup',
		open:     'Open — accepting LMS entries',
		active:   'Active',
		complete: 'Complete'
	};

	function dynamicSeasonStatusLabel(season: any): string {
		if (!season) return '';
		if (season.status !== 'active') return seasonStatusLabel[season.status] ?? season.status;

		const seasonData = (data.seasonDataMap as any)?.[season.id] ?? null;
		const lmsDeadlineIso = seasonData?.lmsEntryDeadline as string | null;
		const shDeadlineIso = seasonData?.shEntryDeadline as string | null;
		const isSecondHalf = String(season.name ?? '').toLowerCase().includes('second half')
			|| (season.lmsEnabled === false && season.secondHalfEnabled !== false);

		const pastLmsDeadline = lmsDeadlineIso ? now > new Date(lmsDeadlineIso).getTime() : false;
		const pastShDeadline = shDeadlineIso ? now > new Date(shDeadlineIso).getTime() : false;

		if (isSecondHalf) {
			return pastShDeadline
				? 'Active — entries closed'
				: 'Active — accepting 2nd Half entries';
		}

		if (!pastLmsDeadline) return 'Active — accepting all entries';
		if (!pastShDeadline) return 'Active — accepting 2nd Half entries only';
		return 'Active — entries closed';
	}

	// Season group filter for the "All Seasons" list
	// Groups: 'real' | '1h' | '1d'
	type SeasonGroup = 'real' | '1h' | '1d';

	function getSeasonGroup(season: any): SeasonGroup {
		if (!season.name?.includes('[TEST]')) return 'real';
		const m = season.name.match(/\((\d+)(h|d)\/week\)/);
		if (!m) return 'real';
		return m[2] === 'h' ? '1h' : '1d';
	}

	const allSeasons = $derived(data.seasons as any[]);

	// Only show groups that actually have seasons
	const hasGroup = $derived({
		real: allSeasons.some(s => getSeasonGroup(s) === 'real'),
		'1h': allSeasons.some(s => getSeasonGroup(s) === '1h'),
		'1d': allSeasons.some(s => getSeasonGroup(s) === '1d'),
	});

	let seasonGroup = $state<SeasonGroup>('real');

	const visibleSeasons = $derived(
		allSeasons.filter(s => getSeasonGroup(s) === seasonGroup)
	);

	// Clear selection when switching season groups
	let prevGroup = seasonGroup;
	$effect(() => {
		void visibleSeasons;
		if (seasonGroup !== prevGroup) {
			prevGroup = seasonGroup;
			selectedSeasonId = '';
		}
	});
</script>

<svelte:head><title>Admin — LMS Pool</title></svelte:head>

<!-- Season status banner -->
<!-- ── Single overview card ───────────────────────────────────────────────── -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

{#if selectedSeason}
	{@const s = selectedSeason as any}
	<div class="relative overflow-hidden"
		style="background: radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.12) 0%, transparent 70%), linear-gradient(135deg, #0a0a0a 0%, #111008 50%, #0a0a0a 100%);"
	>
		<!-- subtle yard-line grid overlay -->
		<div class="pointer-events-none absolute inset-0 opacity-[0.04]"
			style="background-image: repeating-linear-gradient(90deg, #c9a84c 0px, #c9a84c 1px, transparent 1px, transparent 10%); background-size: 10% 100%;"
		></div>

		<div class="relative px-6 py-5">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Selected Pool</p>
					<p class="mt-1 text-2xl font-bold text-white">{s.name}</p>
					<p class="mt-1 text-sm text-[#c9a84c]">{dynamicSeasonStatusLabel(s)}</p>
				</div>
				<div class="flex flex-wrap gap-2 text-xs">
					{#if isSuperAdmin}
						<a href="/admin/seasons/{s.id}/edit"
							class="rounded border border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] px-3 py-1.5 text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.2)]">
							Edit season →
						</a>
					{/if}
				</div>
			</div>


		</div>
	</div>
{:else}
	<div class="px-5 py-4">
		<p class="text-xs font-semibold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Selected Pool</p>
		<p class="mt-2 text-sm text-gray-500">Select an active LMS or Second Half pool below to view stats and quick actions.</p>
	</div>
{/if}

<!-- All seasons list -->
<div class="border-t border-gray-800 p-5">
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-[#c9a84c] shrink-0">All Seasons</h2>
		<div class="flex items-center gap-3">
			{#if hasGroup['1h'] || hasGroup['1d']}
				<select
					bind:value={seasonGroup}
					class="rounded border border-[rgba(201,168,76,0.4)] bg-black px-3 py-1.5 text-sm text-[#c9a84c] focus:border-[#c9a84c] focus:outline-none"
				>
					{#if hasGroup.real}
						<option value="real">2026 – 2027 Season</option>
					{/if}
					{#if hasGroup['1h']}
						<option value="1h">18 Hour Testing</option>
					{/if}
					{#if hasGroup['1d']}
						<option value="1d">24 Hour Testing</option>
					{/if}
				</select>
			{/if}
			{#if isSuperAdmin}
				<a href="/admin/seasons/new" class="text-xs text-[#c9a84c] hover:underline shrink-0">+ New season</a>
			{/if}
		</div>
	</div>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each visibleSeasons as s}
			{@const season = s as any}
			{@const isSecondHalf = season.name?.toLowerCase().includes('second half')}
			{@const isActive = (data.activeSeasons as any[]).some(a => a.id === season.id)}
			{@const isSelected = selectedSeasonId === season.id}
			{@const isTest = season.name?.includes('[TEST]')}
			{@const testInterval = isTest ? (season.name?.match(/\(([^)]+)\/week\)/)?.[1] ?? null) : null}
			<button
				type="button"
				onclick={() => { if (isActive) selectedSeasonId = isSelected ? '' : season.id; }}
				disabled={!isActive}
				class="relative overflow-hidden rounded-xl border text-left transition
					{isActive ? 'cursor-pointer hover:brightness-110' : 'cursor-default opacity-50'}
					{isSelected ? 'ring-2 ring-offset-1 ring-offset-black ' + (isSecondHalf ? 'ring-blue-400' : 'ring-[#c9a84c]') : ''}"
				style={isSecondHalf
					? 'border-color: rgba(96,165,250,0.4); background: radial-gradient(ellipse at 70% 50%, rgba(96,165,250,0.1) 0%, transparent 70%), linear-gradient(135deg, #080c14 0%, #090e1a 50%, #080c14 100%);'
					: 'border-color: rgba(201,168,76,0.4); background: radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.12) 0%, transparent 70%), linear-gradient(135deg, #0a0a0a 0%, #111008 50%, #0a0a0a 100%);'}
			>
				<!-- yard-line overlay -->
				<div
					class="pointer-events-none absolute inset-0 opacity-[0.04]"
					style={isSecondHalf
						? 'background-image: repeating-linear-gradient(90deg, #60a5fa 0px, #60a5fa 1px, transparent 1px, transparent 10%); background-size: 10% 100%;'
						: 'background-image: repeating-linear-gradient(90deg, #c9a84c 0px, #c9a84c 1px, transparent 1px, transparent 10%); background-size: 10% 100%;'}
				></div>

				<div class="relative flex items-center justify-between gap-3 px-5 py-4">
					<div class="min-w-0 flex-1">
						<p class="text-xs font-semibold uppercase tracking-widest {isSecondHalf ? 'text-blue-500/60' : 'text-[rgba(201,168,76,0.6)]'}">
							{isSecondHalf ? 'Second Half' : 'LMS'}{isTest ? ' · TEST' : ''}
						</p>
						<p class="mt-0.5 font-bold text-white truncate">
							{isTest
								? season.name.replace('[TEST] ', '').replace(/\s*\([^)]+\/week\)\s*\d{4}-\d{2}-\d{2}T[\d:]+/, '').trim()
								: season.name}
						</p>
					</div>
					<div class="flex flex-col items-end gap-1.5 shrink-0">
						{#if testInterval}
							<span class="rounded border border-orange-800 bg-orange-950/60 px-2 py-0.5 text-xs font-mono font-semibold text-orange-400">
								{testInterval}/wk
							</span>
						{/if}
						<span class="rounded border px-2.5 py-1 text-xs font-medium {seasonStatusColors[season.status] ?? 'border-gray-700 text-gray-400'}">
							{season.status}
						</span>
						{#if isSelected}
							<span class="text-xs {isSecondHalf ? 'text-blue-400' : 'text-[#c9a84c]'}">● viewing</span>
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>

{#if poolStats}
<!-- Stats grid -->
<div class="border-t border-gray-800 p-5">
	<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
		{selectedSeason ? `${(selectedSeason as any).name} Stats` : 'Stats'}
	</h2>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

		<!-- Pot cards -->
		<div class="rounded-lg border border-[rgba(201,168,76,0.2)] bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Total Pot</p>
				<InfoTip text="Estimated prize pool based on paid entries × entry fee. LMS and 2nd Half pools are tracked separately." />
			</div>
			<p class="mt-1 text-2xl font-bold text-[#c9a84c]">${(poolStats.maintenanceFee > 0 ? poolStats.lmsNetPayout + (selectedPoolType === 'second_half' ? poolStats.secondHalfPot : 0) : poolStats.potEstimate).toLocaleString()}</p>
			{#if poolStats.maintenanceFee > 0}
				<p class="mt-1 text-xs text-gray-600">Gross ${poolStats.potEstimate.toLocaleString()} − ${poolStats.maintenanceFee.toLocaleString()} fee</p>
			{/if}
			<p class="mt-1 text-xs text-gray-600">{poolStats.freeEntries} free · {poolStats.paidEntries - poolStats.freeEntries} paid</p>

		</div>

		<!-- Entry counts -->
		<div class="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Total Entries</p>
				<InfoTip text="All entries regardless of payment status. One player can hold multiple entries. LMS and 2nd Half entries are counted separately." />
			</div>
			<p class="mt-1 text-2xl font-bold text-white">{poolStats.totalEntries}</p>
			<p class="mt-1 text-xs text-gray-600">LMS {poolStats.lmsEntries} · 2H {poolStats.secondHalfEntries}</p>
		</div>

		<!-- Payment status -->
		<div class="rounded-lg border border-green-900/60 bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Paid</p>
				<InfoTip text="Entries marked as paid (cash, Venmo, etc.) or complimentary. Pending entries have not yet paid — they can still pick but should be resolved before week 1 locks." />
			</div>
			<p class="mt-1 text-2xl font-bold text-green-400">{poolStats.paidEntries}</p>
			<p class="mt-1 text-xs text-gray-600">{poolStats.freeEntries} free · {poolStats.pendingPayment} pending</p>
		</div>

		<!-- Active / eliminated -->
		<div class="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Active / Eliminated</p>
				<InfoTip text="Active entries are still in the pool. An entry is eliminated when the player picks a team that wins (LMS) or loses (2nd Half). Eliminated entries remain visible for record-keeping." />
			</div>
			<p class="mt-1 text-2xl font-bold text-white">
				<span class="text-green-400">{poolStats.activeEntries}</span>
				<span class="text-gray-600"> / </span>
				<span class="text-red-400">{poolStats.eliminatedEntries}</span>
			</p>
			<p class="mt-1 text-xs text-gray-600">{poolStats.totalUsers} registered users</p>
		</div>

	</div>
</div>

{/if}

</div><!-- end overview card -->

{#if isSuperAdmin}
<!-- Test season management panel -->
<div class="mb-6 rounded-xl border border-orange-800/50 bg-black/75 p-5 backdrop-blur-sm">

	<div class="mb-4 flex items-center justify-between gap-3">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wider text-orange-400">Test Seasons</p>
			<p class="mt-0.5 text-xs text-gray-500">
				{#if testSeasons.length}
					{testSeasons.length / 2} active pair{testSeasons.length > 2 ? 's' : ''} — weeks advance automatically every 2 minutes.
				{:else}
					No test seasons running. Seed one to start testing.
				{/if}
			</p>
		</div>
		{#if testSeasons.length}
			<a href="/admin/results" class="rounded border border-orange-700 bg-orange-950/60 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950">
				Record Results →
			</a>
		{/if}
	</div>

	<!-- Active test season pairs -->
	{#if testSeasons.length}
		<div class="mb-4 grid gap-3 sm:grid-cols-2">
			{#each [{ label: '1h / week', tag: '(1h/week)', seasons: testSeasons1h, interval: '1h', timing: 'T+0 open · T+40m lock · T+58m results · T+1h next week' },
			        { label: '1d / week', tag: '(1d/week)', seasons: testSeasons1d, interval: '1d', timing: 'T+0 open · T+20h lock · T+23h 58m results · T+24h next week' }] as group}
				{#if group.seasons.length}
					<div class="rounded-lg border border-orange-800/40 bg-black/40 p-4">
						<div class="mb-3 flex items-center justify-between">
							<p class="text-xs font-semibold text-orange-400">{group.label}</p>
							<span class="rounded bg-green-950/60 px-2 py-0.5 text-xs text-green-400">running</span>
						</div>

						<!-- Season rows -->
						<div class="mb-3 flex flex-col gap-2">
							{#each group.seasons as s}
								{@const isLMS = !s.name.toLowerCase().includes('second half')}
								<div class="flex items-center justify-between gap-2 rounded border border-gray-800 bg-gray-950/60 px-3 py-2">
									<div>
										<span class="text-xs font-medium text-gray-300">{isLMS ? 'LMS' : '2nd Half'}</span>
										<span class="ml-2 font-mono text-xs text-gray-600">{s.id}</span>
									</div>
									<!-- Clear single season -->
									{#if clearConfirmId === s.id}
										<div class="flex items-center gap-1">
											<button
												disabled={testBusy}
												onclick={() => {
													clearConfirmId = null;
													const fd = new FormData();
													fd.append('seasonId', s.id);
													submitTestAction('clearTestSeason', fd);
												}}
												class="rounded border border-red-500 bg-red-950/40 px-2 py-0.5 text-xs text-red-400 transition hover:bg-red-900/60 disabled:opacity-40"
											>Confirm</button>
											<button
												type="button"
												onclick={() => clearConfirmId = null}
												class="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-400 transition hover:bg-gray-800"
											>Cancel</button>
										</div>
									{:else}
										<button
											disabled={testBusy}
											onclick={() => clearConfirmId = s.id}
											class="rounded border border-red-900/60 px-2 py-0.5 text-xs text-red-500 transition hover:bg-red-950/40 disabled:opacity-40"
										>Clear</button>
									{/if}
								</div>
							{/each}
						</div>

						<p class="mb-3 text-xs text-gray-600">{group.timing}</p>

						<!-- Reset pair -->
						{#if resetConfirmGroup === group.interval}
							<div class="flex gap-2">
								<button
									disabled={testBusy}
									onclick={() => {
										resetConfirmGroup = null;
										const fd = new FormData();
										fd.append('interval', group.interval);
										fd.append('mode', 'with-picks');
										for (const s of group.seasons) fd.append('seasonId', s.id);
										submitTestAction('resetTestSeason', fd);
									}}
									class="flex-1 rounded border border-orange-500 bg-orange-950/50 px-3 py-1.5 text-xs font-medium text-orange-300 transition hover:bg-orange-900/60 disabled:opacity-40"
								>{testBusy ? 'Working…' : 'Confirm Reset'}</button>
								<button
									type="button"
									onclick={() => resetConfirmGroup = null}
									class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800"
								>Cancel</button>
							</div>
						{:else}
							<button
								disabled={testBusy}
								onclick={() => resetConfirmGroup = group.interval}
								class="w-full rounded border border-orange-800/60 bg-orange-950/30 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950/60 disabled:opacity-40"
							>{testBusy ? 'Working…' : `↺ Reset ${group.label} pair`}</button>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Seed new pair -->
	<div class="flex flex-wrap items-center gap-3 {testSeasons.length ? 'border-t border-orange-800/30 pt-4' : ''}">
		<p class="text-xs text-gray-500 shrink-0">Seed new pair:</p>

		<!-- with-picks variants -->
		<button
			disabled={testBusy}
			onclick={() => {
				const fd = new FormData();
				fd.append('interval', '1h');
				fd.append('mode', 'with-picks');
				submitTestAction('seedTestSeason', fd);
			}}
			class="rounded border border-orange-800/60 bg-orange-950/30 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950/60 disabled:opacity-40"
			title="20 entries, random paid status, picks pre-seeded for weeks 1–3"
		>{testBusy ? 'Working…' : '+ 1h / week'}</button>
		<button
			disabled={testBusy}
			onclick={() => {
				const fd = new FormData();
				fd.append('interval', '1d');
				fd.append('mode', 'with-picks');
				submitTestAction('seedTestSeason', fd);
			}}
			class="rounded border border-orange-800/60 bg-orange-950/30 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950/60 disabled:opacity-40"
			title="20 entries, random paid status, picks pre-seeded for weeks 1–3"
		>{testBusy ? 'Working…' : '+ 1d / week'}</button>

		<span class="text-gray-700 text-xs">|</span>

		<!-- no-picks variants -->
		<button
			disabled={testBusy}
			onclick={() => {
				const fd = new FormData();
				fd.append('interval', '1h');
				fd.append('mode', 'no-picks');
				submitTestAction('seedTestSeason', fd);
			}}
			class="rounded border border-blue-800/60 bg-blue-950/30 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-950/60 disabled:opacity-40"
			title="20 entries, all paid + active, no picks — click Start to begin"
		>{testBusy ? 'Working…' : '+ 1h / week  no picks'}</button>
		<button
			disabled={testBusy}
			onclick={() => {
				const fd = new FormData();
				fd.append('interval', '1d');
				fd.append('mode', 'no-picks');
				submitTestAction('seedTestSeason', fd);
			}}
			class="rounded border border-blue-800/60 bg-blue-950/30 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-950/60 disabled:opacity-40"
			title="20 entries, all paid + active, no picks — click Start to begin"
		>{testBusy ? 'Working…' : '+ 1d / week  no picks'}</button>

		{#if testBusy}
			<div class="flex w-full items-center gap-3 pt-1">
				<!-- spinner -->
				<svg class="h-4 w-4 shrink-0 animate-spin text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
				</svg>
				<!-- indeterminate progress bar -->
				<div class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-orange-950/60">
					<div class="absolute inset-y-0 w-1/3 rounded-full bg-orange-400 animate-[slide_1.4s_ease-in-out_infinite]"></div>
				</div>
				<span class="shrink-0 text-xs text-orange-400">Working…</span>
			</div>
		{/if}
		{#if testMessage}
			<span class="text-xs text-green-400">{testMessage}</span>
		{/if}
		{#if testError}
			<span class="text-xs text-red-400">{testError}</span>
		{/if}
	</div>
</div>
{/if}

<!-- Season entries table -->
{#if poolStats && poolTableEntries.length > 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
		<div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
			<div class="flex items-center gap-2">
				<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Entries</h2>
				<span class="rounded border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-xs font-medium text-[#c9a84c]">
					{poolTableEntries.length} total
				</span>
			</div>
			{#if poolStats.pendingPayment > 0}
				<a href={adminEntriesHref('pending_payment')} class="text-xs text-[#c9a84c] hover:underline">
					View all {poolStats.pendingPayment} →
				</a>
			{/if}
		</div>
		<div class="max-h-[28rem] overflow-auto">
			{#if paymentMessage}
				<div class="mx-4 mt-3 rounded border border-green-800 bg-green-950/40 px-3 py-2 text-xs text-green-300">{paymentMessage}</div>
			{/if}
			{#if paymentError && !pendingApprovalEntry}
				<div class="mx-4 mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">{paymentError}</div>
			{/if}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-800 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
						<th class="px-4 py-2">Entry</th>
						<th class="px-4 py-2">Player</th>
						<th class="px-4 py-2">Type</th>
						<th class="px-4 py-2">Awaiting Payment</th>
						<th class="px-4 py-2 text-right">Fee</th>
						<th class="px-4 py-2 text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each poolTableEntries as entry}
						{@const e = entry as any}
						<tr class="border-b border-gray-800/50 hover:bg-white/[0.02]">
							<td class="px-4 py-2 font-medium text-white">{e.entryName}</td>
							<td class="px-4 py-2 text-gray-400">{e.expand?.user?.displayName ?? e.expand?.user?.email ?? '—'}</td>
							<td class="px-4 py-2">
								<span class="rounded border px-1.5 py-0.5 text-xs
									{e.entryType === 'lms' ? 'border-[rgba(201,168,76,0.3)] text-[#c9a84c]' : 'border-blue-800 text-blue-400'}">
									{e.entryType === 'lms' ? 'LMS' : '2nd Half'}
								</span>
							</td>
							<td class="px-4 py-2">
								{#if e.status === 'pending_payment'}
									<button
										type="button"
										onclick={() => openPaymentApproval(e)}
										class="rounded border border-yellow-800 bg-yellow-950/50 px-1.5 py-0.5 text-xs text-yellow-300 transition hover:bg-yellow-900/50"
										title="Approve payment"
									>
										Yes
									</button>
								{:else}
									<span class="rounded border border-green-800 bg-green-950/50 px-1.5 py-0.5 text-xs text-green-400">No</span>
								{/if}
							</td>
							<td class="px-4 py-2 text-right text-gray-400">
								${e.entryType === 'lms'
									? ((selectedSeason as any)?.lmsEntryFee ?? '—')
									: ((selectedSeason as any)?.secondHalfEntryFee ?? '—')}
							</td>
							<td class="px-4 py-2 text-right">
								<button
									type="button"
									onclick={() => openDeleteEntry(e)}
									class="rounded border border-red-900 bg-red-950/30 px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-950/60"
								>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

{#if pendingDeleteEntry}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
		<div class="w-full max-w-md rounded-xl border border-red-900/80 bg-[#0d0d0d] p-5">
			<h3 class="text-sm font-semibold uppercase tracking-wider text-red-400">Delete entry</h3>
			<p class="mt-2 text-sm text-gray-300">Entry: <span class="font-medium text-white">{pendingDeleteEntry.entryName}</span></p>
			<p class="mt-1 text-xs text-gray-500">Player: {pendingDeleteEntry.expand?.user?.displayName ?? pendingDeleteEntry.expand?.user?.email ?? 'Unknown'}</p>

			{#if deleteError}
				<p class="mt-3 rounded border border-red-800 bg-red-950/40 px-2 py-1 text-xs text-red-300">{deleteError}</p>
			{/if}

			<div class="mt-5 flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={closeDeleteEntry}
					class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-900"
				>
					Cancel
				</button>
				<form method="POST" action="?/deleteEntry" use:enhance={() => {
					deleteBusy = true;
					deleteError = '';
					return async ({ update, result }) => {
						deleteBusy = false;
						if (result.type === 'error' || result.type === 'failure') {
							deleteError = result.data?.error ?? 'Failed to delete entry.';
							return;
						}
						closeDeleteEntry();
						await update();
						await invalidateAll();
					};
				}}>
					<input type="hidden" name="id" value={pendingDeleteEntry.id} />
					<button
						type="submit"
						disabled={deleteBusy}
						class="rounded border border-red-700 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-900/40 disabled:opacity-40"
					>
						{deleteBusy ? 'Deleting...' : 'Delete'}
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

{#if pendingApprovalEntry}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
		<div class="w-full max-w-md rounded-xl border border-[rgba(201,168,76,0.4)] bg-[#0d0d0d] p-5">
			<h3 class="text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Approve Payment</h3>
			<p class="mt-2 text-sm text-gray-300">Entry: <span class="font-medium text-white">{pendingApprovalEntry.entryName}</span></p>
			<p class="mt-1 text-xs text-gray-500">Player: {pendingApprovalEntry.expand?.user?.displayName ?? pendingApprovalEntry.expand?.user?.email ?? 'Unknown'}</p>

			<label for="payment-method" class="mt-4 block text-xs font-medium uppercase tracking-wider text-gray-400">Payment method</label>
			<select
				id="payment-method"
				bind:value={paymentMethodChoice}
				class="mt-1 w-full rounded border border-gray-700 bg-black px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				{#each paymentMethods as method}
					<option value={method.value}>{method.label}</option>
				{/each}
			</select>

			{#if paymentError}
				<p class="mt-3 rounded border border-red-800 bg-red-950/40 px-2 py-1 text-xs text-red-300">{paymentError}</p>
			{/if}

			<div class="mt-5 flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={closePaymentApproval}
					class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-900"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={approvePendingPayment}
					disabled={paymentBusy}
					class="rounded border border-green-700 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-900/40 disabled:opacity-40"
				>
					{paymentBusy ? 'Approving...' : 'Approve Payment'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide {
		0%   { left: -33%; }
		100% { left: 100%; }
	}
</style>

