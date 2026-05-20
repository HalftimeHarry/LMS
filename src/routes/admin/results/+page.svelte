<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import InfoTip from '$lib/components/InfoTip.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const seasons    = $derived(data.seasons    as any[]);
	const activeSeason = $derived(data.activeSeason as any);
	const weekSetting  = $derived(data.weekSetting  as any);
	const games        = $derived(data.games        as any[]);
	const picks        = $derived(data.picks        as any[]);
	const pickResults  = $derived(data.pickResults  as any[]);
	const allWeeks     = $derived(data.allWeeks     as any[]);

	// Build a lookup: pickId+teamId → result
	const resultMap = $derived(
		Object.fromEntries(
			pickResults.map((r: any) => [`${r.pick}__${r.team}`, r.result as string])
		)
	);

	// Track selected outcomes per game: gameId → 'home'|'away'|'tie'|''
	let outcomes = $state<Record<string, string>>({});

	// Pre-fill outcomes from existing pick_results if all games for a team are resolved
	// (we derive winning team per game from pick_results)
	const resolvedGames = $derived((() => {
		const map: Record<string, string> = {};
		for (const game of games) {
			const homeId = game.expand?.homeTeam?.id ?? game.homeTeam;
			const awayId = game.expand?.awayTeam?.id ?? game.awayTeam;
			// Check if any pick_result references these teams with a definitive result
			const homeResult = pickResults.find((r: any) => r.team === homeId);
			const awayResult = pickResults.find((r: any) => r.team === awayId);
			if (homeResult?.result === 'correct' && awayResult?.result === 'incorrect') map[game.id] = 'home';
			else if (awayResult?.result === 'correct' && homeResult?.result === 'incorrect') map[game.id] = 'away';
			else if (homeResult?.result === 'correct' && awayResult?.result === 'correct') map[game.id] = 'tie';
		}
		return map;
	})());

	$effect(() => {
		outcomes = { ...resolvedGames };
	});

	const weekStatus = $derived(weekSetting?.status ?? 'open');
	const isLocked   = $derived(weekStatus === 'locked' || weekStatus === 'results_pending' || weekStatus === 'complete');
	const canRecord  = $derived(weekStatus === 'locked' || weekStatus === 'results_pending' || weekStatus === 'complete');
	const isComplete = $derived(false); // always allow admin to record/correct results

	const statusColors: Record<string, string> = {
		open:             'border-green-800 bg-green-950/60 text-green-400',
		locked:           'border-yellow-800 bg-yellow-950/60 text-yellow-400',
		results_pending:  'border-blue-800 bg-blue-950/60 text-blue-400',
		complete:         'border-gray-700 bg-gray-900 text-gray-500',
	};

	// Picks grouped by entry for the summary panel
	const picksByEntry = $derived((() => {
		const map: Record<string, { entry: any; teams: any[]; results: string[] }> = {};
		for (const pick of picks) {
			const entry = pick.expand?.entry;
			if (!entry) continue;
			const teams: any[] = pick.expand?.pickedTeams ?? [];
			const results = teams.map((t: any) => resultMap[`${pick.id}__${t.id}`] ?? 'pending');
			map[entry.id] = { entry, teams, results };
		}
		return Object.values(map);
	})());

	const eliminatedCount = $derived(picksByEntry.filter(p => p.results.some(r => r === 'incorrect')).length);
	const survivingCount  = $derived(picksByEntry.filter(p => p.results.length > 0 && p.results.every(r => r === 'correct')).length);

	const sortedPicksByEntry = $derived([...picksByEntry].sort((a, b) => {
		const score = (p: typeof a) =>
			p.results.some(r => r === 'incorrect') ? 0
			: p.results.every(r => r === 'correct') ? 2 : 1;
		return score(a) - score(b);
	}));

	let lockLoading     = $state(false);
	let recordLoading   = $state(false);
	let completeLoading = $state(false);
	let overrideLoading = $state(false);
	let resetLoading    = $state(false);

	// Override panel state
	type OverrideTarget = { entry: any; pick: any; teams: any[] } | null;
	let overrideTarget = $state<OverrideTarget>(null);
	let overrideTeamIds = $state<string[]>([]);
	let overrideReason  = $state('');

	function openOverride(entry: any) {
		// Find the pick for this entry in the current week
		const pick = picks.find((p: any) => p.entry === entry.id || p.expand?.entry?.id === entry.id);
		const teams: any[] = pick?.expand?.pickedTeams ?? [];
		overrideTarget  = { entry, pick: pick ?? null, teams };
		overrideTeamIds = teams.map((t: any) => t.id);
		overrideReason  = '';
	}

	function closeOverride() {
		overrideTarget  = null;
		overrideTeamIds = [];
		overrideReason  = '';
	}

	function toggleOverrideTeam(teamId: string) {
		if (overrideTeamIds.includes(teamId)) {
			overrideTeamIds = overrideTeamIds.filter(id => id !== teamId);
		} else {
			overrideTeamIds = [...overrideTeamIds, teamId];
		}
	}

	// All teams available for picking — derived from games this week
	const weekTeams = $derived((() => {
		const seen = new Map<string, any>();
		for (const g of games) {
			const home = g.expand?.homeTeam;
			const away = g.expand?.awayTeam;
			if (home) seen.set(home.id, home);
			if (away) seen.set(away.id, away);
		}
		return [...seen.values()].sort((a: any, b: any) => a.abbreviation.localeCompare(b.abbreviation));
	})());

	function updateSeason(id: string) {
		goto(`?season=${id}`);
	}
	function updateWeek(w: number) {
		goto(`?season=${activeSeason?.id}&week=${w}`);
	}

	const outcomeLabel: Record<string, string> = { home: 'Home Win', away: 'Away Win', tie: 'Tie' };
	const outcomeColor: Record<string, string> = {
		home: 'border-green-700 bg-green-950/60 text-green-300',
		away: 'border-blue-700 bg-blue-950/60 text-blue-300',
		tie:  'border-gray-600 bg-gray-900 text-gray-400',
		'':   'border-gray-700 bg-gray-900 text-gray-600',
	};
	const resultColor: Record<string, string> = {
		correct:   'text-green-400',
		incorrect: 'text-red-400',
		pending:   'text-gray-500',
	};
	const resultIcon: Record<string, string> = {
		correct:   '✓',
		incorrect: '✗',
		pending:   '·',
	};
</script>

<svelte:head><title>Results — Admin</title></svelte:head>

<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(201,168,76,0.15)] pb-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Week Results</h1>
			<p class="mt-1 text-sm text-gray-500">Record game outcomes after each week locks. Mark each game as a home win, away win, or tie — the system then determines which entries are deactivated based on their picks.</p>
		</div>
		<!-- Season selector -->
		<div class="flex items-center gap-1.5">
			<select
				value={activeSeason?.id ?? ''}
				onchange={(e) => updateSeason((e.target as HTMLSelectElement).value)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				{#each seasons as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
			<InfoTip text="Select the season to record results for. Test seasons show simulated results automatically — real seasons require manual entry here." />
		</div>
	</div>

	<!-- Week nav -->
	<div class="flex flex-wrap gap-2">
		{#each allWeeks as w}
			<button
				type="button"
				onclick={() => updateWeek(w.week)}
				class="rounded border px-3 py-1.5 text-xs font-medium transition
					{w.week === data.weekNum
						? 'border-[#c9a84c] bg-[rgba(201,168,76,0.15)] text-[#c9a84c]'
						: 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'}
					{w.status === 'complete' ? 'opacity-60' : ''}"
			>
				Wk {w.week}
				{#if w.status === 'complete'}✓{:else if w.status === 'locked'}🔒{:else if w.status === 'results_pending'}📋{/if}
			</button>
		{/each}
	</div>
</div>

{#if !activeSeason}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4 backdrop-blur-sm">
		<p class="text-sm text-gray-500">Select a season above to view and record results.</p>
	</div>
{:else}



{#if !weekSetting}
	<div class="rounded-xl border border-gray-800 bg-black/75 p-6 text-gray-500">
		Week {data.weekNum} has not been created yet.
	</div>
{:else}

<!-- Week header -->
<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4">
	<div>
		<p class="text-xs font-semibold uppercase tracking-wider text-[rgba(201,168,76,0.6)]">
			{activeSeason.name} — Week {data.weekNum}
		</p>
		<p class="mt-1 text-sm text-gray-400">
			Deadline: {new Date(weekSetting.deadline).toLocaleString()}
			{#if weekSetting.expand?.biggestFavoriteTeam}
				· Auto-pick: <span class="text-[#c9a84c]">{weekSetting.expand.biggestFavoriteTeam.abbreviation}</span>
			{/if}
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[weekStatus] ?? ''}">
			{weekStatus.replace('_', ' ')}
		</span>

		<!-- Lock + auto-pick button -->
		{#if weekStatus === 'open'}
			<div class="flex items-center gap-1.5">
				<form method="POST" action="?/lockWeek" use:enhance={() => {
					lockLoading = true;
					return async ({ update }) => { await update(); lockLoading = false; await invalidateAll(); };
				}}>
					<input type="hidden" name="weekId"   value={weekSetting.id} />
					<input type="hidden" name="seasonId" value={activeSeason.id} />
					<input type="hidden" name="weekNum"  value={data.weekNum} />
					<button type="submit" disabled={lockLoading}
						class="rounded border border-yellow-700 bg-yellow-950/60 px-4 py-1.5 text-sm font-medium text-yellow-400 transition hover:bg-yellow-950 disabled:opacity-50">
						{lockLoading ? 'Locking…' : '🔒 Lock Week + Auto-pick'}
					</button>
				</form>
				<InfoTip text="Closes picks for this week and assigns the auto-pick team to any entry that didn't submit. In production this happens automatically at the deadline — use this to lock early if needed." />
			</div>
		{/if}

		<!-- Complete button -->
		{#if weekStatus === 'results_pending'}
			<div class="flex items-center gap-1.5">
				<form method="POST" action="?/completeWeek" use:enhance={() => {
					completeLoading = true;
					return async ({ update }) => { await update(); completeLoading = false; await invalidateAll(); };
				}}>
					<input type="hidden" name="weekId" value={weekSetting.id} />
					<button type="submit" disabled={completeLoading}
						class="rounded border border-green-700 bg-green-950/60 px-4 py-1.5 text-sm font-medium text-green-400 transition hover:bg-green-950 disabled:opacity-50">
						{completeLoading ? 'Completing…' : '✓ Mark Week Complete'}
					</button>
				</form>
				<InfoTip text="Processes all pick results, eliminates entries that picked incorrectly, and closes this week. Do this after all game results have been entered above." />
			</div>
		{/if}
	</div>
</div>

<!-- Action feedback -->
{#if form?.success || (form as any)?.resetDone}
	<div class="mb-4 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
		{#if (form as any).resetDone}
			Reset complete — {(form as any).deletedResults} pick results deleted, {(form as any).reinstated} entries reinstated.
		{:else if (form as any).resultsWritten !== undefined}
			Results recorded — {(form as any).resultsWritten} pick results written, {(form as any).eliminated} entries eliminated.
		{:else if (form as any).autoPicked !== undefined}
			Week locked — {(form as any).autoPicked} auto-picks assigned.
		{:else}
			Week marked complete.
		{/if}
	</div>
{/if}
{#if (form as any)?.error}
	<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">{(form as any).error}</div>
{/if}

<div class="grid gap-6 lg:grid-cols-3">

	<!-- Game outcomes form -->
	<div class="lg:col-span-2">
		{#if !games.length}
			<div class="rounded-xl border border-gray-800 bg-black/75 p-6 text-sm text-gray-500">
				No games found for this week. Add odds first via Manage Odds.
			</div>
		{:else}
			<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
				<div class="border-b border-[rgba(201,168,76,0.15)] px-5 py-3">
					<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">
						Game Outcomes — Week {data.weekNum}
						<span class="ml-2 text-gray-600">({games.length} games)</span>
					</h2>
				</div>
			<form method="POST" action="?/recordResults" use:enhance={() => {
				recordLoading = true;
				return async ({ update }) => { await update(); recordLoading = false; await invalidateAll(); };
			}}>
				<input type="hidden" name="weekId"   value={weekSetting.id} />
				<input type="hidden" name="seasonId" value={activeSeason.id} />
				<input type="hidden" name="weekNum"  value={data.weekNum} />

				<div class="flex flex-col gap-2 px-5 pt-5">
					{#each games as game}
						{@const home = game.expand?.homeTeam}
						{@const away = game.expand?.awayTeam}
						{@const current = outcomes[game.id] ?? ''}
						{@const resolved = resolvedGames[game.id]}

						<div class="rounded-lg border {resolved ? 'border-[rgba(201,168,76,0.25)]' : 'border-gray-800'} bg-black/75 px-4 py-3">
							<div class="flex flex-wrap items-center gap-3">
								<!-- Teams -->
								<div class="flex min-w-0 flex-1 items-center gap-2 text-sm">
									<span class="font-mono font-bold text-white">{away?.abbreviation ?? '?'}</span>
									<span class="text-gray-600">@</span>
									<span class="font-mono font-bold text-white">{home?.abbreviation ?? '?'}</span>
									{#if game.homeSpread != null}
										<span class="text-xs text-gray-600">
											({game.homeSpread > 0 ? '+' : ''}{game.homeSpread})
										</span>
									{/if}
									<span class="text-xs text-gray-700">
										{new Date(game.gameTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
									</span>
								</div>

								<!-- Outcome buttons -->
								<div class="flex gap-1.5">
									{#each [['away', `${away?.abbreviation} Win`], ['home', `${home?.abbreviation} Win`], ['tie', 'Tie']] as [val, lbl]}
										<label class="cursor-pointer">
											<input
												type="radio"
												name="gameId_{game.id}"
												value={val}
												checked={current === val}
												onchange={() => outcomes[game.id] = val as string}
												class="sr-only"
												disabled={isComplete}
											/>
											<span class="inline-block rounded border px-2.5 py-1 text-xs font-medium transition
												{current === val
													? val === 'away' ? 'border-blue-600 bg-blue-900/60 text-blue-300'
													: val === 'home' ? 'border-green-600 bg-green-900/60 text-green-300'
													: 'border-gray-500 bg-gray-800 text-gray-300'
													: 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-500 hover:text-gray-300'}
												{isComplete ? 'cursor-default' : 'cursor-pointer'}">
												{lbl}
											</span>
										</label>
									{/each}
								</div>

								{#if resolved}
									<span class="text-xs text-[#c9a84c]">saved</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if !isComplete}
					<div class="flex flex-wrap items-center gap-3 px-5 pb-5">
						<button type="submit" disabled={recordLoading || !Object.values(outcomes).some(Boolean)}
							class="rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
							{recordLoading ? 'Saving…' : 'Save Results + Deactivate Entries'}
						</button>
						<p class="self-center text-xs text-gray-600">
							{Object.values(outcomes).filter(Boolean).length}/{games.length} games entered
						</p>
					</div>
				{/if}
				<!-- Reset results — clears pick_results, reinstates eliminated entries, resets week to locked -->
				{#if weekSetting && (weekSetting.status === 'results_pending' || weekSetting.status === 'complete' || pickResults.length > 0)}
					<div class="mx-5 mb-5 mt-3 border-t border-gray-800 pt-3">
						<form method="POST" action="?/resetWeekResults" use:enhance={() => {
							if (!confirm('Reset all results for this week? Pick results will be deleted and eliminated entries reinstated.')) return () => {};
							resetLoading = true;
							return async ({ update }) => { await update(); resetLoading = false; await invalidateAll(); };
						}}>
							<input type="hidden" name="weekId"   value={weekSetting?.id} />
							<input type="hidden" name="seasonId" value={activeSeason?.id} />
							<button type="submit" disabled={resetLoading}
								class="rounded border border-gray-700 bg-gray-900 px-4 py-1.5 text-xs text-gray-400 transition hover:border-red-800 hover:text-red-400 disabled:opacity-50">
								{resetLoading ? 'Resetting…' : '↺ Reset Week Results'}
							</button>
							<span class="ml-2 text-xs text-gray-600">Clears results, reinstates eliminated entries, returns week to locked.</span>
						</form>
					</div>
				{/if}
			</form>
			</div><!-- end card -->
		{/if}
	</div>

	<!-- Pick summary panel -->
	<div>
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
			Entry Status
			{#if picksByEntry.length}
				<span class="ml-1 text-gray-600">({picksByEntry.length} picks)</span>
			{/if}
		</h2>

		{#if picksByEntry.length}
			<!-- Summary counts -->
			<div class="mb-3 flex gap-3 text-xs">
				<span class="rounded border border-green-800 bg-green-950/60 px-2.5 py-1 text-green-400">
					{survivingCount} surviving
				</span>
				<span class="rounded border border-red-800 bg-red-950/60 px-2.5 py-1 text-red-400">
					{eliminatedCount} eliminated
				</span>
				<span class="rounded border border-gray-700 bg-gray-900 px-2.5 py-1 text-gray-500">
					{picksByEntry.length - survivingCount - eliminatedCount} pending
				</span>
			</div>

			<div class="flex flex-col gap-1.5 max-h-[600px] overflow-y-auto pr-1">
				{#each sortedPicksByEntry as { entry, teams, results }}
					{@const isElim    = results.some(r => r === 'incorrect')}
					{@const isSurvive = results.length > 0 && results.every(r => r === 'correct')}
					<button
						type="button"
						onclick={() => openOverride(entry)}
						class="w-full rounded-lg border px-3 py-2 text-xs text-left transition
							{isElim    ? 'border-red-900 bg-red-950/30 hover:bg-red-950/50'
							: isSurvive ? 'border-green-900 bg-green-950/30 hover:bg-green-950/50'
							: 'border-gray-800 bg-black/50 hover:bg-gray-900/80'}">
						<div class="flex items-center justify-between gap-2">
							<span class="font-medium text-white truncate">{entry.entryName}</span>
							<div class="flex items-center gap-1.5 shrink-0">
								{#each teams as team, i}
									<span class="font-mono {resultColor[results[i] ?? 'pending']}">
										{resultIcon[results[i] ?? 'pending']} {team.abbreviation}
									</span>
								{/each}
								<span class="ml-1 text-gray-700 text-[10px]">edit</span>
							</div>
						</div>
						<p class="mt-0.5 text-gray-600 truncate">
							{entry.expand?.user?.displayName ?? entry.expand?.user?.email ?? ''}
							{#if picks.find((p: any) => (p.entry === entry.id || p.expand?.entry?.id === entry.id) && p.isAutoPick)}
								<span class="text-orange-600"> · auto-pick</span>
							{/if}
						</p>
					</button>
				{/each}
			</div>
		{:else}
			<div class="rounded-xl border border-gray-800 bg-black/75 p-4 text-sm text-gray-500">
				No picks submitted for this week yet.
			</div>
		{/if}

		<!-- Emergency override panel -->
		{#if overrideTarget}
			{@const ot = overrideTarget}
			<div class="mt-4 rounded-xl border border-yellow-700 bg-yellow-950/30 p-4">
				<div class="mb-3 flex items-center justify-between gap-2">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wider text-yellow-400">⚠ Emergency Pick Override</p>
						<p class="mt-0.5 text-xs text-gray-400">{ot.entry.entryName}</p>
					</div>
					<button type="button" onclick={closeOverride}
						class="text-gray-600 hover:text-gray-400 text-lg leading-none">✕</button>
				</div>

				<form method="POST" action="?/overridePick" use:enhance={() => {
					overrideLoading = true;
					return async ({ update }) => {
						await update();
						overrideLoading = false;
						if (!(form as any)?.error) { closeOverride(); await invalidateAll(); }
					};
				}}>
					<input type="hidden" name="pickId"  value={ot.pick?.id ?? ''} />
					<input type="hidden" name="entryId" value={ot.entry.id} />
					<input type="hidden" name="weekId"  value={weekSetting?.id ?? ''} />
					<input type="hidden" name="teamIds" value={overrideTeamIds.join(',')} />

					<!-- Team selector -->
					<div class="mb-3">
						<p class="mb-2 text-xs text-gray-500">Select replacement team(s):</p>
						<div class="flex flex-wrap gap-1.5">
							{#each weekTeams as team}
								{@const selected = overrideTeamIds.includes(team.id)}
								<button
									type="button"
									onclick={() => toggleOverrideTeam(team.id)}
									class="rounded border px-2.5 py-1 font-mono text-xs font-medium transition
										{selected
											? 'border-yellow-600 bg-yellow-900/60 text-yellow-300'
											: 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-500 hover:text-gray-300'}">
									{team.abbreviation}
								</button>
							{/each}
						</div>
						{#if overrideTeamIds.length}
							<p class="mt-1.5 text-xs text-yellow-500">
								Selected: {overrideTeamIds.map(id => weekTeams.find((t: any) => t.id === id)?.abbreviation ?? id).join(', ')}
							</p>
						{/if}
					</div>

					<!-- Reason — required for audit trail -->
					<div class="mb-3">
						<label for="override-reason" class="mb-1 block text-xs text-gray-500">
							Reason <span class="text-red-500">*</span>
							<span class="text-gray-700"> (saved to pick record for audit)</span>
						</label>
						<textarea
							id="override-reason"
							name="reason"
							bind:value={overrideReason}
							rows="2"
							placeholder="e.g. Player submitted pick via phone call before deadline — system error prevented submission"
							class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-700 focus:border-yellow-600 focus:outline-none resize-none"
						></textarea>
					</div>

					{#if (form as any)?.error && overrideTarget}
						<p class="mb-2 text-xs text-red-400">{(form as any).error}</p>
					{/if}

					<div class="flex gap-2">
						<button
							type="submit"
							disabled={overrideLoading || !overrideTeamIds.length || !overrideReason.trim()}
							class="rounded border border-yellow-700 bg-yellow-950/60 px-4 py-1.5 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-950 disabled:opacity-40">
							{overrideLoading ? 'Saving…' : 'Save Override'}
						</button>
						<button type="button" onclick={closeOverride}
							class="rounded border border-gray-700 px-4 py-1.5 text-xs text-gray-500 transition hover:bg-gray-900">
							Cancel
						</button>
					</div>

					<p class="mt-2 text-[10px] text-gray-700">
						Saving will delete existing pick results for this entry so they can be re-recorded.
						If the entry was eliminated this week it will be reinstated to active.
					</p>
				</form>
			</div>
		{/if}
	</div>

</div>
{/if}
{/if}
 
