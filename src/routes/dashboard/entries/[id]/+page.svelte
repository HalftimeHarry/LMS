<script lang="ts">
	import { enhance } from '$app/forms';
	import { teamLogoUrl } from '$lib/teamLogos';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const entry                  = $derived(data.entry                  as any);
	const season                 = $derived(data.season                 as any);
	const openWeeks              = $derived(data.openWeeks              as any[]);
	const closedWeeks            = $derived(data.closedWeeks            as any[]);
	const teams                  = $derived(data.teams                  as any[]);
	const pickByWeek             = $derived(data.pickByWeek             as Record<string, any>);
	const usedByWeek             = $derived(data.usedByWeek             as Record<string, string[]>);
	const picksRequiredByWeek    = $derived(data.picksRequiredByWeek    as Record<string, number>);
	const oddsByWeek             = $derived((data as any).oddsByWeek             as Record<string, any[]>);
	const teamSpreadByWeek       = $derived((data as any).teamSpreadByWeek       as Record<string, Record<string, number>>);
	const recommendationsByWeek  = $derived((data as any).recommendationsByWeek  as Record<string, any[]>);

	const isLms = $derived(entry?.entryType === 'lms');

	// Pick saved toast
	let showToast = $state(false);
	$effect(() => {
		if ($page.url.searchParams.get('pickSaved') === '1') {
			showToast = true;
			const t = setTimeout(() => { showToast = false; }, 3500);
			return () => clearTimeout(t);
		}
	});

	function spreadDisplay(spread: number): string {
		if (spread === 0) return 'PK';
		return spread > 0 ? `+${spread}` : String(spread);
	}

	function moneylineDisplay(ml: number | null): string {
		if (ml == null) return '';
		return ml > 0 ? `+${ml}` : String(ml);
	}

	// ── Countdown timer ───────────────────────────────────────────────────────
	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(id);
	});

	function timeUntil(deadline: string): { d: number; h: number; m: number; s: number; expired: boolean; urgent: boolean } {
		const diff = new Date(deadline).getTime() - now;
		if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true, urgent: false };
		const d = Math.floor(diff / 86_400_000);
		const h = Math.floor((diff % 86_400_000) / 3_600_000);
		const m = Math.floor((diff % 3_600_000)  /    60_000);
		const s = Math.floor((diff % 60_000)      /     1_000);
		return { d, h, m, s, expired: false, urgent: diff < 3_600_000 }; // urgent = < 1 hour
	}

	// All weeks collapsed by default
	let expandedWeeks  = $state<Set<string>>(new Set());
	let loadingWeek    = $state<string | null>(null);
	let scrollEl       = $state<HTMLElement | null>(null);
	let showScrollTop  = $state(false);

	function onScroll() {
		showScrollTop = (scrollEl?.scrollTop ?? 0) > 120;
	}

	function scrollToTop() {
		scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function toggleWeek(weekId: string) {
		const next = new Set(expandedWeeks);
		if (next.has(weekId)) next.delete(weekId);
		else next.add(weekId);
		expandedWeeks = next;
	}

	// Per-week selected team state — keyed by weekId
	let selections = $state<Record<string, string[]>>({});

	$effect(() => {
		const next: Record<string, string[]> = {};
		for (const week of openWeeks) {
			const pick = pickByWeek[week.id];
			next[week.id] = pick?.expand?.pickedTeams?.map((t: any) => t.id) ?? [];
		}
		selections = next;
	});

	function toggleTeam(weekId: string, teamId: string) {
		const cur      = selections[weekId] ?? [];
		const required = picksRequiredByWeek[weekId] ?? 1;
		if (cur.includes(teamId)) {
			selections = { ...selections, [weekId]: cur.filter((t) => t !== teamId) };
		} else if (required === 1) {
			selections = { ...selections, [weekId]: [teamId] };
		} else if (cur.length < required) {
			selections = { ...selections, [weekId]: [...cur, teamId] };
		}
	}

	const conferences = ['AFC', 'NFC'];
	const divisions   = ['East', 'North', 'South', 'West'];

	type Team = { id: string; abbreviation: string; name: string; city: string; conference: string; division: string };

	const grouped = $derived(() => {
		const map: Record<string, Record<string, Team[]>> = {};
		for (const t of teams as Team[]) {
			if (!map[t.conference]) map[t.conference] = {};
			if (!map[t.conference][t.division]) map[t.conference][t.division] = [];
			map[t.conference][t.division].push(t);
		}
		return map;
	});

	const statusColors: Record<string, string> = {
		pending_payment: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		active:          'bg-green-950/60 text-green-400 border-green-800',
		eliminated:      'bg-red-950/60 text-red-400 border-red-800',
		winner:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	const weekStatusColors: Record<string, string> = {
		locked:          'border-yellow-800 text-yellow-500',
		results_pending: 'border-orange-800 text-orange-400',
		complete:        'border-gray-700 text-gray-500',
	};

	function formatDeadline(d: string) {
		return new Date(d).toLocaleString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}

	// All weeks combined for display — open first, then closed sorted by week number
	const allDisplayWeeks = $derived([
		...openWeeks,
		...closedWeeks
	]);

	const totalPicked = $derived(Object.keys(pickByWeek).length);
	const totalWeeks  = $derived(allDisplayWeeks.length);
</script>

<svelte:head><title>{entry?.entryName ?? 'Entry'} — LMS Pool</title></svelte:head>

<!-- Pick saved toast -->
{#if showToast}
	<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2
		animate-[toast-in_0.35s_ease-out_forwards]"
		style="animation: toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards, toast-out 0.4s ease-in 3.1s forwards;">
		<div class="flex items-center gap-3 rounded-xl border border-green-700 bg-green-950/95 px-5 py-3 shadow-2xl backdrop-blur-sm">
			<span class="text-lg">✅</span>
			<span class="text-sm font-semibold text-green-300">Pick saved!</span>
		</div>
	</div>
{/if}

<style>
	@keyframes toast-in {
		from { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.92); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
	}
	@keyframes toast-out {
		from { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
		to   { opacity: 0; transform: translateX(-50%) translateY(8px)   scale(0.95); }
	}
</style>

<div class="mx-auto max-w-2xl">

	{#if allDisplayWeeks.length === 0}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-10 text-center backdrop-blur-sm">
			<p class="text-gray-400">No weeks set up yet. Check back soon.</p>
		</div>
	{:else}

	<!-- ── Single card wrapping everything ───────────────────────────────────── -->
	<div class="relative rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">

		<!-- Back nav -->
		<div class="border-b border-gray-800/60 px-6 py-3">
			{#if $page.url.searchParams.get('pickSaved') === '1'}
				<a href="/dashboard"
					class="inline-flex items-center gap-2 rounded-lg border border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] px-3 py-1.5 text-sm font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.2)]">
					← Back to Dashboard
				</a>
			{:else}
				<a href="/dashboard" class="text-sm text-gray-500 hover:text-[#c9a84c]">← Dashboard</a>
			{/if}
		</div>

		<!-- Scroll container -->
		<div
			bind:this={scrollEl}
			onscroll={onScroll}
			class="max-h-[80vh] overflow-y-auto scroll-smooth"
		>

		<!-- Entry header -->
		<div class="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
			<div>
				<h1 class="text-2xl font-bold text-white">{entry?.entryName}</h1>
				<p class="mt-1 text-sm text-gray-400">{season?.name ?? '—'}</p>
				{#if entry?.status === 'eliminated' && entry?.eliminatedWeek}
					<p class="mt-2 text-sm text-red-400">
						Eliminated week {entry.eliminatedWeek}
						{#if entry.eliminatedReason} — {entry.eliminatedReason}{/if}
					</p>
				{/if}
			</div>
			<div class="flex flex-col items-end gap-2">
				<span class="rounded border px-3 py-1 text-sm font-medium {statusColors[entry?.status] ?? ''}">
					{entry?.status?.replace('_', ' ')}
				</span>
				{#if entry?.paid}
					<span class="text-xs text-green-400">✅ Paid</span>
				{:else}
					<span class="text-xs text-gray-500">Payment pending</span>
				{/if}
			</div>
		</div>

		<!-- Past picks / Teams Used -->
		{#if closedWeeks.some(w => pickByWeek[w.id])}
			<div class="border-t border-gray-800 px-6 py-4">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Teams Used</h2>
				<div class="flex flex-wrap gap-2">
					{#each closedWeeks.filter(w => pickByWeek[w.id]) as w}
						{@const p = pickByWeek[w.id]}
						{#each (p?.expand?.pickedTeams ?? []) as team}
							<div class="flex items-center gap-2 rounded-lg border border-gray-800 bg-black/60 px-3 py-2">
								<img
									src={teamLogoUrl(team.abbreviation)}
									alt={team.abbreviation}
									class="h-7 w-7 rounded-full bg-white p-0.5 object-contain {p.isAutoPick ? 'opacity-60 grayscale' : ''}"
								/>
								<div>
									<p class="text-xs font-semibold text-white">{team.abbreviation}</p>
									<p class="text-[10px] text-gray-500">Wk {w.week}{p.isAutoPick ? ' · auto' : ''}</p>
								</div>
							</div>
						{/each}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Current week banner + pick count -->
		<div class="border-t border-gray-800 px-6 py-4">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-lg font-bold text-white">
					{isLms ? 'Pick the Loser' : 'Pick the Winner'}
				</h2>
				<span class="text-sm font-semibold text-[#c9a84c]">
					{totalPicked} / {totalWeeks} picked
				</span>
			</div>

			{#each [openWeeks[0]] as currentWeek}
				{#if currentWeek}
					{@const currentPick    = pickByWeek[currentWeek.id]}
					{@const pickedTeams    = currentPick?.expand?.pickedTeams ?? []}
					{@const isAutoPick     = currentPick?.isAutoPick === true}
					{@const autoPick       = currentWeek.expand?.biggestFavoriteTeam}
					{@const hasPick        = !!currentPick}

					<div class="mt-4 flex items-center gap-4 rounded-lg border px-4 py-3
						{hasPick
							? 'border-green-800 bg-green-950/20'
							: 'border-yellow-900 bg-yellow-950/20'}">

						<!-- Status icon -->
						<div class="shrink-0 text-xl">
							{hasPick ? '✅' : '⚠️'}
						</div>

						<div class="min-w-0 flex-1">
							<p class="text-xs font-semibold uppercase tracking-wider
								{hasPick ? 'text-green-400' : 'text-yellow-500'}">
								Week {currentWeek.week}
								{hasPick ? '— Pick submitted' : '— No pick yet'}
							</p>

							{#if hasPick}
								<!-- Show the submitted pick -->
								<div class="mt-1.5 flex flex-wrap items-center gap-2">
									{#each pickedTeams as team}
										<div class="flex items-center gap-1.5">
											<img src={teamLogoUrl(team.abbreviation)} alt={team.abbreviation} class="h-6 w-6 object-contain" />
											<span class="text-sm font-medium text-white">{team.city} {team.name}</span>
											{#each [teamSpreadByWeek?.[currentWeek.id]?.[team.id]] as sp}
												{#if sp != null}
													<span class="text-xs text-gray-500">({spreadDisplay(sp)})</span>
												{/if}
											{/each}
										</div>
									{/each}
									<span class="rounded border px-1.5 py-0.5 text-[10px] font-medium
										{isAutoPick
											? 'border-orange-800 text-orange-400'
											: isLms
												? 'border-red-800 text-red-400'
												: 'border-green-800 text-green-400'}">
										{isAutoPick ? 'Auto-pick' : isLms ? 'To lose' : 'To win'}
									</span>
								</div>
								<p class="mt-1 text-xs text-gray-600">
									Deadline: {formatDeadline(currentWeek.deadline)}
									· You can update your pick until then.
								</p>
							{:else}
								<!-- No pick — show auto-pick warning -->
								<div class="mt-1 flex flex-wrap items-center gap-2">
									<p class="text-sm text-gray-400">
										Submit your pick before
										<span class="text-white">{formatDeadline(currentWeek.deadline)}</span>
									</p>
								</div>
								{#if autoPick}
									<p class="mt-1 text-xs text-yellow-700">
										If you miss the deadline,
										<span class="font-medium text-yellow-500">{autoPick.city} {autoPick.name}</span>
										will be auto-picked for you.
									</p>
								{/if}
							{/if}
						</div>

						<!-- Countdown + quick-pick -->
						{#each [timeUntil(currentWeek.deadline)] as t}
						<div class="shrink-0 flex flex-col items-end gap-2">
							{#if t.expired}
								<span class="text-xs font-semibold text-red-400">Deadline passed</span>
							{:else}
								<div class="text-right">
									<p class="text-[10px] uppercase tracking-wider
										{t.urgent ? 'text-red-400' : hasPick ? 'text-green-600' : 'text-yellow-600'}">
										{t.urgent ? '⚠ Closing soon' : 'Time remaining'}
									</p>
									<p class="font-mono text-lg font-bold tabular-nums leading-tight
										{t.urgent ? 'text-red-400' : hasPick ? 'text-green-400' : 'text-[#c9a84c]'}">
										{#if t.d > 0}
											{t.d}d {String(t.h).padStart(2,'0')}h
										{:else}
											{String(t.h).padStart(2,'0')}:{String(t.m).padStart(2,'0')}:{String(t.s).padStart(2,'0')}
										{/if}
									</p>
								</div>
							{/if}
							{#if !t.expired}
								<button
									type="button"
									onclick={() => { expandedWeeks = new Set([currentWeek.id]); }}
									class="rounded border border-[rgba(201,168,76,0.4)] px-3 py-1.5 text-xs font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.1)] {hasPick ? 'standings-pulse' : ''}"
								>
									{hasPick ? 'Change pick ↓' : 'Pick now ↓'}
								</button>
							{/if}
						</div>
						{/each}
					</div>
				{:else}
					<p class="mt-2 text-sm text-gray-500">No weeks currently open for picks.</p>
				{/if}
			{/each}
		</div>

		{#if form?.error}
			<div class="mx-6 mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">
				{form.error}
			</div>
		{/if}

		<!-- Week rows -->
		{#each allDisplayWeeks as week (week.id)}
			{@const picksRequired = picksRequiredByWeek[week.id] ?? 1}
			{@const isOpen      = week.status === 'open'}
			{@const pick        = pickByWeek[week.id]}
			{@const sel         = selections[week.id] ?? []}
			{@const hasPick     = !!pick}
			{@const canSubmit   = sel.length === picksRequired}
			{@const pickedTeams = pick?.expand?.pickedTeams ?? []}
			{@const autoPick    = week.expand?.biggestFavoriteTeam}
			{@const isAutoPick  = pick?.isAutoPick === true}

			<div class="border-t border-gray-800 {!isOpen ? 'opacity-50 hover:opacity-80 transition-opacity' : ''}">

					<!-- Week header -->
				<button
					type="button"
					onclick={() => toggleWeek(week.id)}
					class="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-white/5"
				>
						<div>
							<div class="flex items-center gap-2">
								<p class="font-semibold text-white">Week {week.week}</p>
								{#if !isOpen}
									<span class="rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide {weekStatusColors[week.status] ?? 'border-gray-700 text-gray-500'}">
										{week.status === 'locked' ? 'Locked' : week.status === 'results_pending' ? 'Results Pending' : 'Complete'}
									</span>
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-gray-500">Deadline: {formatDeadline(week.deadline)}</p>
						</div>
						<div class="flex items-center gap-3">
							{#if hasPick}
								{#if isAutoPick}
									<span class="text-sm text-orange-400">
										{pickedTeams.map((t: any) => t.abbreviation).join(', ')}
										<span class="ml-1 text-xs text-orange-500">auto-pick</span>
									</span>
								{:else}
									<span class="text-sm text-gray-300">
										{pickedTeams.map((t: any) => t.abbreviation).join(', ')}
										<span class="ml-1 text-xs {isLms ? 'text-red-400' : 'text-green-400'}">
											{isLms ? '✗ Lose' : '✓ Win'}
										</span>
									</span>
								{/if}
								<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">Picked</span>
							{:else if !isOpen && autoPick}
								<!-- Missed deadline — show pending auto-pick -->
								<span class="text-sm text-orange-400">
									{autoPick.abbreviation}
									<span class="ml-1 text-xs text-orange-600">auto-pick pending</span>
								</span>
								<span class="rounded border border-orange-900 bg-orange-950/40 px-2 py-0.5 text-xs text-orange-400">No pick</span>
							{:else if !isOpen}
								<span class="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-500">No pick</span>
							{:else}
								<span class="rounded border border-yellow-800 bg-yellow-950/60 px-2 py-0.5 text-xs text-yellow-400">No pick</span>
							{/if}
							<span class="text-gray-600">{expandedWeeks.has(week.id) ? '▲' : '▼'}</span>
					</div>
				</button>

				<!-- Expanded body -->
				{#if expandedWeeks.has(week.id)}
					<div class="border-t border-gray-800/50 bg-black/20 px-6 pb-5 pt-4">

							{#if !isOpen}
								<!-- ── CLOSED WEEK: read-only view ── -->
								{#if hasPick}
									<div class="mb-3 rounded-lg border border-gray-800 bg-black/40 p-4">
										<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
											{isAutoPick ? 'Auto-pick applied' : 'Your pick'}
										</p>
										<div class="flex flex-wrap gap-3">
											{#each pickedTeams as team}
												<div class="flex items-center gap-2.5 rounded-md border px-3 py-2
													{isAutoPick
														? 'border-orange-800 bg-orange-950/30'
														: isLms
															? 'border-red-700 bg-red-950/30'
															: 'border-green-700 bg-green-950/30'}">
													<img
														src={teamLogoUrl(team.abbreviation)}
														alt="{team.city} {team.name}"
														class="h-8 w-8 object-contain"
													/>
													<div>
														<p class="text-sm font-medium text-white">{team.city} {team.name}</p>
														<p class="text-xs {isAutoPick ? 'text-orange-400' : isLms ? 'text-red-400' : 'text-green-400'}">
															{isAutoPick ? 'Auto-pick' : isLms ? 'To lose' : 'To win'}
														</p>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{:else}
									<!-- No pick submitted — show auto-pick info -->
									<div class="rounded-lg border border-orange-900 bg-orange-950/20 p-4">
										<p class="mb-1 text-sm font-semibold text-orange-400">Deadline passed — no pick submitted</p>
										{#if autoPick}
											<p class="text-sm text-gray-400">
												Auto-pick: <span class="font-medium text-orange-300">{autoPick.city} {autoPick.name}</span>
												will be applied to your entry.
											</p>
											<div class="mt-3 flex items-center gap-2.5">
												<img
													src={teamLogoUrl(autoPick.abbreviation)}
													alt="{autoPick.city} {autoPick.name}"
													class="h-8 w-8 object-contain opacity-70"
												/>
												<span class="text-sm text-gray-300">{autoPick.city} {autoPick.name}</span>
												<span class="text-xs text-orange-500">pending</span>
											</div>
										{:else}
											<p class="text-sm text-gray-500">No auto-pick team set for this week. Contact the pool admin.</p>
										{/if}
									</div>
								{/if}

							{:else if entry?.status === 'eliminated'}
								<!-- Eliminated — no picking allowed -->
								<div class="rounded-lg border border-red-900 bg-red-950/30 p-4">
									<p class="text-sm text-red-400">This entry has been eliminated — picks are no longer accepted.</p>
								</div>
							{:else}
								<!-- ── OPEN WEEK: team picker ── -->
								<!-- ── OPEN WEEK: team picker ── -->
								<!-- Sticky pick bar — instruction + live selection + submit -->
								<div class="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgba(201,168,76,0.25)] bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
									<p class="text-xs text-gray-400">
										{#if isLms}
											Select <strong class="text-white">1 team</strong> you think will <strong class="text-red-400">lose</strong>.
										{:else}
											Select <strong class="text-white">{picksRequired} team{picksRequired > 1 ? 's' : ''}</strong> you think will <strong class="text-green-400">win</strong>.
										{/if}
									</p>
									<div class="flex items-center gap-3">
										{#if sel.length > 0}
											<span class="flex items-center gap-1.5 text-sm text-gray-300">
												{#each sel as id}
													{@const t = (teams as Team[]).find(x => x.id === id)}
													{#if t}
														<img src={teamLogoUrl(t.abbreviation)} alt={t.name} class="h-5 w-5 object-contain" />
														<span>{t.abbreviation}</span>
													{/if}
												{/each}
												<span class="{isLms ? 'text-red-400' : 'text-green-400'}">— {isLms ? 'Lose' : 'Win'}</span>
											</span>
										{:else}
											<span class="text-xs text-gray-600">No team selected</span>
										{/if}
										<button
											type="submit"
											form="pick-form-{week.id}"
											disabled={!canSubmit || loadingWeek === week.id}
											class="rounded bg-[#c9a84c] px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40"
										>
											{loadingWeek === week.id ? 'Saving…' : hasPick ? 'Update Pick' : 'Submit Pick'}
										</button>
									</div>
								</div>

								<!-- ── Odds panel ── -->
								{#each [oddsByWeek?.[week.id] ?? []] as weekOdds}
									{#if weekOdds.length > 0}
										{@const recs      = recommendationsByWeek?.[week.id] ?? []}
										{@const autoPick  = week.expand?.biggestFavoriteTeam}

										<!-- Auto-pick alert -->
										{#if autoPick}
											<div class="mb-4 flex items-center gap-3 rounded-lg border border-orange-900 bg-orange-950/25 px-3 py-2.5">
												<img src={teamLogoUrl(autoPick.abbreviation)} alt={autoPick.abbreviation} class="h-8 w-8 shrink-0 object-contain" />
												<div class="min-w-0">
													<p class="text-xs font-semibold text-orange-400">Default auto-pick if you miss the deadline</p>
													<p class="text-sm text-white">{autoPick.city} {autoPick.name}
														{#each [teamSpreadByWeek?.[week.id]?.[autoPick.id]] as sp}
															{#if sp != null}
																<span class="ml-1 text-xs text-gray-400">({spreadDisplay(sp)})</span>
															{/if}
														{/each}
													</p>
												</div>
											</div>
										{/if}

										<!-- 3 recommendations -->
										{#if recs.length > 0}
											<div class="mb-4">
												<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
													{isLms ? 'Recommended picks (biggest underdogs)' : 'Recommended picks (biggest favorites)'}
												</p>
												<div class="flex flex-col gap-1.5">
													{#each recs as rec, i}
														<button
															type="button"
															onclick={() => toggleTeam(week.id, rec.teamId)}
															class="flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition
																{sel.includes(rec.teamId)
																	? isLms ? 'border-red-600 bg-red-950/40' : 'border-green-600 bg-green-950/40'
																	: rec.isAutoPick
																		? 'border-orange-800 bg-orange-950/20 hover:border-orange-600'
																		: 'border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.05)] hover:border-[rgba(201,168,76,0.5)]'}"
														>
															<!-- Rank badge -->
															<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
																{i === 0 ? 'bg-[#c9a84c] text-black' : 'bg-gray-800 text-gray-400'}">
																{i + 1}
															</span>
															<img src={teamLogoUrl(rec.abbreviation)} alt={rec.abbreviation} class="h-7 w-7 shrink-0 object-contain" />
															<div class="min-w-0 flex-1">
																<p class="text-sm font-medium text-white leading-tight">{rec.city} {rec.name}</p>
																<p class="text-xs text-gray-500">
																	{rec.isHome ? 'vs' : '@'} {rec.opponent}
																	{#if rec.alreadyUsed}
																		<span class="ml-1 text-red-500">· already used</span>
																	{/if}
																	{#if rec.isAutoPick}
																		<span class="ml-1 text-orange-400">· auto-pick</span>
																	{/if}
																</p>
															</div>
															<div class="shrink-0 text-right">
																<p class="text-sm font-semibold {isLms ? (rec.spread > 0 ? 'text-[#c9a84c]' : 'text-gray-400') : (rec.spread < 0 ? 'text-[#c9a84c]' : 'text-gray-400')}">
																	{spreadDisplay(rec.spread)}
																</p>
																{#if rec.moneyline != null}
																	<p class="text-xs text-gray-600">{moneylineDisplay(rec.moneyline)}</p>
																{/if}
															</div>
															{#if sel.includes(rec.teamId)}
																<span class="shrink-0 text-sm {isLms ? 'text-red-400' : 'text-green-400'}">{isLms ? '✗' : '✓'}</span>
															{/if}
														</button>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Full matchup list (collapsible) -->
										<details class="mb-4 group">
											<summary class="cursor-pointer list-none">
												<div class="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm font-medium text-gray-300 transition hover:border-gray-600 hover:bg-gray-800/60 hover:text-white">
													<span class="transition group-open:hidden">▶ Show all {weekOdds.length} matchups (quick view odds)</span>
													<span class="hidden transition group-open:inline">▼ Hide matchups</span>
												</div>
											</summary>
											<div class="mt-2 overflow-hidden rounded-lg border border-gray-800">
												<table class="w-full text-xs">
													<thead>
														<tr class="border-b border-gray-800 text-gray-600">
															<th class="px-3 py-1.5 text-left">Away</th>
															<th class="px-3 py-1.5 text-left">Home</th>
														</tr>
													</thead>
													<tbody>
														{#each weekOdds as game}
															{@const home = game.expand?.homeTeam}
															{@const away = game.expand?.awayTeam}
															{@const hs   = game.homeSpread ?? null}
															<tr class="border-b border-gray-800/50 hover:bg-white/[0.02]">
																<td class="px-3 py-1.5">
																	<div class="flex items-center gap-1.5">
																		<img src={teamLogoUrl(away?.abbreviation)} alt={away?.abbreviation} class="h-4 w-4 object-contain opacity-70" />
																		<span class="text-gray-400">{away?.abbreviation}</span>
																		{#if hs != null && hs > 0}
																			<span class="text-[#c9a84c] font-semibold">-{hs}</span>
																		{/if}
																	</div>
																</td>
																<td class="px-3 py-1.5">
																	<div class="flex items-center gap-1.5">
																		<img src={teamLogoUrl(home?.abbreviation)} alt={home?.abbreviation} class="h-4 w-4 object-contain" />
																		<span class="text-white">{home?.abbreviation}</span>
																		{#if hs != null && hs < 0}
																			<span class="text-[#c9a84c] font-semibold">{hs}</span>
																		{/if}
																	</div>
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										</details>
									{/if}
								{/each}

								<form
									id="pick-form-{week.id}"
									method="POST"
									use:enhance={() => {
										loadingWeek = week.id;
										return async ({ update }) => { await update(); loadingWeek = null; };
									}}
								>
									<input type="hidden" name="entryId"   value={entry?.id} />
									<input type="hidden" name="weekId"    value={week.id} />
									<input type="hidden" name="entryType" value={entry?.entryType} />
									{#each sel as id}
										<input type="hidden" name="teamIds" value={id} />
									{/each}

									<!-- Team grid -->
									{#each conferences as conf}
										<div class="mb-4">
											<p class="mb-2 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">{conf}</p>
											<div class="grid gap-3 sm:grid-cols-2">
												{#each divisions as div}
													{@const divTeams = grouped()[conf]?.[div] ?? []}
													{#if divTeams.length > 0}
														<div class="rounded-lg border border-gray-800 bg-black/50 p-2.5">
															<p class="mb-1.5 text-xs text-gray-600">{conf} {div}</p>
															<div class="flex flex-col gap-1">
																{#each divTeams as team}
																	{@const selected   = sel.includes(team.id)}
																	{@const usedOther  = (usedByWeek[week.id] ?? []).includes(team.id)}
																	{@const limitFull  = !selected && !isLms && sel.length >= picksRequired}
																	{@const disabled   = usedOther || limitFull}
																	{@const teamSpread = teamSpreadByWeek?.[week.id]?.[team.id] ?? null}
																	<button
																		type="button"
																		onclick={() => toggleTeam(week.id, team.id)}
																		disabled={disabled}
																		title={usedOther ? 'Already picked in another week' : undefined}
																		class="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-sm transition
																			{selected
																				? isLms
																					? 'border-red-600 bg-red-950/40 text-white'
																					: 'border-green-600 bg-green-950/40 text-white'
																				: usedOther
																					? 'cursor-not-allowed border-gray-800 bg-gray-900/20 text-gray-700 line-through'
																					: limitFull
																						? 'cursor-not-allowed border-gray-800 text-gray-600'
																						: 'border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-900/60'}"
																	>
																		<img
																			src={teamLogoUrl(team.abbreviation)}
																			alt="{team.city} {team.name}"
																			class="h-7 w-7 shrink-0 object-contain {usedOther ? 'opacity-20' : selected ? 'opacity-100' : 'opacity-70'}"
																		/>
																		<span class="text-xs flex-1">{team.city} {team.name}</span>
																		{#if teamSpread != null && !usedOther}
																			<span class="text-[10px] font-semibold tabular-nums
																				{isLms
																					? teamSpread > 3 ? 'text-[#c9a84c]' : teamSpread < -3 ? 'text-gray-600' : 'text-gray-500'
																					: teamSpread < -3 ? 'text-[#c9a84c]' : teamSpread > 3 ? 'text-gray-600' : 'text-gray-500'}">
																				{spreadDisplay(teamSpread)}
																			</span>
																		{/if}
																		{#if selected}
																			<span class="text-xs {isLms ? 'text-red-400' : 'text-green-400'}">
																				{isLms ? '✗' : '✓'}
																			</span>
																		{:else if usedOther}
																			<span class="text-xs text-gray-700">used</span>
																		{/if}
																	</button>
																{/each}
															</div>
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/each}

									<!-- Submit row -->
									<div class="mt-3 flex items-center justify-between gap-3">
										<span class="text-xs text-gray-500">
											{#if sel.length > 0}
												{#each sel as id}
													{@const t = (teams as Team[]).find(x => x.id === id)}
													{#if t}
														<span class="flex items-center gap-1.5">
															<img src={teamLogoUrl(t.abbreviation)} alt={t.name} class="h-5 w-5 object-contain" />
															<span>{t.abbreviation}</span>
														</span>
													{/if}
												{/each}
												<span class="{isLms ? 'text-red-400' : 'text-green-400'}">
													— {isLms ? 'Lose' : 'Win'}
												</span>
											{:else}
												No team selected
											{/if}
										</span>
										<button
											type="submit"
											disabled={!canSubmit || loadingWeek === week.id}
											class="shrink-0 rounded bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40"
										>
											{loadingWeek === week.id ? 'Saving…' : hasPick ? 'Update Pick' : 'Submit Pick'}
										</button>
									</div>
								</form>
							{/if}

					</div>
				{/if}

			</div><!-- end week row -->
		{/each}

		</div><!-- end scroll container -->

		<!-- Back to top button — appears after scrolling down -->
		{#if showScrollTop}
			<button
				type="button"
				onclick={scrollToTop}
				class="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-[rgba(201,168,76,0.3)] bg-black/90 px-3 py-1.5 text-xs font-medium text-[#c9a84c] shadow-lg backdrop-blur-sm transition hover:bg-[rgba(201,168,76,0.1)]"
			>
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
				</svg>
				Top
			</button>
		{/if}

	</div><!-- end single card -->

	{/if}

</div>
