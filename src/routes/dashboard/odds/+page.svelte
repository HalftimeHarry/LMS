<script lang="ts">
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const season = $derived((data as any).season as any);
	const week   = $derived((data as any).week   as any);
	const games  = $derived((data as any).games  as any[]);

	function fmtGameTime(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}

	function spreadDisplay(val: number | null): string {
		if (val == null) return '—';
		if (val === 0) return 'PK';
		return val > 0 ? `+${val}` : `${val}`;
	}

	function mlDisplay(val: number | null): string {
		if (val == null) return '—';
		return val > 0 ? `+${val}` : `${val}`;
	}
</script>

<svelte:head>
	<title>Latest Odds — Week {week?.week ?? '—'}</title>
</svelte:head>

<div class="mx-auto max-w-2xl">

	<!-- Back -->
	<div class="mb-6">
		<a href="/dashboard" class="text-sm text-gray-500 hover:text-[#c9a84c]">← Dashboard</a>
	</div>

	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">

		<!-- Header -->
		<div class="border-b border-gray-800 px-6 py-5">
			<h1 class="text-xl font-bold text-white">Latest Odds</h1>
			{#if week}
				<p class="mt-1 text-sm text-gray-400">
					Week {week.week} · {season?.name ?? '—'}
				</p>
			{/if}
		</div>

		{#if !week || games.length === 0}
			<div class="px-6 py-12 text-center">
				<p class="text-gray-500">No odds available yet. Check back closer to game time.</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-800/60">
				{#each games as game}
					{@const home     = game.expand?.homeTeam}
					{@const away     = game.expand?.awayTeam}
					{@const hSpread  = game.homeSpread  ?? null}
					{@const hML      = game.homeMoneyline ?? null}
					{@const aML      = game.awayMoneyline ?? null}
					{@const homeFav  = hSpread != null && hSpread < 0}
					{@const awayFav  = hSpread != null && hSpread > 0}
					{@const homeSpreadVal = hSpread != null ? hSpread : null}
					{@const awaySpreadVal = hSpread != null ? -hSpread : null}

					<div class="px-4 py-4">
						<!-- Game time + notes -->
						<div class="mb-3 flex items-center justify-between gap-2">
							<span class="text-xs text-gray-500">{fmtGameTime(game.gameTime)}</span>
							{#if game.notes}
								<span class="text-xs text-gray-600 italic">{game.notes}</span>
							{/if}
						</div>

						<!-- Teams -->
						<div class="flex flex-col gap-2">
							<!-- Away team -->
							<div class="flex items-center gap-3">
								<img
									src={teamLogoUrl(away?.abbreviation)}
									alt={away?.abbreviation}
									class="h-8 w-8 shrink-0 object-contain {awayFav ? '' : 'opacity-50'}"
								/>
								<div class="flex flex-1 items-center justify-between gap-2">
									<span class="text-sm font-medium {awayFav ? 'text-white' : 'text-gray-400'}">
										{away?.city} {away?.name}
										<span class="ml-1 text-xs text-gray-500">({away?.abbreviation})</span>
									</span>
									<div class="flex items-center gap-4 text-right">
										<span class="w-12 text-sm font-semibold {awayFav ? 'text-[#c9a84c]' : 'text-gray-500'}">
											{spreadDisplay(awaySpreadVal)}
										</span>
										<span class="w-14 text-sm text-gray-400">{mlDisplay(aML)}</span>
									</div>
								</div>
							</div>

							<!-- Home team -->
							<div class="flex items-center gap-3">
								<img
									src={teamLogoUrl(home?.abbreviation)}
									alt={home?.abbreviation}
									class="h-8 w-8 shrink-0 object-contain {homeFav ? '' : 'opacity-50'}"
								/>
								<div class="flex flex-1 items-center justify-between gap-2">
									<span class="text-sm font-medium {homeFav ? 'text-white' : 'text-gray-400'}">
										{home?.city} {home?.name}
										<span class="ml-1 text-xs text-gray-500">({home?.abbreviation}) · Home</span>
									</span>
									<div class="flex items-center gap-4 text-right">
										<span class="w-12 text-sm font-semibold {homeFav ? 'text-[#c9a84c]' : 'text-gray-500'}">
											{spreadDisplay(homeSpreadVal)}
										</span>
										<span class="w-14 text-sm text-gray-400">{mlDisplay(hML)}</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Column labels (first game only) -->
					</div>
				{/each}
			</div>

			<!-- Legend -->
			<div class="border-t border-gray-800 px-6 py-3 flex items-center gap-6">
				<span class="text-xs text-gray-600">Spread · Moneyline</span>
				<span class="text-xs text-gray-600">Favorite shown in <span class="text-[#c9a84c]">gold</span></span>
			</div>
		{/if}

	</div>
</div>
