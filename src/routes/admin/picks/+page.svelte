<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const seasons      = $derived(data.seasons      as any[]);
	const allWeeks     = $derived(data.allWeeks     as any[]);
	const picks        = $derived(data.picks        as any[]);
	const resultMap    = $derived(data.resultMap    as Record<string, string>);
	const selectedWeek = $derived(data.selectedWeek as any);

	const lmsPicks = $derived(picks.filter((p: any) => p.entryType === 'lms'));
	const shPicks  = $derived(picks.filter((p: any) => p.entryType === 'second_half'));

	function switchSeason(id: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('season', id);
		params.delete('week');
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function switchWeek(num: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('week', String(num));
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function fmtDeadline(iso: string) {
		return new Date(iso).toLocaleString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short', month: 'short', day: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
		});
	}

	const statusColors: Record<string, string> = {
		open:            'text-green-400',
		locked:          'text-yellow-400',
		results_pending: 'text-orange-400',
		complete:        'text-gray-500',
	};

	const resultColors: Record<string, string> = {
		correct:   'text-green-400',
		incorrect: 'text-red-400',
		tie:       'text-yellow-400',
		pending:   'text-gray-500',
	};

	function teamNames(pick: any): string {
		const teams = pick.expand?.pickedTeams ?? [];
		return teams.map((t: any) => t.abbreviation ?? t.name ?? '?').join(', ');
	}
</script>

<svelte:head><title>Manage Picks — Admin</title></svelte:head>

<!-- Header -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Manage Picks</h1>
			<p class="mt-1 text-sm text-gray-500">Weekly deadline snapshot — backup reference for all picks by week.</p>
		</div>
		<!-- Season selector -->
		<select
			value={data.seasonId}
			onchange={(e) => switchSeason((e.target as HTMLSelectElement).value)}
			class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
		>
			{#each seasons as s}
				<option value={s.id}>{s.name}</option>
			{/each}
		</select>
	</div>

	<!-- Week selector -->
	{#if allWeeks.length}
		<div class="mt-4 flex flex-wrap gap-2">
			{#each allWeeks as w}
				{@const active = w.week === data.selectedWeekNum}
				<button
					type="button"
					onclick={() => switchWeek(w.week)}
					class="rounded border px-3 py-1.5 text-xs font-medium transition
						{active
							? 'border-[#c9a84c] bg-[rgba(201,168,76,0.12)] text-[#c9a84c]'
							: 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'}"
				>
					Wk {w.week}
					<span class="ml-1 {statusColors[w.status] ?? 'text-gray-600'}">·</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if !data.selectedSeason}
	<div class="rounded-xl border border-gray-800 bg-black/75 p-12 text-center">
		<p class="text-gray-500">Select a season above.</p>
	</div>
{:else if !selectedWeek}
	<div class="rounded-xl border border-gray-800 bg-black/75 p-12 text-center">
		<p class="text-gray-500">No weeks found for this season.</p>
	</div>
{:else}
	<!-- Week summary bar -->
	<div class="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-gray-800 bg-black/75 px-5 py-3">
		<div>
			<span class="text-sm font-semibold text-white">Week {selectedWeek.week}</span>
			<span class="ml-2 text-xs {statusColors[selectedWeek.status] ?? 'text-gray-500'}">{selectedWeek.status}</span>
		</div>
		{#if selectedWeek.deadline}
			<span class="text-xs text-gray-500">Deadline: {fmtDeadline(selectedWeek.deadline)}</span>
		{/if}
		<span class="ml-auto text-xs text-gray-600">{picks.length} pick{picks.length !== 1 ? 's' : ''} total · {lmsPicks.length} LMS · {shPicks.length} 2H</span>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<!-- LMS picks -->
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">
			<div class="border-b border-[rgba(201,168,76,0.15)] px-5 py-3">
				<p class="text-xs font-semibold uppercase tracking-wider text-[#c9a84c]">LMS — {lmsPicks.length} picks</p>
			</div>
			{#if lmsPicks.length === 0}
				<p class="px-5 py-8 text-center text-sm text-gray-600">No LMS picks this week.</p>
			{:else}
				<div class="divide-y divide-[rgba(201,168,76,0.08)]">
					{#each lmsPicks as pick, i}
						{@const entry   = pick.expand?.entry}
						{@const player  = entry?.expand?.user}
						{@const result  = resultMap[pick.id] ?? 'pending'}
						<div class="flex items-center gap-3 px-5 py-3">
							<span class="w-5 shrink-0 text-xs font-bold text-[#c9a84c]">{i + 1}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-white">{entry?.entryName ?? '—'}</p>
								<p class="truncate text-xs text-gray-500">{player?.displayName ?? player?.email ?? '—'}</p>
							</div>
							<div class="flex items-center gap-2 shrink-0">
								<span class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
									{teamNames(pick)}
								</span>
								{#if pick.isAutoPick}
									<span class="rounded border border-yellow-800 bg-yellow-950/40 px-1.5 py-0.5 text-xs text-yellow-500">auto</span>
								{/if}
								<span class="text-xs font-medium {resultColors[result] ?? 'text-gray-500'}">{result}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 2H picks -->
		<div class="rounded-xl border border-blue-900/40 bg-black/75 backdrop-blur-sm overflow-hidden">
			<div class="border-b border-blue-900/20 px-5 py-3">
				<p class="text-xs font-semibold uppercase tracking-wider text-blue-400">2nd Half — {shPicks.length} picks</p>
			</div>
			{#if shPicks.length === 0}
				<p class="px-5 py-8 text-center text-sm text-gray-600">No 2H picks this week.</p>
			{:else}
				<div class="divide-y divide-blue-900/10">
					{#each shPicks as pick, i}
						{@const entry   = pick.expand?.entry}
						{@const player  = entry?.expand?.user}
						{@const result  = resultMap[pick.id] ?? 'pending'}
						<div class="flex items-center gap-3 px-5 py-3">
							<span class="w-5 shrink-0 text-xs font-bold text-blue-400">{i + 1}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-white">{entry?.entryName ?? '—'}</p>
								<p class="truncate text-xs text-gray-500">{player?.displayName ?? player?.email ?? '—'}</p>
							</div>
							<div class="flex items-center gap-2 shrink-0">
								<span class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
									{teamNames(pick)}
								</span>
								{#if pick.isAutoPick}
									<span class="rounded border border-yellow-800 bg-yellow-950/40 px-1.5 py-0.5 text-xs text-yellow-500">auto</span>
								{/if}
								<span class="text-xs font-medium {resultColors[result] ?? 'text-gray-500'}">{result}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
