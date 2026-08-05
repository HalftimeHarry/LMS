<script lang="ts">
	import type { LayoutData } from '../$types';
	let { data }: { data: LayoutData } = $props();
	const isSuperAdmin = $derived(data.role === 'super_admin');

	type Tab = 'overview' | 'before' | 'weekly' | 'checklist' | 'spam';
	let activeTab = $state<Tab>('overview');

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'overview',  label: 'Overview' },
		{ id: 'before',    label: 'Before the Season' },
		{ id: 'weekly',    label: 'Weekly Management' },
		{ id: 'checklist', label: 'Checklist' },
		{ id: 'spam',      label: 'Manage Participant Spammers' },
	];
</script>

<svelte:head><title>Admin Duties — Admin</title></svelte:head>

<div class="flex flex-col gap-6">

	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<h1 class="text-2xl font-bold text-white">Admin Duties</h1>
		<p class="mt-1 text-sm text-gray-500">What to do and when — from season setup through the final week.</p>
	</div>

	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
		<div class="flex overflow-x-auto border-b border-gray-800">
			{#each tabs as tab}
				<button
					type="button"
					onclick={() => activeTab = tab.id}
					class="shrink-0 px-6 py-3.5 text-sm font-medium transition border-b-2 -mb-px
						{activeTab === tab.id
							? 'border-[#c9a84c] text-[#c9a84c]'
							: 'border-transparent text-gray-500 hover:text-gray-300'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<div class="p-6 max-w-3xl">

			{#if activeTab === 'overview'}
			<div class="flex flex-col gap-6">
				<div>
					<h2 class="text-lg font-bold text-white">How the season runs</h2>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						The scheduled function runs every 2 minutes and handles the weekly lifecycle automatically —
						locking the week at the pick deadline, assigning auto-picks to entries that missed the deadline,
						and advancing weeks through their status progression.
						Your two recurring jobs each week are: <span class="text-white font-medium">keep odds current</span> before each deadline,
						and <span class="text-white font-medium">enter game results</span> after games finish.
					</p>
				</div>

				<div class="rounded-lg border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.05)] px-5 py-4">
					<h3 class="text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Deadline Truth Source and Troubleshooting</h3>
					<p class="mt-2 text-sm leading-relaxed text-gray-300">
						If a countdown clock, lock time, or registration cutoff looks wrong, treat this section as the source of truth.
					</p>
					<div class="mt-4 space-y-3 text-sm text-gray-400">
						<p>
							<span class="font-semibold text-white">1) What controls cutoffs:</span>
							The <span class="text-gray-300">first active kickoff in game odds</span> for that week,
							then <span class="text-gray-300">minus 30 minutes</span>.
						</p>
						<p>
							<span class="font-semibold text-white">2) LMS cutoff:</span>
							Week 1 first kickoff minus 30 minutes.
							<span class="text-gray-300">Example:</span> 5:20 PM PT kickoff => 4:50 PM PT cutoff.
						</p>
						<p>
							<span class="font-semibold text-white">3) 2nd Half cutoff:</span>
							Second-half start week first kickoff (normally Week 6) minus 30 minutes.
						</p>
						<p>
							<span class="font-semibold text-white">4) Why mismatches happen:</span>
							When a kickoff timestamp in odds is wrong (timezone or UTC conversion), every downstream clock and cutoff will be wrong by the same amount.
						</p>
						<p>
							<span class="font-semibold text-white">5) What to verify first:</span>
							In <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>, confirm the week is active and the earliest game time is correct.
							Then check <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> to confirm the displayed deadline lines up with kickoff minus 30 minutes.
						</p>
						<p>
							<span class="font-semibold text-white">6) Lock behavior:</span>
							At deadline, the scheduler marks the week <span class="text-yellow-400">locked</span> and auto-picks missing entries.
							If odds are missing or inactive, auto-picks do not fire.
						</p>
						<p>
							<span class="font-semibold text-white">7) Emergency fix path:</span>
							If kickoff data is wrong, correct odds first in
							<a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>, then confirm in
							<a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> that the displayed deadline recalculates to kickoff minus 30 minutes.
							If already locked and a correction is needed, follow the override process in the Weekly Management tab and document the exception.
						</p>
					</div>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Week status progression</h3>
					<div class="flex flex-col gap-2">
						<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-4 py-3">
							<span class="mt-0.5 w-32 shrink-0 text-xs font-semibold text-green-400">open</span>
							<p class="text-sm text-gray-400">Players can submit and change picks. Odds can be updated. This is the default state when a week is created.</p>
						</div>
						<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-4 py-3">
							<span class="mt-0.5 w-32 shrink-0 text-xs font-semibold text-yellow-400">locked</span>
							<p class="text-sm text-gray-400">The pick deadline has passed. The scheduler locked the week and assigned auto-picks to entries that hadn't submitted. No player changes allowed. You can now enter results.</p>
						</div>
						<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-4 py-3">
							<span class="mt-0.5 w-32 shrink-0 text-xs font-semibold text-orange-300">results_pending</span>
							<p class="text-sm text-gray-400">Results have been saved and finalized. Eliminations have fired. Standings are visible to all players. Awaiting your final sign-off.</p>
						</div>
						<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-4 py-3">
							<span class="mt-0.5 w-32 shrink-0 text-xs font-semibold text-gray-400">complete</span>
							<p class="text-sm text-gray-400">Week is closed. No further changes expected. The next open week becomes the active week.</p>
						</div>
					</div>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Elimination rules</h3>
					<div class="flex flex-col gap-3">
						<div class="rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-5 py-4">
							<p class="mb-1 text-sm font-semibold text-[#c9a84c]">LMS Pool</p>
							<p class="text-sm leading-relaxed text-gray-400">
								Players pick a team they expect to <span class="font-medium text-white">lose</span> its game outright.
								If their picked team <span class="text-red-400">wins</span>, they are eliminated.
								A <span class="text-gray-300">tie</span> is safe — no eliminations fire on a tied game.
								Each team can only be used once per entry per season.
							</p>
						</div>
						<div class="rounded-lg border border-blue-900/40 bg-blue-950/10 px-5 py-4">
							<p class="mb-1 text-sm font-semibold text-blue-400">2nd Half Pool</p>
							<p class="text-sm leading-relaxed text-gray-400">
								Players pick a team they expect to <span class="font-medium text-white">win</span> its game outright.
								If their picked team <span class="text-red-400">loses</span>, they are eliminated.
								A <span class="text-gray-300">tie</span> is safe.
							</p>
							<p class="mt-2 text-sm leading-relaxed text-gray-400">
								<span class="font-medium text-white">Weeks 6–9:</span> 1 pick per week.
								<span class="font-medium text-white">Weeks 10–18:</span> 2 picks per week — losing <span class="text-white">either</span> pick eliminates the entry.
							</p>
						</div>
					</div>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Auto-pick</h3>
					<p class="text-sm leading-relaxed text-gray-400">
						At the pick deadline the scheduler assigns picks to every active entry that hasn't submitted one.
					</p>
					<ul class="mt-3 flex flex-col gap-2 text-sm text-gray-400">
						<li class="flex gap-3"><span class="shrink-0 font-medium text-[#c9a84c]">LMS auto-pick</span> The team with the largest spread (biggest favorite — most negative number). Set this in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> before the deadline.</li>
						<li class="flex gap-3"><span class="shrink-0 font-medium text-blue-400">2H auto-pick</span> The team with the largest positive spread (biggest underdog). Also set in Manage Odds from week 6 onward.</li>
					</ul>
					<p class="mt-3 text-sm text-gray-500">If neither auto-pick is set before the deadline, those entries go without a pick for the week.</p>
				</div>
			</div>
			{:else if activeTab === 'before'}
			<div class="flex flex-col gap-8">
				{#if isSuperAdmin}
				<div>
					<h2 class="text-lg font-bold text-white">Create the Season</h2>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Go to <a href="/admin/seasons/new" class="text-[#c9a84c] hover:underline">Seasons → New Season</a> and fill in the season name, year, entry fees for both pools, and whether LMS and/or Second Half pools are enabled.
						The season starts in <span class="text-gray-300">setup</span> status — players cannot register yet.
						Once you're ready to open registration, advance it to <span class="text-green-400">active</span>.
					</p>
				</div>

				<div>
					<h2 class="text-lg font-bold text-white">Open Registration</h2>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Advance the season to <span class="text-green-400">active</span> from the <a href="/admin/seasons" class="text-[#c9a84c] hover:underline">Seasons</a> page.
						Players can now request entries from their dashboard.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-gray-400">
						To add entries manually, go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and click <span class="text-gray-300">+ Add Entries</span>.
						A 3-step modal walks through player selection, entry configuration (LMS, 2H, or both), and a review screen before creating.
					</p>
				</div>
				{/if}

				<div>
					<h2 class="text-lg font-bold text-white">Enter Week 1 Odds <span class="ml-2 text-sm font-normal text-red-400">required before the first deadline</span></h2>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add all Week 1 matchups with spreads and moneylines.
						The pick deadline is <span class="text-gray-300">30 minutes before the first kickoff of the week</span>.
						The scheduler reads active odds at lock time to assign auto-picks — if no active odds exist, no auto-picks fire.
					</p>
					<ol class="mt-4 flex flex-col gap-3 text-sm text-gray-400">
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">1.</span>Enter all matchups. Hit <span class="text-gray-300">Save</span> on each row.</li>
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">2.</span>Click <span class="text-[#c9a84c]">Set as LMS auto-pick</span> on the biggest-favorite card (most negative spread).</li>
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">3.</span>Click <span class="text-green-400">Activate Week</span> to make odds live. The green dot on the week nav confirms activation.</li>
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">4.</span>Check <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — the LMS auto-pick badge should show the expected team. A <span class="text-yellow-400">⚠ No active odds</span> warning means auto-picks will not fire.</li>
					</ol>
				</div>

				<div>
					<h2 class="text-lg font-bold text-white">Confirm Entries &amp; Payments</h2>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a> and filter by <span class="text-yellow-400">Pending Payment</span> to process outstanding fees.
						Mark entries paid once collected.
						Only <span class="text-green-400">active</span> entries receive picks.
						New entries are blocked after the first pick deadline.
					</p>
				</div>
			</div>
			{:else if activeTab === 'weekly'}
			<div class="flex flex-col gap-10">

				<div class="rounded-lg border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.05)] px-5 py-4">
					<h3 class="text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Deadline Truth Source and Troubleshooting</h3>
					<p class="mt-2 text-sm leading-relaxed text-gray-300">
						Use this before each lock if a countdown, deadline, or status looks off.
					</p>
					<div class="mt-4 space-y-3 text-sm text-gray-400">
						<p>
							<span class="font-semibold text-white">1) Cutoff source:</span>
							Earliest active kickoff in odds for that week, then minus 30 minutes.
						</p>
						<p>
							<span class="font-semibold text-white">2) LMS rule:</span>
							Week 1 first kickoff minus 30 minutes.
						</p>
						<p>
							<span class="font-semibold text-white">3) 2nd Half rule:</span>
							Start-week first kickoff (normally Week 6) minus 30 minutes.
						</p>
						<p>
							<span class="font-semibold text-white">4) Common mismatch cause:</span>
							Wrong kickoff timestamp or timezone conversion in odds data.
						</p>
						<p>
							<span class="font-semibold text-white">5) Verify order:</span>
							Check earliest kickoff in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>,
							then confirm the week deadline in <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a>.
						</p>
						<p>
							<span class="font-semibold text-white">6) Lock behavior:</span>
							At deadline the scheduler locks the week and auto-picks missing entries.
							No active odds means no auto-picks.
						</p>
						<p>
							<span class="font-semibold text-white">7) Emergency fix:</span>
							Correct odds first in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>, then verify in
							<a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> that the displayed deadline recalculates to kickoff minus 30 minutes before kickoff.
							If locked already, follow override steps and document the exception.
						</p>
					</div>
				</div>

				<!-- Task 1: Odds -->
				<div>
					<div class="mb-1 flex items-center gap-3">
						<span class="rounded-full bg-[rgba(201,168,76,0.15)] px-3 py-0.5 text-xs font-semibold text-[#c9a84c]">Task 1</span>
						<h2 class="text-lg font-bold text-white">Update Odds</h2>
						<span class="text-xs text-red-400">by Thu ~10 AM PT · or Sun ~10 AM PT for all-Sunday slates</span>
					</div>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add or update that week's matchups, spreads, and moneylines.
						The pick deadline fires <span class="text-gray-300">30 minutes before the first kickoff of the week</span>.
						For a Thursday night opener that's roughly 10:00 AM PT. For an all-Sunday slate it's roughly 10:00 AM PT Sunday.
					</p>
					<ol class="mt-4 flex flex-col gap-3 text-sm text-gray-400">
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">1.</span>Enter all matchups with spreads and moneylines. Hit <span class="text-gray-300">Save</span> on each row individually.</li>
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">2.</span>Click <span class="text-[#c9a84c]">Set as LMS auto-pick</span> on the biggest-favorite card (most negative spread). From week 6 onward, also click <span class="text-blue-400">Set as 2nd Half auto-pick</span> on the longest-shot card (most positive spread).</li>
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">3.</span>Click <span class="text-green-400">Activate Week</span> to make odds live.</li>
						<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">4.</span>Verify in <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — the auto-pick badge should show the expected team. A <span class="text-yellow-400">⚠ No active odds</span> warning means auto-picks will not fire at lock time.</li>
					</ol>
				</div>

				<div class="border-t border-gray-800"></div>

				<!-- Task 2: Results -->
				<div>
					<div class="mb-1 flex items-center gap-3">
						<span class="rounded-full bg-green-950/40 border border-green-800 px-3 py-0.5 text-xs font-semibold text-green-400">Task 2</span>
						<h2 class="text-lg font-bold text-white">Enter Results</h2>
						<span class="text-xs text-gray-500">Sunday evening / Monday morning</span>
					</div>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Go to <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a>.
						The page auto-selects the current locked week.
						Each game row has a three-way toggle: <span class="text-blue-400">Away Win</span> · <span class="text-green-400">Home Win</span> · <span class="text-gray-400">Tie</span>.
					</p>
					<ol class="mt-4 flex flex-col gap-3 text-sm text-gray-400">
						<li class="flex gap-3">
							<span class="shrink-0 font-mono text-gray-600">1.</span>
							Select the outcome for each game as they finish. A <span class="text-[#c9a84c]">saved</span> label appears on games already recorded.
						</li>
						<li class="flex gap-3">
							<span class="shrink-0 font-mono text-gray-600">2.</span>
							Click <span class="text-blue-400">💾 Save Draft</span> as games finish throughout the day.
							This fires eliminations immediately and updates the live standings panel on the right,
							but keeps the week at <span class="text-yellow-400">locked</span> so you can keep editing as more games finish.
						</li>
						<li class="flex gap-3">
							<span class="shrink-0 font-mono text-gray-600">3.</span>
							Once all games are final, click <span class="text-[#c9a84c]">Save &amp; Finalize</span>.
							This fires a final elimination pass and advances the week to <span class="text-orange-300">results_pending</span>.
						</li>
						<li class="flex gap-3">
							<span class="shrink-0 font-mono text-gray-600">4.</span>
							Review the entry status panels on the right — confirm eliminations look correct.
							Then click <span class="text-green-400">✓ Mark Week Complete</span> to close the week.
						</li>
					</ol>
					<div class="mt-4 rounded-lg border border-gray-800 bg-black px-4 py-3 text-sm text-gray-500">
						Made a mistake? Click <span class="text-red-400">Reset Results</span> to delete all outcomes, reinstate eliminated entries, and return the week to <span class="text-yellow-400">locked</span>. You can then re-enter from scratch.
					</div>
				</div>

				{#if isSuperAdmin}
				<div class="border-t border-gray-800"></div>

				<!-- Exception: pick override -->
				<div>
					<div class="mb-1 flex items-center gap-3">
						<span class="rounded-full bg-yellow-950/40 border border-yellow-800 px-3 py-0.5 text-xs font-semibold text-yellow-400">Exception</span>
						<h2 class="text-lg font-bold text-white">Updating a Pick After the Deadline</h2>
					</div>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						Once a week is locked, players cannot change their picks.
						If a player contacts you with a legitimate reason — wrong team selected, technical issue before kickoff — you have two options.
					</p>

					<div class="mt-4 flex flex-col gap-4">
						<div>
							<p class="text-sm font-semibold text-white">Option A — Reopen the Week <span class="ml-1 text-xs font-normal text-gray-500">(before games start)</span></p>
							<ol class="mt-2 flex flex-col gap-2 text-sm text-gray-400">
								<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">1.</span>Go to <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> and click <span class="text-gray-300">↩ Unlock</span> on the locked week card to set it back to <span class="text-green-400">open</span>.</li>
								<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">2.</span>Tell the player to log in and update their pick from their dashboard.</li>
								<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">3.</span>Return to Season Settings and click <span class="text-gray-300">→ Lock Week</span> immediately after.</li>
							</ol>
							<p class="mt-2 text-xs text-yellow-600">⚠ Only do this before any games have kicked off. Reopening after kickoff gives the player an unfair advantage.</p>
						</div>

						<div>
							<p class="text-sm font-semibold text-white">Option B — Edit Directly in PocketBase <span class="ml-1 text-xs font-normal text-gray-500">(any time)</span></p>
							<ol class="mt-2 flex flex-col gap-2 text-sm text-gray-400">
								<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">1.</span>Open the PocketBase admin UI — your <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">PUBLIC_POCKETBASE_URL</code> with <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">/_/</code> appended — and log in as superuser.</li>
								<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">2.</span>Go to the <span class="text-gray-300">picks</span> collection and find the record by entry name or week.</li>
								<li class="flex gap-3"><span class="shrink-0 font-mono text-gray-600">3.</span>Update the <span class="text-gray-300">pickedTeams</span> relation field to the correct team(s) and save.</li>
							</ol>
							<p class="mt-2 text-xs text-gray-600">This bypasses all app-level deadline checks. Use it only when Option A isn't viable — e.g. games are already underway and you need to correct a data error.</p>
						</div>

						<div class="rounded-lg border border-gray-800 bg-black px-4 py-3 text-sm text-gray-400">
							<span class="font-semibold text-white">Document every override.</span>
							Note it in a group chat, email, or the entry's notes field. If another player questions the change later, you'll have a record of when the request came in and why it was granted.
						</div>
					</div>
				</div>
				{/if}

			</div>
			{:else if activeTab === 'checklist'}
			<div class="flex flex-col gap-6">
				<p class="text-sm text-gray-500">Your recurring schedule each week of the season.</p>

				<div class="flex flex-col gap-3">
					<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-5 py-4">
						<span class="mt-0.5 w-28 shrink-0 rounded bg-gray-800 px-2 py-1 text-center font-mono text-xs text-gray-400">Mon – Wed</span>
						<div class="text-sm text-gray-400">
							Add or update matchups and spreads in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a>.
							Set the LMS auto-pick (and 2H auto-pick from week 6 onward).
							Click <span class="text-green-400">Activate Week</span>.
							The odds warning badge on the week card disappears once active odds are set.
						</div>
					</div>

					<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-5 py-4">
						<span class="mt-0.5 w-28 shrink-0 rounded bg-gray-800 px-2 py-1 text-center font-mono text-xs text-gray-400">Thu ~10 AM PT</span>
						<div class="text-sm text-gray-400">
							Pick deadline fires for weeks with a Thursday game.
							Check <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — confirm the auto-pick badge shows the expected team.
							The scheduler locks the week and fires auto-picks automatically.
						</div>
					</div>

					<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-5 py-4">
						<span class="mt-0.5 w-28 shrink-0 rounded bg-gray-800 px-2 py-1 text-center font-mono text-xs text-gray-400">Sun ~10 AM PT</span>
						<div class="text-sm text-gray-400">
							Pick deadline fires for all-Sunday slates. Same check as above.
						</div>
					</div>

					<div class="flex items-start gap-4 rounded-lg border border-green-900/40 bg-green-950/5 px-5 py-4">
						<span class="mt-0.5 w-28 shrink-0 rounded bg-gray-800 px-2 py-1 text-center font-mono text-xs text-gray-400">Sun evening</span>
						<div class="text-sm text-gray-400">
							As games finish, use <span class="text-blue-400">Save Draft</span> in <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a> to enter outcomes and watch eliminations update live.
							Once all games are final, click <span class="text-[#c9a84c]">Save &amp; Finalize</span> then <span class="text-green-400">Mark Week Complete</span>.
						</div>
					</div>

					<div class="flex items-start gap-4 rounded-lg border border-gray-800 bg-black px-5 py-4">
						<span class="mt-0.5 w-28 shrink-0 rounded bg-gray-800 px-2 py-1 text-center font-mono text-xs text-gray-400">Mon morning</span>
						<div class="text-sm text-gray-400">
							Process outstanding payments in <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries &amp; Payments</a>.
							Start entering next week's odds.
						</div>
					</div>
				</div>

				<div class="rounded-lg border border-gray-800 bg-black/60 px-5 py-4 text-sm text-gray-500">
					<span class="font-semibold text-gray-300">Monday Night / Thursday Night games</span> — if a week has a Monday Night game, wait until that game finishes before clicking Save &amp; Finalize.
					Thursday Night games belong to the <span class="text-white">following</span> week's slate, not the current one.
				</div>
			</div>
			{/if}

			<!-- ── Manage Participant Spammers ──────────────────────────────── -->
			{#if activeTab === 'spam'}
			<div class="space-y-5 p-6">

				<div>
					<h2 class="text-lg font-bold text-white">Dealing with Spam Registrations</h2>
					<p class="mt-1 text-sm text-gray-400">
						If the pool gets hit with fake or spam accounts, use the
						<a href="/admin/participants" class="text-[#c9a84c] hover:underline">Participants</a>
						page to identify and remove them quickly.
					</p>
				</div>

				<!-- How to spot spammers -->
				<div class="rounded-lg border border-gray-800 bg-black/60 px-5 py-4 space-y-3">
					<h3 class="text-sm font-semibold text-white">How to spot spam accounts</h3>
					<ul class="space-y-2 text-sm text-gray-400">
						<li class="flex gap-2">
							<span class="shrink-0 text-[#c9a84c]">—</span>
							<span><span class="text-gray-300">Unverified email</span> — the Verified column shows a dash. Legitimate players usually verify before picking.</span>
						</li>
						<li class="flex gap-2">
							<span class="shrink-0 text-[#c9a84c]">—</span>
							<span><span class="text-gray-300">0 entries</span> — registered but never joined a pool. Real players create at least one entry.</span>
						</li>
						<li class="flex gap-2">
							<span class="shrink-0 text-[#c9a84c]">—</span>
							<span><span class="text-gray-300">Suspicious display name or email</span> — random strings, disposable email domains (mailinator, guerrillamail, etc.).</span>
						</li>
						<li class="flex gap-2">
							<span class="shrink-0 text-[#c9a84c]">—</span>
							<span><span class="text-gray-300">Cluster of registrations</span> — multiple accounts created within seconds of each other on the same day.</span>
						</li>
					</ul>
				</div>

				<!-- Step by step -->
				<div class="rounded-lg border border-gray-800 bg-black/60 px-5 py-4 space-y-3">
					<h3 class="text-sm font-semibold text-white">Removing spammers — step by step</h3>
					<ol class="space-y-3 text-sm text-gray-400 list-none">
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-300">1</span>
							<span>Go to <a href="/admin/participants" class="text-[#c9a84c] hover:underline">Admin → Participants</a>. Use the search box to filter by name or email.</span>
						</li>
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-300">2</span>
							<span>For a single spammer, click the <span class="text-gray-300">Delete</span> button on their row.</span>
						</li>
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-300">3</span>
							<span>For a batch, check the boxes next to each suspect account, then click <span class="text-gray-300">Delete N selected</span> at the top.</span>
						</li>
						<li class="flex gap-3">
							<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-300">4</span>
							<span>A confirmation dialog will list every account being deleted and warn that <span class="text-red-400">this cannot be undone</span>. Review the names carefully before confirming.</span>
						</li>
					</ol>
				</div>

				<!-- Warning -->
				<div class="rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-5 py-4 text-sm text-yellow-600 space-y-1">
					<p class="font-semibold text-yellow-400">⚠️ Deleting a participant is permanent</p>
					<p>Their account, all pool entries, and all pick history are removed immediately. Only delete accounts you are certain are spam — if in doubt, contact the player first.</p>
				</div>

				<!-- Prevention tip -->
				<div class="rounded-lg border border-gray-800 bg-black/60 px-5 py-4 text-sm text-gray-500">
					<span class="font-semibold text-gray-300">Prevention</span> — consider requiring email verification before a player can create entries. This stops most bots at registration without any manual cleanup.
				</div>

			</div>
			{/if}

		</div>
	</div>

</div>
