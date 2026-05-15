<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const entry         = $derived(data.entry         as any);
	const season        = $derived(data.season        as any);
	const openWeeks     = $derived(data.openWeeks     as any[]);
	const teams         = $derived(data.teams         as any[]);
	const pickByWeek    = $derived(data.pickByWeek    as Record<string, any>);
	const usedByWeek    = $derived(data.usedByWeek    as Record<string, string[]>);
	const picksRequired = $derived(data.picksRequired as number);

	const isLms     = $derived(entry?.entryType === 'lms');

	// All weeks collapsed by default; user opens each one individually
	let expandedWeeks = $state<Set<string>>(new Set());
	let loadingWeek   = $state<string | null>(null);

	function toggleWeek(weekId: string) {
		const next = new Set(expandedWeeks);
		if (next.has(weekId)) next.delete(weekId);
		else next.add(weekId);
		expandedWeeks = next;
	}

	// Per-week selected team state — keyed by weekId
	// Initialised from existing picks; re-syncs when data reloads
	let selections = $state<Record<string, string[]>>({});

	$effect(() => {
		const next: Record<string, string[]> = {};
		for (const week of openWeeks) {
			const pick = pickByWeek[week.id];
			next[week.id] = pick?.expand?.pickedTeams?.map((t: any) => t.id) ?? [];
		}
		selections = next;
	});

	function toggleTeam(weekId: string, teamId: string) {
		const cur = selections[weekId] ?? [];
		if (cur.includes(teamId)) {
			selections = { ...selections, [weekId]: cur.filter((t) => t !== teamId) };
		} else if (picksRequired === 1) {
			selections = { ...selections, [weekId]: [teamId] };
		} else if (cur.length < picksRequired) {
			selections = { ...selections, [weekId]: [...cur, teamId] };
		}
	}

	// Group teams by conference + division (computed once — teams list is static)
	const conferences = ['AFC', 'NFC'];
	const divisions   = ['East', 'North', 'South', 'West'];

	type Team = { id: string; abbreviation: string; name: string; city: string; conference: string; division: string };

	const grouped = $derived(() => {
		const map: Record<string, Record<string, Team[]>> = {};
		for (const t of teams as Team[]) {
			if (!map[t.conference]) map[t.conference] = {};
			if (!map[t.conference][t.division]) map[t.conference][t.division] = [];
			map[t.conference][t.division].push(t);
		}
		return map;
	});

	const statusColors: Record<string, string> = {
		pending_payment: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		active:          'bg-green-950/60 text-green-400 border-green-800',
		eliminated:      'bg-red-950/60 text-red-400 border-red-800',
		winner:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	function formatDeadline(d: string) {
		return new Date(d).toLocaleString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}
</script>

<svelte:head><title>{entry?.entryName ?? 'Entry'} — LMS Pool</title></svelte:head>

<div class="mx-auto max-w-2xl">

	<!-- Back -->
	<div class="mb-6">
		<a href="/dashboard" class="text-sm text-gray-500 hover:text-[#c9a84c]">← Dashboard</a>
	</div>

	<!-- Entry header -->
	<div class="mb-8 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-white">{entry?.entryName}</h1>
				<p class="mt-1 text-sm text-gray-400">{season?.name ?? '—'}</p>
				{#if entry?.status === 'eliminated' && entry?.eliminatedWeek}
					<p class="mt-2 text-sm text-red-400">
						Eliminated week {entry.eliminatedWeek}
						{#if entry.eliminatedReason} — {entry.eliminatedReason}{/if}
					</p>
				{/if}
			</div>
			<div class="flex flex-col items-end gap-2">
				<span class="rounded border px-3 py-1 text-sm font-medium {statusColors[entry?.status] ?? ''}">
					{entry?.status?.replace('_', ' ')}
				</span>
				{#if entry?.paid}
					<span class="text-xs text-green-400">✅ Paid</span>
				{:else}
					<span class="text-xs text-gray-500">Payment pending</span>
				{/if}
			</div>
		</div>
	</div>

	{#if openWeeks.length === 0}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-10 text-center backdrop-blur-sm">
			<p class="text-gray-400">No open weeks right now. Check back soon.</p>
		</div>
	{:else}

		<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-lg font-bold text-white">
					{isLms ? 'Pick the Loser' : 'Pick the Winner'}
				</h2>
				<span class="text-sm font-semibold text-[#c9a84c]">
					{Object.values(pickByWeek).length} / {openWeeks.length} picked
				</span>
			</div>
			<p class="mt-2 text-sm text-gray-400">
				{openWeeks.length} weeks open. Picks are private until each week's deadline passes.
				You can change any pick before its deadline.
			</p>
		</div>

		{#if form?.error}
			<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">
				{form.error}
			</div>
		{/if}

		<!-- Week cards -->
		<div class="flex flex-col gap-3">
			{#each openWeeks as week (week.id)}
				{@const pick          = pickByWeek[week.id]}
				{@const sel           = selections[week.id] ?? []}
				{@const hasPick       = !!pick}
				{@const canSubmit     = sel.length === picksRequired}
				{@const pickedTeams   = pick?.expand?.pickedTeams ?? []}

				<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

					<!-- Week header — click to expand/collapse -->
					<button
						type="button"
						onclick={() => toggleWeek(week.id)}
						class="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/5"
					>
						<div>
							<p class="font-semibold text-white">Week {week.week}</p>
							<p class="mt-0.5 text-xs text-gray-500">Deadline: {formatDeadline(week.deadline)}</p>
						</div>
						<div class="flex items-center gap-3">
							{#if hasPick}
								<span class="text-sm text-gray-300">
									{pickedTeams.map((t: any) => t.abbreviation).join(', ')}
									<span class="ml-1 text-xs {isLms ? 'text-red-400' : 'text-green-400'}">
										{isLms ? '✗ Lose' : '✓ Win'}
									</span>
								</span>
								<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">Picked</span>
							{:else}
								<span class="rounded border border-yellow-800 bg-yellow-950/60 px-2 py-0.5 text-xs text-yellow-400">No pick</span>
							{/if}
							<span class="text-gray-600">{expandedWeeks.has(week.id) ? '▲' : '▼'}</span>
						</div>
					</button>

					<!-- Team picker — only shown when expanded -->
					{#if expandedWeeks.has(week.id)}
					<div class="border-t border-gray-800 px-5 pb-5 pt-4">

						<!-- Instruction -->
						<p class="mb-4 text-xs text-gray-500">
							{#if isLms}
								Select <strong class="text-gray-300">1 team</strong> you think will <strong class="text-red-400">lose</strong>.
							{:else}
								Select <strong class="text-gray-300">{picksRequired} team{picksRequired > 1 ? 's' : ''}</strong> you think will <strong class="text-green-400">win</strong>.
							{/if}
						</p>

						<form
							method="POST"
							use:enhance={() => {
								loadingWeek = week.id;
								return async ({ update }) => { await update(); loadingWeek = null; };
							}}
						>
							<input type="hidden" name="entryId"   value={entry?.id} />
							<input type="hidden" name="weekId"    value={week.id} />
							<input type="hidden" name="entryType" value={entry?.entryType} />
							{#each sel as id}
								<input type="hidden" name="teamIds" value={id} />
							{/each}

							<!-- Team grid -->
							{#each conferences as conf}
								<div class="mb-4">
									<p class="mb-2 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">{conf}</p>
									<div class="grid gap-3 sm:grid-cols-2">
										{#each divisions as div}
											{@const divTeams = grouped()[conf]?.[div] ?? []}
											{#if divTeams.length > 0}
												<div class="rounded-lg border border-gray-800 bg-black/50 p-2.5">
													<p class="mb-1.5 text-xs text-gray-600">{conf} {div}</p>
													<div class="flex flex-col gap-1">
														{#each divTeams as team}
															{@const selected   = sel.includes(team.id)}
															{@const usedOther  = (usedByWeek[week.id] ?? []).includes(team.id)}
															{@const limitFull  = !selected && !isLms && sel.length >= picksRequired}
															{@const disabled   = usedOther || limitFull}
															<button
																type="button"
																onclick={() => toggleTeam(week.id, team.id)}
																disabled={disabled}
																title={usedOther ? 'Already picked in another week' : undefined}
																class="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-sm transition
																	{selected
																		? isLms
																			? 'border-red-600 bg-red-950/40 text-white'
																			: 'border-green-600 bg-green-950/40 text-white'
																		: usedOther
																			? 'cursor-not-allowed border-gray-800 bg-gray-900/20 text-gray-700 line-through'
																			: limitFull
																				? 'cursor-not-allowed border-gray-800 text-gray-600'
																				: 'border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-900/60'}"
															>
																<span class="w-7 shrink-0 text-center text-xs font-bold
																	{selected ? (isLms ? 'text-red-400' : 'text-green-400') : usedOther ? 'text-gray-700' : 'text-gray-500'}">
																	{team.abbreviation}
																</span>
																<span class="text-xs">{team.city} {team.name}</span>
																{#if selected}
																	<span class="ml-auto text-xs {isLms ? 'text-red-400' : 'text-green-400'}">
																		{isLms ? '✗' : '✓'}
																	</span>
																{:else if usedOther}
																	<span class="ml-auto text-xs text-gray-700">used</span>
																{/if}
															</button>
														{/each}
													</div>
												</div>
											{/if}
										{/each}
									</div>
								</div>
							{/each}

							<!-- Submit row -->
							<div class="mt-3 flex items-center justify-between gap-3">
								<span class="text-xs text-gray-500">
									{#if sel.length > 0}
										{sel.map(id => (teams as Team[]).find(t => t.id === id)?.abbreviation ?? id).join(', ')}
										<span class="{isLms ? 'text-red-400' : 'text-green-400'}">
											— {isLms ? 'Lose' : 'Win'}
										</span>
									{:else}
										No team selected
									{/if}
								</span>
								<button
									type="submit"
									disabled={!canSubmit || loadingWeek === week.id}
									class="shrink-0 rounded bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40"
								>
									{loadingWeek === week.id ? 'Saving…' : hasPick ? 'Update Pick' : 'Submit Pick'}
								</button>
							</div>
						</form>
					</div>
					{/if}

				</div>
			{/each}
		</div>


	{/if}

</div>
