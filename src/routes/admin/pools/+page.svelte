<script lang="ts">
	import { enhance } from '$app/forms';
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const seasons           = $derived(data.seasons           as any[]);
	const weeks             = $derived(data.weeks             as any[]);
	const teams             = $derived(data.teams             as any[]);
	const picks             = $derived(data.picks             as any[]);
	const eliminatedEntries = $derived(data.eliminatedEntries as any[]);

	// Eliminated entries filtered to selected season
	const seasonEliminated = $derived(
		eliminatedEntries.filter((e: any) => e.season === selectedSeasonId)
	);

	let reinstating      = $state<string | null>(null);
	let eliminatedSearch = $state('');
	let eliminatedWeekFilter = $state('');
	let eliminatedTeamFilter = $state('');

	const filteredEliminated = $derived(
		seasonEliminated.filter((e: any) => {
			if (eliminatedSearch.trim()) {
				const q = eliminatedSearch.toLowerCase();
				const nameMatch = e.entryName?.toLowerCase().includes(q);
				const userMatch = (e.expand?.user?.displayName ?? e.expand?.user?.email ?? '').toLowerCase().includes(q);
				if (!nameMatch && !userMatch) return false;
			}
			if (eliminatedWeekFilter && String(e.eliminatedWeek) !== eliminatedWeekFilter) return false;
			if (eliminatedTeamFilter) {
				const teamIds = (e.eliminatedPick?.expand?.pickedTeams ?? []).map((t: any) => t.id);
				if (!teamIds.includes(eliminatedTeamFilter)) return false;
			}
			return true;
		})
	);

	// Unique weeks that appear in eliminated entries for this season
	const eliminatedWeeks = $derived(
		[...new Set(seasonEliminated.map((e: any) => e.eliminatedWeek).filter(Boolean))]
			.sort((a, b) => a - b)
	);

	// Unique teams that appear in eliminated picks
	const eliminatedTeams = $derived(() => {
		const seen = new Map<string, any>();
		for (const e of seasonEliminated) {
			for (const t of e.eliminatedPick?.expand?.pickedTeams ?? []) {
				if (!seen.has(t.id)) seen.set(t.id, t);
			}
		}
		return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

	// ── Filters ──────────────────────────────────────────────────────────────
	let selectedSeasonId = $state(seasons[0]?.id ?? '');
	let selectedWeekId   = $state('');
	let selectedTeamId   = $state('');

	// Weeks for the selected season
	const seasonWeeks = $derived(
		weeks.filter((w: any) => w.season === selectedSeasonId)
			.sort((a: any, b: any) => a.week - b.week)
	);

	// Auto-select first week when season changes
	$effect(() => {
		selectedWeekId  = seasonWeeks[0]?.id ?? '';
		selectedTeamId  = '';
		eliminateTeamId = '';
		selectedEntryIds = new Set();
	});

	// Pre-fill eliminate team dropdown when a team filter is active
	$effect(() => {
		if (selectedTeamId) eliminateTeamId = selectedTeamId;
	});

	// Picks for selected season + week
	const filteredPicks = $derived(() => {
		return picks.filter((p: any) => {
			const entry = p.expand?.entry;
			if (!entry) return false;
			if (entry.season !== selectedSeasonId) return false;
			if (selectedWeekId && p.week !== selectedWeekId) return false;
			if (entry.status === 'eliminated') return false; // hide already eliminated
			return true;
		});
	});

	// Teams that appear in the filtered picks (for the team filter dropdown)
	const pickedTeamsInView = $derived(() => {
		const seen = new Map<string, any>();
		for (const p of filteredPicks()) {
			for (const t of p.expand?.pickedTeams ?? []) {
				if (!seen.has(t.id)) seen.set(t.id, t);
			}
		}
		return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

	// Apply team filter
	const visiblePicks = $derived(() => {
		if (!selectedTeamId) return filteredPicks();
		return filteredPicks().filter((p: any) =>
			(p.expand?.pickedTeams ?? []).some((t: any) => t.id === selectedTeamId)
		);
	});

	// ── Selection ─────────────────────────────────────────────────────────────
	let selectedEntryIds = $state<Set<string>>(new Set());

	function toggleEntry(entryId: string) {
		const next = new Set(selectedEntryIds);
		if (next.has(entryId)) next.delete(entryId);
		else next.add(entryId);
		selectedEntryIds = next;
	}

	function selectAll() {
		selectedEntryIds = new Set(visiblePicks().map((p: any) => p.expand?.entry?.id).filter(Boolean));
	}

	function clearSelection() {
		selectedEntryIds = new Set();
	}

	// ── Eliminate form ────────────────────────────────────────────────────────
	let eliminateReason  = $state('');
	let eliminateTeamId  = $state('');
	let submitting       = $state(false);
	let clearing         = $state(false);

	const selectedWeek = $derived(weeks.find((w: any) => w.id === selectedWeekId) as any);

	// ── Helpers ───────────────────────────────────────────────────────────────
	function seasonLabel(s: any) {
		return s?.name ?? '—';
	}

	function isSecondHalf(s: any) {
		return s?.name?.toLowerCase().includes('second half');
	}

	const selectedSeason = $derived(seasons.find((s: any) => s.id === selectedSeasonId));
</script>

<svelte:head><title>Manage Pools — Admin</title></svelte:head>

<div class="mx-auto max-w-5xl">

	<div class="relative mb-6 overflow-hidden rounded-xl border border-[rgba(201,168,76,0.4)]"
		style="background: radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.12) 0%, transparent 70%), linear-gradient(135deg, #0a0a0a 0%, #111008 50%, #0a0a0a 100%);"
	>
		<div class="pointer-events-none absolute inset-0 opacity-[0.04]"
			style="background-image: repeating-linear-gradient(90deg,#c9a84c 0,#c9a84c 1px,transparent 1px,transparent 10%); background-size:10% 100%;"
		></div>
		<div class="relative px-6 py-5">
			<p class="text-xs font-semibold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Admin</p>
			<h1 class="mt-1 text-2xl font-bold text-white">Manage Pools</h1>
			<p class="mt-1 text-sm text-gray-400">Filter picks by season, week, and team — then bulk eliminate entries.</p>
		</div>
	</div>

	<!-- ── Season cards ───────────────────────────────────────────────────── -->
	<div class="mb-4 grid gap-3 sm:grid-cols-2">
		{#each seasons as s}
			{@const sh       = isSecondHalf(s)}
			{@const selected = selectedSeasonId === s.id}
			<button
				type="button"
				onclick={() => selectedSeasonId = s.id}
				class="relative overflow-hidden rounded-xl border text-left transition hover:brightness-110
					{selected ? (sh ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-black' : 'ring-2 ring-[#c9a84c] ring-offset-1 ring-offset-black') : ''}"
				style={sh
					? 'border-color: rgba(96,165,250,0.4); background: radial-gradient(ellipse at 70% 50%, rgba(96,165,250,0.1) 0%, transparent 70%), linear-gradient(135deg, #080c14 0%, #090e1a 50%, #080c14 100%);'
					: 'border-color: rgba(201,168,76,0.4); background: radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.12) 0%, transparent 70%), linear-gradient(135deg, #0a0a0a 0%, #111008 50%, #0a0a0a 100%);'}
			>
				<div class="pointer-events-none absolute inset-0 opacity-[0.04]"
					style={sh
						? 'background-image: repeating-linear-gradient(90deg,#60a5fa 0,#60a5fa 1px,transparent 1px,transparent 10%); background-size:10% 100%;'
						: 'background-image: repeating-linear-gradient(90deg,#c9a84c 0,#c9a84c 1px,transparent 1px,transparent 10%); background-size:10% 100%;'}
				></div>
				<div class="relative px-5 py-4">
					<p class="text-xs font-semibold uppercase tracking-widest {sh ? 'text-blue-500/60' : 'text-[rgba(201,168,76,0.6)]'}">
						{sh ? 'Second Half' : 'LMS'}
					</p>
					<p class="mt-0.5 font-bold text-white">{seasonLabel(s)}</p>
					{#if selected}
						<p class="mt-1 text-xs {sh ? 'text-blue-400' : 'text-[#c9a84c]'}">● viewing</p>
					{/if}
				</div>
			</button>
		{/each}
	</div>

	<!-- ── Week cards ──────────────────────────────────────────────────────── -->
	<div class="mb-5 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
		<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Select Week</p>
		<div class="flex flex-wrap gap-2">
			{#each seasonWeeks as w}
				{@const sel = selectedWeekId === w.id}
				<button
					type="button"
					onclick={() => { selectedWeekId = w.id; selectedEntryIds = new Set(); }}
					class="relative overflow-hidden rounded-lg border px-3 py-2 text-xs font-semibold transition
						{sel
							? 'border-[rgba(201,168,76,0.6)] text-[#c9a84c]'
							: 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}"
					style={sel
						? 'background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.15) 0%, transparent 80%), #0a0a0a;'
						: 'background: #0d0d0d;'}
				>
					Wk {w.week}
				</button>
			{/each}
		</div>
	</div>

	<!-- ── Team filter ─────────────────────────────────────────────────────── -->
	{#if pickedTeamsInView().length > 0}
		<div class="mb-5 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Filter by Team Picked</p>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => { selectedTeamId = ''; selectedEntryIds = new Set(); }}
					class="rounded-lg border px-3 py-1.5 text-xs font-medium transition
						{!selectedTeamId
							? 'border-[rgba(201,168,76,0.6)] bg-[rgba(201,168,76,0.1)] text-[#c9a84c]'
							: 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}"
				>
					All teams
				</button>
				{#each pickedTeamsInView() as t}
					{@const sel = selectedTeamId === t.id}
					<button
						type="button"
						onclick={() => { selectedTeamId = t.id; selectedEntryIds = new Set(); }}
						class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition
							{sel
								? 'border-red-700 bg-red-950/40 text-red-400'
								: 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'}"
					>
						<img src={teamLogoUrl(t.abbreviation)} alt={t.name} class="h-5 w-5 object-contain {sel ? 'opacity-100' : 'opacity-60'}" />
						{t.abbreviation} — {t.city} {t.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ── Results table ──────────────────────────────────────────────────── -->
	<div class="mb-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

		<!-- Table header -->
		<div class="border-b border-gray-800 px-5 py-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class="text-base font-bold text-white">
						{visiblePicks().length} active entr{visiblePicks().length === 1 ? 'y' : 'ies'}
					</span>
					{#if selectedTeamId}
						{@const t = teams.find((t: any) => t.id === selectedTeamId) as any}
						<span class="text-sm text-gray-400">— picked {t?.city} {t?.name}</span>
					{/if}
					{#if selectedEntryIds.size > 0}
						<span class="rounded border border-yellow-700 bg-yellow-950/60 px-2.5 py-1 text-sm font-semibold text-yellow-400">
							{selectedEntryIds.size} selected
						</span>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					{#if visiblePicks().length > 0}
						<button
							type="button"
							onclick={selectAll}
							class="rounded border border-yellow-700 bg-yellow-950/60 px-4 py-2 text-sm font-bold text-yellow-400 transition hover:bg-yellow-900/60 hover:text-yellow-300"
						>
							Select all {visiblePicks().length}
						</button>
					{/if}
					{#if selectedEntryIds.size > 0}
						<button
							type="button"
							onclick={clearSelection}
							class="text-sm text-gray-500 transition hover:text-gray-300"
						>
							Clear
						</button>
					{/if}
				</div>
			</div>
		</div>

		{#if visiblePicks().length === 0}
			<div class="px-5 py-10 text-center text-sm text-gray-600">
				No active picks for this week{selectedTeamId ? ' / team' : ''}.
			</div>
		{:else}
			<div class="divide-y divide-gray-800/60">
				{#each visiblePicks() as pick (pick.id)}
					{@const entry      = pick.expand?.entry as any}
					{@const user       = entry?.expand?.user as any}
					{@const pickedTeams = pick.expand?.pickedTeams ?? []}
					{@const entryId    = entry?.id}
					{@const checked    = selectedEntryIds.has(entryId)}

					<label class="flex cursor-pointer items-center gap-4 px-5 py-3 transition hover:bg-white/5
						{checked ? 'bg-red-950/20' : ''}">
						<input
							type="checkbox"
							checked={checked}
							onchange={() => toggleEntry(entryId)}
							class="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-red-500"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-white">
								{entry?.entryName ?? '—'}
							</p>
							<p class="text-xs text-gray-500">
								{user?.displayName ?? user?.email ?? '—'}
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-1.5">
							{#each pickedTeams as t}
								<span class="flex items-center gap-1.5 rounded border border-gray-700 bg-gray-900/60 px-2 py-0.5 text-xs text-gray-300">
									<img src={teamLogoUrl(t.abbreviation)} alt={t.name} class="h-4 w-4 object-contain" />
									{t.abbreviation}
									<span class="{entry?.entryType === 'lms' ? 'text-red-400' : 'text-green-400'}">
										{entry?.entryType === 'lms' ? '✗' : '✓'}
									</span>
								</span>
							{/each}
						</div>
						<span class="shrink-0 rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">
							active
						</span>
					</label>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── Bulk eliminate panel ───────────────────────────────────────────── -->
	{#if selectedEntryIds.size > 0}
		<div class="rounded-xl border border-red-900 bg-red-950/30 p-5 backdrop-blur-sm">
			<h2 class="mb-3 text-sm font-semibold text-red-400">
				Eliminate {selectedEntryIds.size} entr{selectedEntryIds.size === 1 ? 'y' : 'ies'}
			</h2>

			{#if (form as any)?.error}
				<p class="mb-3 text-xs text-red-400">{(form as any).error}</p>
			{/if}
			{#if (form as any)?.success}
				<p class="mb-3 text-xs text-green-400">✅ {(form as any).eliminated} entr{(form as any).eliminated === 1 ? 'y' : 'ies'} eliminated.</p>
			{/if}

			<form
				method="POST"
				action="?/eliminate"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
						if ((form as any)?.success) {
							selectedEntryIds = new Set();
							eliminateReason  = '';
						}
					};
				}}
			>
				<!-- Hidden entry IDs -->
				{#each [...selectedEntryIds] as id}
					<input type="hidden" name="entryIds" value={id} />
				{/each}

				<div class="grid gap-3 sm:grid-cols-3">
					<!-- Week dropdown -->
					<div>
						<label class="mb-1 block text-xs text-gray-500">Week eliminated</label>
						<select
							name="weekNumber"
							class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
						>
							<option value="">— select week —</option>
							{#each seasonWeeks as w}
								<option value={w.week} selected={w.id === selectedWeekId}>
									Week {w.week}
								</option>
							{/each}
						</select>
					</div>

					<!-- Team dropdown -->
					<div>
						<label class="mb-1 block text-xs text-gray-500">Team that eliminated them</label>
						<div class="relative">
							{#if eliminateTeamId}
								<img
									src={teamLogoUrl((teams as any[]).find(t => (t as any).id === eliminateTeamId)?.abbreviation ?? '')}
									alt=""
									class="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 object-contain"
								/>
							{/if}
							<select
								name="teamId"
								bind:value={eliminateTeamId}
								class="w-full rounded border border-gray-700 bg-gray-900 py-2 text-sm text-white focus:border-red-600 focus:outline-none
									{eliminateTeamId ? 'pl-9 pr-3' : 'px-3'}"
							>
								<option value="">— select team —</option>
								{#each teams as t}
									<option value={(t as any).id} selected={(t as any).id === selectedTeamId}>
										{(t as any).abbreviation} — {(t as any).city} {(t as any).name}
									</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Reason -->
					<div>
						<label class="mb-1 block text-xs text-gray-500">Reason (optional)</label>
						<input
							type="text"
							name="reason"
							bind:value={eliminateReason}
							placeholder="e.g. MIA won"
							class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-600 focus:outline-none"
						/>
					</div>
				</div>

				<div class="mt-3 flex justify-end">
					<button
						type="submit"
						disabled={submitting}
						class="rounded bg-red-700 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
					>
						{submitting ? 'Eliminating…' : `Eliminate ${selectedEntryIds.size} entr${selectedEntryIds.size === 1 ? 'y' : 'ies'}`}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- ── Eliminated entries ────────────────────────────────────────────── -->
	<div class="mt-8">
		<div class="mb-3">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">
					Eliminated — {seasonEliminated.length} entr{seasonEliminated.length === 1 ? 'y' : 'ies'}
					{#if filteredEliminated.length !== seasonEliminated.length}
						<span class="ml-1 normal-case text-gray-600">({filteredEliminated.length} shown)</span>
					{/if}
				</h2>
				{#if eliminatedSearch || eliminatedWeekFilter || eliminatedTeamFilter}
					<button
						type="button"
						onclick={() => { eliminatedSearch = ''; eliminatedWeekFilter = ''; eliminatedTeamFilter = ''; }}
						class="text-xs text-gray-600 hover:text-gray-400 transition"
					>
						Clear filters
					</button>
				{/if}
			</div>
			{#if seasonEliminated.length > 0}
				<div class="flex flex-wrap gap-2">
					<input
						type="search"
						bind:value={eliminatedSearch}
						placeholder="Search by name…"
						class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none w-48"
					/>
					<select
						bind:value={eliminatedWeekFilter}
						class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 focus:border-[#c9a84c] focus:outline-none"
					>
						<option value="">All weeks</option>
						{#each eliminatedWeeks as w}
							<option value={String(w)}>Week {w}</option>
						{/each}
					</select>
					<select
						bind:value={eliminatedTeamFilter}
						class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 focus:border-[#c9a84c] focus:outline-none"
					>
						<option value="">All teams</option>
						{#each eliminatedTeams() as t}
							<option value={t.id}>{t.abbreviation} — {t.city} {t.name}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		{#if (form as any)?.reinstated}
			<p class="mb-3 text-xs text-green-400">✅ Entry reinstated to active.</p>
		{/if}

		{#if seasonEliminated.length === 0}
			<div class="rounded-xl border border-gray-800 bg-black/60 px-5 py-8 text-center text-sm text-gray-600">
				No eliminated entries for this season yet.
			</div>
		{:else if filteredEliminated.length === 0}
			<div class="rounded-xl border border-gray-800 bg-black/60 px-5 py-8 text-center text-sm text-gray-600">
				No entries match "{eliminatedSearch}".
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-red-900/50 bg-black/75 backdrop-blur-sm">
				<div class="divide-y divide-gray-800/60">
					{#each filteredEliminated as entry (entry.id)}
						{@const user = entry.expand?.user as any}
						<div class="flex flex-wrap items-center gap-4 px-5 py-3">
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium text-white">{entry.entryName}</p>
								<p class="text-xs text-gray-500">{user?.displayName ?? user?.email ?? '—'}</p>
							</div>
							<div class="flex flex-wrap items-center gap-2 text-xs">
								{#if entry.eliminatedWeek}
									<span class="rounded border border-red-900 bg-red-950/60 px-2 py-0.5 text-red-400">
										Wk {entry.eliminatedWeek}
									</span>
								{/if}
								{#each entry.eliminatedPick?.expand?.pickedTeams ?? [] as team}
									<span class="flex items-center gap-1.5 rounded border border-gray-700 bg-gray-900/60 px-2 py-0.5 font-medium text-gray-300">
										<img src={teamLogoUrl(team.abbreviation)} alt={team.name} class="h-4 w-4 object-contain" />
										{team.abbreviation} — {team.city} {team.name}
									</span>
								{/each}
								{#if entry.eliminatedReason}
									<span class="text-gray-500 italic">"{entry.eliminatedReason}"</span>
								{/if}
							</div>
							<!-- Reinstate button -->
							<form
								method="POST"
								action="?/reinstate"
								use:enhance={() => {
									reinstating = entry.id;
									return async ({ update }) => { await update(); reinstating = null; };
								}}
							>
								<input type="hidden" name="entryId" value={entry.id} />
								<button
									type="submit"
									disabled={reinstating === entry.id}
									class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 transition hover:border-green-700 hover:text-green-400 disabled:opacity-50"
								>
									{reinstating === entry.id ? 'Reinstating…' : 'Reinstate'}
								</button>
							</form>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- ── Dev Tools ─────────────────────────────────────────────────────── -->
	<div class="mt-10 border-t border-gray-800 pt-6">
		<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">Dev Tools</p>

		{#if (form as any)?.cleared}
			<p class="mb-3 text-xs text-green-400">
				✅ Cleared — {(form as any).counts.picks} picks, {(form as any).counts.entries} entries, {(form as any).counts.users} users removed.
			</p>
		{/if}

		<div class="flex flex-wrap items-center gap-4">
			<form
				method="POST"
				action="?/clearTestData"
				use:enhance={() => {
					if (!confirm('Delete ALL @blo.com test data? This cannot be undone.')) return () => {};
					clearing = true;
					return async ({ update }) => { await update(); clearing = false; };
				}}
			>
				<button
					type="submit"
					disabled={clearing}
					class="rounded border border-gray-700 bg-gray-900 px-4 py-2 text-xs text-gray-400 transition hover:border-red-800 hover:text-red-400 disabled:opacity-50"
				>
					{clearing ? 'Clearing…' : 'Clear test data (@blo.com)'}
				</button>
			</form>
			<p class="text-xs text-gray-600">
				Removes all user1–20@blo.com users, their entries, picks, and the Second Half test season.
				Re-seed with <code class="text-gray-500">pnpm seed:test</code>.
			</p>
		</div>
	</div>

</div>
