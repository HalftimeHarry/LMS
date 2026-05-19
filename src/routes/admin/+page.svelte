<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const isSuperAdmin = $derived(data.role === 'super_admin');

	// Which season is currently selected in the overview
	let selectedSeasonId = $state((data.activeSeason as any)?.id ?? '');

	const selectedSeason = $derived(
		(data.seasons as any[]).find(s => s.id === selectedSeasonId) ?? data.activeSeason
	);
	const selectedData = $derived(
		(data.seasonDataMap as any)[selectedSeasonId] ?? {
			stats: stats,
			currentWeek: currentWeek,
			pendingPaymentEntries: pendingPaymentEntries
		}
	);
	const stats       = $derived(selectedData.stats);
	const currentWeek = $derived(selectedData.currentWeek);
	const pendingPaymentEntries = $derived(selectedData.pendingPaymentEntries);

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
				<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-[rgba(201,168,76,0.5)]">Pool Toggles</p>
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

					<!-- 2nd Half config inline -->
					<form method="POST" action="/admin/seasons?/updatePoolConfig" use:enhance={() => () => invalidateAll()}
						class="flex flex-wrap items-center gap-2 text-xs text-gray-400">
						<input type="hidden" name="id" value={s.id} />
						<span class="text-gray-600">2nd Half opens week</span>
						<input type="number" name="secondHalfStartWeek"
							value={s.secondHalfStartWeek ?? 6} min="1" max="18"
							class="w-14 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-white focus:border-blue-500 focus:outline-none" />
						<span class="text-gray-600">· picks ↑ week</span>
						<input type="number" name="secondHalfPicksStartWeek"
							value={s.secondHalfPicksStartWeek ?? 10} min="1" max="18"
							class="w-14 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-white focus:border-blue-500 focus:outline-none" />
						<span class="text-gray-600">·</span>
						<select name="secondHalfPicksPerWeek"
							class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-white focus:border-blue-500 focus:outline-none">
							{#each [1,2,3] as n}
								<option value={n} selected={n === (s.secondHalfPicksPerWeek ?? 2)}>{n} pick{n > 1 ? 's' : ''}/wk</option>
							{/each}
						</select>
						<button type="submit"
							class="rounded border border-gray-700 px-3 py-1 text-gray-400 transition hover:border-blue-600 hover:text-blue-400">
							Save
						</button>
					</form>

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
<div class="mb-8">
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
<div class="mb-8">
	<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
		{selectedSeason ? `${(selectedSeason as any).name} Stats` : 'Stats'}
	</h2>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

		<!-- Pot cards -->
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Total Pot</p>
			<p class="mt-1 text-2xl font-bold text-[#c9a84c]">${stats.potEstimate.toLocaleString()}</p>
			<p class="mt-1 text-xs text-gray-600">LMS ${stats.lmsPot.toLocaleString()} · 2H ${stats.secondHalfPot.toLocaleString()}</p>
		</div>

		<!-- Entry counts -->
		<div class="rounded-xl border border-gray-800 bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Total Entries</p>
			<p class="mt-1 text-2xl font-bold text-white">{stats.totalEntries}</p>
			<p class="mt-1 text-xs text-gray-600">LMS {stats.lmsEntries} · 2H {stats.secondHalfEntries}</p>
		</div>

		<!-- Payment status -->
		<div class="rounded-xl border border-green-900 bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Paid</p>
			<p class="mt-1 text-2xl font-bold text-green-400">{stats.paidEntries}</p>
			<p class="mt-1 text-xs text-gray-600">{stats.freeEntries} free · {stats.pendingPayment} pending</p>
		</div>

		<!-- Active / eliminated -->
		<div class="rounded-xl border border-gray-800 bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Active / Eliminated</p>
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
<div class="mb-8">
	<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Quick Actions</h2>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		<a href="/admin/entries?status=pending_payment"
			class="flex items-center justify-between rounded-xl border border-yellow-900 bg-black/75 px-4 py-3 transition hover:border-yellow-700 backdrop-blur-sm">
			<div>
				<p class="text-sm font-medium text-white">Pending Payments</p>
				<p class="text-xs text-yellow-400">{stats.pendingPayment} entr{stats.pendingPayment === 1 ? 'y' : 'ies'} awaiting payment</p>
			</div>
			<span class="text-yellow-600">→</span>
		</a>
		<a href="/admin/entries"
			class="flex items-center justify-between rounded-xl border border-gray-800 bg-black/75 px-4 py-3 transition hover:border-gray-600 backdrop-blur-sm">
			<div>
				<p class="text-sm font-medium text-white">All Entries</p>
				<p class="text-xs text-gray-500">Manage entries & payments</p>
			</div>
			<span class="text-gray-600">→</span>
		</a>
		<a href="/admin/weeks"
			class="flex items-center justify-between rounded-xl border border-gray-800 bg-black/75 px-4 py-3 transition hover:border-gray-600 backdrop-blur-sm">
			<div>
				<p class="text-sm font-medium text-white">Weekly Settings</p>
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
				class="flex items-center justify-between rounded-xl border border-gray-800 bg-black/75 px-4 py-3 transition hover:border-gray-600 backdrop-blur-sm">
				<div>
					<p class="text-sm font-medium text-white">New Season</p>
					<p class="text-xs text-gray-500">Create next season</p>
				</div>
				<span class="text-gray-600">→</span>
			</a>
		{/if}
	</div>
</div>

<!-- Test season panel — only shown when test seasons exist -->
{#if (data.seasons as any[]).some(s => s.name?.includes('[TEST]'))}
	{@const testSeasons1h = (data.seasons as any[]).filter(s => s.name?.includes('[TEST]') && s.name?.includes('(1h/week)'))}
	{@const testSeasons1d = (data.seasons as any[]).filter(s => s.name?.includes('[TEST]') && s.name?.includes('(1d/week)'))}
	<div class="mb-8 rounded-xl border border-orange-800/50 bg-orange-950/20 p-5">
		<div class="mb-4 flex items-center justify-between gap-3">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wider text-orange-400">Test Seasons Active</p>
				<p class="mt-0.5 text-xs text-gray-500">Run the scheduler from your terminal to start the countdown. Clean up when done.</p>
			</div>
			<a href="/admin/results" class="rounded border border-orange-700 bg-orange-950/60 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-950">
				Record Results →
			</a>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			{#if testSeasons1h.length}
				<div class="rounded-lg border border-orange-800/40 bg-black/40 p-4">
					<p class="mb-2 text-xs font-semibold text-orange-400">18-Hour Test <span class="font-mono text-orange-600">(1h/week)</span></p>
					<div class="mb-3 flex flex-col gap-1">
						{#each testSeasons1h as s}
							<p class="font-mono text-xs text-gray-400">
								<span class="text-gray-600">ID:</span> {s.id}
								<span class="ml-2 text-gray-600">{s.name.toLowerCase().includes('second half') ? '2H' : 'LMS'}</span>
							</p>
						{/each}
					</div>
					<div class="rounded border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-green-400">
						<p class="text-gray-600 mb-1"># Start countdown (run in terminal):</p>
						<p>node scripts/start-test-season.js --interval=1h</p>
					</div>
					<div class="mt-2 text-xs text-gray-600">
						T+0 open · T+40m picks lock · T+58m results · T+1h next week
					</div>
				</div>
			{/if}

			{#if testSeasons1d.length}
				<div class="rounded-lg border border-orange-800/40 bg-black/40 p-4">
					<p class="mb-2 text-xs font-semibold text-orange-400">24-Hour Test <span class="font-mono text-orange-600">(1d/week)</span></p>
					<div class="mb-3 flex flex-col gap-1">
						{#each testSeasons1d as s}
							<p class="font-mono text-xs text-gray-400">
								<span class="text-gray-600">ID:</span> {s.id}
								<span class="ml-2 text-gray-600">{s.name.toLowerCase().includes('second half') ? '2H' : 'LMS'}</span>
							</p>
						{/each}
					</div>
					<div class="rounded border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-green-400">
						<p class="text-gray-600 mb-1"># Start countdown (run in terminal):</p>
						<p>node scripts/start-test-season.js --interval=1d</p>
					</div>
					<div class="mt-2 text-xs text-gray-600">
						T+0 open · T+20h picks lock · T+23h 58m results · T+24h next week
					</div>
				</div>
			{/if}
		</div>

		<div class="mt-4 flex flex-wrap gap-3 border-t border-orange-800/30 pt-4">
			<div class="rounded border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-400">
				<span class="text-gray-600"># Clean up all test data:</span><br/>
				node scripts/clear-test-season.js --all
			</div>
			<div class="rounded border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-400">
				<span class="text-gray-600"># Seed new test seasons:</span><br/>
				node scripts/seed-test-season.js --interval=1h
			</div>
		</div>
	</div>
{/if}

<!-- Pending payment quick list -->
{#if stats.pendingPayment > 0}
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Awaiting Payment</h2>
			{#if stats.pendingPayment > 5}
				<a href="/admin/entries?status=pending_payment" class="text-xs text-[#c9a84c] hover:underline">
					View all {stats.pendingPayment} →
				</a>
			{/if}
		</div>
		<div class="overflow-hidden rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
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
