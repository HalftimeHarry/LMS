<svelte:head><title>Admin Duties — Admin</title></svelte:head>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-white">Admin Duties</h1>
	<p class="mt-1 text-sm text-gray-500">What to do and when — from season setup through the final week.</p>
</div>

<!-- Phase cards -->
<div class="flex flex-col gap-6">

	<!-- Phase 1: Before the season -->
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-gray-950 p-6">
		<div class="mb-4 flex items-center gap-3">
			<span class="rounded-full border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] px-3 py-0.5 text-xs font-semibold text-[#c9a84c]">Phase 1</span>
			<h2 class="text-lg font-bold text-white">Before the Season</h2>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Create the Season</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/seasons/new" class="text-[#c9a84c] hover:underline">Seasons → New Season</a>. Set the entry fees, registration deadline, and pick deadline. Status starts at <span class="text-gray-300">setup</span> — players can't register yet.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Configure Week 1</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a>. Set the Week 1 pick deadline. Leave status as <span class="text-gray-300">open</span> so players can submit picks once the season opens.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Open Registration</p>
				<p class="text-sm text-gray-400">Advance the season status to <span class="text-green-400">open</span> from the <a href="/admin/seasons" class="text-[#c9a84c] hover:underline">Seasons</a> page. Players can now request entries from their dashboard.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Add NFL Teams & Odds</p>
				<p class="text-sm text-gray-400">Confirm all 32 teams exist under <a href="/admin/teams" class="text-[#c9a84c] hover:underline">NFL Teams</a>. Then add Week 1 matchups and spreads via <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> before the pick deadline.</p>
			</div>
		</div>
	</div>

	<!-- Phase 2: Entry management -->
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-gray-950 p-6">
		<div class="mb-4 flex items-center gap-3">
			<span class="rounded-full border border-blue-700 bg-blue-950/40 px-3 py-0.5 text-xs font-semibold text-blue-400">Phase 2</span>
			<h2 class="text-lg font-bold text-white">Entry Management</h2>
			<span class="text-xs text-gray-600">— happens during registration, before week 1 locks</span>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Review Pending Entries</p>
				<p class="text-sm text-gray-400">Go to <a href="/admin/entries" class="text-[#c9a84c] hover:underline">Entries & Payments</a> and filter by <span class="text-yellow-400">Pending Payment</span>. These players have registered but haven't paid yet.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Collect & Confirm Payment</p>
				<p class="text-sm text-gray-400">Once you've received a player's fee (Venmo, Zelle, cash, etc.), mark their entry as paid. Use <span class="text-gray-300">Bulk Mark Paid</span> to process multiple entries at once.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Activate Entries</p>
				<p class="text-sm text-gray-400">Set paid entries to <span class="text-green-400">active</span> status. Only active entries can submit picks. Do this before the Week 1 pick deadline.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Advance Season to Active</p>
				<p class="text-sm text-gray-400">Once registration closes and entries are confirmed, advance the season to <span class="text-green-400">active</span>. This signals the pool is live and picks are being tracked.</p>
			</div>
		</div>
	</div>

	<!-- Phase 3: Weekly management -->
	<div class="rounded-xl border border-green-900/60 bg-gray-950 p-6">
		<div class="mb-1 flex items-center gap-3">
			<span class="rounded-full border border-green-700 bg-green-950/40 px-3 py-0.5 text-xs font-semibold text-green-400">Phase 3</span>
			<h2 class="text-lg font-bold text-white">Weekly Management</h2>
			<span class="text-xs text-gray-600">— repeats every week of the season</span>
		</div>
		<p class="mb-4 text-sm text-gray-500">This is the bulk of ongoing admin work. Most weeks it comes down to two tasks: keeping odds current and entering results.</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">1 · Update Odds</p>
				<p class="text-sm text-gray-400">Before the pick deadline each week, go to <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> and add or update that week's matchups, spreads, and moneylines. Players use these to make informed picks.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">2 · Lock the Week</p>
				<p class="text-sm text-gray-400">After the pick deadline passes, go to <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a> and lock the week. This prevents any further pick changes and signals that games are underway.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">3 · Enter Win / Loss / Tie</p>
				<p class="text-sm text-gray-400">Once games finish, return to <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a> and set each game's outcome — <span class="text-blue-400">Away Win</span>, <span class="text-green-400">Home Win</span>, or <span class="text-gray-400">Tie</span>. Hit <span class="text-gray-300">Save Results</span> to record them and process eliminations automatically.</p>
			</div>
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">4 · Mark Week Complete</p>
				<p class="text-sm text-gray-400">After all results are saved and eliminations look correct, mark the week complete. Then set up the next week's deadline in <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> and open it for picks.</p>
			</div>
		</div>
	</div>

	<!-- Updating a pick after the deadline -->
	<div class="rounded-xl border border-yellow-900/60 bg-gray-950 p-6">
		<div class="mb-4 flex items-center gap-3">
			<span class="rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-0.5 text-xs font-semibold text-yellow-400">Exception</span>
			<h2 class="text-lg font-bold text-white">Updating a Pick After the Deadline</h2>
		</div>
		<p class="mb-4 text-sm text-gray-400">
			Once a week is locked, players cannot change their picks. If a player contacts you with a legitimate reason — wrong team selected, technical issue before kickoff — you have two options depending on timing.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-gray-800 bg-black px-4 py-3">
				<p class="mb-1 text-sm font-semibold text-white">Option A — Reopen the Week <span class="ml-1 text-xs font-normal text-gray-500">(before games start)</span></p>
				<ol class="mt-2 flex flex-col gap-1.5 text-sm text-gray-400">
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">1.</span>Go to <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> and set the week status back to <span class="text-green-400">open</span>.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">2.</span>Tell the player to log in and update their pick from their dashboard.</li>
					<li class="flex gap-2"><span class="shrink-0 text-gray-600">3.</span>Return to Season Settings and set the week back to <span class="text-yellow-400">locked</span> immediately after.</li>
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

	<!-- Quick reference -->
	<div class="rounded-xl border border-gray-800 bg-gray-950 p-6">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Quick Reference — Weekly Checklist</h2>
		<ol class="flex flex-col gap-2 text-sm text-gray-400">
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Mon</span>
				<span>Open the new week in <a href="/admin/weeks" class="text-[#c9a84c] hover:underline">Season Settings</a> — set the deadline, status → <span class="text-green-400">open</span>.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Wed</span>
				<span>Add or update matchups and spreads in <a href="/admin/odds" class="text-[#c9a84c] hover:underline">Manage Odds</a> as lines move.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Sun AM</span>
				<span>Lock the week in <a href="/admin/results" class="text-[#c9a84c] hover:underline">Results</a> before kickoff.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Sun PM</span>
				<span>Enter game outcomes (W/L/T) as games finish. Save Results to eliminate entries.</span>
			</li>
			<li class="flex items-start gap-3">
				<span class="mt-0.5 shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-500">Mon</span>
				<span>Confirm eliminations look right, then mark the week complete and repeat.</span>
			</li>
		</ol>
	</div>

</div>
