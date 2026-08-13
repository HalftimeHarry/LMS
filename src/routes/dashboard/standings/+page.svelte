<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();


	const activeSeason    = $derived(data.activeSeason as any);
	const weeks           = $derived(data.weeks        as any[]);
	const entries         = $derived(data.entries      as any[]);
	const pickGrid        = $derived(data.pickGrid    as Record<string, Record<string, { teams: string[]; isAutoPick: boolean; isOwn: boolean }>>);
	const currentWeek     = $derived(data.currentWeek as any);
	const poolType        = $derived(data.poolType    as 'lms' | 'second_half');
	const userId          = $derived(data.userId      as string | null);
	const isLoggedIn      = $derived(!!userId);
	const poolAutoPickByWeek = $derived((data as any).poolAutoPickByWeek as Record<number, any> ?? {});
	// Server-computed — accurate for all viewers including guests
	const stillToPickCount = $derived((data as any).stillToPickCount as number ?? 0);
	const stillToPickList  = $derived((data as any).stillToPickList  as { id: string; entryName: string; userId: string }[] ?? []);

	const isLms = $derived(poolType === 'lms');

	// ── Week buckets ──────────────────────────────────────────────────────────
	const visibleWeeks = $derived(
		weeks.filter(w => w.status === 'locked' || w.status === 'results_pending' || w.status === 'complete')
	);
	const openWeeks = $derived(weeks.filter(w => w.status === 'open'));

	// ── Filters (client-side) ─────────────────────────────────────────────────
	let searchText   = $state('');
	let statusFilter = $state<'all' | 'active' | 'eliminated'>('active');

	const filteredEntries = $derived(() => {
		let list = [...entries] as any[];

		// Status filter
		if (statusFilter !== 'all') {
			list = list.filter(e => e.status === statusFilter);
		}

		// Search — match entry name or player display name
		const q = searchText.trim().toLowerCase();
		if (q) {
			list = list.filter(e =>
				e.entryName.toLowerCase().includes(q) ||
				(e.expand?.user?.displayName ?? '').toLowerCase().includes(q)
			);
		}

		// Sort: active first, then winners, then eliminated (by survival week desc)
		list.sort((a, b) => {
			if (a.status === 'active'   && b.status !== 'active')   return -1;
			if (b.status === 'active'   && a.status !== 'active')   return 1;
			if (a.status === 'winner'   && b.status !== 'winner')   return -1;
			if (b.status === 'winner'   && a.status !== 'winner')   return 1;
			if (a.eliminatedWeek && b.eliminatedWeek) return b.eliminatedWeek - a.eliminatedWeek;
			return a.entryName.localeCompare(b.entryName);
		});

		return list;
	});

	const activeCount = $derived(entries.filter((e: any) => e.status === 'active').length);

	// ── Countdown timer ───────────────────────────────────────────────────────
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(t);
	});

	// ── Live refresh — re-runs server load every 30s while a week is open ────
	// Keeps the "still to pick" list current as participants submit picks.
	$effect(() => {
		if (!currentWeekIsOpen) return;
		const t = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(t);
	});

	const timeLeft = $derived(() => {
		if (!currentWeek?.deadline) return null;
		const diff = new Date(currentWeek.deadline).getTime() - now;
		if (diff <= 0) return null;
		const h  = Math.floor(diff / 3_600_000);
		const m  = Math.floor((diff % 3_600_000) / 60_000);
		const s  = Math.floor((diff % 60_000) / 1_000);
		const urgent = diff < 3_600_000; // under 1 hour
		return {
			label: h > 0
				? `${h}h ${String(m).padStart(2,'0')}m`
				: `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`,
			urgent
		};
	});

	// ── Pool switcher ─────────────────────────────────────────────────────────
	function switchPool(type: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('pool', type);
		goto(`?${params.toString()}`, { replaceState: true });
	}


	// ── Style maps ────────────────────────────────────────────────────────────
	const statusColors: Record<string, string> = {
		active:    'text-green-400',
		eliminated:'text-red-400',
		winner:    'text-[#c9a84c]',
	};

	const weekStatusDot: Record<string, string> = {
		locked:          'bg-yellow-500',
		results_pending: 'bg-orange-500',
		complete:        'bg-gray-600',
		open:            'bg-blue-500',
	};

	// ── Current-week pick breakdown ───────────────────────────────────────────
	// Pre-deadline: pickGrid only contains the current user's own picks for open
	// weeks, so all counts/names derived here are safe to display.
	// Post-deadline: the week moves to visibleWeeks and pickGrid contains
	// everyone's picks — the same derived logic then shows the full breakdown.

	const activeEntries = $derived(
		(entries as any[]).filter((e: any) => e.status === 'active')
	);

	// Team breakdown for the current week — works for both open and locked weeks.
	// For open weeks this will only reflect the user's own picks (privacy safe).
	// For locked/complete weeks it reflects all picks.
	const currentWeekBreakdown = $derived((() => {
		if (!currentWeek) return [] as { abbr: string; count: number }[];
		const map: Record<string, number> = {};
		for (const weekMap of Object.values(pickGrid)) {
			const cell = weekMap[currentWeek.id];
			if (!cell) continue;
			for (const abbr of cell.teams) {
				map[abbr] = (map[abbr] ?? 0) + 1;
			}
		}
		return Object.entries(map)
			.map(([abbr, count]) => ({ abbr, count }))
			.sort((a, b) => b.count - a.count);
	})());

	// Whether the current week is still open (picks hidden from others)
	const currentWeekIsOpen = $derived(
		openWeeks.some(ow => ow.id === currentWeek?.id)
	);

	// How many active entries have picked — for open weeks this is unknowable
	// without leaking info, so we only show it post-deadline.
	const totalPicksThisWeek = $derived(
		currentWeekBreakdown.reduce((sum, t) => sum + t.count, 0)
	);

	// Own entries in the still-to-pick list — used for "Pick now →" links
	const myStillToPick = $derived(
		stillToPickList.filter(e => e.userId === userId)
	);

	let breakdownOpen    = $state(false);
	let expandedTeam     = $state<string | null>(null);
	let pendingListOpen  = $state(false);
</script>

<svelte:head><title>Standings — LMS Pool</title></svelte:head>

<!-- ── Single standings card ────────────────────────────────────────────────── -->
<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

<!-- ── Header ──────────────────────────────────────────────────────────────── -->
<div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 px-5 py-4">
	<div>
		<h1 class="text-2xl font-bold text-white">Standings</h1>
		{#if activeSeason}
			<p class="mt-1 text-sm text-gray-500">
				{activeSeason.name}{#if currentWeek} · Week {currentWeek.week}{/if}
			</p>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<!-- Pool toggle -->
		<div class="flex items-center gap-2">
			<div class="group relative rounded border border-gray-700 bg-gray-900/80 px-2 py-1">
				<button
					type="button"
					onclick={() => switchPool('lms')}
					class="px-2 py-1 text-sm font-medium transition
						{poolType === 'lms' ? 'standings-pulse bg-[#c9a84c] text-black border-2 border-[#ffe082] shadow-[0_0_18px_rgba(255,214,94,0.9),0_0_36px_rgba(201,168,76,0.6)]' : 'bg-gray-900 text-gray-400 hover:text-white'}">
					LMS
				</button>
				<span class="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-[#f5d77a] opacity-0 shadow-[0_8px_30px_rgba(15,23,42,0.55)] backdrop-blur-md transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100">
					View Last Man Standing standings
					<span class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white/10"></span>
				</span>
			</div>
			<div class="group relative rounded border border-gray-700 bg-gray-900/80 px-2 py-1">
				<button
					type="button"
					onclick={() => switchPool('second_half')}
					class="border-l border-gray-700 px-2 py-1 text-sm font-medium transition
						{poolType === 'second_half' ? 'standings-pulse bg-blue-600 text-white border-2 border-blue-200 shadow-[0_0_18px_rgba(147,197,253,0.9),0_0_36px_rgba(37,99,235,0.7)]' : 'bg-gray-900 text-gray-400 hover:text-white'}">
					2nd Half
				</button>
				<span class="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-blue-200 opacity-0 shadow-[0_8px_30px_rgba(15,23,42,0.55)] backdrop-blur-md transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100">
					View Second Half standings
					<span class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white/10"></span>
				</span>
			</div>
		</div>
	</div>
</div>

{#if !activeSeason}
	<div class="p-12 text-center">
		<p class="text-gray-400">No active season yet. Check back soon.</p>
	</div>

{:else if entries.length === 0}
	<div class="p-12 text-center">
		<p class="text-gray-400">No {isLms ? 'LMS' : 'Second Half'} entries yet.</p>
	</div>

{:else}


	<!-- ── Guest banner ─────────────────────────────────────────────────────── -->
	{#if !isLoggedIn}
		<div class="guest-pulse flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(201,168,76,0.15)] px-5 py-3">
			<p class="text-sm text-gray-400">
				<span class="text-[#c9a84c] font-medium">Viewing as guest.</span>
				Sign in to see your picks, submit picks for open weeks, and track your entries.
			</p>
			<div class="flex gap-2">
				<a href="/login"
					class="rounded border border-[#c9a84c] bg-black/80 px-4 py-1.5 text-sm font-semibold text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black">
					Sign In
				</a>
				<a href="/register"
					class="rounded bg-[#c9a84c] px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-[#e8c96a]">
					Register
				</a>
			</div>
		</div>
	{/if}

	<!-- ── Summary bar ──────────────────────────────────────────────────────── -->
	<div class="flex flex-wrap items-center gap-6 border-b border-gray-800 px-5 py-3">
		<div class="text-center">
			<p class="text-xl font-bold text-white">{activeCount}</p>
			<p class="text-xs text-gray-500">Still alive</p>
		</div>
		<div class="text-center">
			<p class="text-xl font-bold text-gray-400">{entries.length}</p>
			<p class="text-xs text-gray-500">Total entries</p>
		</div>
		<div class="text-center">
			<p class="text-xl font-bold text-[#c9a84c]">{visibleWeeks.length}</p>
			<p class="text-xs text-gray-500">Weeks past deadline</p>
		</div>
		{#if openWeeks.length > 0}
			{@const ow       = openWeeks[0]}
			{@const autoPick = poolType === 'lms' ? (ow.expand?.biggestFavoriteTeam ?? poolAutoPickByWeek[ow.week]) : poolAutoPickByWeek[ow.week]}
			<div class="ml-auto flex flex-wrap items-center gap-3 rounded-lg border border-blue-900 bg-blue-950/30 px-3 py-2">
				<div class="flex items-center gap-2 text-sm text-blue-400">
					<span class="h-2 w-2 shrink-0 rounded-full bg-blue-500 animate-pulse"></span>
					<span>Week {ow.week} open — picks hidden until deadline</span>
				</div>
				{#if autoPick}
					<div class="flex items-center gap-1.5 border-l border-blue-900 pl-3 text-xs text-gray-400">
						<span class="text-gray-500">Auto-pick:</span>
						<img
							src={teamLogoUrl(autoPick.abbreviation)}
							alt="{autoPick.city} {autoPick.name}"
							class="h-5 w-5 object-contain"
						/>
						<span class="text-gray-300">{autoPick.city} {autoPick.name}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>



	<!-- ── Auto-pick pending list (collapsible) ────────────────────────────── -->
	<!-- Only shown while the week is open. Entries here haven't picked yet     -->
	<!-- and will receive the auto-pick if they miss the deadline.              -->
	{#if currentWeekIsOpen && stillToPickCount > 0}
		{@const autoPick = poolType === 'lms' ? (currentWeek?.expand?.biggestFavoriteTeam ?? poolAutoPickByWeek[currentWeek?.week]) : poolAutoPickByWeek[currentWeek?.week]}
		<div class="border-b border-orange-900/30 bg-orange-950/10 overflow-hidden">

			<!-- Toggle header -->
			<button
				type="button"
				onclick={() => pendingListOpen = !pendingListOpen}
				class="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-orange-950/20"
			>
				<div class="flex items-center gap-2 min-w-0">
					<span class="h-2 w-2 rounded-full bg-orange-500 animate-pulse shrink-0"></span>
					<p class="text-sm font-semibold text-orange-400">
						{stillToPickCount} {stillToPickCount === 1 ? 'entry' : 'entries'} still to pick — Week {currentWeek.week}
					</p>
					<p class="hidden sm:block text-xs text-gray-500">· If they don't pick, they'll be assigned the auto-pick.</p>
				</div>
				<div class="flex items-center gap-3 shrink-0">
					{#if autoPick}
						<div class="flex items-center gap-1.5 text-xs text-gray-500">
							<span>Auto-pick:</span>
							<img src={teamLogoUrl(autoPick.abbreviation)} alt={autoPick.abbreviation} class="h-5 w-5 object-contain" />
							<span class="text-gray-400">{autoPick.abbreviation}</span>
						</div>
					{/if}
					<svg
						class="h-3.5 w-3.5 text-gray-600 transition-transform {pendingListOpen ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
					</svg>
				</div>
			</button>

			<!-- Collapsible entry list -->
			{#if pendingListOpen}
				<div class="border-t border-orange-900/20 divide-y divide-orange-900/20">
					{#each stillToPickList as entry}
						{@const isMe = entry.userId === userId}
						<div class="flex items-center gap-3 px-5 py-2.5 {isMe ? 'bg-yellow-950/20' : ''}">
							<div class="min-w-0 flex-1">
								<p class="text-sm {isMe ? 'font-semibold text-yellow-400' : 'text-gray-300'}">
									{entry.entryName}
									{#if isMe}<span class="ml-1 text-[10px] font-normal opacity-60">you</span>{/if}
								</p>
							</div>
							{#if isMe}
								<a href="/dashboard/entries/{entry.id}"
									class="shrink-0 rounded border border-yellow-700/50 bg-yellow-950/40 px-2.5 py-1 text-xs font-medium text-yellow-400 transition hover:bg-yellow-900/50">
									Pick now →
								</a>
							{:else if autoPick}
								<div class="flex items-center gap-1 shrink-0">
									<img src={teamLogoUrl(autoPick.abbreviation)} alt={autoPick.abbreviation} class="h-4 w-4 object-contain opacity-50" />
									<span class="text-xs text-gray-600">{autoPick.abbreviation} auto</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

		</div>
	{/if}

	<!-- ── Deadline countdown + current-week pick breakdown ────────────────── -->
	{#if currentWeek?.deadline}
		{@const tl = timeLeft()}
		<div class="border-b {tl?.urgent ? 'border-red-900' : 'border-gray-800'} overflow-hidden">

			<!-- Deadline row -->
			<div class="flex items-center gap-3 px-4 py-2.5">
				<span class="text-xs text-gray-500">
					Wk {currentWeek.week} pick deadline:
					<span class="text-white">
						{new Date(currentWeek.deadline).toLocaleString('en-US', {
							weekday: 'short', month: 'short', day: 'numeric',
							hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
						})}
					</span>
				</span>
				{#if tl}
					<span class="ml-auto font-mono text-sm font-bold {tl.urgent ? 'text-red-400' : 'text-[#c9a84c]'}">
						{tl.label}
					</span>
				{:else}
					<span class="ml-auto text-xs text-gray-600">Deadline passed</span>
				{/if}
			</div>

			<!-- Collapsible breakdown toggle -->
			{#if currentWeekBreakdown.length > 0 || myStillToPick.length > 0}
				<button
					type="button"
					onclick={() => { breakdownOpen = !breakdownOpen; expandedTeam = null; }}
					class="flex w-full items-center justify-between border-t border-gray-800/60 px-4 py-2.5 text-left transition hover:bg-white/[0.02]"
				>
					<span class="flex items-center gap-2 text-xs font-medium text-gray-400">
						<span class="h-1.5 w-1.5 rounded-full bg-blue-500 {currentWeekIsOpen ? 'animate-pulse' : ''}"></span>
						{#if currentWeekIsOpen}
							View my Week {currentWeek.week} picks
							{#if stillToPickCount > 0}
								· <span class="text-yellow-600">{stillToPickCount} still to pick</span>
							{:else}
								· <span class="text-green-600">all picks in</span>
							{/if}
						{:else}
							View my Week {currentWeek.week} picks — {totalPicksThisWeek} of {activeEntries.length} submitted
						{/if}
					</span>
					<svg
						class="h-3.5 w-3.5 text-gray-600 transition-transform {breakdownOpen ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
					</svg>
				</button>

				{#if breakdownOpen}
					<div class="border-t border-gray-800/60 px-4 pb-4 pt-3">

						{#if currentWeekIsOpen}
							<!-- ── Pre-deadline ───────────────────────────────────────── -->

							<!-- Own pick (if submitted) -->
							{#if currentWeekBreakdown.length > 0}
								<p class="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-600">Your pick{currentWeekBreakdown.length !== 1 ? 's' : ''} this week</p>
								<div class="mb-4 space-y-1">
									{#each currentWeekBreakdown as { abbr }}
										<div class="flex items-center gap-3 rounded-lg bg-[rgba(201,168,76,0.08)] px-3 py-2">
											<img src={teamLogoUrl(abbr)} alt={abbr}
												class="h-7 w-7 shrink-0 rounded-full bg-white p-0.5 object-contain" />
											<span class="text-sm font-medium text-[#c9a84c]">{abbr}</span>
											<span class="ml-auto rounded bg-[rgba(201,168,76,0.15)] px-1.5 py-0.5 text-[10px] font-semibold text-[#c9a84c]">your pick</span>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Still to pick — show own entries with action links -->
							{@const autoPick = poolType === 'lms' ? (currentWeek.expand?.biggestFavoriteTeam ?? poolAutoPickByWeek[currentWeek.week]) : poolAutoPickByWeek[currentWeek.week]}
							{#if stillToPickCount > 0}
								{#if myStillToPick.length > 0}
									<div class="mb-3 space-y-1">
										{#each myStillToPick as entry}
											<div class="flex items-center gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-3 py-2.5">
												<div class="min-w-0 flex-1">
													<p class="text-sm font-medium text-yellow-400">
														{entry.entryName}
														<span class="ml-1 text-[10px] opacity-60">you</span>
													</p>
												</div>
												<a href="/dashboard/entries/{entry.id}"
													class="shrink-0 rounded border border-yellow-700/50 bg-yellow-950/40 px-2.5 py-1 text-xs font-medium text-yellow-400 hover:bg-yellow-900/50 transition">
													Pick now →
												</a>
											</div>
										{/each}
									</div>
								{/if}
								<p class="text-xs text-gray-600">
									{stillToPickCount} {stillToPickCount === 1 ? 'entry' : 'entries'} still to pick.
									{#if autoPick}
										Will be auto-assigned <span class="text-gray-400">{autoPick.city} {autoPick.name}</span>.
									{/if}
								</p>
							{:else}
								<p class="text-xs text-green-600">All active entries have picked this week.</p>
							{/if}

							<p class="mt-3 text-[11px] text-gray-700">Picks are hidden until the deadline.</p>

						{:else}
							<!-- ── Post-deadline: full breakdown ─────────────────────── -->
							<div class="max-h-80 overflow-y-auto space-y-1 pr-1">
								{#each currentWeekBreakdown as { abbr, count }}
									{@const pct = totalPicksThisWeek > 0 ? Math.round((count / totalPicksThisWeek) * 100) : 0}
									{@const isMyPick = Object.values(pickGrid).some(wm => wm[currentWeek.id]?.isOwn && wm[currentWeek.id]?.teams.includes(abbr))}
									<button
										type="button"
										onclick={() => expandedTeam = expandedTeam === abbr ? null : abbr}
										class="group flex w-full items-center gap-3 rounded-lg px-3 py-2 transition
											{isMyPick ? 'bg-[rgba(201,168,76,0.08)] hover:bg-[rgba(201,168,76,0.12)]' : 'hover:bg-white/[0.03]'}"
									>
										<img src={teamLogoUrl(abbr)} alt={abbr}
											class="h-7 w-7 shrink-0 rounded-full bg-white p-0.5 object-contain" />
										<div class="flex min-w-0 flex-1 flex-col gap-1">
											<div class="flex items-center gap-2">
												<span class="text-sm font-medium {isMyPick ? 'text-[#c9a84c]' : 'text-gray-200'}">{abbr}</span>
												{#if isMyPick}
													<span class="rounded bg-[rgba(201,168,76,0.15)] px-1.5 py-0.5 text-[10px] font-semibold text-[#c9a84c]">your pick</span>
												{/if}
											</div>
											<div class="h-1 w-full overflow-hidden rounded-full bg-gray-800">
												<div class="h-full rounded-full transition-all {isMyPick ? 'bg-[#c9a84c]' : 'bg-blue-600'}"
													style="width: {pct}%"></div>
											</div>
										</div>
										<div class="shrink-0 text-right">
											<span class="font-mono text-sm font-bold {isMyPick ? 'text-[#c9a84c]' : 'text-white'}">{count}</span>
											<span class="ml-1 text-xs text-gray-600">{pct}%</span>
										</div>
										<svg class="h-3 w-3 shrink-0 text-gray-700 transition-transform group-hover:text-gray-500 {expandedTeam === abbr ? 'rotate-180' : ''}"
											fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
										</svg>
									</button>

									{#if expandedTeam === abbr}
										<div class="mx-3 mb-1 rounded-b-lg border border-t-0 border-gray-800 bg-gray-950/60 px-3 py-2">
											<p class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">Entries picking {abbr}</p>
											<div class="flex flex-wrap gap-1.5">
												{#each (entries as any[]).filter(e => pickGrid[e.id]?.[currentWeek.id]?.teams.includes(abbr)) as entry}
													<span class="rounded border px-2 py-0.5 text-xs
														{entry.user === userId ? 'border-[#c9a84c]/30 text-[#c9a84c]' : 'border-gray-800 text-gray-400'}">
														{entry.entryName}{#if entry.user === userId}<span class="opacity-60"> you</span>{/if}
													</span>
												{/each}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}

					</div>
				{/if}
			{/if}

		</div>
	{/if}

	{#if visibleWeeks.length === 0 && openWeeks.length === 0}
		<!-- Season not started -->
		<div class="p-10 text-center">
			<p class="text-gray-400">No weeks set up yet. Check back when the season starts.</p>
		</div>

	{:else}
		<!-- ── Pick grid ─────────────────────────────────────────────────────── -->

			<!-- Filters -->
			<div class="flex flex-wrap items-center gap-3 border-b border-gray-800 px-4 py-3">
				<!-- Search -->
				<div class="relative">
					<svg class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					<input
						type="text"
						placeholder="Search entry or player…"
						bind:value={searchText}
						class="rounded border border-gray-700 bg-gray-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none w-52"
					/>
				</div>

				<!-- Status filter -->
				<div class="flex overflow-hidden rounded border border-gray-700 text-xs font-medium">
					{#each [['all', 'All'], ['active', 'Active'], ['eliminated', 'Eliminated']] as [val, label]}
						<button
							type="button"
							onclick={() => statusFilter = val as any}
							class="px-3 py-1.5 transition
								{statusFilter === val
									? val === 'active' ? 'bg-green-900 text-green-300'
									: val === 'eliminated' ? 'bg-red-950 text-red-400'
									: 'bg-gray-700 text-white'
									: 'bg-gray-900 text-gray-500 hover:text-gray-300'}
								{val !== 'all' ? 'border-l border-gray-700' : ''}"
						>
							{label}
							{#if val === 'active'}
								<span class="ml-1 opacity-60">{activeCount}</span>
							{:else if val === 'eliminated'}
								<span class="ml-1 opacity-60">{entries.filter((e: any) => e.status === 'eliminated').length}</span>
							{:else}
								<span class="ml-1 opacity-60">{entries.length}</span>
							{/if}
						</button>
					{/each}
				</div>

				{#if searchText || statusFilter !== 'all'}
					<button
						type="button"
						onclick={() => { searchText = ''; statusFilter = 'active'; }}
						class="text-xs text-gray-600 hover:text-gray-400"
					>
						Clear filters
					</button>
				{/if}

				<span class="ml-auto text-xs text-gray-600">
					{filteredEntries().length} of {entries.length} shown
				</span>
			</div>

			<!-- Scrollable table -->
			<div class="overflow-x-auto overflow-y-auto max-h-[32rem]">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="sticky top-0 z-20 border-b border-gray-800 text-xs font-medium uppercase tracking-wider text-gray-500 bg-[#0a0a0a]">
						<!-- Sticky entry column -->
						<th class="sticky left-0 z-10 bg-[#0a0a0a] px-4 py-3 text-left w-44">Entry</th>

						<!-- Past-deadline weeks — picks visible to all -->
						{#each visibleWeeks as week}
							<th class="px-3 py-3 text-center whitespace-nowrap">
								<div class="flex flex-col items-center gap-1">
									<span>Wk {week.week}</span>
									<span class="h-1.5 w-1.5 rounded-full {weekStatusDot[week.status] ?? 'bg-gray-700'}"></span>
								</div>
							</th>
						{/each}

						<!-- Open weeks — picks hidden (own pick shown with eye icon) -->
						{#each openWeeks as week}
							<th class="px-3 py-3 text-center whitespace-nowrap">
								<div class="flex flex-col items-center gap-1 text-blue-500/50">
									<span>Wk {week.week}</span>
									<span class="h-1.5 w-1.5 rounded-full bg-blue-500/40"></span>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each filteredEntries() as entry}
						{@const isElim    = entry.status === 'eliminated'}
						{@const isMe      = entry.user === userId}
						{@const needsPick = isMe && entry.status === 'active' && openWeeks.some(ow => !pickGrid[entry.id]?.[ow.id])}
						<tr class="border-b border-gray-800/40 transition hover:bg-white/[0.02]
							{isElim ? 'opacity-50' : ''}
							{isMe   ? 'bg-[rgba(201,168,76,0.03)]' : ''}">

							<!-- Entry name (sticky) -->
							<td class="sticky left-0 z-10 bg-[#0a0a0a] px-4 py-2.5
								{isMe ? 'border-l-2 border-[#c9a84c]/40' : ''}">
								<div class="flex items-center gap-2">
									<div>
										<p class="font-medium leading-tight {isMe ? 'text-[#c9a84c]' : 'text-white'}">
											{entry.entryName}
											{#if isMe}<span class="ml-1 text-[10px] text-[#c9a84c]/60">you</span>{/if}
										</p>
										<p class="text-xs text-gray-500">
											{entry.expand?.user?.displayName ?? ''}
											<span class="ml-2 {statusColors[entry.status] ?? 'text-gray-400'}">
												{entry.status === 'active'
													? 'Active'
													: entry.status === 'winner'
														? 'Winner'
														: `Out Wk ${entry.eliminatedWeek ?? '?'}`}
											</span>
										</p>
									</div>
									{#if needsPick}
										<a href="/dashboard/entries/{entry.id}"
											class="ml-1 shrink-0 rounded border border-yellow-700 bg-yellow-950/50 px-2 py-0.5 text-[10px] font-semibold text-yellow-400 transition hover:bg-yellow-900/60 whitespace-nowrap">
											⚠ Pick →
										</a>
									{/if}
								</div>
							</td>

							<!-- Past-deadline pick cells (visible to everyone) -->
							{#each visibleWeeks as week}
								{@const cell = pickGrid[entry.id]?.[week.id]}
								<td class="px-2 py-2 text-center align-middle">
									{#if cell}
										<div class="flex flex-col items-center gap-0.5">
											{#each cell.teams as abbr}
												<img
													src={teamLogoUrl(abbr)}
													alt={abbr}
													title="{abbr}{cell.isAutoPick ? ' (auto-pick)' : ''}"
													class="h-6 w-6 rounded-full bg-white p-0.5 object-contain {cell.isAutoPick ? 'opacity-40 grayscale' : ''}"
												/>
												<span class="text-[9px] leading-none {cell.isAutoPick ? 'text-gray-600' : 'text-gray-400'}">{abbr}</span>
											{/each}
	
										</div>
									{:else if isElim && entry.eliminatedWeek && week.week >= entry.eliminatedWeek}
										<span class="text-gray-700 text-xs">—</span>
									{:else}
										<!-- Missed pick — show pending auto-pick team faded -->
										{@const autoPick = week.expand?.biggestFavoriteTeam}
										{#if autoPick}
											<div class="flex flex-col items-center gap-0.5" title="Auto-pick pending: {autoPick.abbreviation}">
												<img src={teamLogoUrl(autoPick.abbreviation)} alt={autoPick.abbreviation}
													class="h-6 w-6 rounded-full bg-white p-0.5 object-contain opacity-20" />
												<span class="text-[9px] leading-none text-orange-700">?</span>
											</div>
										{:else}
											<span class="text-[10px] text-red-900">✗</span>
										{/if}
									{/if}
								</td>
							{/each}

							<!-- Open week cells -->
							{#each openWeeks as week}
								{@const cell = pickGrid[entry.id]?.[week.id]}
								<td class="px-2 py-2 text-center align-middle">
									{#if isMe && cell}
										<!-- Own pick — click to change -->
										<a href="/dashboard/entries/{entry.id}"
											title="Change pick"
											class="group flex flex-col items-center gap-0.5 hover:opacity-80 transition">
											{#each cell.teams as abbr}
												<img
													src={teamLogoUrl(abbr)}
													alt={abbr}
													class="h-6 w-6 rounded-full bg-white p-0.5 object-contain"
												/>
												<span class="text-[9px] leading-none text-gray-400">{abbr}</span>
											{/each}
											<span class="text-[9px] leading-none text-[#c9a84c]/70 group-hover:text-[#c9a84c] transition">change</span>
										</a>
									{:else if isMe && !cell}
										<!-- Own entry, no pick yet -->
										<a href="/dashboard/entries/{entry.id}"
											class="text-[10px] text-yellow-600 hover:text-yellow-400 underline underline-offset-2">
											Pick
										</a>
									{:else if !isLoggedIn}
										<!-- Guest — prompt to sign in -->
										<a href="/login" class="text-[10px] text-gray-700 hover:text-gray-500">
											🔒
										</a>
									{:else}
										<!-- Other entries — hidden until deadline -->
										<span class="text-gray-800 text-xs select-none">🔒</span>
									{/if}
								</td>
							{/each}

						</tr>
					{/each}

					{#if filteredEntries().length === 0}
						<tr>
							<td colspan={1 + visibleWeeks.length + openWeeks.length}
								class="px-4 py-8 text-center text-sm text-gray-600">
								No entries match your filters.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
			</div><!-- end scrollable table -->


		<!-- ── Legend ────────────────────────────────────────────────────────── -->
		<div class="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-gray-800/60 px-4 py-3 text-xs text-gray-600">
			<span class="flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>Locked
			</span>
			<span class="flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full bg-orange-500"></span>Results pending
			</span>
			<span class="flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full bg-gray-600"></span>Complete
			</span>
			<span class="flex items-center gap-1.5">
				<img src={teamLogoUrl('DAL')} alt="" class="h-3.5 w-3.5 rounded-full bg-white p-px opacity-20 grayscale" />
				Auto-pick pending
			</span>
			<span class="flex items-center gap-1.5">
				<span class="text-[#c9a84c]/60 text-[10px]">you</span>
				Your entry / pick
			</span>
			<span class="flex items-center gap-1.5">
				<span class="text-gray-800">🔒</span>
				Hidden until deadline
			</span>
		</div>
	{/if}

{/if}

</div><!-- end single standings card -->



