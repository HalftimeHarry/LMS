<style>
	@keyframes gold-pulse {
		0%, 100% { background: rgba(201,168,76,0.06); box-shadow: 0 0 10px rgba(201,168,76,0.15); }
		50%       { background: rgba(201,168,76,0.35); box-shadow: 0 0 24px rgba(201,168,76,0.5);  }
	}
	.standings-pulse {
		animation: gold-pulse 2s ease-in-out infinite;
	}
</style>

<script lang="ts">
	import { formatDeadlineLongDual } from '$lib/time';
	import type { PageData } from './$types';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import PoolCard from '$lib/components/PoolCard.svelte';
	import { teamLogoUrl } from '$lib/teamLogos';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createDashboardController } from '$lib/controllers';
	import { resolveCardCountdownDisplay } from '$lib/utils';

	let { data }: { data: PageData } = $props();

	const pickByEntry          = $derived(data.pickByEntry          as Record<string, any>);
	const usedTeamCountByEntry = $derived(data.usedTeamCountByEntry as Record<string, number>);
	const currentWeekBySeason  = $derived(data.currentWeekBySeason  as Record<string, any>);
	const currentWeekSHBySeason = $derived(data.currentWeekSHBySeason as Record<string, any>);
	const week6BySeason        = $derived(data.week6BySeason        as Record<string, any>);
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

	// Pair LMS + 2H seasons by year into unified display groups
	const seasonGroups = $derived((() => {
		const raw = Object.entries(entriesBySeason as Record<string, any[]>)
			.map(([sid, entries]) => ({
				season: allSeasons.find((s: any) => s.id === sid)
				        ?? activeSeasons.find((s: any) => s.id === sid)
				        ?? (data.entries as any[]).find((e: any) => e.season === sid)?.expand?.season
				        ?? { id: sid, name: '—' },
				entries: entries as any[],
			}));

		// Merge LMS + 2H seasons with the same year into one group
		// Key by year (or season id for test/unmatched seasons)
		const merged = new Map<string, { season: any; entries: any[] }>();
		for (const g of raw) {
			const isTest = g.season.name?.includes('[TEST]');
			const year   = !isTest && g.season.year ? String(g.season.year) : g.season.id;
			if (!merged.has(year)) {
				// Use the LMS season as the anchor (lmsEnabled or not secondHalfEnabled)
				merged.set(year, { season: g.season, entries: [...g.entries] });
			} else {
				const existing = merged.get(year)!;
				// Prefer the LMS season as the display season
				if (g.season.secondHalfEnabled && !g.season.lmsEnabled) {
					// keep existing as anchor, just merge entries
				} else {
					existing.season = g.season;
				}
				existing.entries.push(...g.entries);
			}
		}

		return [...merged.values()].sort((a, b) => {
			const aTest = a.season.name?.includes('[TEST]') ? 1 : 0;
			const bTest = b.season.name?.includes('[TEST]') ? 1 : 0;
			if (aTest !== bTest) return aTest - bTest;
			return (b.season.year ?? 0) - (a.season.year ?? 0);
		});
	})());

	// Season is driven by the URL ?season= param — server sets the correct default via redirect
	const selectedSeasonId = $derived((data.selectedSeasonId as string | null) ?? '');
	const selectedGroup    = $derived((() => {
		if (!selectedSeasonId) return seasonGroups[0] ?? null;
		return seasonGroups.find(g =>
			g.season.id === selectedSeasonId ||
			g.entries.some((e: any) => e.season === selectedSeasonId)
		) ?? seasonGroups[0] ?? null;
	})());

	// True when the current user has at least one active entry in the selected season
	const hasAliveEntries = $derived(
		(selectedGroup?.entries ?? []).some((e: any) => e.status === 'active')
	);

	// Only show test seasons in the selector when no real seasons exist
	const hasRealSeasons      = $derived(seasonGroups.some(g => !g.season.name?.includes('[TEST]')));
	const selectableSeasons   = $derived(
		hasRealSeasons ? seasonGroups.filter(g => !g.season.name?.includes('[TEST]')) : seasonGroups
	);

	function switchSeason(id: string) {
		goto(`?season=${id}`);
	}

	function formatCountdown(diff: number, live: boolean) {
		if (!live || !Number.isFinite(diff)) return '—';
		const totalSeconds = Math.max(0, Math.floor(diff / 1_000));
		const days = Math.floor(totalSeconds / 86_400);
		const hours = Math.floor((totalSeconds % 86_400) / 3_600);
		const minutes = Math.floor((totalSeconds % 3_600) / 60);
		const seconds = totalSeconds % 60;
		return `${days > 0 ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

	const pickView = $derived((data as any).pickView as 'entries' | 'standings');

	const dashboardCards = $derived(
		createDashboardController({
			seasonGroups,
			selectedSeasonId,
			currentWeekBySeason: currentWeekBySeason as Record<string, any>,
			currentWeekSHBySeason: currentWeekSHBySeason as Record<string, any>,
			week6BySeason: week6BySeason as Record<string, any>,
			entries: data.entries as any[],
			now,
		}).cardGroups
	);

	function seasonSpanLabelFromSeason(season: any): string | null {
		if (!season) return null;

		const nameMatch = String(season.name ?? '').match(/(20\d{2})\s*-\s*(20\d{2})/);
		if (nameMatch) return `${nameMatch[1]} - ${nameMatch[2]}`;

		const endYear = Number(season.year);
		if (!Number.isFinite(endYear) || endYear <= 0) return null;

		return `${endYear - 1} - ${endYear}`;
	}

	function seasonSpanLabel(group: any): string | null {
		if (!group) return null;

		// Prefer an explicit YYYY - YYYY span from any entry season name in this group.
		for (const entry of group.entries ?? []) {
			const fromEntry = seasonSpanLabelFromSeason(entry.expand?.season);
			if (fromEntry) return fromEntry;
		}

		return seasonSpanLabelFromSeason(group.season);
	}

	function pickLink(entry: any): string {
		if (pickView === 'standings') {
			const pool = entry.entryType === 'lms' ? 'lms' : 'second_half';
			const sid  = entry.expand?.season?.id ?? entry.season ?? '';
			return `/dashboard/standings?pool=${pool}&season=${sid}`;
		}
		return `/dashboard/entries/${entry.id}`;
	}

	function fmtDeadline(iso: string | null | undefined): string {
		return formatDeadlineLongDual(iso);
	}
</script>

<svelte:head><title>Dashboard — LMS Pool</title></svelte:head>

<!-- ── Single dashboard card ──────────────────────────────────────────────── -->
<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-visible"
	style="background: radial-gradient(ellipse at 0% 50%, rgba(201,168,76,0.04) 0%, transparent 60%), #0a0a0a;">

<!-- Welcome -->
<div class="px-6 py-5">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="text-xs font-semibold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Welcome back</p>
			<h1 class="mt-0.5 text-2xl font-bold text-white">{data.user.displayName}</h1>
			{#if selectedGroup}
				<p class="mt-1 text-sm text-gray-500">{selectedGroup.season.name}</p>
			{:else}
				<p class="mt-1 text-sm text-gray-500">No active season right now. Check back soon.</p>
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
</div>

<!-- Stat cards — split by pool type -->
{#if selectedGroup}
	{@const sg      = selectedGroup}
	{@const lmsPool = (data.poolStatsBySeason as Record<string, any>)[sg.entries.find((e: any) => e.entryType === 'lms')?.season ?? sg.season.id] ?? {}}
	{@const shPool  = (data.poolStatsBySeason as Record<string, any>)[sg.entries.find((e: any) => e.entryType === 'second_half')?.season ?? ''] ?? {}}
	{@const lms     = lmsPool.lms ?? { total: 0, active: 0, eliminated: 0, pot: 0 }}
	{@const sh      = shPool.sh   ?? { total: 0, active: 0, eliminated: 0, pot: 0 }}
	{@const lmsSeasonRecord = (data.activeSeasons as any[]).find((s: any) => s.id === (sg.entries.find((e: any) => e.entryType === 'lms')?.season ?? sg.season.id))}
	{@const lmsMaintFee = (lmsSeasonRecord?.maintenanceFee ?? 0) as number}

	<!-- My entries summary -->
	{@const myLmsEntries = sg.entries.filter((e: any) => e.entryType === 'lms')}
	{@const myShEntries  = sg.entries.filter((e: any) => e.entryType === 'second_half')}
	{@const myLmsAlive   = myLmsEntries.filter((e: any) => e.status === 'active').length}
	{@const myShAlive    = myShEntries.filter((e: any)  => e.status === 'active').length}
	{@const myLmsOut     = myLmsEntries.filter((e: any) => e.status === 'eliminated').length}
	{@const myShOut      = myShEntries.filter((e: any)  => e.status === 'eliminated').length}

	<div class="border-t border-gray-800 p-5">
		<div class="flex flex-col gap-6">

		<!-- LMS stats row -->
		{#if lms.total > 0}
		<div>
			<div class="mb-2 flex items-center gap-2">
				<span class="text-[10px] font-bold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Last Man Standing</span>
				<div class="h-px flex-1 bg-[rgba(201,168,76,0.15)]"></div>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<!-- Still alive -->
				<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-green-400">{lms.active}</div>
					<div class="mt-1 text-xs text-gray-500">Still Alive</div>
					<div class="mt-0.5 text-[10px] text-gray-700">across all players</div>
				</div>
				<!-- Eliminated -->
				<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-red-400">{lms.eliminated}</div>
					<div class="mt-1 text-xs text-gray-500">Eliminated</div>
					<div class="mt-0.5 text-[10px] text-gray-700">knocked out so far</div>
				</div>
				<!-- Total -->
				<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-white">{lms.total}</div>
					<div class="mt-1 text-xs text-gray-500">Total Entries</div>
					<div class="mt-0.5 text-[10px] text-gray-700">in the LMS pool</div>
				</div>
				<!-- Pot -->
				<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-[#c9a84c]">${lms.pot.toLocaleString()}</div>
					<div class="mt-1 text-xs text-gray-500">Prize Pot</div>
					{#if lmsMaintFee > 0}
						<div class="mt-0.5 text-[10px] text-gray-700">${(lms.pot + lmsMaintFee).toLocaleString()} gross − ${lmsMaintFee.toLocaleString()} maintenance fee</div>
					{/if}
					<div class="mt-0.5 text-[10px] text-gray-700">{lms.paid ?? 0} paid · {lms.free ?? 0} free</div>
					
				</div>
				<!-- My entries -->
				<div class="rounded-xl border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.05)] p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-[#c9a84c]">{myLmsAlive}<span class="text-sm text-gray-600">/{myLmsEntries.length}</span></div>
					<div class="mt-1 text-xs text-gray-500">My Entries Alive</div>
					<div class="mt-0.5 text-[10px] {myLmsOut > 0 ? 'text-red-500' : 'text-gray-700'}">
						{myLmsOut > 0 ? `${myLmsOut} eliminated` : 'none eliminated'}
					</div>
				</div>
			</div>
		</div>
		{/if}

		<!-- 2H stats row -->
		{#if sh.total > 0}
		<div>
			<div class="mb-2 flex items-center gap-2">
				<span class="text-[10px] font-bold uppercase tracking-widest text-blue-500/60">Second Half Pool</span>
				<div class="h-px flex-1 bg-blue-900/30"></div>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<div class="rounded-xl border border-blue-900/40 bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-green-400">{sh.active}</div>
					<div class="mt-1 text-xs text-gray-500">Still Alive</div>
					<div class="mt-0.5 text-[10px] text-gray-700">across all players</div>
				</div>
				<div class="rounded-xl border border-blue-900/40 bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-red-400">{sh.eliminated}</div>
					<div class="mt-1 text-xs text-gray-500">Eliminated</div>
					<div class="mt-0.5 text-[10px] text-gray-700">knocked out so far</div>
				</div>
				<div class="rounded-xl border border-blue-900/40 bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-white">{sh.total}</div>
					<div class="mt-1 text-xs text-gray-500">Total Entries</div>
					<div class="mt-0.5 text-[10px] text-gray-700">in the 2H pool</div>
				</div>
				<div class="rounded-xl border border-blue-900/40 bg-black/75 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-[#c9a84c]">${sh.pot.toLocaleString()}</div>
					<div class="mt-1 text-xs text-gray-500">Prize Pot</div>
					
				</div>
				<div class="rounded-xl border border-blue-700/40 bg-blue-950/10 p-4 text-center backdrop-blur-sm">
					<div class="text-2xl font-bold text-blue-400">{myShAlive}<span class="text-sm text-gray-600">/{myShEntries.length}</span></div>
					<div class="mt-1 text-xs text-gray-500">My Entries Alive</div>
					<div class="mt-0.5 text-[10px] {myShOut > 0 ? 'text-red-500' : 'text-gray-700'}">
						{myShOut > 0 ? `${myShOut} eliminated` : 'none eliminated'}
					</div>
				</div>
			</div>
		</div>
		{/if}

		</div>
	</div>
{/if}

<!-- Current week countdowns — LMS + 2H side by side when both active -->
{#each dashboardCards as groupCard}
	{@const lmsCard = groupCard.lmsCard}
	{@const shCard = groupCard.secondHalfCard}
	{#if lmsCard || shCard}
	<div class="mb-4 grid gap-4 {lmsCard && shCard ? 'sm:grid-cols-2' : 'grid-cols-1'}">
		{#if lmsCard}
		<PoolCard
			title={lmsCard.title}
			subtitle={lmsCard.subtitle}
			weekLabel={lmsCard.weekLabel}
			entryDeadlineLabel={lmsCard.entryDeadline ? fmtDeadline(lmsCard.entryDeadline) : 'TBD'}
			pickDeadlineLabel={lmsCard.pickDeadline ? fmtDeadline(lmsCard.pickDeadline) : 'TBD'}
			registrationLabel={lmsCard.registrationLabel}
			picksLabel={lmsCard.picksLabel}
			registrationCountdown={formatCountdown(lmsCard.registrationDiffMs, lmsCard.registrationLive)}
			picksCountdown={formatCountdown(lmsCard.picksDiffMs, lmsCard.picksLive)}
			registrationLive={lmsCard.registrationLive}
			picksLive={lmsCard.picksLive}
			registrationUrgent={lmsCard.registrationUrgent}
			picksUrgent={lmsCard.picksUrgent}
			registrationDeadlinePassed={lmsCard.registrationDeadlinePassed}
			picksDeadlinePassed={lmsCard.picksDeadlinePassed}
			footerMessage={lmsCard.footerMessage}
		/>
		{/if}

		{#if shCard}
		<PoolCard
			title={shCard.title}
			subtitle={shCard.subtitle}
			weekLabel={shCard.weekLabel}
			entryDeadlineLabel={shCard.entryDeadline ? fmtDeadline(shCard.entryDeadline) : 'TBD'}
			pickDeadlineLabel={shCard.pickDeadline ? fmtDeadline(shCard.pickDeadline) : 'TBD'}
			registrationLabel={shCard.registrationLabel}
			picksLabel={shCard.picksLabel}
			registrationCountdown={formatCountdown(shCard.registrationDiffMs, shCard.registrationLive)}
			picksCountdown={resolveCardCountdownDisplay({
				isSecondHalfPending: shCard.picksLabel === 'Picks pending',
				registrationDiffMs: shCard.registrationDiffMs,
				registrationLive: shCard.registrationLive,
				picksDiffMs: shCard.picksDiffMs,
				picksLive: shCard.picksLive
			})}
			registrationLive={shCard.registrationLive}
			picksLive={shCard.picksLive}
			registrationUrgent={shCard.registrationUrgent}
			picksUrgent={shCard.picksUrgent}
			registrationDeadlinePassed={shCard.registrationDeadlinePassed}
			picksDeadlinePassed={shCard.picksDeadlinePassed}
			footerMessage={shCard.footerMessage}
			ctaHref={shCard.ctaHref}
			ctaText={shCard.ctaText}
			borderClass="border-blue-900/40"
			dividerClass="border-blue-900/20"
			titleClass="text-blue-500/60"
			subtitleClass="text-green-400"
			picksClass="text-blue-400"
			footerClass="text-blue-400/70"
		/>
		{/if}
	</div>
	{/if}
{/each}

<!-- Entries -->
<div class="border-t border-gray-800 p-5">
	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-bold text-white">My Entries
			{#if seasonSpanLabel(selectedGroup)}
				<span class="ml-1 text-base font-normal text-gray-500">{seasonSpanLabel(selectedGroup)}</span>
			{/if}
		</h2>
			<InfoTip text="Each entry is an independent shot at the pool. You can hold multiple entries. Click an entry to view its pick history and submit your weekly pick. Tip: use 'Pick from Standings' to see every player's picks side-by-side — it's easier to spot which of your entries still needs a pick and how your choice stacks up against the field." />
		</div>
		<div class="flex items-center gap-2">
			{#if hasAliveEntries}
				<a href="/dashboard/standings?season={selectedSeasonId}"
					class="standings-pulse relative flex items-center gap-3 overflow-hidden rounded-lg border border-[#c9a84c] px-4 py-2.5 transition hover:brightness-110"
>
					<span class="flex flex-col">
						<span class="text-sm font-bold text-[#c9a84c]">🏆 Pick from Standings</span>
						<span class="text-[10px] text-[#c9a84c]/60">See the full field — pick your entry from the grid</span>
					</span>
					<svg class="ml-auto h-4 w-4 shrink-0 text-[#c9a84c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				</a>
			{:else}
				<a href="/dashboard/standings?season={selectedSeasonId}"
					class="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-xs font-medium text-gray-400 transition hover:border-gray-500 hover:text-white">
					🏆 Pick from Standings
					<svg class="ml-auto h-3.5 w-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				</a>
			{/if}
			{#if data.activeSeason?.status === 'open'}
				<a href="/dashboard/entries/new"
					class="rounded border border-[#c9a84c] bg-black/80 px-4 py-1.5 text-sm text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black">
					+ Request Entry
				</a>
			{/if}
		</div>
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
			{#each seasonGroups.filter(g => g.season.id === selectedSeasonId || g.entries.some((e: any) => e.season === selectedSeasonId)) as group, gi}
				{@const lmsGroup      = group.entries.filter((e: any) => e.entryType === 'lms').sort((a: any, b: any) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }))}
				{@const shGroup       = group.entries.filter((e: any) => e.entryType === 'second_half').sort((a: any, b: any) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }))}
				{@const lmsSeasonId2  = lmsGroup[0]?.season ?? group.season.id}
				{@const shSeasonId2   = shGroup[0]?.season ?? group.season.id}
				{@const currentWeek   = currentWeekBySeason[lmsSeasonId2] ?? currentWeekBySeason[group.season.id] ?? null}
				{@const currentWeekSH = currentWeekSHBySeason[shSeasonId2] ?? currentWeekSHBySeason[group.season.id] ?? null}
				{@const activeCount   = group.entries.filter((e: any) => e.status === 'active').length}
				{@const missingPicks  = (currentWeek?.status === 'open'
					? lmsGroup.filter((e: any) => e.status === 'active' && !pickByEntry[e.id]).length
					: 0) + (currentWeekSH?.status === 'open'
					? shGroup.filter((e: any) => e.status === 'active' && !pickByEntry[e.id]).length
					: 0)}
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
								<span class="font-semibold text-white">
									{seasonSpanLabel(group) ?? group.season.name}
								</span>
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

					{#if isOpen}
					<div class="border-t border-[rgba(201,168,76,0.15)]">

						<!-- LMS section -->
						{#if lmsGroup.length > 0}
						{@const tab = groupTab[gi] ?? 'active'}
						{@const lmsActive = lmsGroup.filter((e: any) => e.status !== 'eliminated')}
						{@const lmsElim   = lmsGroup.filter((e: any) => e.status === 'eliminated')}
						<div class="border-b border-[rgba(201,168,76,0.1)]">
							<!-- LMS header -->
							<div class="flex items-center justify-between gap-2 border-b border-[rgba(201,168,76,0.08)] bg-[rgba(201,168,76,0.04)] px-5 py-2">
								<div class="flex items-center gap-2">
									<span class="text-[10px] font-bold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Last Man Standing</span>
									<span class="rounded-full bg-[rgba(201,168,76,0.15)] px-2 py-0.5 text-[10px] font-bold text-[#c9a84c]">{lmsGroup.length}</span>
									<span class="text-[10px] text-gray-600">· Pick the <span class="text-red-400 font-medium">LOSER</span></span>
								</div>
								<div class="flex gap-1">
									<button type="button" onclick={() => setGroupTab(gi, 'active')}
										class="px-3 py-1 text-[10px] font-semibold transition rounded
											{tab === 'active' ? 'text-[#c9a84c] bg-[rgba(201,168,76,0.1)]' : 'text-gray-600 hover:text-gray-400'}">
										Active ({lmsActive.length})
									</button>
									<button type="button" onclick={() => setGroupTab(gi, 'eliminated')}
										class="px-3 py-1 text-[10px] font-semibold transition rounded
											{tab === 'eliminated' ? 'text-red-400 bg-red-950/30' : 'text-gray-600 hover:text-gray-400'}">
										Out ({lmsElim.length})
									</button>
								</div>
							</div>
							<div class="flex flex-col gap-2 px-5 pb-4 pt-3">
								{#each (tab === 'active' ? lmsActive : lmsElim) as entry}
									{@const hasPick  = currentWeek ? !!pickByEntry[entry.id] : false}
									{@const pick     = pickByEntry[entry.id]}
									{@const isPending = currentWeek?.status === 'open'}
									<a href={pickLink(entry)}
										class="block rounded-lg border p-4 transition
											{entry.status === 'active' && currentWeek
												? hasPick ? 'border-green-900 bg-green-950/60 hover:border-green-700'
												: 'border-yellow-900 bg-yellow-950/20 hover:border-yellow-700'
												: 'border-gray-800 bg-gray-950/60 hover:border-gray-600'}">
										<div class="flex flex-wrap items-center justify-between gap-3">
											<div>
												<p class="font-semibold text-white">{entry.entryName}</p>
												{#if entry.status === 'eliminated' && entry.eliminatedWeek}
													<p class="mt-1 text-xs text-red-400">Out week {entry.eliminatedWeek}{entry.eliminatedReason ? ` — ${entry.eliminatedReason}` : ''}</p>
												{/if}
												{#if entry.status === 'pending_payment'}
													<p class="mt-1 text-xs text-yellow-500">Awaiting payment confirmation.</p>
												{/if}
											</div>
											<div class="flex flex-wrap items-center gap-2">
												{#if entry.paid}<span class="text-xs text-green-400">✅ Paid</span>{:else}<span class="text-xs text-gray-500">Payment pending</span>{/if}
												<span class="rounded border px-2 py-0.5 text-xs font-medium {statusColors[entry.status] ?? ''}">{entry.status.replace('_',' ')}</span>
												{#if entry.status === 'active'}
													<span class="text-xs text-gray-500">{NFL_TEAMS - (usedTeamCountByEntry[entry.id] ?? 0)} left</span>
												{/if}
												{#if entry.status === 'active' && currentWeek}
													{#if pick}
														{@const teams = pick.expand?.pickedTeams ?? []}
														<span class="flex items-center gap-1 rounded border px-2 py-0.5 text-xs
															{isPending ? 'border-yellow-800 bg-yellow-950/60 text-yellow-400' : 'border-gray-700 text-gray-400'}">
															{isPending ? 'Pending' : 'Locked'} —
															{#each teams as t}<img src={teamLogoUrl(t.abbreviation)} alt={t.abbreviation} class="h-4 w-4 object-contain" /><span>{t.abbreviation}</span>{/each}
															<span class="text-red-400">to lose</span>
														</span>
														{#if isPending}<span class="standings-pulse rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-xs font-semibold text-[#c9a84c]">Update →</span>{/if}
													{:else if isPending}
														<span class="rounded border border-red-800 bg-red-950/60 px-2 py-0.5 text-xs text-red-400">⚠ Pick needed</span>
														<span class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-xs font-semibold text-[#c9a84c]">
															{pickView === 'standings' ? 'Standings →' : 'Submit pick →'}
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

						<!-- 2H section -->
						{#if shGroup.length > 0}
						{@const shTab   = groupTab[gi + 1000] ?? 'active'}
						{@const shActive = shGroup.filter((e: any) => e.status !== 'eliminated')}
						{@const shElim   = shGroup.filter((e: any) => e.status === 'eliminated')}
						<div>
							<!-- 2H header -->
							<div class="flex items-center justify-between gap-2 border-b border-blue-900/20 bg-blue-950/10 px-5 py-2">
								<div class="flex items-center gap-2">
									<span class="text-[10px] font-bold uppercase tracking-widest text-blue-500/60">Second Half Pool</span>
									<span class="rounded-full bg-blue-950/40 px-2 py-0.5 text-[10px] font-bold text-blue-400">{shGroup.length}</span>
									<span class="text-[10px] text-gray-600">· Pick the <span class="text-green-400 font-medium">WINNER</span></span>
								</div>
								<div class="flex gap-1">
									<button type="button" onclick={() => setGroupTab(gi + 1000, 'active')}
										class="px-3 py-1 text-[10px] font-semibold transition rounded
											{shTab === 'active' ? 'text-blue-400 bg-blue-950/30' : 'text-gray-600 hover:text-gray-400'}">
										Active ({shActive.length})
									</button>
									<button type="button" onclick={() => setGroupTab(gi + 1000, 'eliminated')}
										class="px-3 py-1 text-[10px] font-semibold transition rounded
											{shTab === 'eliminated' ? 'text-red-400 bg-red-950/30' : 'text-gray-600 hover:text-gray-400'}">
										Out ({shElim.length})
									</button>
								</div>
							</div>
							<div class="flex flex-col gap-2 px-5 pb-4 pt-3">
								{#each (shTab === 'active' ? shActive : shElim) as entry}
									{@const hasPick   = currentWeekSH ? !!pickByEntry[entry.id] : false}
									{@const pick      = pickByEntry[entry.id]}
									{@const isPending = currentWeekSH?.status === 'open'}
									<a href={pickLink(entry)}
										class="block rounded-lg border p-4 transition
											{entry.status === 'active' && currentWeekSH
												? hasPick ? 'border-green-900 bg-green-950/60 hover:border-green-700'
												: 'border-yellow-900 bg-yellow-950/20 hover:border-yellow-700'
												: 'border-gray-800 bg-gray-950/60 hover:border-gray-600'}">
										<div class="flex flex-wrap items-center justify-between gap-3">
											<div>
												<p class="font-semibold text-white">{entry.entryName}</p>
												{#if entry.status === 'eliminated' && entry.eliminatedWeek}
													<p class="mt-1 text-xs text-red-400">Out week {entry.eliminatedWeek}{entry.eliminatedReason ? ` — ${entry.eliminatedReason}` : ''}</p>
												{/if}
												{#if entry.status === 'pending_payment'}
													<p class="mt-1 text-xs text-yellow-500">Awaiting payment confirmation.</p>
												{/if}
											</div>
											<div class="flex flex-wrap items-center gap-2">
												{#if entry.paid}<span class="text-xs text-green-400">✅ Paid</span>{:else}<span class="text-xs text-gray-500">Payment pending</span>{/if}
												<span class="rounded border px-2 py-0.5 text-xs font-medium {statusColors[entry.status] ?? ''}">{entry.status.replace('_',' ')}</span>
												{#if entry.status === 'active'}
													<span class="text-xs text-gray-500">{NFL_TEAMS - (usedTeamCountByEntry[entry.id] ?? 0)} left</span>
												{/if}
												{#if entry.status === 'active' && currentWeekSH}
													{#if pick}
														{@const teams = pick.expand?.pickedTeams ?? []}
														<span class="flex items-center gap-1 rounded border px-2 py-0.5 text-xs
															{isPending ? 'border-yellow-800 bg-yellow-950/60 text-yellow-400' : 'border-gray-700 text-gray-400'}">
															{isPending ? 'Pending' : 'Locked'} —
															{#each teams as t}<img src={teamLogoUrl(t.abbreviation)} alt={t.abbreviation} class="h-4 w-4 object-contain" /><span>{t.abbreviation}</span>{/each}
															<span class="text-green-400">to win</span>
														</span>
														{#if isPending}<span class="standings-pulse rounded border border-blue-700 bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-400">Update →</span>{/if}
													{:else if isPending}
														<span class="rounded border border-red-800 bg-red-950/60 px-2 py-0.5 text-xs text-red-400">⚠ Pick needed</span>
														<span class="rounded border border-blue-700 bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-400">
															{pickView === 'standings' ? 'Standings →' : 'Submit pick →'}
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
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Quick links -->
<div class="border-t border-gray-800">
	<div class="grid gap-0 grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-800 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-gray-800 sm:[&>*:nth-child(odd)]:border-r-0">
		<a href="/dashboard/picks"
			class="p-5 transition hover:bg-white/[0.02]">
			<p class="font-semibold text-[#c9a84c]">Make a Pick</p>
			<p class="mt-1 text-sm text-gray-400">Submit or update your pick for the current week</p>
		</a>
		<a href="/dashboard/standings?season={selectedSeasonId}"
			class="p-5 transition hover:bg-white/[0.02]">
			<p class="font-semibold text-[#c9a84c]">Standings</p>
			<p class="mt-1 text-sm text-gray-400">See who is still alive in the pool</p>
		</a>
		<a href="/dashboard/odds"
			class="p-5 transition hover:bg-white/[0.02]">
			<p class="font-semibold text-[#c9a84c]">Latest Odds</p>
			<p class="mt-1 text-sm text-gray-400">Spreads and moneylines for the current week</p>
		</a>
		<a href="/dashboard/rules"
			class="p-5 transition hover:bg-white/[0.02]">
			<p class="font-semibold text-[#c9a84c]">Rules</p>
			<p class="mt-1 text-sm text-gray-400">How the pool works, tiebreakers, and payouts</p>
		</a>
	</div>
</div>

</div><!-- end single dashboard card -->
