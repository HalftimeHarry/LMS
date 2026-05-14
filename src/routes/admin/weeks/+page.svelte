<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const statusColors: Record<string, string> = {
		open:            'bg-blue-950/60 text-blue-400 border-blue-800',
		locked:          'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		results_pending: 'bg-orange-950/60 text-orange-400 border-orange-800',
		complete:        'bg-gray-900 text-gray-500 border-gray-700',
	};

	const nextStatus: Record<string, { value: string; label: string }> = {
		open:            { value: 'locked',          label: 'Lock' },
		locked:          { value: 'results_pending', label: 'Results Pending' },
		results_pending: { value: 'complete',        label: 'Complete' },
		complete:        { value: 'complete',        label: 'Complete' },
	};

	// Favorite team selection per row
	let favoriteTeam: Record<string, string> = $state(
		Object.fromEntries(data.weeks.map((w: { id: string; biggestFavoriteTeam: string }) => [w.id, w.biggestFavoriteTeam ?? '']))
	);

	let createLoading = $state(false);

	function switchSeason(id: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('season', id);
		goto(`?${params.toString()}`, { replaceState: true });
	}

	// Default deadline: next Thursday 3pm PST
	function nextThursday(): string {
		const now = new Date();
		const day = now.getDay(); // 0=Sun … 4=Thu
		const daysUntilThursday = (4 - day + 7) % 7 || 7;
		const thu = new Date(now);
		thu.setDate(now.getDate() + daysUntilThursday);
		thu.setHours(15, 0, 0, 0);
		// Format for datetime-local input
		return thu.toISOString().slice(0, 16);
	}
</script>

<svelte:head><title>Weekly Settings — Admin</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-2xl font-bold text-white">Weekly Settings</h1>
	<!-- Season switcher -->
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

{#if !data.activeSeason}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">No seasons found. <a href="/admin/seasons/new" class="text-[#c9a84c] hover:underline">Create one first.</a></p>
	</div>
{:else}

	<!-- Create week form -->
	<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Add Week</h2>

		{#if form?.error}
			<p class="mb-3 rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">{form.error}</p>
		{/if}

		<form
			method="POST"
			action="?/createWeek"
			use:enhance={() => {
				createLoading = true;
				return async ({ update }) => { await update(); createLoading = false; };
			}}
			class="flex flex-wrap items-end gap-3"
		>
			<input type="hidden" name="seasonId" value={data.activeSeason.id} />

			<div class="flex flex-col gap-1">
				<label for="week" class="text-xs text-gray-400">Week #</label>
				<input id="week" name="week" type="number" min="1" max="18" required placeholder="1"
					class="w-20 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<div class="flex flex-col gap-1">
				<label for="deadline" class="text-xs text-gray-400">Deadline (PST)</label>
				<input id="deadline" name="deadline" type="datetime-local" required value={nextThursday()}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<div class="flex flex-col gap-1">
				<label for="notes" class="text-xs text-gray-400">Notes</label>
				<input id="notes" name="notes" type="text" placeholder="Optional"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<button type="submit" disabled={createLoading}
				class="rounded bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{createLoading ? 'Adding…' : '+ Add Week'}
			</button>
		</form>
	</div>

	<!-- Weeks list -->
	{#if data.weeks.length === 0}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-10 text-center backdrop-blur-sm">
			<p class="text-gray-400">No weeks set up yet for {data.activeSeason.name}.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each data.weeks as week}
				<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<!-- Week info -->
						<div>
							<p class="font-semibold text-white">Week {week.week}</p>
							<p class="mt-0.5 text-sm text-gray-400">
								Deadline: {new Date(week.deadline).toLocaleString('en-US', {
									weekday: 'short', month: 'short', day: 'numeric',
									hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
								})}
							</p>
							{#if week.expand?.biggestFavoriteTeam}
								<p class="mt-1 text-xs text-[#c9a84c]">
									Auto-pick: {week.expand.biggestFavoriteTeam.city} {week.expand.biggestFavoriteTeam.name}
								</p>
							{/if}
							{#if week.notes}
								<p class="mt-1 text-xs text-gray-500">{week.notes}</p>
							{/if}
						</div>

						<!-- Actions -->
						<div class="flex flex-wrap items-center gap-2">
							<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[week.status] ?? ''}">
								{week.status.replace('_', ' ')}
							</span>

							<!-- Advance status -->
							{#if week.status !== 'complete'}
								<form method="POST" action="?/setStatus" use:enhance>
									<input type="hidden" name="id" value={week.id} />
									<input type="hidden" name="status" value={nextStatus[week.status].value} />
									<button type="submit"
										class="rounded border border-[rgba(201,168,76,0.4)] px-3 py-1 text-xs text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.1)]">
										→ {nextStatus[week.status].label}
									</button>
								</form>
							{/if}

							<!-- Set biggest favourite -->
							<form method="POST" action="?/setFavorite" use:enhance class="flex items-center gap-1">
								<input type="hidden" name="id" value={week.id} />
								<select
									name="teamId"
									bind:value={favoriteTeam[week.id]}
									class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-[#c9a84c] focus:outline-none"
								>
									<option value="">Auto-pick team…</option>
									{#each data.teams as team}
										<option value={team.id}>{team.abbreviation} — {team.city} {team.name}</option>
									{/each}
								</select>
								<button type="submit"
									class="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-800">
									Set
								</button>
							</form>

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
