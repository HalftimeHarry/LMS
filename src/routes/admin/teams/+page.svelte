<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	type Team = { id: string; abbreviation: string; name: string; city: string; conference: string; division: string };

	// Group by conference → division
	const grouped = $derived(() => {
		const map: Record<string, Record<string, Team[]>> = {};
		for (const team of data.teams as Team[]) {
			if (!map[team.conference]) map[team.conference] = {};
			if (!map[team.conference][team.division]) map[team.conference][team.division] = [];
			map[team.conference][team.division].push(team);
		}
		return map;
	});

	const conferences = ['AFC', 'NFC'];
	const divisions   = ['East', 'North', 'South', 'West'];

	const confColors: Record<string, string> = {
		AFC: 'text-blue-400',
		NFC: 'text-red-400',
	};
</script>

<svelte:head><title>NFL Teams — Admin</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold text-white">NFL Teams</h1>
	<span class="rounded border border-gray-700 px-3 py-1 text-sm text-gray-400">
		{data.teams.length} teams
	</span>
</div>

{#if data.teams.length === 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="mb-2 text-gray-400">No teams seeded yet.</p>
		<p class="text-sm text-gray-600">
			Run <code class="rounded bg-gray-800 px-2 py-0.5 text-[#c9a84c]">pnpm seed:teams</code> to populate all 32 NFL teams.
		</p>
	</div>
{:else}
	<div class="grid gap-8 lg:grid-cols-2">
		{#each conferences as conf}
			<div>
				<h2 class="mb-4 text-xl font-bold {confColors[conf]}">{conf}</h2>
				<div class="flex flex-col gap-4">
					{#each divisions as div}
						{@const teams = grouped()[conf]?.[div] ?? []}
						{#if teams.length > 0}
							<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
								<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
									{conf} {div}
								</p>
								<div class="flex flex-col gap-2">
									{#each teams as team}
										<div class="flex items-center gap-3">
											<span class="w-10 text-center text-xs font-bold text-[#c9a84c]">
												{team.abbreviation}
											</span>
											<span class="text-sm text-white">
												{team.city} {team.name}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
