<script lang="ts">
	import type { PageData } from './$types';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { teamLogoUrl } from '$lib/teamLogos';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	const pickByEntry          = $derived(data.pickByEntry          as Record<string, any>);
	const usedTeamCountByEntry = $derived(data.usedTeamCountByEntry as Record<string, number>);
	const currentWeekBySeason  = $derived(data.currentWeekBySeason  as Record<string, any>);
	const entriesBySeason      = $derived(data.entriesBySeason      as Record<string, any[]>);
	const activeSeasons        = $derived(data.activeSeasons        as any[]);
	const allSeasons           = $derived(data.allSeasons           as any[]);
	const NFL_TEAMS = 32;

	// Live countdown tick
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(id);
	});

	// Seasons that have at least one entry for this user, sorted real-first
	const seasonGroups = $derived(
		Object.entries(entriesBySeason)
			.map(([sid, entries]) => ({
				season:  allSeasons.find((s: any) => s.id === sid)
				         ?? activeSeasons.find((s: any) => s.id === sid)
				         ?? (data.entries as any[]).find((e: any) => e.season === sid)?.expand?.season
				         ?? { id: sid, name: '—' },
				entries: entries as any[],
			}))
			// Real seasons first, then test seasons; alphabetical within each group
			.sort((a, b) => {
				const aTest = a.season.name?.includes('[TEST]') ? 1 : 0;
				const bTest = b.season.name?.includes('[TEST]') ? 1 : 0;
				if (aTest !== bTest) return aTest - bTest;
				return (a.season.name ?? '').localeCompare(b.season.name ?? '');
			})
	);

	// Season is driven by the URL ?season= param — server sets the correct default via redirect
	const selectedSeasonId = $derived(data.selectedSeasonId as string);
	const selectedGroup    = $derived(seasonGroups.find(g => g.season.id === selectedSeasonId) ?? null);

	// Only show test seasons in the selector when no real seasons exist
	const hasRealSeasons      = $derived(seasonGroups.some(g => !g.season.name?.includes('[TEST]')));
	const selectableSeasons   = $derived(
		hasRealSeasons ? seasonGroups.filter(g => !g.season.name?.includes('[TEST]')) : seasonGroups
	);

	function switchSeason(id: string) {
		goto(`?season=${id}`);
	}

	// Collapsible — selected season open by default
	let openGroups = $state(new Set<number>());
	$effect(() => {
		const initial = new Set<number>();
		seasonGroups.forEach((g, i) => {
			if (!g.season.name?.includes('[TEST]')) initial.add(i);
		});
		openGroups = initial;
	});
	function toggleGroup(i: number) {
		const next = new Set(openGroups);
		next.has(i) ? next.delete(i) : next.add(i);
		openGroups = next;
	}

	// Active/Eliminated tab per season group
	let groupTab = $state<Record<number, 'active' | 'eliminated'>>({});
	function setGroupTab(i: number, tab: 'active' | 'eliminated') {
		groupTab = { ...groupTab, [i]: tab };
	}

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

	const weekStatusLabels: Record<string, string> = {
		open:            'OPEN',
		locked:          'LOCKED',
		results_pending: 'RESULTS PENDING',
		complete:        'COMPLETE',
	};
</script>

<svelte:head><title>Dashboard — LMS Pool</title></svelte:head>

<!-- Welcome -->
<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<div>
		<h1 class="text-3xl font-bold text-white">
			Welcome back, <span class="text-[#c9a84c]">{data.user.displayName}</span>
		</h1>
		{#if selectedGroup}
			<p class="mt-1 text-sm text-gray-500">{selectedGroup.season.name}</p>
		{:else}
			<p class="mt-1 text-gray-400">No active season right now. Check back soon.</p>
		{/if}
	</div>
	{#if selectableSeasons.length > 1}
		<div class="flex flex-col items-end gap-1">
			<label for="season-select" class="text-xs text-gray-600">Season</label>
			<select
				id="season-select"
				value={selectedSeasonId}
				onchange={(e) => switchSeason((e.target as HTMLSelectElement).value)}
				class="rounded border border-[rgba(201,168,76,0.4)] bg-black px-3 py-2 text-sm text-[#c9a84c] focus:border-[#c9a84c] focus:outline-none"
			>
				{#each selectableSeasons as g}
					<option value={g.season.id}>{g.season.name}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>

<!-- Stat cards — pool-wide for selected season -->
{#if selectedGroup}
	{@const sg    = selectedGroup}
	{@const pool  = (data.poolStatsBySeason as Record<string, any>)[sg.season.id] ?? { total: 0, active: 0, pending: 0, eliminated: 0, pot: 0 }}
	<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 text-center backdrop-blur-sm">
			<div class="text-3xl font-bold text-green-400">{pool.active}</div>
			<div class="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
				Still Alive
				<InfoTip text="Total entries still active in the pool across all players." />
			</div>
		</div>
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 text-center backdrop-blur-sm">
			<div class="text-3xl font-bold text-red-400">{pool.eliminated}</div>
			<div class="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
				Eliminated
				<InfoTip text="Total entries knocked out of the pool so far this season." />
			</div>
		</div>
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 text-center backdrop-blur-sm">
			<div class="text-3xl font-bold text-white">{pool.total}</div>
			<div class="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
				Total Entries
				<InfoTip text="All entries in this season's pool across all players." />
			</div>
		</div>
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 text-center backdrop-blur-sm">
			<div class="text-3xl font-bold text-[#c9a84c]">${pool.pot.toLocaleString()}</div>
			<div class="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
				Amount in Pot
				<InfoTip text="Prize pool from paid entries × entry fee. Excludes complimentary entries." />
			</div>
		</div>
	</div>
{/if}

<!-- Current week + deadline — selected season only -->
{#each seasonGroups.filter(g => g.season.id === selectedSeasonId) as group}
	{@const season = group.season}
	{@const cw     = currentWeekBySeason[season.id]}
	{#if cw}
		{@const diff   = new Date(cw.deadline).getTime() - now}
		{@const live   = cw.status === 'open' && diff > 0}
		{@const urgent = live && diff < 3_600_000}
		{@const d = live ? Math.floor(diff / 86_400_000) : 0}
		{@const h = live ? Math.floor((diff % 86_400_000) / 3_600_000) : 0}
		{@const m = live ? Math.floor((diff % 3_600_000)  /    60_000) : 0}
		{@const s = live ? Math.floor((diff % 60_000)     /     1_000) : 0}
		<div class="mb-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wider text-gray-500">{season.name} — Current Week</p>
					<p class="mt-1 text-2xl font-bold text-white">Week {cw.week}</p>
					<p class="mt-1 text-sm text-gray-400">
						Pick deadline:
						<span class="text-white">
							{new Date(cw.deadline).toLocaleString('en-US', {
								weekday: 'short', month: 'short', day: 'numeric',
								hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
							})}
						</span>
					</p>
				</div>
				<div class="flex items-center gap-3">
					{#if live}
						<span class="font-mono text-2xl font-bold tabular-nums {urgent ? 'text-red-400' : 'text-[#c9a84c]'}">
							{#if d > 0}{d}d {/if}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
						</span>
					{/if}
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium {weekStatusColors[cw.status] ?? 'text-gray-400'}">
							{weekStatusLabels[cw.status] ?? cw.status.toUpperCase()}
						</span>
						<InfoTip text="OPEN — picks accepted until the deadline. LOCKED — deadline passed, no changes. RESULTS PENDING — games finished, results being entered. COMPLETE — eliminations processed." />
					</div>
				</div>
			</div>
			{#if cw.status === 'open'}
				<p class="mt-3 text-xs {urgent ? 'text-red-400' : 'text-[#c9a84c]'}">
					{urgent ? '⚠ Deadline closing soon — submit your pick now.' : 'Picks are open. Submit or update your pick from each active entry below before the deadline.'}
				</p>
			{:else if cw.status === 'locked'}
				<p class="mt-3 text-xs text-yellow-500">
					The deadline has passed. Picks are locked — no changes until results are posted.
				</p>
			{:else if cw.status === 'results_pending'}
				<p class="mt-3 text-xs text-orange-400">
					Games are in. Results are being entered — check back soon to see if you're still alive.
				</p>
			{/if}
		</div>
	{/if}
{/each}

<!-- Entries -->
<div class="mb-8 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-bold text-white">My Entries
			{#if selectedGroup?.season?.name}
				<span class="ml-1 text-base font-normal text-gray-500">{selectedGroup.season.name}</span>
			{/if}
		</h2>
			<InfoTip text="Each entry is an independent shot at the pool. You can hold multiple entries. Click an entry to view its pick history and submit your weekly pick." />
		</div>
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
			{#each seasonGroups.filter(g => g.season.id === selectedSeasonId) as group, gi}
				{@const currentWeek   = currentWeekBySeason[group.season.id] ?? null}
				{@const activeCount   = group.entries.filter((e: any) => e.status === 'active').length}
				{@const missingPicks  = currentWeek?.status === 'open'
					? group.entries.filter((e: any) => e.status === 'active' && !pickByEntry[e.id]).length
					: 0}
				{@const isOpen        = openGroups.has(gi)}

				<!-- Collapsible season card -->
				<div class="overflow-hidden rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">

					<!-- Header / toggle -->
					<button
						type="button"
						onclick={() => toggleGroup(gi)}
						class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-semibold text-white">{group.season.name}</span>
								{#if currentWeek}
									<span class="rounded border border-gray-800 px-2 py-0.5 text-xs {weekStatusColors[currentWeek.status] ?? 'text-gray-500'}">
										Wk {currentWeek.week} · {weekStatusLabels[currentWeek.status] ?? currentWeek.status}
									</span>
								{/if}
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{activeCount} active entr{activeCount === 1 ? 'y' : 'ies'}
								{#if missingPicks > 0}
									· <span class="text-red-400">⚠ {missingPicks} pick{missingPicks === 1 ? '' : 's'} needed</span>
								{:else if currentWeek?.status === 'open' && activeCount > 0}
									· <span class="text-green-400">All picks submitted</span>
								{:else if currentWeek?.status === 'locked'}
									· <span class="text-yellow-500">Picks locked</span>
								{/if}
								· Click to {isOpen ? 'collapse' : 'view entries & submit picks'}
							</p>
						</div>
						<span class="shrink-0 text-gray-500 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}">▾</span>
					</button>

					<!-- Entry list with Active / Eliminated tabs -->
					{#if isOpen}
						{@const activeEntries     = group.entries.filter((e: any) => e.status !== 'eliminated')}
						{@const eliminatedEntries = group.entries.filter((e: any) => e.status === 'eliminated')}
						{@const tab               = groupTab[gi] ?? 'active'}
						<div class="border-t border-[rgba(201,168,76,0.15)]">
							<!-- Tab bar -->
							<div class="flex border-b border-[rgba(201,168,76,0.1)]">
								<button
									type="button"
									onclick={() => setGroupTab(gi, 'active')}
									class="px-5 py-2.5 text-xs font-semibold transition {tab === 'active' ? 'border-b-2 border-[#c9a84c] text-[#c9a84c]' : 'text-gray-500 hover:text-gray-300'}"
								>Active ({activeEntries.length})</button>
								<button
									type="button"
									onclick={() => setGroupTab(gi, 'eliminated')}
									class="px-5 py-2.5 text-xs font-semibold transition {tab === 'eliminated' ? 'border-b-2 border-red-500 text-red-400' : 'text-gray-500 hover:text-gray-300'}"
								>Eliminated ({eliminatedEntries.length})</button>
							</div>
							<div class="flex flex-col gap-3 px-5 pb-4 pt-3">
								{#each (tab === 'active' ? activeEntries : eliminatedEntries) as entry}
									{@const hasPick = currentWeek ? !!pickByEntry[entry.id] : false}
								<a
										href="/dashboard/entries/{entry.id}"
										class="block rounded-lg border p-4 transition hover:border-[#c9a84c]
											{entry.status === 'active' && currentWeek
												? hasPick
													? 'border-green-900 bg-green-950'
													: 'border-blue-900 bg-blue-950'
												: 'border-gray-800 bg-gray-950/60'}"
									>
										<div class="flex flex-wrap items-center justify-between gap-3">
											<div>
												<p class="font-semibold text-white">{entry.entryName}</p>
												{#if entry.status === 'eliminated' && entry.eliminatedWeek}
													<p class="mt-1 text-xs text-red-400">
														Eliminated week {entry.eliminatedWeek}
														{#if entry.eliminatedReason} — {entry.eliminatedReason}{/if}
													</p>
												{/if}
												{#if entry.status === 'pending_payment'}
													<p class="mt-1 text-xs text-yellow-500">Awaiting payment confirmation from admin.</p>
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
													<span class="text-xs text-gray-500">{available} team{available !== 1 ? 's' : ''} left</span>
												{/if}
												{#if entry.status === 'active' && currentWeek}
													{@const pick = pickByEntry[entry.id]}
													{#if pick}
														{@const teams = pick.expand?.pickedTeams ?? []}
														{@const isLms = entry.entryType === 'lms'}
														{@const isPending = currentWeek.status === 'open'}
														<span class="flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium
															{isPending ? 'border-yellow-800 bg-yellow-950/60 text-yellow-400' : 'border-gray-700 bg-gray-900/60 text-gray-400'}">
															{isPending ? 'Pending' : 'Locked'} · Wk {currentWeek.week} —
															{#each teams as t}
																<img src={teamLogoUrl(t.abbreviation)} alt={t.abbreviation} class="h-4 w-4 object-contain" />
																<span>{t.city} {t.name}</span>
															{/each}
															<span class="{isLms ? 'text-red-400' : 'text-green-400'}">{isLms ? 'to lose' : 'to win'}</span>
														</span>
														{#if isPending}
															<span class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-2.5 py-1 text-xs font-semibold text-[#c9a84c]">
																Update pick →
															</span>
														{/if}
													{:else if currentWeek.status === 'open'}
														<span class="rounded border border-red-800 bg-red-950/60 px-2.5 py-1 text-xs font-medium text-red-400">
															⚠ Wk {currentWeek.week} — pick needed
														</span>
														<span class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-2.5 py-1 text-xs font-semibold text-[#c9a84c]">
															Submit pick →
														</span>
													{/if}
												{/if}
											</div>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Quick links -->
<div class="grid gap-4 sm:grid-cols-3">
	<a href="/dashboard/picks"
		class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[#c9a84c]">
		<p class="font-semibold text-[#c9a84c]">Make a Pick</p>
		<p class="mt-1 text-sm text-gray-400">Submit or update your pick for the current week</p>
	</a>
	<a href="/dashboard/standings?season={selectedSeasonId}"
		class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[#c9a84c]">
		<p class="font-semibold text-[#c9a84c]">Standings</p>
		<p class="mt-1 text-sm text-gray-400">See who is still alive in the pool</p>
	</a>
	<a href="/dashboard/rules"
		class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[#c9a84c]">
		<p class="font-semibold text-[#c9a84c]">Rules</p>
		<p class="mt-1 text-sm text-gray-400">How the pool works, tiebreakers, and payouts</p>
	</a>
</div>
