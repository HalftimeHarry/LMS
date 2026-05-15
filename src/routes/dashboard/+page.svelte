<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const pickByEntry          = $derived(data.pickByEntry          as Record<string, any>);
	const usedTeamCountByEntry = $derived(data.usedTeamCountByEntry as Record<string, number>);
	const NFL_TEAMS = 32;

	const statusColors: Record<string, string> = {
		pending_payment: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		active:          'bg-green-950/60 text-green-400 border-green-800',
		eliminated:      'bg-red-950/60 text-red-400 border-red-800',
		winner:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	const weekStatusColors: Record<string, string> = {
		open:            'text-green-400',
		locked:          'text-yellow-400',
		results_pending: 'text-orange-400',
		complete:        'text-gray-500',
	};
</script>

<svelte:head><title>Dashboard — LMS Pool</title></svelte:head>

<!-- Welcome -->
<div class="mb-8">
	<h1 class="text-3xl font-bold text-white">
		Welcome back, <span class="text-[#c9a84c]">{data.user.displayName}</span>
	</h1>
	{#if data.activeSeason}
		<p class="mt-1 text-gray-400">{data.activeSeason.name} is underway.</p>
	{:else}
		<p class="mt-1 text-gray-400">No active season right now. Check back soon.</p>
	{/if}
</div>

<!-- Stat cards -->
<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
	{#each [
		{ label: 'Active Entries',    value: data.activeEntries.length,    color: 'text-green-400' },
		{ label: 'Pending Payment',   value: data.pendingEntries.length,   color: 'text-yellow-400' },
		{ label: 'Eliminated',        value: data.eliminatedEntries.length,color: 'text-red-400' },
		{ label: 'Total Entries',     value: data.entries.length,          color: 'text-white' },
	] as card}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 text-center backdrop-blur-sm">
			<div class="text-3xl font-bold {card.color}">{card.value}</div>
			<div class="mt-1 text-xs text-gray-500">{card.label}</div>
		</div>
	{/each}
</div>

<!-- Current week + deadline -->
{#if data.currentWeek}
	<div class="mb-8 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Current Week</p>
				<p class="mt-1 text-2xl font-bold text-white">Week {data.currentWeek.week}</p>
				<p class="mt-1 text-sm text-gray-400">
					Deadline:
					<span class="text-white">
						{new Date(data.currentWeek.deadline).toLocaleString('en-US', {
							weekday: 'short', month: 'short', day: 'numeric',
							hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
						})}
					</span>
				</p>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium {weekStatusColors[data.currentWeek.status] ?? 'text-gray-400'}">
					{data.currentWeek.status.replace('_', ' ').toUpperCase()}
				</span>
			</div>
		</div>
	</div>
{/if}

<!-- Entries -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold text-white">My Entries</h2>
		{#if data.activeSeason?.status === 'open'}
			<a href="/dashboard/entries/new"
				class="rounded border border-[#c9a84c] bg-black/80 px-4 py-1.5 text-sm text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black">
				+ Request Entry
			</a>
		{/if}
	</div>

	{#if data.entries.length === 0}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-10 text-center backdrop-blur-sm">
			<p class="text-gray-400">You have no entries yet.</p>
			{#if data.activeSeason?.status === 'open'}
				<a href="/dashboard/entries/new" class="mt-2 inline-block text-sm text-[#c9a84c] hover:underline">
					Request your first entry →
				</a>
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each data.entries as entry}
				<a
					href="/dashboard/entries/{entry.id}"
					class="block rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[#c9a84c]"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p class="font-semibold text-white">{entry.entryName}</p>
							<p class="mt-0.5 text-sm text-gray-400">{entry.expand?.season?.name ?? '—'}</p>
							{#if entry.status === 'eliminated' && entry.eliminatedWeek}
								<p class="mt-1 text-xs text-red-400">
									Eliminated week {entry.eliminatedWeek}
									{#if entry.eliminatedReason} — {entry.eliminatedReason}{/if}
								</p>
							{/if}
							{#if entry.status === 'pending_payment'}
								<p class="mt-1 text-xs text-yellow-500">Awaiting payment confirmation.</p>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-2">
							{#if entry.paid}
								<span class="text-xs text-green-400">✅ Paid</span>
							{:else}
								<span class="text-xs text-gray-500">Payment pending</span>
							{/if}
							<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[entry.status] ?? ''}">
								{entry.status.replace('_', ' ')}
							</span>
							{#if entry.status === 'active'}
							{@const available = NFL_TEAMS - (usedTeamCountByEntry[entry.id] ?? 0)}
							<span class="text-xs text-gray-500">
								{available} team{available !== 1 ? 's' : ''} available
							</span>
						{/if}
						{#if entry.status === 'active' && data.currentWeek}
								{@const pick = pickByEntry[entry.id]}
								{#if pick}
									{@const teams = pick.expand?.pickedTeams ?? []}
									{@const isLms = entry.entryType === 'lms'}
									{@const isPending = data.currentWeek.status === 'open'}
									<span class="rounded border px-2.5 py-1 text-xs font-medium
										{isPending
											? 'border-yellow-800 bg-yellow-950/60 text-yellow-400'
											: 'border-gray-700 bg-gray-900/60 text-gray-400'}">
										{isPending ? 'Pending' : 'Used'} · Wk {data.currentWeek.week}
										— {teams.map((t: any) => t.city + ' ' + t.name).join(', ')}
										<span class="{isLms ? 'text-red-400' : 'text-green-400'}">{isLms ? 'to lose' : 'to win'}</span>
									</span>
								{:else if data.currentWeek.status === 'open'}
									<span class="rounded border border-yellow-800 bg-yellow-950/60 px-2.5 py-1 text-xs font-medium text-yellow-400">
										Wk {data.currentWeek.week} — pick needed
									</span>
								{/if}
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<!-- Quick links -->
<div class="grid gap-4 sm:grid-cols-3">
	{#each [
		{ href: '/dashboard/standings', label: 'Standings',   desc: 'See who is still alive' },
		{ href: '/dashboard/rules',     label: 'Rules',       desc: 'Official 2027 rules' },
		{ href: '/dashboard/profile',   label: 'My Profile',  desc: 'Update your account' },
	] as link}
		<a href={link.href}
			class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[#c9a84c]">
			<p class="font-semibold text-[#c9a84c]">{link.label}</p>
			<p class="mt-1 text-sm text-gray-400">{link.desc}</p>
		</a>
	{/each}
</div>
