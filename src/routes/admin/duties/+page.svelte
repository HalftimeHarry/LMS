<script lang="ts">
	import type { LayoutData } from '../$types';
	let { data }: { data: LayoutData } = $props();
	const isSuperAdmin = $derived(data.role === 'super_admin');
</script>

<svelte:head><title>Admin Duties — Admin</title></svelte:head>

<div class="flex flex-col gap-6">

	<!-- Header card -->
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<h1 class="text-2xl font-bold text-white">Admin Duties</h1>
		<p class="mt-1 text-sm text-gray-500">What to do and when — from season setup through the final week.</p>
		<div class="mt-3 rounded-lg border border-gray-800 bg-black/60 px-4 py-3 text-sm text-gray-400">
			<span class="font-semibold text-gray-300">What's automated:</span> The scheduled function runs every 2 minutes and handles the entire weekly lifecycle —
			locking the week at the deadline, assigning auto-picks to entries that missed the deadline (biggest favorite from active odds),
			and advancing weeks through <span class="text-orange-300">results_pending</span> → <span class="text-green-300">complete</span>.
			Your job is to keep odds current and enter real game results.
		</div>
	</div>

	<!-- ── Super Admin only: Phase 1 — Season Setup ─────────────────────── -->
	{#if isSuperAdmin}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<div class="mb-4 flex items-center gap-3">
			<span class="rounded-full border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] px-3 py-0.5 text-xs font-semibold text-[#c9a84c]">Phase 1</span>
			<h2 class="text-lg font-bold text-white">Before the Season</h2>
			<span class="rounded border border-[rgba(201,168,76,0.3)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c9a84c]">Super Admin</span>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Create the Season</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/seasons/new" class="text-[#c9a84c] hover:underline">Seasons → New Season</a>. Set the entry fees, first pick deadline, and whether LMS and/or Second Half pools are enabled. Status starts at <span class="text-gray-300">setup</span> — players can't register yet. Advance to <span class="text-green-400">active</span> once you're ready to open registration.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Open Registration</p>
				<p class="text-sm text-gray-400">Advance the season to <span class="text-green-400">active</span> from the <a href="/admin/seasons" class="text-[#c9a84c] hover:underline">Seasons</a> page. Players can now request entries from their dashboard. To add entries manually, go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and click <span class="text-gray-300">+ Add Entries</span> — a 3-step modal walks through player selection, entry configuration, and a review screen before creating.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Enter Week 1 Odds <span class="ml-1 text-xs font-normal text-red-400">required before first deadline</span></p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add all Week 1 matchups with spreads. Mark each game <span class="text-green-400">active</span>. The scheduled function derives the auto-pick team (biggest favorite) directly from active odds at lock time — if no active odds exist, no auto-picks fire.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Confirm Entries &amp; Payments</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees. Mark entries paid once collected. Use <span class="text-gray-300">+ Add Entries</span> to add players manually via the 3-step modal — select player, configure entry (season, pool type, count, name), then review before creating. Only <span class="text-green-400">active</span> entries receive picks. New entries are blocked after the first pick deadline.</p>
			</div>
		</div>
	</div>
	{:else}
	<!-- Pool Admin: condensed pre-season note -->
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<div class="mb-4 flex items-center gap-3">
			<span class="rounded-full border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] px-3 py-0.5 text-xs font-semibold text-[#c9a84c]">Phase 1</span>
			<h2 class="text-lg font-bold text-white">Before the Season</h2>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Enter Week 1 Odds <span class="ml-1 text-xs font-normal text-red-400">required before first deadline</span></p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add all Week 1 matchups with spreads. Mark each game <span class="text-green-400">active</span>. The scheduled function derives the auto-pick team (biggest favorite) directly from active odds at lock time — if no active odds exist, no auto-picks fire.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Confirm Entries &amp; Payments</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees. Mark entries paid once collected. Use <span class="text-gray-300">+ Add Entries</span> to add players manually via the 3-step modal — select player, configure entry (season, pool type, count, name), then review before creating. Only <span class="text-green-400">active</span> entries receive picks. New entries are blocked after the first pick deadline.</p>
			</div>
		</div>
	</div>
	{/if}

	<!-- Phase 2: Weekly management — both roles -->
	<div class="rounded-xl border border-green-900/60 bg-black/75 p-6 backdrop-blur-sm">
		<div class="mb-1 flex items-center gap-3">
			<span class="rounded-full border border-green-700 bg-green-950/40 px-3 py-0.5 text-xs font-semibold text-green-400">{isSuperAdmin ? 'Phase 2' : 'Phase 1'}</span>
			<h2 class="text-lg font-bold text-white">Weekly Management</h2>
			<span class="text-xs text-gray-600">— repeats every week of the season</span>
		</div>
		<p class="mb-4 text-sm text-gray-500">Two tasks per week: keep odds current before the deadline, enter results after games finish. Everything else is automated.</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">1 · Update Odds <span class="ml-1 text-xs font-normal text-red-400">before the pick deadline</span></p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add or update that week's matchups, spreads, and moneylines. Mark games <span class="text-green-400">active</span>. The <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> week card shows a warning badge if no active odds are set — that means no auto-picks will fire at lock time. The LMS auto-pick badge shows which team will be assigned and whether it's a <span class="text-gray-400">preview</span> (can still change) or <span class="text-[#c9a84c]">locked in</span> (already committed by the scheduler).</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">2 · Enter Results <span class="ml-1 text-xs font-normal text-gray-500">after games finish</span></p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a> and set each game's outcome — <span class="text-blue-400">Away Win</span>, <span class="text-green-400">Home Win</span>, or <span class="text-gray-400">Tie</span>. Hit <span class="text-gray-300">Save Results</span> to record them and process eliminations. The week advances to <span class="text-orange-300">results pending</span> then <span class="text-green-300">complete</span> automatically.</p>
			</div>
		</div>

		<!-- Auto-pick callout -->
		<div class="mt-3 rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-4 py-3">
			<p class="mb-1 text-sm font-semibold text-[#c9a84c]">How auto-pick works</p>
			<p class="text-sm text-gray-400">At the pick deadline the scheduled function locks the week, scans all <span class="text-gray-300">active</span> game odds, and selects the team with the largest spread (biggest favorite) as the LMS auto-pick. It assigns that team to every active entry that hasn't submitted a pick. The Second Half auto-pick uses the biggest underdog. <strong class="font-semibold text-gray-300">Odds must be entered and marked active before the deadline</strong> — if none exist, no auto-picks fire and those entries go without a pick for the week.</p>
		</div>
	</div>

	<!-- ── Super Admin only: Exception — pick override ───────────────────── -->
	{#if isSuperAdmin}
	<div class="rounded-xl border border-yellow-900/60 bg-black/75 p-6 backdrop-blur-sm">
		<div class="mb-4 flex items-center gap-3">
			<span class="rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-0.5 text-xs font-semibold text-yellow-400">Exception</span>
			<h2 class="text-lg font-bold text-white">Updating a Pick After the Deadline</h2>
			<span class="rounded border border-[rgba(201,168,76,0.3)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c9a84c]">Super Admin</span>
		</div>
		<p class="mb-4 text-sm text-gray-400">
			Once a week is locked, players cannot change their picks. If a player contacts you with a legitimate reason — wrong team selected, technical issue before kickoff — you have two options depending on timing.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Option A — Reopen the Week <span class="ml-1 text-xs font-normal text-gray-500">(before games start)</span></p>
				<ol class="mt-2 flex flex-col gap-1.5 text-sm text-gray-400">
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">1.</span>Go to <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> and click <span class="text-gray-300">↩ Unlock</span> on the locked week card to set it back to <span class="text-green-400">open</span>.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">2.</span>Tell the player to log in and update their pick from their dashboard.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">3.</span>Return to Season Settings and click <span class="text-gray-300">→ Lock Week</span> immediately after.</li>
				</ol>
				<p class="mt-3 text-xs text-yellow-600">⚠ Only do this before any games have kicked off. Reopening after kickoff gives the player an unfair advantage.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Option B — Edit Directly in PocketBase <span class="ml-1 text-xs font-normal text-gray-500">(any time)</span></p>
				<ol class="mt-2 flex flex-col gap-1.5 text-sm text-gray-400">
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">1.</span>Open the PocketBase admin UI — your <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">PUBLIC_POCKETBASE_URL</code> with <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">/_/</code> appended — and log in as superuser.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">2.</span>Go to the <span class="text-gray-300">picks</span> collection and find the record by entry name or week.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">3.</span>Update the <span class="text-gray-300">pickedTeams</span> relation field to the correct team(s) and save.</li>
				</ol>
				<p class="mt-3 text-xs text-gray-600">This bypasses all app-level deadline checks. Use it only when Option A isn't viable — e.g. games are already underway and you need to correct a data error.</p>
			</div>
		</div>
		<div class="mt-3 rounded-lg border border-gray-800 bg-black px-4 py-3 text-sm text-gray-400">
			<p class="mb-1 text-sm font-semibold text-white">What to document</p>
			Whenever you override a pick, note it somewhere — a group chat message, email, or the entry's notes field. If another player questions the change later, you'll have a record of when the request came in and why it was granted.
		</div>
	</div>
	{/if}

	<!-- Quick reference checklist — both roles -->
	<div class="rounded-xl border border-gray-800 bg-black/75 p-6 backdrop-blur-sm">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Weekly Checklist</h2>
		<ol class="flex flex-col gap-2 text-sm text-gray-400">
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Early week</span>
				<span>Add or update matchups and spreads in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>. Mark games active. The odds warning badge on the week card disappears once active odds are set.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Before deadline</span>
				<span>Check <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — confirm the LMS auto-pick badge shows the expected team. The scheduled function locks the week and fires auto-picks automatically at the deadline.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">After games</span>
				<span>Enter game outcomes (W/L/T) in <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a>. Save Results to eliminate entries — the week advances to <span class="text-orange-300">results pending</span> then <span class="text-green-300">complete</span> automatically.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Entries</span>
				<span>Process outstanding payments in <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a>. New entries are blocked after the first pick deadline — use status changes to manage late situations.</span>
			</li>
		</ol>
	</div>

</div>
