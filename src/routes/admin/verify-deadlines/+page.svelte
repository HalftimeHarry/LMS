<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ADMIN_TIME_ZONE, PLAYER_TIME_ZONE } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const rows        = $derived(data.rows        as any[]);
	const counts      = $derived(data.counts      as { upcoming: number; mismatches: number; earlyLocks: number; missingData: number });
	const checkedAt   = $derived(data.checkedAt   as string);
	const isSuperAdmin = $derived(data.isSuperAdmin as boolean);

	let refreshing = $state(false);
	async function refresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
	}

	function fmt(iso: string | null, timeZone: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString('en-US', {
			timeZone,
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		});
	}

	const et = (iso: string | null) => fmt(iso, PLAYER_TIME_ZONE);
	const pt = (iso: string | null) => fmt(iso, ADMIN_TIME_ZONE);

	const resultStyle: Record<string, string> = {
		OK:                 'bg-green-900/60 text-green-300',
		MISMATCH:           'bg-yellow-900/50 text-yellow-300',
		EARLY_LOCK:         'bg-red-900/60 text-red-300',
		OPEN_PAST_DEADLINE: 'bg-red-900/60 text-red-300',
		MISSING_DATA:       'bg-red-900/60 text-red-300',
		TEST_SCHEDULE:      'bg-blue-900/50 text-blue-300',
	};

	const resultLabel: Record<string, string> = {
		OK:                 'OK',
		MISMATCH:           'Deadline mismatch',
		EARLY_LOCK:         'Locked early',
		OPEN_PAST_DEADLINE: 'Open past deadline',
		MISSING_DATA:       'Missing data',
		TEST_SCHEDULE:      'Test schedule',
	};

	function fmtDiff(diff: number | null): string {
		if (diff === null) return '—';
		if (diff === 0) return '0 min';
		return `${diff > 0 ? '+' : ''}${diff} min`;
	}
</script>

<svelte:head><title>Verify Deadlines — Admin</title></svelte:head>

<div>
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-white">Verify Deadlines</h1>
			<p class="mt-1 text-sm text-gray-500">
				Read-only audit of upcoming weeks: stored deadline vs the effective deadline the app enforces
				(first kickoff − 30 min; test seasons keep their own schedule).
				Times in Eastern (ET) with Pacific (PT) beneath.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-xs text-gray-500">Last checked: {pt(checkedAt)}</span>
			<button
				type="button"
				onclick={refresh}
				disabled={refreshing}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white transition hover:border-[#c9a84c] disabled:opacity-50"
			>
				{refreshing ? 'Refreshing…' : 'Refresh'}
			</button>
		</div>
	</div>

	<!-- ── Counts ──────────────────────────────────────────────────────────── -->
	<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-xl border border-gray-800 bg-black/60 px-4 py-3">
			<p class="text-2xl font-bold text-white">{counts.upcoming}</p>
			<p class="text-xs text-gray-500">Upcoming weeks</p>
		</div>
		<div class="rounded-xl border {counts.mismatches ? 'border-yellow-800' : 'border-gray-800'} bg-black/60 px-4 py-3">
			<p class="text-2xl font-bold {counts.mismatches ? 'text-yellow-300' : 'text-white'}">{counts.mismatches}</p>
			<p class="text-xs text-gray-500">Deadline mismatches</p>
		</div>
		<div class="rounded-xl border {counts.earlyLocks ? 'border-red-800' : 'border-gray-800'} bg-black/60 px-4 py-3">
			<p class="text-2xl font-bold {counts.earlyLocks ? 'text-red-300' : 'text-white'}">{counts.earlyLocks}</p>
			<p class="text-xs text-gray-500">Early locks</p>
		</div>
		<div class="rounded-xl border {counts.missingData ? 'border-red-800' : 'border-gray-800'} bg-black/60 px-4 py-3">
			<p class="text-2xl font-bold {counts.missingData ? 'text-red-300' : 'text-white'}">{counts.missingData}</p>
			<p class="text-xs text-gray-500">Missing data</p>
		</div>
	</div>

	{#if rows.length === 0}
		<div class="rounded-xl border border-gray-800 bg-black/60 p-10 text-center text-gray-500">
			No upcoming or locked weeks found.
		</div>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-gray-800 bg-black/60">
			<table class="min-w-full text-sm">
				<thead class="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
					<tr>
						<th class="px-4 py-3 text-left">Season</th>
						<th class="px-4 py-3 text-left">Week</th>
						<th class="px-4 py-3 text-left">Status</th>
						<th class="px-4 py-3 text-left">First game / kickoff</th>
						<th class="px-4 py-3 text-left">Stored deadline</th>
						<th class="px-4 py-3 text-left">Effective deadline</th>
						<th class="px-4 py-3 text-right">Diff</th>
						<th class="px-4 py-3 text-left">Result</th>
						<th class="px-4 py-3 text-left">Deadline change</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-800/60">
					{#each rows as r}
						<tr class={r.result === 'OK' || r.result === 'TEST_SCHEDULE' ? '' : 'bg-red-950/20'}>
							<td class="px-4 py-2.5 text-gray-300">
								{r.seasonName}
								{#if r.oddsSource}
									<span class="block text-xs text-gray-600">games via {r.oddsSource}</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 font-semibold text-white">{r.week}</td>
							<td class="px-4 py-2.5">
								<span class="rounded px-2 py-0.5 text-xs font-medium
									{r.status === 'open' ? 'bg-green-900/60 text-green-300'
									: r.status === 'locked' ? 'bg-yellow-900/50 text-yellow-300'
									: 'bg-gray-800 text-gray-400'}">
									{r.status}
								</span>
							</td>
							<td class="px-4 py-2.5 text-gray-300">
								{#if r.firstGame}
									{r.firstGame}
									<span class="block text-xs text-gray-500">{et(r.firstKickoff)}</span>
									<span class="block text-xs text-gray-600">{pt(r.firstKickoff)}</span>
								{:else}
									<span class="text-red-400">No game data</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 {r.flags.includes('MISMATCH') ? 'text-yellow-300' : 'text-gray-300'}">
								{et(r.storedDeadline)}
								<span class="block text-xs text-gray-600">{pt(r.storedDeadline)}</span>
							</td>
							<td class="px-4 py-2.5 text-gray-300">
								{#if r.effectiveDeadline}
									{et(r.effectiveDeadline)}
									<span class="block text-xs text-gray-600">{pt(r.effectiveDeadline)}</span>
								{:else}
									<span class="font-medium text-red-400">Unresolved</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-right {r.flags.includes('MISMATCH') ? 'text-yellow-300' : 'text-gray-400'}">
								{fmtDiff(r.diffMinutes)}
							</td>
							<td class="px-4 py-2.5">
								<span class="rounded px-2 py-0.5 text-xs font-medium {resultStyle[r.result] ?? 'bg-gray-800 text-gray-400'}">
									{resultLabel[r.result] ?? r.result}
								</span>
								{#if r.flags.length > 1}
									<span class="block mt-1 text-xs text-gray-600">
										also: {r.flags.filter((f: string) => f !== r.result).join(', ')}
									</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-xs text-gray-600">{r.deadlineChangeNote}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
