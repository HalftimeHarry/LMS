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
			<span class="font-semibold text-gray-300">What's automated:</span> The scheduled function runs every 2 minutes and handles the weekly lifecycle —
			locking the week at the deadline, assigning auto-picks to entries that missed the deadline,
			and advancing weeks through <span class="text-orange-300">results_pending</span> → <span class="text-green-300">complete</span>.
			Your two recurring jobs are: <span class="text-white">keep odds current</span> before each deadline, and <span class="text-white">enter game results</span> after games finish.
		</div>
	</div>

	<!-- Super Admin only: Phase 1 — Season Setup -->
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
				<p class="text-sm text-gray-400">Go to <a href="/admin/seasons/new" class="text-[#c9a84c] hover:underline">Seasons → New Season</a>. Set entry fees, the first pick deadline, and whether LMS and/or Second Half pools are enabled. Status starts at <span class="text-gray-300">setup</span> — players can't register yet. Advance to <span class="text-green-400">active</span> once you're ready to open registration.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Open Registration</p>
				<p class="text-sm text-gray-400">Advance the season to <span class="text-green-400">active</span> from the <a href="/admin/seasons" class="text-[#c9a84c] hover:underline">Seasons</a> page. Players can now request entries from their dashboard. To add entries manually, go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and click <span class="text-gray-300">+ Add Entries</span> — a 3-step modal walks through player selection, entry configuration, and a review screen before creating.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Enter Week 1 Odds <span class="ml-1 text-xs font-normal text-red-400">required before first deadline</span></p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add all Week 1 matchups with spreads and moneylines. Click <span class="text-gray-300">Set as LMS auto-pick</span> on the biggest-favorite suggestion card, then click <span class="text-gray-300">Activate Week</span> to make odds live. The scheduled function reads active odds at lock time to assign auto-picks — if no active odds exist, no auto-picks fire.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Confirm Entries &amp; Payments</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees. Mark entries paid once collected. Only <span class="text-green-400">active</span> entries receive picks. New entries are blocked after the first pick deadline.</p>
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
				<p class="text-sm text-gray-400">Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add all Week 1 matchups with spreads and moneylines. Click <span class="text-gray-300">Set as LMS auto-pick</span> on the biggest-favorite suggestion card, then click <span class="text-gray-300">Activate Week</span> to make odds live. The scheduled function reads active odds at lock time to assign auto-picks — if no active odds exist, no auto-picks fire.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Confirm Entries &amp; Payments</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees. Mark entries paid once collected. Only <span class="text-green-400">active</span> entries receive picks. New entries are blocked after the first pick deadline.</p>
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

			<!-- Task 1: Odds -->
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">
					1 · Update Odds
					<span class="ml-1 text-xs font-normal text-red-400">by Thu ~10 AM PT (or Sun ~10 AM PT for all-Sunday slates)</span>
				</p>
				<p class="mb-3 text-sm text-gray-400">
					Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add or update that week's matchups, spreads, and moneylines.
					The pick deadline is <span class="text-gray-300">20 minutes before the first kickoff of the week</span>.
				</p>
				<ol class="flex flex-col gap-1.5 text-sm text-gray-400">
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">1.</span>Enter all matchups with spreads and moneylines. Hit <span class="text-gray-300">Save Odds</span>.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">2.</span>Click <span class="text-[#c9a84c]">Set as LMS auto-pick</span> on the biggest-favorite card (most negative spread). From week 6 onward, also click <span class="text-blue-400">Set as 2nd Half auto-pick</span> on the longest-shot card (most positive spread).</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">3.</span>Click <span class="text-green-400">Activate Week</span> to make odds live. The green dot on the week nav confirms activation.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">4.</span>Check <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — the LMS auto-pick badge should show the expected team. A <span class="text-yellow-400">⚠ No active odds</span> warning means auto-picks will not fire at lock time.</li>
				</ol>
			</div>

			<!-- Task 2: Results -->
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">
					2 · Enter Results
					<span class="ml-1 text-xs font-normal text-gray-500">Sunday evening / Monday morning</span>
				</p>
				<p class="mb-3 text-sm text-gray-400">
					Go to <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a>. The page auto-selects the current locked week.
					Each game row has a three-way toggle: <span class="text-blue-400">Away Win</span> · <span class="text-green-400">Home Win</span> · <span class="text-gray-400">Tie</span>.
				</p>
				<ol class="flex flex-col gap-1.5 text-sm text-gray-400">
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">1.</span>Select the outcome for each game. A <span class="text-[#c9a84c]">saved</span> label appears on games already recorded.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">2.</span>Use <span class="text-blue-400">💾 Save Draft</span> as games finish throughout the day — fires eliminations and updates the live standings panel on the right, but keeps the week at <span class="text-yellow-400">locked</span> so you can keep editing.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">3.</span>Once all games are final, click <span class="text-[#c9a84c]">Save &amp; Finalize</span>. This fires a final elimination pass and advances the week to <span class="text-orange-300">results_pending</span>.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">4.</span>Review the entry status panels on the right — confirm eliminations look correct. Then click <span class="text-green-400">✓ Mark Week Complete</span> to close the week.</li>
				</ol>
				<p class="mt-3 text-xs text-gray-600">Made a mistake? Click <span class="text-red-400">Reset Results</span> to delete all outcomes, reinstate eliminated entries, and return the week to <span class="text-yellow-400">locked</span>. You can re-enter from scratch.</p>
			</div>
		</div>

		<!-- Elimination rules -->
		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-4 py-3">
				<p class="mb-2 text-sm font-semibold text-[#c9a84c]">LMS elimination rule</p>
				<p class="text-sm text-gray-400">
					LMS players pick a team they expect to <span class="text-white font-medium">lose</span>.
					If their picked team <span class="text-red-400">wins</span>, they're eliminated.
					A <span class="text-gray-300">tie</span> is safe — no eliminations fire on a tied game.
				</p>
			</div>
			<div class="rounded-lg border border-blue-900/40 bg-blue-950/10 px-4 py-3">
				<p class="mb-2 text-sm font-semibold text-blue-400">2nd Half elimination rule</p>
				<p class="text-sm text-gray-400">
					2H players pick a team they expect to <span class="text-white font-medium">win</span>.
					If their picked team <span class="text-red-400">loses</span>, they're eliminated.
					<span class="mt-1 block">Weeks 6–9: 1 pick/week. Weeks 10–18: 2 picks/week — losing <span class="text-white">either</span> pick eliminates the entry.</span>
					A <span class="text-gray-300">tie</span> is safe for both picks.
				</p>
			</div>
		</div>

		<!-- Auto-pick callout -->
		<div class="mt-3 rounded-lg border border-gray-800 bg-black/60 px-4 py-3">
			<p class="mb-1 text-sm font-semibold text-gray-300">How auto-pick works</p>
			<p class="text-sm text-gray-400">
				At the pick deadline the scheduled function locks the week and assigns picks to every active entry that hasn't submitted one.
				<span class="text-white">LMS auto-pick</span> = the team with the largest spread (biggest favorite, most negative number).
				<span class="text-blue-300">2H auto-pick</span> = the team with the largest positive spread (biggest underdog).
				Both must be set via <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> before the deadline — if not set, those entries go without a pick for the week.
			</p>
		</div>
	</div>

	<!-- Super Admin only: Exception — pick override -->
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

	<!-- Weekly checklist -->
	<div class="rounded-xl border border-gray-800 bg-black/75 p-6 backdrop-blur-sm">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Weekly Checklist</h2>
		<ol class="flex flex-col gap-3 text-sm text-gray-400">
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Mon–Wed</span>
				<span>Add or update matchups and spreads in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>. Set the LMS auto-pick (and 2H auto-pick from week 6 onward). Click <span class="text-green-400">Activate Week</span>. The odds warning badge on the week card disappears once active odds are set.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Thu ~10 AM PT</span>
				<span>Pick deadline fires for weeks with a Thursday game. Check <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — confirm the auto-pick badge shows the expected team. The scheduler locks the week and fires auto-picks automatically.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Sun ~10 AM PT</span>
				<span>Pick deadline fires for all-Sunday slates. Same check as above.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Sun evening</span>
				<span>As games finish, use <span class="text-blue-400">Save Draft</span> in <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a> to enter outcomes and watch eliminations update live. Once all games are final, click <span class="text-[#c9a84c]">Save &amp; Finalize</span> then <span class="text-green-400">Mark Week Complete</span>.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Mon morning</span>
				<span>Process outstanding payments in <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a>. Start entering next week's odds.</span>
			</li>
		</ol>

		<!-- Week status reference -->
		<div class="mt-5 border-t border-gray-800 pt-4">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">Week status reference</p>
			<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-lg border border-gray-800 bg-black px-3 py-2">
					<span class="text-xs font-semibold text-green-400">open</span>
					<p class="mt-0.5 text-xs text-gray-500">Players can submit and change picks. Odds can be updated.</p>
				</div>
				<div class="rounded-lg border border-gray-800 bg-black px-3 py-2">
					<span class="text-xs font-semibold text-yellow-400">locked</span>
					<p class="mt-0.5 text-xs text-gray-500">Deadline passed. Auto-picks assigned. No player changes. Results can now be entered.</p>
				</div>
				<div class="rounded-lg border border-gray-800 bg-black px-3 py-2">
					<span class="text-xs font-semibold text-orange-300">results_pending</span>
					<p class="mt-0.5 text-xs text-gray-500">Results saved and finalized. Eliminations fired. Standings visible. Awaiting admin sign-off.</p>
				</div>
				<div class="rounded-lg border border-gray-800 bg-black px-3 py-2">
					<span class="text-xs font-semibold text-gray-400">complete</span>
					<p class="mt-0.5 text-xs text-gray-500">Week closed. No further changes expected.</p>
				</div>
			</div>
		</div>
	</div>

</div>
