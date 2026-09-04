<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ADMIN_TIME_ZONE, PLAYER_TIME_ZONE } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const seasons      = $derived(data.seasons      as any[]);
	const activeSeason = $derived(data.activeSeason as any);
	const rows         = $derived(data.rows         as any[]);
	const isSuperAdmin = $derived(data.isSuperAdmin as boolean);

	const problems = $derived(rows.filter((r: any) => !r.ok));

	function switchSeason(id: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('season', id);
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function fmt(iso: string | null, timeZone: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString('en-US', {
			timeZone,
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		});
	}

	const et = (iso: string | null) => fmt(iso, PLAYER_TIME_ZONE);
	const pt = (iso: string | null) => fmt(iso, ADMIN_TIME_ZONE);
</script>

<svelte:head><title>Weekly Deadlines — Admin</title></svelte:head>

<div>
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-white">Weekly Deadlines</h1>
			<p class="mt-1 text-sm text-gray-500">
				Each week's first kickoff and the pick deadline derived from it.
				Times shown in Eastern (player time) with Pacific in parentheses.
			</p>
		</div>

		{#if isSuperAdmin && seasons.length > 1}
			<select
				value={activeSeason?.id ?? ''}
				onchange={(e) => switchSeason(e.currentTarget.value)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				{#each seasons as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if !activeSeason}
		<div class="rounded-xl border border-gray-800 bg-black/60 p-10 text-center text-gray-500">
			No season found.
		</div>
	{:else}
		{#if problems.length}
			<div class="mb-4 rounded-xl border border-gray-800 bg-black/60 px-4 py-3 text-sm">
				<p class="font-semibold text-red-300">
					{problems.length} week{problems.length === 1 ? '' : 's'} need attention
				</p>
				<p class="mt-1 text-gray-400">
					The pick deadline should be exactly 30 minutes before that week's first kickoff.
				</p>
			</div>
		{/if}

		<div class="overflow-x-auto rounded-xl border border-gray-800 bg-black/60">
			<table class="min-w-full text-sm">
				<thead class="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
					<tr>
						<th class="px-4 py-3 text-left">Week</th>
						<th class="px-4 py-3 text-left">Status</th>
						<th class="px-4 py-3 text-right">Games</th>
						<th class="px-4 py-3 text-left">First kickoff</th>
						<th class="px-4 py-3 text-left">Pick deadline (saved)</th>
						<th class="px-4 py-3 text-left">Entry cutoff (−40m)</th>
						<th class="px-4 py-3 text-left">Check</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-800/60">
					{#each rows as r}
						{@const eastern = r.isPast ? 'text-gray-600' : 'text-gray-300'}
						{@const pacific = r.isPast ? 'text-gray-600' : 'text-red-400'}
						<tr class={r.ok ? '' : 'bg-red-950/20'}>
							<td class="px-4 py-2.5 font-semibold {r.isPast ? 'text-gray-500' : 'text-white'}">{r.week}</td>
							<td class="px-4 py-2.5">
								<span class="rounded px-2 py-0.5 text-xs font-medium
									{r.status === 'open' ? 'bg-green-900/60 text-green-300'
									: r.status === 'locked' ? 'bg-yellow-900/50 text-yellow-300'
									: r.status === 'results_pending' ? 'bg-blue-900/50 text-blue-300'
									: 'bg-gray-800 text-gray-400'}">
									{r.status}
								</span>
							</td>
							<td class="px-4 py-2.5 text-right {r.gameCount === 0 ? 'text-red-400' : 'text-gray-400'}">
								{r.gameCount}
							</td>
							<td class="px-4 py-2.5 {eastern}">
								{et(r.firstKickoff)}
								<span class="block text-xs {pacific}">{pt(r.firstKickoff)}</span>
							</td>
							<td class="px-4 py-2.5 {r.ok ? eastern : 'text-red-300'}">
								{et(r.storedDeadline)}
								<span class="block text-xs {pacific}">{pt(r.storedDeadline)}</span>
							</td>
							<td class="px-4 py-2.5 {eastern}">
								{et(r.entryDeadline)}
								<span class="block text-xs {pacific}">{pt(r.entryDeadline)}</span>
							</td>
							<td class="px-4 py-2.5">
								{#if r.ok}
									<span class="text-xs {r.isPast ? 'text-gray-600' : 'text-blue-400'}">✓ 30 min before</span>
								{:else if !r.firstKickoff}
									<span class="text-xs text-red-400">no kickoff data</span>
								{:else if !r.storedDeadline}
									<span class="text-xs text-red-400">no deadline set</span>
								{:else}
									<span class="text-xs text-red-400">
										{r.driftMinutes} min before — expected {et(r.expectedPickDeadline)}
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="mt-3 text-xs text-gray-600">
			Read-only. Edit deadlines in
			<a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a>
			and kickoffs in
			<a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>.
		</p>
	{/if}
</div>
