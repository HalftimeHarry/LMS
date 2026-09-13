<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		clearResultsDraftOutcomes as clearClientDraftOutcomes,
		getResultsDraftKey,
		loadResultsDraftOutcomes,
		saveResultsDraftOutcomes,
	} from '$lib/adminResultsDraft';
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const pageData = $derived(data);
	const pageForm = $derived(form);

	const yearPairs   = $derived(pageData.yearPairs      as any[]);
	const activePair  = $derived(pageData.activePair     as any);
	const lmsWeek     = $derived(pageData.lmsWeek        as any);
	const shWeek      = $derived(pageData.shWeek         as any);
	const games       = $derived(pageData.games          as any[]);
	const lmsPicks    = $derived(pageData.lmsPicks       as any[]);
	const shPicks     = $derived(pageData.shPicks        as any[]);
	const lmsResults  = $derived(pageData.lmsPickResults as any[]);
	const shResults   = $derived(pageData.shPickResults  as any[]);
	const allWeeks    = $derived(pageData.allWeeks       as any[]);
	const shStartWeek = $derived((pageData.shStartWeek   as number) ?? 6);
	const weekNum     = $derived(pageData.weekNum        as number);
	const show2H      = $derived(!!activePair?.sh && weekNum >= shStartWeek);

	const serverNow = $derived((pageData.serverNow as number) ?? Date.now());
	let now = $state(0);
	$effect(() => {
		now = serverNow;
		const id = setInterval(() => { now = Date.now(); }, 1_000);
		return () => clearInterval(id);
	});

	const lmsResultMap = $derived(Object.fromEntries(lmsResults.map((r: any) => [`${r.pick}__${r.team}`, r.result as string])));
	const shResultMap  = $derived(Object.fromEntries(shResults.map( (r: any) => [`${r.pick}__${r.team}`, r.result as string])));

	let outcomes = $state<Record<string, string>>({});
	let draftHydrated = $state(false);
	const savedDraftOutcomes = $derived((pageData.draftOutcomes as Record<string, string>) ?? {});
	const localDraftOutcomes = $derived.by(() => {
		if (!activePair || !weekNum) return {} as Record<string, string>;
		try {
			return loadResultsDraftOutcomes(activePair.year, weekNum);
		} catch {
			return {} as Record<string, string>;
		}
	});
	const hasSavedDraft = $derived(Object.keys(savedDraftOutcomes).length > 0 || Object.keys(localDraftOutcomes).length > 0);

	const resolvedGames = $derived.by(() => {
		const map: Record<string, string> = {};
		for (const game of games) {
			const homeId = game.expand?.homeTeam?.id ?? game.homeTeam;
			const awayId = game.expand?.awayTeam?.id ?? game.awayTeam;
			const all = [...lmsResults, ...shResults];
			const hr  = all.find((r: any) => r.team === homeId);
			const ar  = all.find((r: any) => r.team === awayId);
			if      (hr?.result === 'correct'   && ar?.result === 'incorrect') map[game.id] = 'home';
			else if (ar?.result === 'correct'   && hr?.result === 'incorrect') map[game.id] = 'away';
			else if (hr?.result === 'correct'   && ar?.result === 'correct')   map[game.id] = 'tie';
		}
		return map;
	});
	const sourceOutcomes = $derived.by(() => ({ ...savedDraftOutcomes, ...localDraftOutcomes, ...resolvedGames }));
	let lastSourceKey = $state('');

	$effect(() => {
		if (!activePair || !weekNum) return;
		const nextKey = `${activePair.year}:${weekNum}:${Object.keys(sourceOutcomes).sort().join(',')}:${JSON.stringify(sourceOutcomes)}`;
		if (nextKey !== lastSourceKey) {
			outcomes = { ...sourceOutcomes };
			lastSourceKey = nextKey;
			draftHydrated = true;
		}
	});

	$effect(() => {
		if (!activePair || !weekNum) return;
		if (Object.keys(savedDraftOutcomes).length > 0 && Object.keys(outcomes).length === 0) {
			outcomes = { ...savedDraftOutcomes };
			draftHydrated = true;
		}
		if (Object.keys(localDraftOutcomes).length > 0 && Object.keys(outcomes).length === 0) {
			outcomes = { ...localDraftOutcomes };
			draftHydrated = true;
		}
	});

	$effect(() => {
		if (!activePair || !weekNum) return;
		const key = getResultsDraftKey(activePair.year, weekNum);
		if (typeof window === 'undefined') return;
		if (Object.keys(outcomes).length > 0) {
			saveResultsDraftOutcomes(activePair.year, weekNum, outcomes);
			if (window.localStorage.getItem(key) !== JSON.stringify(outcomes)) {
				window.localStorage.setItem(key, JSON.stringify(outcomes));
			}
		} else {
			clearClientDraftOutcomes(activePair.year, weekNum);
		}
	});

	$effect(() => {
		if (!import.meta.env.PROD) return;
		const id = setInterval(() => { invalidateAll(); }, 30_000);
		return () => clearInterval(id);
	});

	function resetDraftOutcomes() {
		if (!activePair || !weekNum) return;
		outcomes = {};
		if (typeof window !== 'undefined' && activePair && weekNum) {
			clearClientDraftOutcomes(activePair.year, weekNum);
		}
	}

	const weekStatus = $derived(lmsWeek?.status ?? shWeek?.status ?? 'open');

	function parsePocketBaseDeadline(value: unknown): number | null {
		if (value == null || value === '') return null;
		const raw = String(value).trim();
		if (!raw) return null;
		const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
		const ms = new Date(normalized).getTime();
		if (!Number.isFinite(ms)) return null;
		return ms;
	}

	function buildPanel(picks: any[], rmap: Record<string, string>) {
		const map: Record<string, { entry: any; teams: any[]; results: string[] }> = {};
		for (const pick of picks) {
			const entry = pick.expand?.entry;
			if (!entry) continue;
			const teams: any[] = pick.expand?.pickedTeams ?? [];
			map[entry.id] = { entry, teams, results: teams.map((t: any) => rmap[`${pick.id}__${t.id}`] ?? 'pending') };
		}
		return Object.values(map).sort((a, b) => {
			const s = (p: typeof a) => p.results.some(r => r === 'incorrect') ? 0 : p.results.every(r => r === 'correct') ? 2 : 1;
			return s(a) - s(b);
		});
	}

	const lmsEntries = $derived(buildPanel(lmsPicks, lmsResultMap));
	const shEntries  = $derived(buildPanel(shPicks,  shResultMap));

	let recordLoading   = $state(false);
	let lockLoading     = $state(false);
	let completeLoading = $state(false);
	let resetLoading    = $state(false);
	let resetConfirm    = $state(false);

	const statusColors: Record<string, string> = {
		open:            'border-green-800 bg-green-950/60 text-green-400',
		locked:          'border-yellow-800 bg-yellow-950/60 text-yellow-400',
		results_pending: 'border-blue-800 bg-blue-950/60 text-blue-400',
		complete:        'border-gray-700 bg-gray-900 text-gray-500',
	};
	const statusLabels: Record<string, string> = {
		open: 'Open for result entry',
		locked: 'Locked until deadline',
		results_pending: 'Results pending review',
		complete: 'Completed',
	};
	const resultColor: Record<string, string> = { correct: 'text-green-400', incorrect: 'text-red-400', pending: 'text-gray-500' };
	const resultIcon:  Record<string, string> = { correct: '✓', incorrect: '✗', pending: '·' };

	function formatAdminDateTime(value: unknown): string {
		const ms = parsePocketBaseDeadline(value);
		if (ms == null) return '';
		return new Date(ms).toLocaleString('en-US', {
			timeZone: 'America/Los_Angeles',
			month: 'numeric',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true,
		});
	}

	function updateYear(y: string) { goto(`?year=${y}`); }
	function updateWeek(w: number) { goto(`?year=${activePair?.year}&week=${w}`); }

	function isWeekResultsEnabled(week: any): boolean {
		if (!week) return false;
		const ms = parsePocketBaseDeadline(week.deadline);
		if (ms == null) return false;
		return now >= ms;
	}

	const selectedWeekFromNav = $derived(allWeeks.find((w: any) => w.week === weekNum) ?? null);
	const selectedWeekDeadlineMs = $derived.by(() => parsePocketBaseDeadline(selectedWeekFromNav?.deadline));
	const selectedWeekResultsEnabled = $derived.by(() => {
		if (selectedWeekDeadlineMs == null) return false;
		return now >= selectedWeekDeadlineMs;
	});
	const selectedWeekDeadlineLabel = $derived(
		selectedWeekFromNav?.deadline
			? new Date(selectedWeekDeadlineMs ?? 0).toLocaleString('en-US', {
				timeZone: 'America/Los_Angeles',
				weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
				hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
			})
			: ''
	);
	const lmsStatusDisplay = $derived.by(() => {
		if (!lmsWeek) return 'locked';
		return selectedWeekResultsEnabled ? 'open' : 'locked';
	});
	const shStatusDisplay = $derived.by(() => {
		if (!shWeek || !show2H) return 'locked';
		return selectedWeekResultsEnabled ? 'open' : 'locked';
	});

	const gamesEntered = $derived(Object.values(outcomes).filter(Boolean).length);
	const allGamesEntered = $derived(games.length > 0 && gamesEntered >= games.length);
	const isRestoringSavedDraft = $derived(!draftHydrated && hasSavedDraft);
	const progressDisplayGames = $derived.by(() => isRestoringSavedDraft ? 0 : gamesEntered);
	const saveProgressPercent = $derived.by(() => {
		if (!games.length) return 0;
		if (isRestoringSavedDraft) return 0;
		return (progressDisplayGames / games.length) * 100;
	});
	const draftStatusText = $derived.by(() => {
		if (recordLoading) return 'Saving draft…';
		if (isRestoringSavedDraft) return 'Restoring saved draft…';
		if (hasSavedDraft && !allGamesEntered) return 'Draft saved locally';
		if (allGamesEntered) return 'Ready to finalize';
		return 'Draft in progress';
	});
	const showResetActions = $derived(Boolean(lmsWeek || shWeek));
</script>

<svelte:head><title>Results — Admin</title></svelte:head>

<!-- ── Header: year selector + week nav ─────────────────────────────────── -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(201,168,76,0.15)] pb-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Week Results</h1>
			<p class="mt-1 text-sm text-gray-500">Enter game outcomes once — results apply to both LMS and Second Half simultaneously.</p>
		</div>
		<div class="flex items-center gap-2">
			<label for="results-season" class="text-xs text-gray-500">Season</label>
			<select id="results-season"
				value={activePair?.year ?? ''}
				onchange={(e) => updateYear((e.target as HTMLSelectElement).value)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				{#each yearPairs as pair}
					<option value={pair.year}>{pair.year} – {Number(pair.year) + 1}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if allWeeks.length}
		<div class="flex flex-wrap gap-2">
			{#each allWeeks as w}
				{@const weekEnabled = isWeekResultsEnabled(w)}
				<button
					type="button"
					onclick={() => updateWeek(w.week)}
					disabled={!weekEnabled}
					class="rounded border px-3 py-1.5 text-xs font-medium transition
						{w.week === weekNum
							? 'border-[#c9a84c] bg-[rgba(201,168,76,0.15)] text-[#c9a84c]'
							: weekEnabled
							? 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'
							: 'cursor-not-allowed border-gray-800 bg-black text-gray-600'}
						{w.status === 'complete' ? 'opacity-60' : ''}"
					title={weekEnabled ? '' : `Results Week ${w.week} unlocks after deadline`}
				>
					Results Week {w.week}
					{#if w.status === 'complete'}✓{:else if w.status === 'locked' && !weekEnabled}🔒{:else if w.status === 'results_pending'}📋{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if !activePair}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4 text-sm text-gray-500">
		No season pairs found. Create an LMS and Second Half season with the same year.
	</div>
{:else}

<!-- ── Feedback ──────────────────────────────────────────────────────────── -->
{#if pageForm?.success || (pageForm as any)?.resetDone}
	<div class="mb-4 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
		{#if (pageForm as any).resetDone}
			Reset complete — {(pageForm as any).deletedResults} pick results deleted, {(pageForm as any).reinstated} entries reinstated.
		{:else if (pageForm as any).isDraft}
			Draft saved — {(pageForm as any).resultsWritten} results written, {(pageForm as any).eliminated} entries eliminated. Weeks remain locked.
		{:else if (pageForm as any).resultsWritten !== undefined}
			Results saved — {(pageForm as any).resultsWritten} results written, {(pageForm as any).eliminated} entries eliminated.
		{:else if (pageForm as any).autoPicked !== undefined}
			Weeks locked — {(pageForm as any).autoPicked} auto-picks assigned.
		{:else}
			Weeks marked complete.
		{/if}
	</div>
{/if}
{#if (pageForm as any)?.error}
	<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">{(pageForm as any).error}</div>
{/if}

{#if !selectedWeekResultsEnabled}
	<div class="mb-4 rounded-xl border border-yellow-900/60 bg-black/85 px-5 py-4 text-sm text-yellow-200">
		<p class="font-semibold">Results Week {weekNum} is not active yet.</p>
		{#if selectedWeekDeadlineLabel}
			<p class="mt-1 text-yellow-300/80">This week becomes active after its deadline: {selectedWeekDeadlineLabel}.</p>
		{/if}
	</div>
{/if}

<!-- ── Week header: status + actions ────────────────────────────────────── -->
{#if lmsWeek || shWeek}
<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4">
	<div>
		<p class="text-xs font-semibold uppercase tracking-wider text-[rgba(201,168,76,0.6)]">
			{activePair.year}–{Number(activePair.year)+1} — Week {weekNum}
		</p>
		<div class="mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
			{#if lmsWeek}
				<span>LMS deadline: {formatAdminDateTime(lmsWeek.deadline)}</span>
			{/if}
			{#if shWeek && show2H}
				<span>2H deadline: {formatAdminDateTime(shWeek.deadline)}</span>
			{/if}
		</div>
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<!-- Status badges -->
		{#if lmsWeek}
			<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[lmsStatusDisplay] ?? ''}">LMS: {statusLabels[lmsStatusDisplay] ?? lmsStatusDisplay.replace('_',' ')}</span>
		{/if}
		{#if shWeek && show2H}
			<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[shStatusDisplay] ?? ''}">2H: {statusLabels[shStatusDisplay] ?? shStatusDisplay.replace('_',' ')}</span>
		{/if}

		<!-- Lock both weeks -->
		{#if weekStatus === 'open'}
			<form method="POST" action="?/lockWeek" use:enhance={() => {
				lockLoading = true;
				return async ({ update }) => { await update(); lockLoading = false; await invalidateAll(); };
			}}>
				<input type="hidden" name="lmsWeekId"   value={lmsWeek?.id ?? ''} />
				<input type="hidden" name="shWeekId"    value={show2H ? (shWeek?.id ?? '') : ''} />
				<input type="hidden" name="lmsSeasonId" value={activePair.lms?.id ?? ''} />
				<input type="hidden" name="shSeasonId"  value={activePair.sh?.id ?? ''} />
				<input type="hidden" name="year"       value={activePair.year ?? ''} />
				<input type="hidden" name="weekNum"     value={weekNum} />
				<button type="submit" disabled={lockLoading || !selectedWeekResultsEnabled}
					class="rounded border border-yellow-700 bg-yellow-950/60 px-4 py-1.5 text-sm font-medium text-yellow-400 transition hover:bg-yellow-950 disabled:opacity-50">
					{lockLoading ? 'Locking…' : '🔒 Lock Week + Auto-pick'}
				</button>
			</form>
		{/if}

		<!-- Complete both weeks -->
		{#if weekStatus === 'results_pending'}
			<form method="POST" action="?/completeWeek" use:enhance={() => {
				completeLoading = true;
				return async ({ update }) => { await update(); completeLoading = false; await invalidateAll(); };
			}}>
				<input type="hidden" name="lmsWeekId" value={lmsWeek?.id ?? ''} />
				<input type="hidden" name="shWeekId"  value={show2H ? (shWeek?.id ?? '') : ''} />
				<input type="hidden" name="year"     value={activePair.year ?? ''} />
				<input type="hidden" name="weekNum"  value={weekNum} />
				<button type="submit" disabled={completeLoading || !selectedWeekResultsEnabled}
					class="rounded border border-green-700 bg-green-950/60 px-4 py-1.5 text-sm font-medium text-green-400 transition hover:bg-green-950 disabled:opacity-50">
					{completeLoading ? 'Completing…' : '✓ Mark Week Complete'}
				</button>
			</form>
		{/if}
	</div>
</div>
{/if}

<!-- ── Main grid ─────────────────────────────────────────────────────────── -->
<div class="grid gap-6 {activePair.lms && lmsEntries.length && (show2H && shEntries.length) ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}">

	<!-- Game outcomes form -->
	<div class="{activePair.lms && lmsEntries.length && (show2H && shEntries.length) ? 'lg:col-span-2' : 'lg:col-span-1'}">
		{#if !games.length}
			<div class="rounded-xl border border-gray-800 bg-black/75 p-6 text-sm text-gray-500">
				No games found for week {weekNum}. Add odds first via Manage Odds.
			</div>
		{:else}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
			<div class="flex items-center justify-between gap-3 border-b border-[rgba(201,168,76,0.15)] px-5 py-3">
				<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">
					Game Outcomes — Week {weekNum}
					<span class="ml-2 text-gray-600">({games.length} games · {gamesEntered} entered)</span>
				</h2>

				{#if showResetActions}
					<div class="flex items-center gap-2">
						{#if resetConfirm}
							<div class="flex items-center gap-2">
								<form method="POST" action="?/resetWeekResults" use:enhance={() => {
									resetConfirm = false; resetLoading = true;
									return async ({ update, result }) => {
											await update();
											resetLoading = false;
											if ((result as any)?.type === 'success') {
												resetDraftOutcomes();
											}
											await invalidateAll();
										};
								}}>
									<input type="hidden" name="lmsWeekId"   value={lmsWeek?.id ?? ''} />
									<input type="hidden" name="shWeekId"    value={show2H ? (shWeek?.id ?? '') : ''} />
									<input type="hidden" name="lmsSeasonId" value={activePair.lms?.id ?? ''} />
									<input type="hidden" name="shSeasonId"  value={activePair.sh?.id ?? ''} />
									<input type="hidden" name="weekNum"     value={weekNum} />
									<button type="submit" disabled={resetLoading || !selectedWeekResultsEnabled}
										class="rounded border border-red-500 bg-red-950/40 px-4 py-1.5 text-xs text-red-400 transition hover:bg-red-900/60 disabled:opacity-50">
										{resetLoading ? 'Resetting…' : 'Confirm Reset'}
									</button>
								</form>
								<button type="button" onclick={() => resetConfirm = false}
									class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800">Cancel</button>
							</div>
						{:else}
							<button type="button" onclick={() => resetConfirm = true} disabled={resetLoading || !selectedWeekResultsEnabled}
									class="rounded border border-red-700 bg-red-950/50 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-500 hover:bg-red-900/70 disabled:opacity-50">
								↺ Reset Week Results
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<form method="POST" action="?/recordResults" use:enhance={() => {
				recordLoading = true;
				return async ({ update, result }) => {
					await update();
					recordLoading = false;
					if ((result as any)?.type === 'success' && !(result as any)?.data?.isDraft) {
						resetDraftOutcomes();
					}
					await invalidateAll();
				};
			}}>
				<input type="hidden" name="lmsWeekId"   value={lmsWeek?.id ?? ''} />
				<input type="hidden" name="shWeekId"    value={show2H ? (shWeek?.id ?? '') : ''} />
				<input type="hidden" name="lmsSeasonId" value={activePair.lms?.id ?? ''} />
				<input type="hidden" name="shSeasonId"  value={activePair.sh?.id ?? ''} />
				<input type="hidden" name="year"       value={activePair.year ?? ''} />
				<input type="hidden" name="weekNum"     value={weekNum} />
				<div class="flex flex-col gap-2 px-5 pt-4">
					{#each games as game}
						{@const home    = game.expand?.homeTeam}
						{@const away    = game.expand?.awayTeam}
						{@const current = outcomes[game.id] ?? ''}
						{@const saved   = !!resolvedGames[game.id]}
							{@const winnerTeam = current === 'home' ? home : current === 'away' ? away : null}

							<div class="rounded-lg border {saved ? 'border-[rgba(201,168,76,0.25)]' : 'border-gray-800'} bg-black/75 px-4 py-3">
								<div class="flex flex-wrap items-center gap-3">
									<div class="flex min-w-0 flex-1 items-center gap-2 text-sm">
										{#if winnerTeam}
											<img src={teamLogoUrl(winnerTeam.abbreviation)} alt={winnerTeam.abbreviation} class="h-8 w-8 rounded-full border border-emerald-500/60 bg-emerald-950/40 p-1 object-contain" />
											<span class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Won</span>
										{/if}
										<span class={`font-mono font-bold ${current === 'away' ? 'text-blue-200' : 'text-white'} ${current === 'home' ? 'opacity-80' : ''}`}>
											{away?.abbreviation ?? '?'}
										</span>
										<span class="text-gray-600">@</span>
										<span class={`font-mono font-bold ${current === 'home' ? 'text-green-200' : 'text-white'} ${current === 'away' ? 'opacity-80' : ''}`}>
											{home?.abbreviation ?? '?'}
										</span>
										{#if game.homeSpread != null}
											<span class="text-xs text-gray-600">({game.homeSpread > 0 ? '+' : ''}{game.homeSpread})</span>
										{/if}
										<span class="text-xs text-gray-700">
											{new Date(game.game_time_stamp ?? game.gameTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</span>
									</div>
<div class="flex flex-wrap gap-1.5">
											{#each [
												{ val: 'away', text: `${away?.abbreviation ?? 'AWAY'} WINS` },
												{ val: 'home', text: `${home?.abbreviation ?? 'HOME'} WINS` },
												{ val: 'tie', text: 'TIE' }
											] as option}
												{@const optionId = `${game.id}-${option.val}`}
												<label for={optionId} class="cursor-pointer">
													<input id={optionId} type="radio" name="gameId_{game.id}" value={option.val}
														checked={current === option.val}
														disabled={!selectedWeekResultsEnabled}
														onchange={() => outcomes[game.id] = option.val as string}
														class="sr-only" />
													<span class="inline-flex items-center justify-center rounded border px-3 py-1.5 text-sm font-black uppercase tracking-wide transition
														{current === option.val
															? option.val === 'away' ? 'border-blue-600 bg-blue-900/60 text-blue-200 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]'
															: option.val === 'home' ? 'border-green-600 bg-green-900/60 text-green-200 shadow-[0_0_0_1px_rgba(74,222,128,0.35)]'
															: 'border-gray-500 bg-gray-800 text-gray-200 shadow-[0_0_0_1px_rgba(156,163,175,0.35)]'
															: 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-500 hover:text-gray-300'}
														{selectedWeekResultsEnabled ? 'cursor-pointer' : 'cursor-not-allowed'}"
														title={`game=${game.id} value=${option.val} current=${current || 'none'} selected=${current === option.val ? 'true' : 'false'}`}>
														{option.text}
													</span>
												</label>
											{/each}
										</div>
										{#if saved}<span class="text-xs text-[#c9a84c]">saved</span>{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Submit buttons -->
				<div class="space-y-3 px-5 py-4">
					<div class="flex items-center justify-between gap-3">
						<span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
							{draftStatusText}
						</span>
						<span class="text-xs font-medium text-[#c9a84c]">{progressDisplayGames}/{games.length} games</span>
					</div>
					<div class="h-2.5 overflow-hidden rounded-full bg-gray-800">
						<div class="h-full rounded-full bg-gradient-to-r from-[#c9a84c] via-yellow-400 to-amber-300 transition-all duration-200"
							style={`width: ${saveProgressPercent}%`}></div>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<!-- Draft save — keeps weeks locked, updates standings live -->
						<button type="submit" name="draft" value="1"
							disabled={recordLoading || gamesEntered === 0 || !selectedWeekResultsEnabled}
							class="rounded border border-blue-700 bg-blue-950/60 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-950 disabled:opacity-50">
							{recordLoading ? 'Saving draft…' : hasSavedDraft && !allGamesEntered ? 'Draft saved locally' : '💾 Save Draft'}
						</button>
						<!-- Finalize — advances weeks to results_pending -->
						<button type="submit"
							disabled={recordLoading || !selectedWeekResultsEnabled || !allGamesEntered}
							class="rounded bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500">
							{recordLoading ? 'Finalizing…' : 'Save & Finalize'}
						</button>
						<p class="self-center text-xs text-gray-600">
							{progressDisplayGames}/{games.length} games · {draftStatusText} · Draft keeps weeks open for corrections · Finalize requires all games entered
						</p>
					</div>
				</div>
			</form>
		</div>
		{/if}
	</div>

	<!-- Entry status panels -->
	<div class="flex flex-col gap-6">

		<!-- LMS panel -->
		{#if activePair.lms && lmsEntries.length}
		<div>
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
				LMS Entries
				<span class="ml-1 text-gray-600">({lmsEntries.length})</span>
			</h2>
			<div class="mb-2 flex gap-2 text-xs">
				<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-green-400">
					{lmsEntries.filter(e => e.results.length > 0 && e.results.every(r => r === 'correct')).length} safe
				</span>
				<span class="rounded border border-red-800 bg-red-950/60 px-2 py-0.5 text-red-400">
					{lmsEntries.filter(e => e.results.some(r => r === 'incorrect')).length} out
				</span>
				<span class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-gray-500">
					{lmsEntries.filter(e => e.results.every(r => r === 'pending')).length} pending
				</span>
			</div>
			<div class="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
				{#each lmsEntries as { entry, teams, results }}
					{@const isOut  = results.some(r => r === 'incorrect')}
					{@const isSafe = results.length > 0 && results.every(r => r === 'correct')}
					<div class="rounded-lg border px-3 py-2 text-xs
						{isOut  ? 'border-red-900 bg-red-950/30'
						: isSafe ? 'border-green-900 bg-green-950/30'
						: 'border-gray-800 bg-black/50'}">
						<div class="flex items-center justify-between gap-2">
							<span class="truncate font-medium text-white">{entry.entryName}</span>
							<div class="flex shrink-0 items-center gap-1.5">
								{#each teams as team, i}
									<span class="font-mono {resultColor[results[i] ?? 'pending']}">
										{resultIcon[results[i] ?? 'pending']} {team.abbreviation}
									</span>
								{/each}
							</div>
						</div>
						<p class="mt-0.5 truncate text-gray-600">{entry.expand?.user?.displayName ?? ''}</p>
					</div>
				{/each}
			</div>
		</div>
		{/if}

		<!-- 2H panel — only shown from week 6 onward -->
		{#if show2H && shEntries.length}
		<div>
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
				2nd Half Entries
				<span class="ml-1 text-gray-600">({shEntries.length})</span>
			</h2>
			<div class="mb-2 flex gap-2 text-xs">
				<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-green-400">
					{shEntries.filter(e => e.results.length > 0 && e.results.every(r => r === 'correct')).length} safe
				</span>
				<span class="rounded border border-red-800 bg-red-950/60 px-2 py-0.5 text-red-400">
					{shEntries.filter(e => e.results.some(r => r === 'incorrect')).length} out
				</span>
				<span class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-gray-500">
					{shEntries.filter(e => e.results.every(r => r === 'pending')).length} pending
				</span>
			</div>
			<div class="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
				{#each shEntries as { entry, teams, results }}
					{@const isOut  = results.some(r => r === 'incorrect')}
					{@const isSafe = results.length > 0 && results.every(r => r === 'correct')}
					<div class="rounded-lg border px-3 py-2 text-xs
						{isOut  ? 'border-red-900 bg-red-950/30'
						: isSafe ? 'border-green-900 bg-green-950/30'
						: 'border-gray-800 bg-black/50'}">
						<div class="flex items-center justify-between gap-2">
							<span class="truncate font-medium text-white">{entry.entryName}</span>
							<div class="flex shrink-0 items-center gap-1.5">
								{#each teams as team, i}
									<span class="font-mono {resultColor[results[i] ?? 'pending']}">
										{resultIcon[results[i] ?? 'pending']} {team.abbreviation}
									</span>
								{/each}
							</div>
						</div>
						<p class="mt-0.5 truncate text-gray-600">{entry.expand?.user?.displayName ?? ''}</p>
					</div>
				{/each}
			</div>
		</div>
		{/if}

		{#if !activePair.lms && !show2H}
			<p class="text-xs text-gray-600">2nd Half pool starts at week {shStartWeek}.</p>
		{/if}
	</div>

</div><!-- end grid -->
{/if}

<style>
	/* nothing extra needed */
</style>
