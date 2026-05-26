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

	const ctrl = createWeeksController(
		data.weeks as any[],
		(data.poolType ?? 'lms') as EntryType,
		(data.activeSeason as any)?.secondHalfStartWeek ?? 6
	);

	const entryDeadline = $derived(
		ctrl.poolType === 'second_half'
			? (data.shEntryDeadline as string | null)
			: (data.lmsEntryDeadline as string | null)
	);
	// Keep controller in sync when page data reloads
	$effect(() => ctrl.setWeeks(data.weeks as any[]));

	const statusColors: Record<string, string> = {
		open:            'bg-blue-950 text-blue-400 border-blue-800',
		locked:          'bg-yellow-950 text-yellow-400 border-yellow-800',
		results_pending: 'bg-orange-950 text-orange-300 border-orange-600',
		complete:        'bg-green-950 text-green-300 border-green-800',
	};

	let bulkLoading      = $state(false);
	let advanceLoading      = $state(false);
	let advanceLog          = $state<string[]>([]);
	let seasonActionMsg     = $state('');
	let seasonActionBusy    = $state(false);
	let seasonActionConfirm = $state<'startSeason' | 'resetSeason' | null>(null);
	let deleteWeekConfirmId = $state<string | null>(null);

	// Maintenance fee form state
	let maintenanceFeeInput = $state(String(data.maintenanceFee ?? 0));
	let maintenanceSaving   = $state(false);
	let maintenanceSaved    = $state(false);
	let maintenanceError    = $state('');

	// Inline deadline editing
	let editDeadlineId    = $state<string | null>(null);
	let editDeadlineValue = $state('');
	let deadlineSaving    = $state(false);
	let deadlineSavedId   = $state<string | null>(null);
	let deadlineError     = $state('');

	function startEditDeadline(week: any) {
		// Convert stored UTC ISO to a datetime-local string in PT
		const d = new Date(week.deadline);
		const ptStr = d.toLocaleString('en-US', {
			timeZone: 'America/Los_Angeles',
			year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', hour12: false,
		});
		// Reformat MM/DD/YYYY, HH:mm → YYYY-MM-DDTHH:mm
		const [datePart, timePart] = ptStr.split(', ');
		const [mm, dd, yyyy] = datePart.split('/');
		editDeadlineValue = `${yyyy}-${mm}-${dd}T${timePart}`;
		editDeadlineId    = week.id;
		deadlineError     = '';
	}

	async function runSeasonAction(action: 'startSeason' | 'resetSeason') {
		if (!data.activeSeason) return;
		if (seasonActionConfirm !== action) { seasonActionConfirm = action; return; }
		seasonActionConfirm = null;
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
	const now          = $derived(nowTick);
	const nextActions  = $derived(data.nextActions as { weekNum: number; at: number; action: string }[]);
	const isTestSeason = $derived(data.isTestSeason as boolean);
	const isSuperAdmin = $derived(data.isSuperAdmin as boolean);

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

	function switchSeason(id: string) {
		// Auto-switch pool type if the selected season only supports one pool
		const s = (data.seasons as any[]).find(x => x.id === id);
		if (s) {
			const sh = s.name?.toLowerCase().includes('second half');
			if (!sh) ctrl.poolType = 'lms';
			else     ctrl.poolType = 'second_half';
		}
		updateParam('season', id);
	}

	function clearSeason() {
		const params = new URLSearchParams($page.url.searchParams);
		params.delete('season');
		goto(`?${params.toString()}`, { replaceState: true });
	}
	// Group seasons for the rich picker — server already deduplicates by year
	const seasonGroups = $derived(() => {
		const all  = data.seasons as any[];
		const real  = all.filter(s => !s.name?.includes('[TEST]'));
		const tests = all.filter(s =>  s.name?.includes('[TEST]'));

		// Pair test seasons by their timestamp tag e.g. "(1h/week) 2026-05-21T15:32"
		const pairMap = new Map<string, any[]>();
		for (const s of tests) {
			// Extract tag: everything after the first ']'
			const tag = s.name.replace(/^\[TEST\]\s*\d{4}\s*-\s*\d{4}\s*(LMS|Second Half)\s*/, '').trim();
			if (!pairMap.has(tag)) pairMap.set(tag, []);
			pairMap.get(tag)!.push(s);
		}
		return { real, testPairs: [...pairMap.entries()] };
	});


</script>

<svelte:head><title>Season Settings — Admin</title></svelte:head>

<!-- Filter + context card -->
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-4 border-b border-[rgba(201,168,76,0.15)] pb-4">
		<h1 class="text-2xl font-bold text-white">Season Settings</h1>
		<p class="mt-1 text-sm text-gray-500">Verify week deadlines and monitor the pick schedule. In production, weeks advance automatically. Use <span class="text-gray-300">▶ Advance now</span> in dev to trigger transitions manually.</p>
	</div>

	<!-- Row 1: season selector + pool toggle -->
	<div class="flex flex-col gap-4">

		<!-- Real seasons -->
		{#if seasonGroups().real.length}
			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Seasons</p>
				<div class="flex flex-wrap gap-2">
					<!-- All Seasons (default) -->
					<button type="button" onclick={clearSeason}
						class="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition
							{!data.activeSeason ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-white' : 'border-gray-700 bg-gray-900/60 text-gray-400 hover:border-gray-500 hover:text-white'}">
						<span class="font-medium">All Seasons</span>
						{#if !data.activeSeason}
							<span class="text-xs text-[#c9a84c]">● viewing</span>
						{/if}
					</button>

					{#each seasonGroups().real as s}
						{@const active = data.activeSeason?.id === s.id}
						<button type="button" onclick={() => switchSeason(s.id)}
							class="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition
								{active ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.08)] text-white' : 'border-gray-700 bg-gray-900/60 text-gray-400 hover:border-gray-500 hover:text-white'}"
						>
							<span class="font-medium">{s.name}</span>
							<span class="rounded px-1.5 py-0.5 text-xs
								{s.status === 'active' ? 'bg-green-950 text-green-400' :
								 s.status === 'open'   ? 'bg-blue-950 text-blue-400' :
								 s.status === 'setup'  ? 'bg-gray-800 text-gray-500' :
								                         'bg-gray-900 text-gray-600'}">{s.status}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Test season pairs -->
		{#if seasonGroups().testPairs.length}
			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Test Seasons</p>
				<div class="flex flex-col gap-2">
					{#each seasonGroups().testPairs as [tag, pair]}
						<div class="flex flex-wrap items-center gap-1.5 rounded-lg border border-orange-900/40 bg-orange-950/10 px-3 py-2">
							<span class="mr-1 text-xs text-orange-500/70 shrink-0">{tag}</span>
							{#each pair as s}
								{@const active = data.activeSeason?.id === s.id}
								{@const isLMS = !s.name?.toLowerCase().includes('second half')}
								<button type="button" onclick={() => switchSeason(s.id)}
									class="flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition
										{active
											? (isLMS ? 'border-[#c9a84c] bg-[rgba(201,168,76,0.12)] text-[#c9a84c]' : 'border-blue-500 bg-blue-950/40 text-blue-300')
											: 'border-gray-700 bg-gray-900/60 text-gray-400 hover:border-gray-500 hover:text-white'}"
								>
									{#if isLMS}
										<span class="rounded bg-[rgba(201,168,76,0.15)] px-1 text-[10px] font-bold text-[#c9a84c]">LMS</span>
									{:else}
										<span class="rounded bg-blue-950/60 px-1 text-[10px] font-bold text-blue-400">2H</span>
									{/if}
									<span class="rounded px-1 text-[10px]
										{s.status === 'active' ? 'text-green-400' :
										 s.status === 'open'   ? 'text-blue-400' :
										                         'text-gray-600'}">{s.status}</span>
									<span class="font-mono text-gray-500">{s.id.slice(-6)}</span>
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}

	</div>

	<!-- Test season controls -->
	{#if isTestSeason}
		<div class="mt-4 flex flex-wrap items-center gap-3 border-t border-[rgba(201,168,76,0.15)] pt-4">
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-gray-500 shrink-0">Test controls:</span>
				<InfoTip text="These controls only appear for [TEST] seasons. Start season pushes all week deadlines forward from now without touching picks or entries. Reset season clears all picks and results, restores eliminated entries, and restarts the clock — use this for a clean test run." />
			</div>

			{#if seasonActionConfirm === 'startSeason'}
				<button onclick={() => runSeasonAction('startSeason')} disabled={seasonActionBusy}
					class="rounded border border-green-500 bg-green-950/50 px-4 py-1.5 text-xs font-semibold text-green-300 transition hover:bg-green-900/60 disabled:opacity-40"
				>Confirm Start</button>
				<button type="button" onclick={() => seasonActionConfirm = null}
					class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800"
				>Cancel</button>
			{:else if seasonActionConfirm === 'resetSeason'}
				<button onclick={() => runSeasonAction('resetSeason')} disabled={seasonActionBusy}
					class="rounded border border-orange-500 bg-orange-950/50 px-4 py-1.5 text-xs font-semibold text-orange-300 transition hover:bg-orange-900/60 disabled:opacity-40"
				>Confirm Reset</button>
				<button type="button" onclick={() => seasonActionConfirm = null}
					class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800"
				>Cancel</button>
			{:else}
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
			{/if}

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

<!-- ── Maintenance Fee + Payout Breakdown ──────────────────────────────── -->
{#if data.activeSeason && isSuperAdmin}
{@const season        = data.activeSeason as any}
{@const lmsFee        = season.lmsEntryFee        ?? 0}
{@const shFee         = season.secondHalfEntryFee ?? 0}
{@const lmsCount      = (data.lmsEntryCount  as number) ?? 0}
{@const shCount       = (data.shEntryCount   as number) ?? 0}
{@const totalCount    = lmsCount + shCount}
{@const lmsRevenue    = lmsFee  * lmsCount}
{@const shRevenue     = shFee   * shCount}
{@const totalRevenue  = lmsRevenue + shRevenue}
{@const mFee          = Number(maintenanceFeeInput) || 0}
{@const lmsShare      = totalRevenue > 0 ? lmsRevenue / totalRevenue : 0}
{@const shShare       = totalRevenue > 0 ? shRevenue  / totalRevenue : 0}
{@const lmsMaintCost  = Math.round(mFee * lmsShare  * 100) / 100}
{@const shMaintCost   = Math.round(mFee * shShare   * 100) / 100}
{@const lmsPayout     = Math.max(0, lmsRevenue - lmsMaintCost)}
{@const shPayout      = Math.max(0, shRevenue  - shMaintCost)}
<div class="rounded-xl border border-gray-800 bg-black/75 p-5 backdrop-blur-sm">
	<div class="mb-4 flex items-center justify-between gap-3">
		<div>
			<h2 class="text-sm font-semibold uppercase tracking-wider text-gray-400">Maintenance Fee &amp; Payout Breakdown</h2>
			<p class="mt-0.5 text-xs text-gray-600">Operating cost deducted from pool revenue before payouts. Split proportionally by each pool's share of total revenue.</p>
		</div>
	</div>

	<div class="grid gap-5 sm:grid-cols-2">

		<!-- Fee input form -->
		<form method="POST" action="?/saveMaintenance"
			use:enhance={() => {
				maintenanceSaving = true;
				maintenanceSaved  = false;
				maintenanceError  = '';
				return async ({ result, update }) => {
					await update({ reset: false });
					maintenanceSaving = false;
					if (result.type === 'success') {
						maintenanceSaved = true;
						setTimeout(() => { maintenanceSaved = false; }, 3000);
					} else if (result.type === 'failure') {
						maintenanceError = (result.data as any)?.error ?? 'Save failed.';
					}
				};
			}}
			class="flex flex-col gap-3"
		>
			<input type="hidden" name="seasonId" value={season.id} />

			<div>
				<label for="maintenanceFee" class="mb-1 block text-xs font-medium text-gray-400">
					Total maintenance fee ($)
				</label>
				<div class="flex items-center gap-2">
					<span class="text-sm text-gray-500">$</span>
					<input
						id="maintenanceFee"
						name="maintenanceFee"
						type="number"
						min="0"
						step="0.01"
						bind:value={maintenanceFeeInput}
						class="w-32 rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
					/>
					<button type="submit" disabled={maintenanceSaving}
						class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-1.5 text-xs font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.15)] disabled:opacity-40">
						{maintenanceSaving ? 'Saving…' : 'Save'}
					</button>
					{#if maintenanceSaved}
						<span class="text-xs text-green-400">Saved</span>
					{/if}
					{#if maintenanceError}
						<span class="text-xs text-red-400">{maintenanceError}</span>
					{/if}
				</div>
				<p class="mt-1.5 text-xs text-gray-600">
					Set to $0 if there are no operating costs this season.
					The fee is split between pools in proportion to their revenue — a larger pool absorbs a larger share.
				</p>
			</div>

			<!-- Revenue inputs summary -->
			<div class="rounded-lg border border-gray-800 bg-black px-3 py-2.5 text-xs text-gray-500">
				<div class="flex justify-between">
					<span>LMS entries</span>
					<span class="text-gray-300">{lmsCount} × ${lmsFee} = <span class="text-white font-medium">${lmsRevenue.toLocaleString()}</span></span>
				</div>
				<div class="mt-1 flex justify-between">
					<span>2nd Half entries</span>
					<span class="text-gray-300">{shCount} × ${shFee} = <span class="text-white font-medium">${shRevenue.toLocaleString()}</span></span>
				</div>
				<div class="mt-2 flex justify-between border-t border-gray-800 pt-2">
					<span class="font-medium text-gray-400">Total revenue</span>
					<span class="font-semibold text-white">${totalRevenue.toLocaleString()}</span>
				</div>
			</div>
		</form>

		<!-- Payout breakdown -->
		<div class="flex flex-col gap-3">
			<p class="text-xs font-medium text-gray-400">Estimated payouts after maintenance</p>

			<!-- LMS pool -->
			<div class="rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-4 py-3">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold text-[#c9a84c]">LMS Pool</span>
					<span class="text-lg font-bold text-white">${lmsPayout.toLocaleString()}</span>
				</div>
				<div class="mt-1.5 flex flex-col gap-0.5 text-xs text-gray-500">
					<div class="flex justify-between">
						<span>Revenue</span><span class="text-gray-400">${lmsRevenue.toLocaleString()}</span>
					</div>
					<div class="flex justify-between">
						<span>Maintenance share ({Math.round(lmsShare * 100)}%)</span>
						<span class="text-red-400">−${lmsMaintCost.toLocaleString()}</span>
					</div>
					{#if lmsCount > 0}
					<div class="mt-1 flex justify-between border-t border-[rgba(201,168,76,0.1)] pt-1">
						<span>Per-entry payout (winner takes all)</span>
						<span class="text-[#c9a84c] font-medium">${lmsPayout.toLocaleString()}</span>
					</div>
					{/if}
				</div>
			</div>

			<!-- 2H pool -->
			<div class="rounded-lg border border-blue-900/40 bg-blue-950/10 px-4 py-3">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold text-blue-400">2nd Half Pool</span>
					<span class="text-lg font-bold text-white">${shPayout.toLocaleString()}</span>
				</div>
				<div class="mt-1.5 flex flex-col gap-0.5 text-xs text-gray-500">
					<div class="flex justify-between">
						<span>Revenue</span><span class="text-gray-400">${shRevenue.toLocaleString()}</span>
					</div>
					<div class="flex justify-between">
						<span>Maintenance share ({Math.round(shShare * 100)}%)</span>
						<span class="text-red-400">−${shMaintCost.toLocaleString()}</span>
					</div>
					{#if shCount > 0}
					<div class="mt-1 flex justify-between border-t border-blue-900/30 pt-1">
						<span>Per-entry payout (winner takes all)</span>
						<span class="text-blue-400 font-medium">${shPayout.toLocaleString()}</span>
					</div>
					{/if}
				</div>
			</div>

			{#if totalCount === 0}
				<p class="text-xs text-gray-600">No active entries yet — payouts will appear once entries are confirmed.</p>
			{/if}
		</div>
	</div>
</div>
{/if}

{#if !data.activeSeason}
	<div class="rounded-xl border border-gray-800 bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-500">Select a season above to view and manage its weeks.</p>
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

								{#if week.status === 'open' && isSuperAdmin}
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
							<div class="mt-0.5 flex flex-wrap items-center gap-3">
								{#if editDeadlineId === week.id}
									<!-- Inline deadline editor -->
									<form method="POST" action="?/updateDeadline"
										use:enhance={() => {
											deadlineSaving = true;
											deadlineError  = '';
											return async ({ result, update }) => {
												await update({ reset: false });
												deadlineSaving = false;
												if (result.type === 'success') {
													deadlineSavedId   = week.id;
													editDeadlineId    = null;
													setTimeout(() => { deadlineSavedId = null; }, 3000);
												} else if (result.type === 'failure') {
													deadlineError = (result.data as any)?.error ?? 'Save failed.';
												}
											};
										}}
										class="flex flex-wrap items-center gap-2"
									>
										<input type="hidden" name="id" value={week.id} />
										<input
											type="datetime-local"
											name="deadline"
											bind:value={editDeadlineValue}
											class="rounded border border-[rgba(201,168,76,0.5)] bg-gray-900 px-2 py-1 text-xs text-white focus:border-[#c9a84c] focus:outline-none"
										/>
										<span class="text-xs text-gray-600">PT</span>
										<button type="submit" disabled={deadlineSaving}
											class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-3 py-1 text-xs font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.15)] disabled:opacity-40">
											{deadlineSaving ? 'Saving…' : 'Save'}
										</button>
										<button type="button" onclick={() => { editDeadlineId = null; deadlineError = ''; }}
											class="rounded border border-gray-700 px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-800">
											Cancel
										</button>
										{#if deadlineError}
											<span class="text-xs text-red-400">{deadlineError}</span>
										{/if}
									</form>
								{:else}
									<p class="text-sm text-gray-400">
										Deadline: {new Date(week.deadline).toLocaleString('en-US', {
											weekday: 'short', month: 'short', day: 'numeric',
											hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
											timeZone: 'America/Los_Angeles'
										})}
									</p>
									{#if deadlineSavedId === week.id}
										<span class="text-xs text-green-400">Saved</span>
									{/if}
									{#if deadlineLabel}
										<span class="font-mono text-sm font-bold {deadlineUrgent ? 'text-red-400' : 'text-[#c9a84c]'}">
											{deadlineLabel}
										</span>
									{/if}
									<!-- Edit button — only on open/locked weeks -->
									{#if week.status === 'open' || week.status === 'locked'}
										<button type="button" onclick={() => startEditDeadline(week)}
											class="rounded border border-gray-700 px-2 py-0.5 text-[10px] text-gray-500 transition hover:border-gray-500 hover:text-gray-300">
											Edit
										</button>
									{/if}
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
											{#if (picks.lms as any).stored}
												<span class="rounded bg-[rgba(201,168,76,0.15)] px-1 text-[10px] font-semibold uppercase tracking-wider text-[#c9a84c]">locked in</span>
											{:else}
												<span class="rounded bg-gray-800 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">preview</span>
											{/if}
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

							<!-- Advance status — Lock Week restricted to super_admin -->

							{#if week.status !== 'complete' && (week.status !== 'open' || isSuperAdmin)}
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

	

							<!-- Delete (open weeks, super_admin only) -->
							{#if week.status === 'open' && isSuperAdmin}
								{#if deleteWeekConfirmId === week.id}
									<div class="flex items-center gap-1">
										<form method="POST" action="?/deleteWeek" use:enhance={() => { deleteWeekConfirmId = null; }}>
											<input type="hidden" name="id" value={week.id} />
											<button type="submit"
												class="rounded border border-red-500 bg-red-950/40 px-3 py-1 text-xs text-red-400 transition hover:bg-red-900/60">
												Confirm
											</button>
										</form>
										<button type="button" onclick={() => deleteWeekConfirmId = null}
											class="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-800">
											Cancel
										</button>
									</div>
								{:else}
									<button type="button" onclick={() => deleteWeekConfirmId = week.id}
										class="rounded border border-red-900 px-3 py-1 text-xs text-red-500 transition hover:bg-red-950/40">
										Delete
									</button>
								{/if}
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}
