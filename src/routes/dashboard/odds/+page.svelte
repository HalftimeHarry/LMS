<script lang="ts">
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const season     = $derived((data as any).season     as any);
	const week       = $derived((data as any).week       as any);
	const games      = $derived((data as any).games      as any[]);
	const isLoggedIn = $derived((data as any).isLoggedIn as boolean);

	function fmtGameTime(iso: string | null | undefined): string {
		if (!iso) return '\u2014';
		return new Date(iso).toLocaleString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}

	function spreadDisplay(val: number | null): string {
		if (val == null) return '\u2014';
		if (val === 0) return 'PK';
		return val > 0 ? `+${val}` : `${val}`;
	}

	function mlDisplay(val: number | null): string {
		if (val == null) return '\u2014';
		return val > 0 ? `+${val}` : `${val}`;
	}
</script>

<svelte:head>
	<title>Latest Odds \u2014 Week {week?.week ?? '\u2014'}</title>
</svelte:head>

<div class="mx-auto max-w-2xl">
<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

	<!-- Back nav / guest CTA -->
	{#if isLoggedIn}
		<div class="border-b border-gray-800/60 px-6 py-3">
			<a href="/dashboard" class="text-sm text-gray-500 hover:text-[#c9a84c]">← Dashboard</a>
		</div>
	{:else}
		<div class="guest-pulse flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(201,168,76,0.15)] px-5 py-3">
			<p class="text-sm text-gray-400">
				<span class="text-[#c9a84c] font-medium">Viewing as guest.</span>
				Sign in to see your picks, submit picks for open weeks, and track your entries.
			</p>
			<div class="flex gap-2">
				<a href="/register"
					class="rounded bg-[#c9a84c] px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-[#e8c96a]">
					Register
				</a>
				<a href="/login"
					class="rounded border border-[#c9a84c] bg-black/80 px-4 py-1.5 text-sm font-semibold text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black">
					Sign In
				</a>
			</div>
		</div>
	{/if}


	<!-- Header -->
	<div class="border-b border-gray-800 px-6 py-5">
		<h1 class="text-xl font-bold text-white">Latest Odds</h1>
		{#if week}
			<p class="mt-1 text-sm text-gray-400">
				Week {week.week} \u00b7 {season?.name ?? '\u2014'}
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
				{@const home          = game.expand?.homeTeam}
				{@const away          = game.expand?.awayTeam}
				{@const hSpread       = game.homeSpread    ?? null}
				{@const hML           = game.homeMoneyline ?? null}
				{@const aML           = game.awayMoneyline ?? null}
				{@const homeFav       = hSpread != null && hSpread < 0}
				{@const awayFav       = hSpread != null && hSpread > 0}
				{@const homeSpreadVal = hSpread != null ? hSpread  : null}
				{@const awaySpreadVal = hSpread != null ? -hSpread : null}

				<div class="px-5 py-4">
					<!-- Game time + notes -->
					<div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-0.5">
						<span class="text-xs font-medium text-gray-400">{fmtGameTime(game.gameTime)}</span>
						{#if game.notes}
							<span class="text-xs text-gray-600 italic">{game.notes}</span>
						{/if}
					</div>

					<!-- Teams: logo | name | spread | ML -->
					<div class="flex flex-col gap-2">
						<!-- Away -->
						<div class="flex items-center gap-3">
							<img src={teamLogoUrl(away?.abbreviation)} alt={away?.abbreviation}
								class="h-9 w-9 shrink-0 object-contain {awayFav ? '' : 'opacity-40'}" />
							<span class="flex-1 text-sm font-medium {awayFav ? 'text-white' : 'text-gray-500'}">
								{away?.city} {away?.name}
								<span class="ml-1 text-xs opacity-50">({away?.abbreviation})</span>
							</span>
							<span class="w-14 text-right text-sm font-semibold tabular-nums {awayFav ? 'text-[#c9a84c]' : 'text-gray-600'}">
								{spreadDisplay(awaySpreadVal)}
							</span>
							<span class="w-14 text-right text-sm tabular-nums text-gray-400">
								{mlDisplay(aML)}
							</span>
						</div>
						<!-- Home -->
						<div class="flex items-center gap-3">
							<img src={teamLogoUrl(home?.abbreviation)} alt={home?.abbreviation}
								class="h-9 w-9 shrink-0 object-contain {homeFav ? '' : 'opacity-40'}" />
							<span class="flex-1 text-sm font-medium {homeFav ? 'text-white' : 'text-gray-500'}">
								{home?.city} {home?.name}
								<span class="ml-1 text-xs opacity-50">({home?.abbreviation})</span>
								<span class="ml-1 text-[10px] text-gray-600">\u00b7 Home</span>
							</span>
							<span class="w-14 text-right text-sm font-semibold tabular-nums {homeFav ? 'text-[#c9a84c]' : 'text-gray-600'}">
								{spreadDisplay(homeSpreadVal)}
							</span>
							<span class="w-14 text-right text-sm tabular-nums text-gray-400">
								{mlDisplay(hML)}
							</span>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Legend -->
		<div class="border-t border-gray-800 px-6 py-3 flex items-center gap-6">
			<span class="text-xs text-gray-600">Spread \u00b7 Moneyline</span>
			<span class="text-xs text-gray-600">Favorite shown in <span class="text-[#c9a84c]">gold</span></span>
		</div>
	{/if}

</div>
</div>
