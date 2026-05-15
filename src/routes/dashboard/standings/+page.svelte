<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const lmsEntries        = data.lmsEntries        as any[];
	const secondHalfEntries = data.secondHalfEntries as any[];

	const statusColors: Record<string, string> = {
		active:    'bg-green-950/60 text-green-400 border-green-800',
		eliminated:'bg-red-950/60 text-red-400 border-red-800',
		winner:    'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	const statusLabel: Record<string, string> = {
		active:    'Active',
		eliminated:'Eliminated',
		winner:    'Winner 🏆',
	};
</script>

<svelte:head><title>Standings — LMS Pool</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-2xl font-bold text-white">Standings</h1>
	{#if data.activeSeason}
		<span class="rounded border border-[rgba(201,168,76,0.3)] px-3 py-1 text-sm text-[#c9a84c]">
			{data.activeSeason.name}
			{#if data.currentWeek} · Week {data.currentWeek.week}{/if}
		</span>
	{/if}
</div>

{#if !data.activeSeason}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">No active season yet. Check back soon.</p>
	</div>

{:else}

	<!-- LMS standings -->
	<section class="mb-10">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
			LMS — Full Season
			<span class="rounded border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-xs text-[#c9a84c]">
				Pick the Loser
			</span>
			<span class="ml-auto text-sm font-normal text-gray-500">
				{lmsEntries.filter((e) => e.status === 'active').length} remaining
				/ {lmsEntries.length} total
			</span>
		</h2>

		{#if lmsEntries.length === 0}
			<div class="rounded-xl border border-gray-800 bg-black/50 p-8 text-center">
				<p class="text-gray-500">No LMS entries yet.</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-800 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
							<th class="px-4 py-3 w-10">#</th>
							<th class="px-4 py-3">Entry</th>
							<th class="px-4 py-3">Player</th>
							<th class="px-4 py-3">Status</th>
							<th class="px-4 py-3 text-right">Eliminated</th>
						</tr>
					</thead>
					<tbody>
						{#each lmsEntries as entry, i}
							<tr class="border-b border-gray-800/50 transition hover:bg-white/[0.02]
								{entry.status === 'eliminated' ? 'opacity-50' : ''}">
								<td class="px-4 py-3 text-gray-600">{i + 1}</td>
								<td class="px-4 py-3 font-medium text-white">{entry.entryName}</td>
								<td class="px-4 py-3 text-gray-400">
									{entry.expand?.user?.displayName ?? '—'}
								</td>
								<td class="px-4 py-3">
									<span class="rounded border px-2 py-0.5 text-xs font-medium {statusColors[entry.status] ?? 'border-gray-700 text-gray-400'}">
										{statusLabel[entry.status] ?? entry.status}
									</span>
								</td>
								<td class="px-4 py-3 text-right text-xs text-gray-500">
									{#if entry.eliminatedWeek}
										Week {entry.eliminatedWeek}
									{:else}
										—
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Second Half standings -->
	<section>
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
			Second Half
			<span class="rounded border border-blue-800 bg-blue-950/60 px-2 py-0.5 text-xs text-blue-400">
				Pick the Winner
			</span>
			<span class="ml-auto text-sm font-normal text-gray-500">
				{secondHalfEntries.filter((e) => e.status === 'active').length} remaining
				/ {secondHalfEntries.length} total
			</span>
		</h2>

		{#if secondHalfEntries.length === 0}
			<div class="rounded-xl border border-gray-800 bg-black/50 p-8 text-center">
				<p class="text-gray-500">No Second Half entries yet.</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-800 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
							<th class="px-4 py-3 w-10">#</th>
							<th class="px-4 py-3">Entry</th>
							<th class="px-4 py-3">Player</th>
							<th class="px-4 py-3">Status</th>
							<th class="px-4 py-3 text-right">Eliminated</th>
						</tr>
					</thead>
					<tbody>
						{#each secondHalfEntries as entry, i}
							<tr class="border-b border-gray-800/50 transition hover:bg-white/[0.02]
								{entry.status === 'eliminated' ? 'opacity-50' : ''}">
								<td class="px-4 py-3 text-gray-600">{i + 1}</td>
								<td class="px-4 py-3 font-medium text-white">{entry.entryName}</td>
								<td class="px-4 py-3 text-gray-400">
									{entry.expand?.user?.displayName ?? '—'}
								</td>
								<td class="px-4 py-3">
									<span class="rounded border px-2 py-0.5 text-xs font-medium {statusColors[entry.status] ?? 'border-gray-700 text-gray-400'}">
										{statusLabel[entry.status] ?? entry.status}
									</span>
								</td>
								<td class="px-4 py-3 text-right text-xs text-gray-500">
									{#if entry.eliminatedWeek}
										Week {entry.eliminatedWeek}
									{:else}
										—
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

{/if}
