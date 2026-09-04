<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDeadlineLong } from '$lib/time';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const teams        = data.teams        as any[];
	const existingPick = data.existingPick as any;
	const entry        = data.entry        as any;
	const week         = data.week         as any;
	const season       = data.season       as any;

	const isLms         = $derived(entry?.entryType === 'lms');
	const picksRequired = $derived(data.picksRequired as number);

	// Pre-select teams from an existing pick
	let selectedTeamIds = $state<string[]>(
		existingPick?.expand?.pickedTeams?.map((t: any) => t.id) ?? []
	);

	function toggleTeam(id: string) {
		if (selectedTeamIds.includes(id)) {
			selectedTeamIds = selectedTeamIds.filter((t) => t !== id);
		} else if (selectedTeamIds.length < picksRequired) {
			selectedTeamIds = [...selectedTeamIds, id];
		}
	}

	const canSubmit = $derived(selectedTeamIds.length === picksRequired);

	// Group teams by conference + division for display
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

	let loading = $state(false);
</script>

<svelte:head><title>Make Pick — LMS Pool</title></svelte:head>

<div class="mx-auto max-w-3xl">

	<!-- Header -->
	<div class="mb-6 flex items-center gap-3">
		<a href="/dashboard" class="text-sm text-gray-500 hover:text-[#c9a84c]">← Dashboard</a>
		<h1 class="text-2xl font-bold text-white">Make Your Pick</h1>
	</div>

	<!-- Entry + week context -->
	<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="font-semibold text-white">{entry?.entryName}</p>
				<p class="text-sm text-gray-400">{season?.name} · Week {week?.week}</p>
			</div>
			<div class="flex items-center gap-2">
				<span class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-3 py-1 text-sm font-medium text-[#c9a84c]">
					{isLms ? 'LMS — Pick the Loser' : 'Second Half — Pick the Winner'}
				</span>
				{#if picksRequired > 1}
					<span class="rounded border border-blue-800 bg-blue-950/60 px-3 py-1 text-sm text-blue-400">
						{picksRequired} picks required
					</span>
				{/if}
			</div>
		</div>

		{#if week}
			<p class="mt-3 text-xs text-gray-500">
				Deadline: {formatDeadlineLong(week.deadline)}
			</p>
		{/if}
	</div>

	{#if !week}
		<!-- No open week -->
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
			<p class="text-lg font-semibold text-white">No open week right now</p>
			<p class="mt-2 text-sm text-gray-400">Check back when the next week opens.</p>
			<a href="/dashboard" class="mt-6 inline-block rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a]">
				Back to Dashboard
			</a>
		</div>

	{:else}

		{#if form?.error}
			<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">
				{form.error}
			</div>
		{/if}

		<!-- Instruction banner -->
		<div class="mb-5 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 text-sm text-gray-300">
			{#if isLms}
				Select <strong class="text-white">1 team</strong> you think will <strong class="text-red-400">lose</strong> this week.
				Your pick is private until the deadline passes.
			{:else}
				Select <strong class="text-white">{picksRequired} team{picksRequired > 1 ? 's' : ''}</strong> you think will <strong class="text-green-400">win</strong> this week.
				Your pick{picksRequired > 1 ? 's are' : ' is'} private until the deadline passes.
			{/if}
		</div>

		<!-- Selection counter -->
		<div class="mb-4 flex items-center gap-2">
			<span class="text-sm text-gray-400">
				{selectedTeamIds.length} / {picksRequired} selected
			</span>
			{#if selectedTeamIds.length > 0}
				<button
					type="button"
					onclick={() => selectedTeamIds = []}
					class="text-xs text-gray-600 hover:text-gray-400"
				>Clear</button>
			{/if}
		</div>

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => { await update(); loading = false; };
			}}
		>
			<input type="hidden" name="entryId"   value={entry?.id} />
			<input type="hidden" name="weekId"    value={week?.id} />
			<input type="hidden" name="entryType" value={entry?.entryType} />
			{#each selectedTeamIds as id}
				<input type="hidden" name="teamIds" value={id} />
			{/each}

			<!-- Team grid grouped by conference / division -->
			{#each conferences as conf}
				<div class="mb-6">
					<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">{conf}</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						{#each divisions as div}
							{@const divTeams = grouped()[conf]?.[div] ?? []}
							{#if divTeams.length > 0}
								<div class="rounded-lg border border-gray-800 bg-black/50 p-3">
									<p class="mb-2 text-xs font-medium text-gray-500">{conf} {div}</p>
									<div class="flex flex-col gap-1.5">
										{#each divTeams as team}
											{@const selected = selectedTeamIds.includes(team.id)}
											{@const disabled = !selected && selectedTeamIds.length >= picksRequired}
											<button
												type="button"
												onclick={() => toggleTeam(team.id)}
												disabled={disabled}
												class="flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition
													{selected
														? isLms
															? 'border-red-600 bg-red-950/40 text-white'
															: 'border-green-600 bg-green-950/40 text-white'
														: disabled
															? 'cursor-not-allowed border-gray-800 text-gray-600'
															: 'border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-900/60'}"
											>
												<span class="w-8 shrink-0 text-center text-xs font-bold
													{selected ? (isLms ? 'text-red-400' : 'text-green-400') : 'text-gray-500'}">
													{team.abbreviation}
												</span>
												<span>{team.city} {team.name}</span>
												{#if selected}
													<span class="ml-auto text-xs {isLms ? 'text-red-400' : 'text-green-400'}">
														{isLms ? '✗ Lose' : '✓ Win'}
													</span>
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

			<!-- Submit -->
			<div class="sticky bottom-4 mt-6 flex items-center gap-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/90 p-4 backdrop-blur-sm">
				{#if selectedTeamIds.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each selectedTeamIds as id}
							{@const t = (teams as Team[]).find((x) => x.id === id)}
							{#if t}
								<span class="rounded border px-2 py-0.5 text-xs font-medium
									{isLms ? 'border-red-800 bg-red-950/60 text-red-400' : 'border-green-800 bg-green-950/60 text-green-400'}">
									{t.abbreviation} — {isLms ? 'Lose' : 'Win'}
								</span>
							{/if}
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-500">No team selected yet.</p>
				{/if}
				<button
					type="submit"
					disabled={!canSubmit || loading}
					class="ml-auto shrink-0 rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-40"
				>
					{loading ? 'Saving…' : existingPick ? 'Update Pick' : 'Submit Pick'}
				</button>
			</div>
		</form>

	{/if}
</div>
