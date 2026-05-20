<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { createWeeksController } from '$lib/controllers';
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData, ActionData } from './$types';
	import type { EntryType } from '$lib/providers';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ctrl = createWeeksController(data.weeks as any[], (data.poolType ?? 'lms') as EntryType);
	// Keep controller in sync when page data reloads
	$effect(() => ctrl.setWeeks(data.weeks as any[]));

	const statusColors: Record<string, string> = {
		open:            'bg-blue-950 text-blue-400 border-blue-800',
		locked:          'bg-yellow-950 text-yellow-400 border-yellow-800',
		results_pending: 'bg-orange-950 text-orange-300 border-orange-600',
		complete:        'bg-green-950 text-green-300 border-green-800',
	};

	let bulkLoading      = $state(false);
	let advanceLoading   = $state(false);
	let advanceLog       = $state<string[]>([]);
	let seasonActionMsg  = $state('');
	let seasonActionBusy = $state(false);

	async function runSeasonAction(action: 'startSeason' | 'resetSeason') {
		if (!data.activeSeason) return;
		const label = action === 'startSeason' ? 'start' : 'reset';
		if (!confirm(`${label === 'reset' ? 'Reset' : 'Start'} "${data.activeSeason.name}"? ${label === 'reset' ? 'All picks and results will be cleared and deadlines pushed forward.' : 'Deadlines will be pushed forward from now.'}`)) return;
		seasonActionBusy = true;
		seasonActionMsg  = '';
		const fd = new FormData();
		fd.append('seasonId', data.activeSeason.id);
		try {
			const res  = await fetch(`?/${action}`, { method: 'POST', body: fd });
			const json = await res.json().catch(() => ({}));
			seasonActionMsg = json?.data?.message ?? (res.ok ? 'Done.' : json?.data?.error ?? 'Failed.');
			if (res.ok) await invalidateAll();
		} finally {
			seasonActionBusy = false;
		}
	}

	// Relative time formatter
	function relativeTime(ms: number): string {
		const abs = Math.abs(ms);
		if (abs < 60_000)          return 'just now';
		if (abs < 3_600_000)       return `${Math.round(abs / 60_000)}m`;
		if (abs < 86_400_000)      return `${Math.round(abs / 3_600_000)}h`;
		return `${Math.round(abs / 86_400_000)}d`;
	}

	let   nowTick     = $state(data.serverNow as number);
	$effect(() => {
		const id = setInterval(() => { nowTick = Date.now(); }, 1_000);
		return () => clearInterval(id);
	});
	const now         = $derived(nowTick);
	const nextActions = $derived(data.nextActions as { weekNum: number; at: number; action: string }[]);
	const isTestSeason = $derived(data.isTestSeason as boolean);

	const actionLabel: Record<string, string> = {
		lock:     'Picks lock',
		results:  'Results simulated',
		complete: 'Week completes',
	};

	function updateParam(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set(key, value);
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function switchSeason(id: string) { updateParam('season', id); }
	function switchPoolType(type: EntryType) {
		ctrl.poolType = type;
		updateParam('poolType', type);
	}


</script>

<svelte:head><title>Season Settings — Admin</title></svelte:head>

<!-- Filter + context card -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-4 border-b border-[rgba(201,168,76,0.15)] pb-4">
		<h1 class="text-2xl font-bold text-white">Season Settings</h1>
		<p class="mt-1 text-sm text-gray-500">Verify week deadlines and monitor the pick schedule. In production, weeks advance automatically. Use <span class="text-gray-300">▶ Advance now</span> in dev to trigger transitions manually.</p>
	</div>

	<!-- Row 1: season selector + pool toggle -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex flex-col gap-1">
				<span class="text-xs text-gray-500">Season</span>
				<select
					value={data.activeSeason?.id ?? ''}
					onchange={(e) => switchSeason((e.target as HTMLSelectElement).value)}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
				>
					{#each data.seasons as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>

			<div class="flex flex-col gap-1">
				<span class="text-xs text-gray-500">Pool type</span>
				<div class="flex overflow-hidden rounded border border-gray-700">
					<button type="button" onclick={() => switchPoolType('lms')}
						class="px-4 py-1.5 text-sm font-medium transition {ctrl.poolType === 'lms' ? 'bg-[#c9a84c] text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}"
					>LMS</button>
					<button type="button" onclick={() => switchPoolType('second_half')}
						class="border-l border-gray-700 px-4 py-1.5 text-sm font-medium transition {ctrl.poolType === 'second_half' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}"
					>2nd Half</button>
				</div>
			</div>
		</div>

		<!-- Viewing label -->
		<div class="text-right">
			<p class="text-xs text-gray-500">Viewing</p>
			<p class="text-sm font-semibold text-white">
				{data.activeSeason?.name ?? '—'}
			</p>
		</div>
	</div>

	<!-- Test season controls -->
	{#if isTestSeason}
		<div class="mt-4 flex flex-wrap items-center gap-3 border-t border-[rgba(201,168,76,0.15)] pt-4">
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-gray-500 shrink-0">Test controls:</span>
				<InfoTip text="These controls only appear for [TEST] seasons. Start season pushes all week deadlines forward from now without touching picks or entries. Reset season clears all picks and results, restores eliminated entries, and restarts the clock — use this for a clean test run." />
			</div>

			<button
				onclick={() => runSeasonAction('startSeason')}
				disabled={seasonActionBusy}
				class="rounded border border-green-800 bg-green-950/40 px-4 py-1.5 text-xs font-semibold text-green-400 transition hover:bg-green-950/70 disabled:opacity-40"
			>▶ Start season</button>

			<button
				onclick={() => runSeasonAction('resetSeason')}
				disabled={seasonActionBusy}
				class="rounded border border-orange-800 bg-orange-950/40 px-4 py-1.5 text-xs font-semibold text-orange-400 transition hover:bg-orange-950/70 disabled:opacity-40"
			>↺ Reset season</button>

			{#if seasonActionBusy}
				<span class="text-xs text-gray-400 animate-pulse">Working…</span>
			{/if}
			{#if seasonActionMsg}
				<span class="text-xs {seasonActionMsg.toLowerCase().includes('fail') || seasonActionMsg.toLowerCase().includes('error') ? 'text-red-400' : 'text-green-400'}">{seasonActionMsg}</span>
			{/if}
		</div>
	{/if}

	<!-- ── Season countdown banner ───────────────────────────────────────── -->
	{#each [ctrl.filtered.find((w: any) => w.status === 'open') ?? null] as currentWeek}
		{#if currentWeek}
			{@const diff   = new Date(currentWeek.deadline).getTime() - now}
			{@const live   = diff > 0}
			{@const urgent = live && diff < 3_600_000}
			{@const d = live ? Math.floor(diff / 86_400_000) : 0}
			{@const h = live ? Math.floor((diff % 86_400_000) / 3_600_000) : 0}
			{@const m = live ? Math.floor((diff % 3_600_000) / 60_000) : 0}
			{@const s = live ? Math.floor((diff % 60_000) / 1_000) : 0}
			<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3
				{urgent ? 'border-red-800 bg-red-950/80' : live ? 'border-green-800 bg-green-950/70' : 'border-gray-700 bg-gray-950/80'}">
				<div class="flex items-center gap-3">
					<span class="text-xs font-semibold uppercase tracking-wider {urgent ? 'text-red-400' : live ? 'text-green-400' : 'text-gray-500'}">
						{live ? '● Running' : '● Deadline passed'}
					</span>
					<span class="text-sm text-gray-300">
						Week {currentWeek.week} — deadline {new Date(currentWeek.deadline).toLocaleString('en-US', {
							weekday: 'short', month: 'short', day: 'numeric',
							hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
						})}
					</span>
				</div>
				{#if live}
					<span class="font-mono text-xl font-bold tabular-nums {urgent ? 'text-red-400' : 'text-[#c9a84c]'}">
						{#if d > 0}{d}d {/if}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
					</span>
				{:else}
					<span class="text-sm font-semibold text-gray-500">Advance week to continue</span>
				{/if}
			</div>
		{:else}
			<div class="mt-4 rounded-xl border border-gray-700 bg-gray-950/80 px-5 py-3">
				<span class="text-sm text-gray-500">⏸ No open week — season not running or all weeks complete.</span>
			</div>
		{/if}
	{/each}

	<!-- Divider -->
	<div class="my-4 border-t border-[rgba(201,168,76,0.15)]"></div>

	<!-- Row 2: pool rules context -->
	{#if ctrl.poolType === 'lms'}
		<div class="flex flex-wrap gap-4">
			<div class="flex items-center gap-2">
				<span class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-xs font-semibold text-[#c9a84c]">LMS</span>
				<span class="text-sm text-gray-300">Last Man / Last Woman Standing</span>
			</div>
			<div class="flex flex-wrap gap-3 text-xs text-gray-500">
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Pick:</span> 1 team to <span class="text-red-400 font-medium ml-1">lose</span></span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Weeks:</span> 1 – 18</span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Frequency:</span> 1 pick / week</span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Eliminated:</span> picked team wins</span>
			</div>
		</div>
	{:else}
		<div class="flex flex-wrap gap-4">
			<div class="flex items-center gap-2">
				<span class="rounded border border-blue-800 bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-400">2nd Half</span>
				<span class="text-sm text-gray-300">Second Half Survivor</span>
			</div>
			<div class="flex flex-wrap gap-3 text-xs text-gray-500">
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Pick:</span> teams to <span class="text-green-400 font-medium ml-1">win</span></span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Entries open:</span> week 6</span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Wks 6–9:</span> 1 pick</span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Wks 10–18:</span> 2 picks</span>
				<span class="text-gray-700">·</span>
				<span class="flex items-center gap-1"><span class="text-gray-300 font-medium">Eliminated:</span> any picked team loses</span>
			</div>
		</div>
	{/if}
</div>

{#if !data.activeSeason}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">No seasons found. <a href="/admin/seasons/new" class="text-[#c9a84c] hover:underline">Create one first.</a></p>
	</div>
{:else}

	<!-- Schedule timeline card — test seasons only -->
	{#if isTestSeason}
	<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Schedule</h2>
				<p class="mt-0.5 text-xs text-gray-500">
					Test season — weeks advance automatically in production every 2 min. Use the button below in dev.
				</p>
			</div>

			<form method="POST" action="?/advanceNow"
				use:enhance={() => {
					advanceLoading = true; advanceLog = [];
					return async ({ result, update }) => {
						await update({ reset: false });
						advanceLoading = false;
						if (result.type === 'success') advanceLog = (result.data as any)?.advanceLog ?? [];
					};
				}}
			>
				<input type="hidden" name="seasonId" value={data.activeSeason.id} />
				<button type="submit" disabled={advanceLoading}
					class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-1.5 text-xs font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.15)] disabled:opacity-40">
					{advanceLoading ? 'Running…' : '▶ Advance now'}
				</button>
			</form>
		</div>

		<!-- Advance log output -->
		{#if advanceLog.length}
			<div class="mb-4 rounded border border-gray-800 bg-black p-3">
				{#each advanceLog as line}
					<p class="font-mono text-xs text-green-400">{line}</p>
				{/each}
			</div>
		{/if}

		<!-- Upcoming transitions -->
		{#if nextActions.length}
			<div class="flex flex-col gap-2">
				{#each nextActions.slice(0, 2) as evt}
					{@const isPast = now > evt.at}
					{@const diff   = evt.at - now}
					<div class="flex items-center gap-3 rounded border {isPast ? 'border-red-900/70 bg-red-950/60' : 'border-gray-800 bg-black/80'} px-3 py-2">
						<span class="w-16 shrink-0 text-xs font-semibold {isPast ? 'text-red-400' : 'text-gray-300'}">
							Week {evt.weekNum}
						</span>
						<span class="flex-1 text-xs text-gray-400">{actionLabel[evt.action] ?? evt.action}</span>
						<span class="text-xs font-mono {isPast ? 'text-red-400' : 'text-[#c9a84c]'}">
							{isPast ? `${relativeTime(diff)} overdue` : `in ${relativeTime(diff)}`}
						</span>
						<span class="text-xs text-gray-600">
							{new Date(evt.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
						</span>
					</div>
				{/each}
				{#if nextActions.length > 2}
					<p class="text-xs text-gray-600 pl-1">+{nextActions.length - 2} more upcoming transitions</p>
				{/if}
			</div>
		{:else}
			<p class="text-sm text-gray-500">All weeks complete.</p>
		{/if}
	</div>
	{/if}

	<!-- Weeks list -->
	{#if ctrl.filtered.length === 0}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-10 text-center backdrop-blur-sm">
			<p class="text-gray-400">No weeks set up yet for {data.activeSeason.name}.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each ctrl.filtered as week}
				{@const pickCount      = (data.pickCountsByWeek ?? {})[week.id] ?? 0}
				{@const activeCount    = data.activeEntryCount ?? 0}
				{@const missing        = Math.max(0, activeCount - pickCount)}
				{@const picksThisWeek  = ctrl.poolType === 'second_half' ? (week.week >= 10 ? 2 : 1) : 1}
				{@const hasActiveOdds  = (data.activeOddsWeeks ?? []).includes(week.week)}
				{@const isNextOpen     = ctrl.filtered.find((w: any) => w.status === 'open')?.id === week.id}
				{@const needsOddsWarn  = week.status === 'open' && !hasActiveOdds && isNextOpen}
				{@const deadlineDiff   = isNextOpen ? new Date(week.deadline).getTime() - now : 0}
				{@const deadlineUrgent = isNextOpen && deadlineDiff > 0 && deadlineDiff < 3_600_000}
				{@const deadlineLabel  = isNextOpen && deadlineDiff > 0
					? (Math.floor(deadlineDiff / 3_600_000) > 0
						? `${Math.floor(deadlineDiff / 3_600_000)}h ${String(Math.floor((deadlineDiff % 3_600_000) / 60_000)).padStart(2,'0')}m`
						: `${String(Math.floor((deadlineDiff % 3_600_000) / 60_000)).padStart(2,'0')}:${String(Math.floor((deadlineDiff % 60_000) / 1_000)).padStart(2,'0')}`)
					: null}
				<div class="rounded-xl border p-5 backdrop-blur-sm
					{week.status === 'complete'         ? 'border-green-900    bg-green-950/90'
					: week.status === 'results_pending' ? 'border-purple-900   bg-purple-950/90'
					: week.status === 'locked'          ? 'border-gray-700     bg-gray-900/90'
					: isNextOpen                        ? 'border-purple-700   bg-purple-950/80'
					:                                     'border-gray-800     bg-black/80'}">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<!-- Week info -->
						<div>
							<div class="flex items-center gap-3">
								<p class="font-semibold text-white">Week {week.week}</p>

								{#if week.status === 'open'}
									{#if isNextOpen}
										<span class="rounded border border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.12)] px-2 py-0.5 text-xs font-semibold text-[#c9a84c]">Current</span>
									{:else}
										<span class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs text-gray-500">Upcoming</span>
									{/if}
								{/if}

								{#if activeCount > 0}
									<span class="rounded border px-2 py-0.5 text-xs
										{missing === 0
											? 'border-green-800 text-green-400'
											: missing <= 3
												? 'border-yellow-800 text-yellow-400'
												: 'border-red-900 text-red-400'}">
										{pickCount}/{activeCount} picks
										{#if missing > 0}· {missing} missing{/if}
									</span>
								{/if}
							</div>
							<div class="mt-0.5 flex items-center gap-3">
								<p class="text-sm text-gray-400">
									Deadline: {new Date(week.deadline).toLocaleString('en-US', {
										weekday: 'short', month: 'short', day: 'numeric',
										hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
									})}
								</p>
								{#if deadlineLabel}
									<span class="font-mono text-sm font-bold {deadlineUrgent ? 'text-red-400' : 'text-[#c9a84c]'}">
										{deadlineLabel}
									</span>
								{/if}
							</div>
	
							{#each [{ lms: (data.biggestFavoriteByWeek ?? {})[week.week], sh: (data.longestShotByWeek ?? {})[week.week] }] as picks}
							{#if picks.lms || picks.sh}
								<div class="mt-2 flex flex-wrap gap-2">
									{#if picks.lms}
										<span class="flex items-center gap-1.5 rounded border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.06)] px-2 py-0.5 text-xs text-[#c9a84c]">
											<span class="font-semibold uppercase tracking-wide">LMS auto-pick</span>
											<img src={teamLogoUrl(picks.lms.abbreviation)} alt={picks.lms.abbreviation} class="h-4 w-4 object-contain" />
											<span class="text-gray-300">{picks.lms.city} {picks.lms.name}</span>
											<span class="text-gray-500">{picks.lms.spread}</span>
										</span>
									{/if}
									{#if picks.sh}
										<span class="flex items-center gap-1.5 rounded border border-blue-900 bg-blue-950/40 px-2 py-0.5 text-xs text-blue-400">
											<span class="font-semibold uppercase tracking-wide">2H auto-pick</span>
											<img src={teamLogoUrl(picks.sh.abbreviation)} alt={picks.sh.abbreviation} class="h-4 w-4 object-contain" />
											<span class="text-gray-300">{picks.sh.city} {picks.sh.name}</span>
											<span class="text-blue-500">+{picks.sh.spread}</span>
										</span>
									{/if}
								</div>
							{/if}
						{/each}
							{#if needsOddsWarn}
								<div class="mt-2 flex items-center gap-1.5 rounded border border-yellow-800 bg-yellow-950/60 px-2.5 py-1.5 text-xs text-yellow-400">
									⚠ No active odds set — auto-pick will not fire at lock time. Activate odds via <a href="/admin/odds" class="underline hover:text-yellow-300">Manage Odds</a>.
								</div>
							{/if}
							{#if week.notes}
								<p class="mt-1 text-xs text-gray-500">{week.notes}</p>
							{/if}
						</div>

						<!-- Actions -->
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[week.status] ?? ''}
								{week.status === 'results_pending' ? 'animate-pulse' : ''}">
								{week.status.replace('_', ' ')}
							</span>



							<!-- Unlock (locked → open) -->
							{#if week.status === 'locked'}
								<form method="POST" action="?/setStatus" use:enhance>
									<input type="hidden" name="id" value={week.id} />
									<input type="hidden" name="status" value="open" />
									<button type="submit"
										class="rounded border border-gray-600 px-3 py-1 text-xs text-gray-400 transition hover:border-gray-400 hover:text-white">
										↩ Unlock
									</button>
								</form>
							{/if}

							<!-- Advance status -->
							{#if week.status !== 'complete'}
								<form method="POST" action="?/setStatus" use:enhance>
									<input type="hidden" name="id" value={week.id} />
									<input type="hidden" name="status" value={ctrl.nextStatus(week.status) ?? week.status} />
									<button type="submit"
										class="rounded border px-3 py-1 text-xs transition
											{week.status === 'results_pending'
												? 'animate-pulse border-orange-500 text-orange-300 hover:bg-orange-950/40'
												: 'border-[rgba(201,168,76,0.4)] text-[#c9a84c] hover:bg-[rgba(201,168,76,0.1)]'}">
										→ {ctrl.advanceLabel(week.status)}
									</button>
								</form>
							{/if}

	

							<!-- Delete (open weeks only) -->
							{#if week.status === 'open'}
								<form method="POST" action="?/deleteWeek" use:enhance>
									<input type="hidden" name="id" value={week.id} />
									<button type="submit"
										onclick={(e) => { if (!confirm('Delete this week?')) e.preventDefault(); }}
										class="rounded border border-red-900 px-3 py-1 text-xs text-red-500 transition hover:bg-red-950/40">
										Delete
									</button>
								</form>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}
