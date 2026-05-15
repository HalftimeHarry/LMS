<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const isSuperAdmin = $derived(data.role === 'super_admin');

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
</script>

<svelte:head><title>Admin — LMS Pool</title></svelte:head>

<!-- Season status banner -->
{#if data.activeSeason}
	{@const s = data.activeSeason as any}
	<div class="mb-6 rounded-xl border px-5 py-4 {seasonStatusColors[s.status] ?? 'border-gray-700 text-gray-400'}">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-xs font-medium uppercase tracking-wider opacity-60">Current Season</p>
				<p class="mt-0.5 text-lg font-bold">{s.name}</p>
				<p class="mt-0.5 text-sm opacity-75">{seasonStatusLabel[s.status] ?? s.status}</p>
			</div>
			<div class="flex flex-wrap gap-2 text-xs">
				{#if s.firstPickDeadline}
					<span class="rounded border border-current/30 px-2 py-1 opacity-75">
						First pick: {new Date(s.firstPickDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
					</span>
				{/if}
				{#if data.currentWeek}
					<span class="rounded border border-current/30 px-2 py-1 opacity-75">
						Week {(data.currentWeek as any).week} — {(data.currentWeek as any).status}
					</span>
				{/if}
				<a href="/admin/seasons/{s.id}/edit" class="rounded border border-current/30 px-2 py-1 opacity-75 hover:opacity-100 transition">
					Edit season →
				</a>
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
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">All Seasons</h2>
		{#if isSuperAdmin}
			<a href="/admin/seasons/new" class="text-xs text-[#c9a84c] hover:underline">+ New season</a>
		{/if}
	</div>
	<div class="flex flex-wrap gap-2">
		{#each data.seasons as s}
			<span class="rounded border px-3 py-1 text-sm {seasonStatusColors[(s as any).status] ?? 'border-gray-700 text-gray-400'}">
				{(s as any).name} <span class="opacity-50">· {(s as any).status}</span>
			</span>
		{/each}
	</div>
</div>

<!-- Stats grid -->
<div class="mb-8">
	<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
		{data.activeSeason ? `${(data.activeSeason as any).name} Stats` : 'Stats'}
	</h2>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

		<!-- Pot cards -->
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Total Pot</p>
			<p class="mt-1 text-2xl font-bold text-[#c9a84c]">${data.stats.potEstimate.toLocaleString()}</p>
			<p class="mt-1 text-xs text-gray-600">LMS ${data.stats.lmsPot.toLocaleString()} · 2H ${data.stats.secondHalfPot.toLocaleString()}</p>
		</div>

		<!-- Entry counts -->
		<div class="rounded-xl border border-gray-800 bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Total Entries</p>
			<p class="mt-1 text-2xl font-bold text-white">{data.stats.totalEntries}</p>
			<p class="mt-1 text-xs text-gray-600">LMS {data.stats.lmsEntries} · 2H {data.stats.secondHalfEntries}</p>
		</div>

		<!-- Payment status -->
		<div class="rounded-xl border border-green-900 bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Paid</p>
			<p class="mt-1 text-2xl font-bold text-green-400">{data.stats.paidEntries}</p>
			<p class="mt-1 text-xs text-gray-600">{data.stats.freeEntries} free · {data.stats.pendingPayment} pending</p>
		</div>

		<!-- Active / eliminated -->
		<div class="rounded-xl border border-gray-800 bg-black/75 p-4 backdrop-blur-sm">
			<p class="text-xs text-gray-500">Active / Eliminated</p>
			<p class="mt-1 text-2xl font-bold text-white">
				<span class="text-green-400">{data.stats.activeEntries}</span>
				<span class="text-gray-600"> / </span>
				<span class="text-red-400">{data.stats.eliminatedEntries}</span>
			</p>
			<p class="mt-1 text-xs text-gray-600">{data.stats.totalUsers} registered users</p>
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
				<p class="text-xs text-yellow-400">{data.stats.pendingPayment} entr{data.stats.pendingPayment === 1 ? 'y' : 'ies'} awaiting payment</p>
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
					{#if data.currentWeek}
						Week {(data.currentWeek as any).week} is {(data.currentWeek as any).status}
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

<!-- Pending payment quick list -->
{#if data.pendingPaymentCount > 0}
	<div>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Awaiting Payment</h2>
			{#if data.pendingPaymentCount > 5}
				<a href="/admin/entries?status=pending_payment" class="text-xs text-[#c9a84c] hover:underline">
					View all {data.pendingPaymentCount} →
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
					{#each data.pendingPaymentEntries as entry}
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
									? ((data.activeSeason as any)?.lmsEntryFee ?? '—')
									: ((data.activeSeason as any)?.secondHalfEntryFee ?? '—')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
