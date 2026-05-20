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

	// Which season is currently selected in the overview
	let selectedSeasonId = $state((data.activeSeason as any)?.id ?? '');

	const selectedSeason = $derived(
		(data.seasons as any[]).find(s => s.id === selectedSeasonId) ?? data.activeSeason
	);
	const selectedData = $derived(
		(data.seasonDataMap as any)[selectedSeasonId] ?? null
	);
	const stats                 = $derived(selectedData?.stats                 ?? null);
	const currentWeek           = $derived(selectedData?.currentWeek           ?? null);
	const pendingPaymentEntries = $derived(selectedData?.pendingPaymentEntries ?? []);

	const seasonStatusColors: Record<string, string> = {
		setup:    'border-gray-700 bg-gray-900 text-gray-400',
		open:     'border-green-800 bg-green-950/60 text-green-400',
		active:   'border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] text-[#c9a84c]',
		complete: 'border-gray-700 bg-gray-900 text-gray-500'
	};

	const seasonStatusLabel: Record<string, string> = {
		setup:    'Setup',
		open:     'Open — accepting LMS entries',
		active:   'Active — accepting 2nd Half entries',
		complete: 'Complete'
	};

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

	// Auto-select the first active season when switching groups
	$effect(() => {
		const first = visibleSeasons.find(s =>
			(data.activeSeasons as any[]).some((a: any) => a.id === s.id)
		);
		if (first) selectedSeasonId = (first as any).id;
	});
</script>

<svelte:head><title>Admin — LMS Pool</title></svelte:head>

<!-- Season status banner -->
{#if selectedSeason}
	{@const s = selectedSeason as any}
	<div class="relative mb-6 overflow-hidden rounded-xl border border-[rgba(201,168,76,0.4)]"
		style="background: radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.12) 0%, transparent 70%), linear-gradient(135deg, #0a0a0a 0%, #111008 50%, #0a0a0a 100%);"
	>
		<!-- subtle yard-line grid overlay -->
		<div class="pointer-events-none absolute inset-0 opacity-[0.04]"
			style="background-image: repeating-linear-gradient(90deg, #c9a84c 0px, #c9a84c 1px, transparent 1px, transparent 10%); background-size: 10% 100%;"
		></div>

		<div class="relative px-6 py-5">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Current Season</p>
					<p class="mt-1 text-2xl font-bold text-white">{s.name}</p>
					<p class="mt-1 text-sm text-[#c9a84c]">{seasonStatusLabel[s.status] ?? s.status}</p>
				</div>
				<div class="flex flex-wrap gap-2 text-xs">
					{#if s.firstPickDeadline}
						<span class="rounded border border-[rgba(201,168,76,0.3)] bg-black/40 px-3 py-1.5 text-gray-300">
							First pick: {new Date(s.firstPickDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
						</span>
					{/if}
					{#if currentWeek}
						<span class="rounded border border-[rgba(201,168,76,0.3)] bg-black/40 px-3 py-1.5 text-gray-300">
							Week {(currentWeek as any).week} — {(currentWeek as any).status}
						</span>
					{/if}
					<a href="/admin/seasons/{s.id}/edit"
						class="rounded border border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] px-3 py-1.5 text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.2)]">
						Edit season →
					</a>
				</div>
			</div>

			<!-- Pool toggles -->
			<div class="mt-4 border-t border-[rgba(201,168,76,0.15)] pt-4">
				<div class="mb-3 flex items-center gap-2">
					<p class="text-xs font-semibold uppercase tracking-wider text-[rgba(201,168,76,0.5)]">Pool Toggles</p>
					<InfoTip text="Enable or disable each pool type. Disabling a pool hides it from players but keeps all data intact. Use this to open registration for one pool at a time." />
				</div>
				<div class="flex flex-wrap gap-4">

					<!-- LMS toggle -->
					<form method="POST" action="/admin/seasons?/togglePool" use:enhance={() => () => invalidateAll()}>
						<input type="hidden" name="id"   value={s.id} />
						<input type="hidden" name="pool" value="lms" />
						<input type="hidden" name="enabled" value={s.lmsEnabled === false ? 'true' : 'false'} />
						<button type="submit"
							class="flex items-center gap-2.5 rounded-lg border px-4 py-2 text-sm font-medium transition
								{s.lmsEnabled !== false
									? 'border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.12)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.2)]'
									: 'border-gray-700 bg-gray-900 text-gray-500 hover:bg-gray-800'}">
							<span class="h-2 w-2 rounded-full {s.lmsEnabled !== false ? 'bg-[#c9a84c]' : 'bg-gray-600'}"></span>
							LMS Pool
							<span class="text-xs opacity-70">{s.lmsEnabled !== false ? 'ON' : 'OFF'}</span>
						</button>
					</form>

					<!-- 2nd Half toggle -->
					<form method="POST" action="/admin/seasons?/togglePool" use:enhance={() => () => invalidateAll()}>
						<input type="hidden" name="id"   value={s.id} />
						<input type="hidden" name="pool" value="second_half" />
						<input type="hidden" name="enabled" value={s.secondHalfEnabled === false ? 'true' : 'false'} />
						<button type="submit"
							class="flex items-center gap-2.5 rounded-lg border px-4 py-2 text-sm font-medium transition
								{s.secondHalfEnabled !== false
									? 'border-blue-700 bg-blue-950/50 text-blue-400 hover:bg-blue-950/80'
									: 'border-gray-700 bg-gray-900 text-gray-500 hover:bg-gray-800'}">
							<span class="h-2 w-2 rounded-full {s.secondHalfEnabled !== false ? 'bg-blue-400' : 'bg-gray-600'}"></span>
							2nd Half Pool
							<span class="text-xs opacity-70">{s.secondHalfEnabled !== false ? 'ON' : 'OFF'}</span>
						</button>
					</form>

					<!-- 2nd Half config summary — edit in Season Settings -->
					{#if s.secondHalfEnabled !== false}
						<p class="self-center text-xs text-gray-600">
							opens wk {s.secondHalfStartWeek ?? 6}
							· {s.secondHalfPicksPerWeek ?? 2} pick{(s.secondHalfPicksPerWeek ?? 2) > 1 ? 's' : ''}/wk
						</p>
					{/if}

				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="mb-6 rounded-xl border border-yellow-800 bg-yellow-950/40 px-5 py-4 text-yellow-400">
		<p class="font-semibold">No active season</p>
		<p class="mt-1 text-sm opacity-75">Create a season to get started.</p>
		<a href="/admin/seasons/new" class="mt-3 inline-block rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e8c96a] transition">
			+ New Season
		</a>
	</div>
{/if}

<!-- All seasons list -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-[#c9a84c] shrink-0">All Seasons</h2>
		<div class="flex items-center gap-3">
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
				onclick={() => { if (isActive) selectedSeasonId = season.id; }}
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

<!-- Stats grid -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
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
			<p class="mt-1 text-2xl font-bold text-[#c9a84c]">${stats.potEstimate.toLocaleString()}</p>
			<p class="mt-1 text-xs text-gray-600">LMS ${stats.lmsPot.toLocaleString()} · 2H ${stats.secondHalfPot.toLocaleString()}</p>
		</div>

		<!-- Entry counts -->
		<div class="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Total Entries</p>
				<InfoTip text="All entries regardless of payment status. One player can hold multiple entries. LMS and 2nd Half entries are counted separately." />
			</div>
			<p class="mt-1 text-2xl font-bold text-white">{stats.totalEntries}</p>
			<p class="mt-1 text-xs text-gray-600">LMS {stats.lmsEntries} · 2H {stats.secondHalfEntries}</p>
		</div>

		<!-- Payment status -->
		<div class="rounded-lg border border-green-900/60 bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Paid</p>
				<InfoTip text="Entries marked as paid (cash, Venmo, etc.) or complimentary. Pending entries have not yet paid — they can still pick but should be resolved before week 1 locks." />
			</div>
			<p class="mt-1 text-2xl font-bold text-green-400">{stats.paidEntries}</p>
			<p class="mt-1 text-xs text-gray-600">{stats.freeEntries} free · {stats.pendingPayment} pending</p>
		</div>

		<!-- Active / eliminated -->
		<div class="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
			<div class="flex items-center gap-1.5">
				<p class="text-xs text-gray-500">Active / Eliminated</p>
				<InfoTip text="Active entries are still in the pool. An entry is eliminated when the player picks a team that wins (LMS) or loses (2nd Half). Eliminated entries remain visible for record-keeping." />
			</div>
			<p class="mt-1 text-2xl font-bold text-white">
				<span class="text-green-400">{stats.activeEntries}</span>
				<span class="text-gray-600"> / </span>
				<span class="text-red-400">{stats.eliminatedEntries}</span>
			</p>
			<p class="mt-1 text-xs text-gray-600">{stats.totalUsers} registered users</p>
		</div>

	</div>
</div>

<!-- Quick actions -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-3 flex items-center gap-2">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Quick Actions</h2>
		<InfoTip text="Shortcuts to the most common admin tasks for the currently selected season." />
	</div>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		<a href="/admin/entries?status=pending_payment"
			class="flex items-center justify-between rounded-lg border border-yellow-900 bg-gray-900/60 px-4 py-3 transition hover:border-yellow-700">
			<div>
				<p class="text-sm font-medium text-white">Pending Payments</p>
				<p class="text-xs text-yellow-400">{stats.pendingPayment} entr{stats.pendingPayment === 1 ? 'y' : 'ies'} awaiting payment</p>
			</div>
			<span class="text-yellow-600">→</span>
		</a>
		<a href="/admin/entries"
			class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 transition hover:border-gray-600">
			<div>
				<p class="text-sm font-medium text-white">All Entries</p>
				<p class="text-xs text-gray-500">Manage entries & payments</p>
			</div>
			<span class="text-gray-600">→</span>
		</a>
		<a href="/admin/weeks"
			class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 transition hover:border-gray-600">
			<div>
				<p class="text-sm font-medium text-white">Season Settings</p>
				<p class="text-xs text-gray-500">
					{#if currentWeek}
						Week {(currentWeek as any).week} is {(currentWeek as any).status}
					{:else}
						Set up weeks & deadlines
					{/if}
				</p>
			</div>
			<span class="text-gray-600">→</span>
		</a>
		{#if isSuperAdmin}
			<a href="/admin/seasons/new"
				class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 transition hover:border-gray-600">
				<div>
					<p class="text-sm font-medium text-white">New Season</p>
					<p class="text-xs text-gray-500">Create next season</p>
				</div>
				<span class="text-gray-600">→</span>
			</a>
		{/if}
	</div>
</div>

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
									<button
										disabled={testBusy}
										onclick={() => {
											if (!confirm(`Clear "${s.name}"? This deletes all entries, picks and results.`)) return;
											const fd = new FormData();
											fd.append('seasonId', s.id);
											submitTestAction('clearTestSeason', fd);
										}}
										class="rounded border border-red-900/60 px-2 py-0.5 text-xs text-red-500 transition hover:bg-red-950/40 disabled:opacity-40"
									>Clear</button>
								</div>
							{/each}
						</div>

						<p class="mb-3 text-xs text-gray-600">{group.timing}</p>

						<!-- Reset pair -->
						<button
							disabled={testBusy}
							onclick={() => {
								if (!confirm(`Reset all ${group.label} test seasons? Current data will be deleted and a fresh pair seeded.`)) return;
								const fd = new FormData();
								fd.append('interval', group.interval);
								for (const s of group.seasons) fd.append('seasonId', s.id);
								submitTestAction('resetTestSeason', fd);
							}}
							class="w-full rounded border border-orange-800/60 bg-orange-950/30 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950/60 disabled:opacity-40"
						>{testBusy ? 'Working…' : `↺ Reset ${group.label} pair`}</button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Seed new pair -->
	<div class="flex flex-wrap items-center gap-3 {testSeasons.length ? 'border-t border-orange-800/30 pt-4' : ''}">
		<p class="text-xs text-gray-500 shrink-0">Seed new pair:</p>
		<button
			disabled={testBusy}
			onclick={() => {
				const fd = new FormData();
				fd.append('interval', '1h');
				submitTestAction('seedTestSeason', fd);
			}}
			class="rounded border border-orange-800/60 bg-orange-950/30 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950/60 disabled:opacity-40"
		>{testBusy ? 'Working…' : '+ 1h / week'}</button>
		<button
			disabled={testBusy}
			onclick={() => {
				const fd = new FormData();
				fd.append('interval', '1d');
				submitTestAction('seedTestSeason', fd);
			}}
			class="rounded border border-orange-800/60 bg-orange-950/30 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950/60 disabled:opacity-40"
		>{testBusy ? 'Working…' : '+ 1d / week'}</button>

		{#if testBusy}
			<span class="text-xs text-orange-400 animate-pulse">Working…</span>
		{/if}
		{#if testMessage}
			<span class="text-xs text-green-400">{testMessage}</span>
		{/if}
		{#if testError}
			<span class="text-xs text-red-400">{testError}</span>
		{/if}
	</div>
</div>

<!-- Pending payment quick list -->
{#if stats.pendingPayment > 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
		<div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
			<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Awaiting Payment</h2>
			{#if stats.pendingPayment > 5}
				<a href="/admin/entries?status=pending_payment" class="text-xs text-[#c9a84c] hover:underline">
					View all {stats.pendingPayment} →
				</a>
			{/if}
		</div>
		<div class="overflow-hidden">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-800 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
						<th class="px-4 py-2">Entry</th>
						<th class="px-4 py-2">Player</th>
						<th class="px-4 py-2">Type</th>
						<th class="px-4 py-2 text-right">Fee</th>
					</tr>
				</thead>
				<tbody>
					{#each pendingPaymentEntries as entry}
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
							<td class="px-4 py-2 text-right text-gray-400">
								${e.entryType === 'lms'
									? ((selectedSeason as any)?.lmsEntryFee ?? '—')
									: ((selectedSeason as any)?.secondHalfEntryFee ?? '—')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

