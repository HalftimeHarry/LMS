<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import InfoTip from '$lib/components/InfoTip.svelte';

	let { data }: { data: PageData } = $props();

	let deleteConfirmId = $state<string | null>(null);

	const statusColors: Record<string, string> = {
		setup:    'bg-gray-800 text-gray-400 border-gray-700',
		open:     'bg-blue-950/60 text-blue-400 border-blue-800',
		active:   'bg-green-950/60 text-green-400 border-green-800',
		complete: 'bg-gray-900 text-gray-500 border-gray-700',
	};

	const nextStatus: Record<string, string> = {
		setup:    'open',
		open:     'active',
		active:   'complete',
		complete: 'complete',
	};
</script>

<svelte:head><title>Seasons — Admin</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold text-white">Seasons</h1>
		<p class="mt-1 text-sm text-gray-500">Each season runs one full NFL year. A season moves through four stages: <span class="text-gray-300">setup → open → active → complete</span>. Players can register once a season is open.</p>
	</div>
	<a
		href="/admin/seasons/new"
		class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]"
	>+ New Season</a>
</div>

{#if data.seasons.length === 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">No seasons yet.</p>
		<a href="/admin/seasons/new" class="mt-3 inline-block text-sm text-[#c9a84c] hover:underline">
			Create the first season →
		</a>
	</div>
{:else}
	<div class="flex flex-col gap-4">
		{#each data.seasons as season}
			<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 class="text-lg font-semibold text-white">{season.name}</h2>
						<p class="mt-0.5 text-sm text-gray-400">
							{season.year} · Entry fee: <span class="text-white">${season.entryFee}</span>
							{#if season.regularSeasonOnly}
								· <span class="text-gray-500">Regular season only</span>
							{/if}
						</p>
						{#if season.paymentDeadline}
							<p class="mt-1 text-xs text-gray-500">
								Payment deadline: {new Date(season.paymentDeadline).toLocaleDateString()}
							</p>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<div class="flex items-center gap-1.5">
							<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[season.status] ?? 'bg-gray-800 text-gray-400'}">
								{season.status}
							</span>
							<InfoTip text="setup — not visible to players yet. open — registration live, players can sign up. active — picks are being collected each week. complete — season has ended." />
						</div>

						<!-- Advance status -->
						{#if season.status !== 'complete'}
							<div class="flex items-center gap-1.5">
								<form method="POST" action="?/setStatus" use:enhance>
									<input type="hidden" name="id" value={season.id} />
									<input type="hidden" name="status" value={nextStatus[season.status]} />
									<button
										type="submit"
										class="rounded border border-[rgba(201,168,76,0.4)] px-3 py-1 text-xs text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.1)]"
									>→ {nextStatus[season.status]}</button>
								</form>
								<InfoTip text="Move this season to the next stage. Make sure weeks and entry fees are configured before advancing to open." />
							</div>
						{/if}

						<a
							href="/admin/weeks?season={season.id}"
							class="rounded border border-gray-700 px-3 py-1 text-xs text-gray-300 transition hover:bg-gray-800"
						>Season Settings</a>

						<!-- Delete — [TEST] seasons only, full cascade -->
						{#if season.name?.includes('[TEST]')}
							{#if deleteConfirmId === season.id}
								<div class="flex items-center gap-1">
									<form method="POST" action="?/delete" use:enhance={() => { deleteConfirmId = null; }}>
										<input type="hidden" name="id" value={season.id} />
										<button type="submit"
											class="rounded border border-red-500 bg-red-950/40 px-3 py-1 text-xs text-red-400 transition hover:bg-red-900/60"
										>Confirm</button>
									</form>
									<button type="button" onclick={() => deleteConfirmId = null}
										class="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-800"
									>Cancel</button>
								</div>
							{:else}
								<button type="button" onclick={() => deleteConfirmId = season.id}
									class="rounded border border-red-900 px-3 py-1 text-xs text-red-500 transition hover:bg-red-950/40"
								>Delete season</button>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
