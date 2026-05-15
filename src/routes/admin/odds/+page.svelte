<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const activeSeason = $derived(data.activeSeason as any);
	const weekNum      = $derived(data.weekNum      as number);
	const games        = $derived(data.games        as any[]);
	const weekSummary  = $derived(data.weekSummary  as any[]);

	// Is the current week fully activated?
	const currentSummary = $derived(weekSummary.find((w: any) => w.week === weekNum));
	const isWeekActive   = $derived((currentSummary?.active ?? 0) === (currentSummary?.total ?? -1) && (currentSummary?.total ?? 0) > 0);
	const hasAnyOdds     = $derived((currentSummary?.hasOdds ?? 0) > 0);

	// Derived: biggest favorite (most negative homeSpread = home favored most)
	// and longest shot (most positive homeSpread = home biggest underdog, or away biggest underdog)
	const activeGames = $derived(games.filter((g: any) => g.isActive && g.homeSpread != null));

	const biggestFavorite = $derived(() => {
		if (!activeGames.length) return null;
		// Most negative homeSpread = home team is biggest favorite
		// Most positive homeSpread = away team is biggest favorite
		let best: any = null;
		let bestSpread = 0;
		for (const g of activeGames) {
			const spread = g.homeSpread as number;
			if (spread < bestSpread) { bestSpread = spread; best = { team: g.expand?.homeTeam, spread, game: g }; }
			if (-spread < bestSpread) { bestSpread = -spread; best = { team: g.expand?.awayTeam, spread: -spread, game: g }; }
		}
		// If no negative spread found, pick the most negative overall
		if (!best) {
			const sorted = [...activeGames].sort((a, b) => a.homeSpread - b.homeSpread);
			const g = sorted[0];
			best = { team: g.expand?.homeTeam, spread: g.homeSpread, game: g };
		}
		return best;
	});

	const longestShot = $derived(() => {
		if (!activeGames.length) return null;
		// Longest shot = biggest underdog = most positive spread
		let best: any = null;
		let bestSpread = -Infinity;
		for (const g of activeGames) {
			const spread = g.homeSpread as number;
			// Away team spread = -homeSpread
			if (-spread > bestSpread) { bestSpread = -spread; best = { team: g.expand?.awayTeam, spread: -spread, game: g }; }
			if (spread > bestSpread)  { bestSpread = spread;  best = { team: g.expand?.homeTeam, spread, game: g }; }
		}
		return best;
	});

	// Week setting for this week (to apply auto-pick)
	const weekSetting = $derived((data as any).weekSetting as any ?? null);

	let savingOdds    = $state(false);
	let activating    = $state(false);
	let applyingLms   = $state(false);
	let applying2h    = $state(false);

	function switchWeek(w: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('week', String(w));
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function spreadLabel(homeSpread: number | null, homeAbbr: string, awayAbbr: string): string {
		if (homeSpread == null) return '—';
		if (homeSpread === 0) return 'PK';
		if (homeSpread < 0) return `${homeAbbr} ${homeSpread}`;
		return `${awayAbbr} -${homeSpread}`;
	}

	function moneylineDisplay(ml: number | null): string {
		if (ml == null) return '';
		return ml > 0 ? `+${ml}` : String(ml);
	}
</script>

<svelte:head><title>Manage Odds — Admin</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-white">Manage Odds</h1>
		{#if activeSeason}
			<p class="mt-1 text-sm text-gray-500">{activeSeason.name}</p>
		{/if}
	</div>
</div>

{#if !activeSeason}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">No active season. <a href="/admin/seasons" class="text-[#c9a84c] hover:underline">Create one first.</a></p>
	</div>
{:else}

	{#if form?.error}
		<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-2 text-sm text-red-400">{form.error}</div>
	{/if}
	{#if (form as any)?.success}
		<div class="mb-4 rounded border border-green-800 bg-green-950/60 px-4 py-2 text-sm text-green-400">
			{(form as any).saved != null ? `Saved odds for ${(form as any).saved} game(s).` : 'Done.'}
		</div>
	{/if}

	<!-- Week nav -->
	<div class="mb-5 overflow-x-auto rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-3 backdrop-blur-sm">
		<div class="flex gap-1.5">
			{#each Array.from({ length: 18 }, (_, i) => i + 1) as w}
				{@const ws = weekSummary.find((s: any) => s.week === w)}
				{@const isActive = ws && ws.active === ws.total && ws.total > 0}
				{@const hasOdds  = ws && ws.hasOdds > 0}
				<button
					type="button"
					onclick={() => switchWeek(w)}
					class="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition
						{w === weekNum
							? 'border-[#c9a84c] bg-[rgba(201,168,76,0.15)] text-[#c9a84c]'
							: 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'}"
				>
					{w}
					{#if isActive}
						<span class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 ring-1 ring-black"></span>
					{:else if hasOdds}
						<span class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-500 ring-1 ring-black"></span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="mt-2 flex gap-4 text-xs text-gray-600">
			<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-green-500"></span>Active (live to participants)</span>
			<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-yellow-500"></span>Odds entered, not yet active</span>
		</div>
	</div>

	<!-- Week header + activate controls -->
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4 backdrop-blur-sm">
		<div>
			<h2 class="text-lg font-bold text-white">Week {weekNum}</h2>
			<p class="text-sm text-gray-500">
				{games.length} game{games.length !== 1 ? 's' : ''}
				{#if currentSummary?.hasOdds}· {currentSummary.hasOdds} with odds{/if}
			</p>
		</div>
		<div class="flex items-center gap-3">
			{#if games.length > 0}
				<form method="POST" action="?/activateWeek" use:enhance={() => {
					activating = true;
					return async ({ update }) => { await update(); activating = false; };
				}}>
					<input type="hidden" name="seasonId" value={activeSeason.id} />
					<input type="hidden" name="week"     value={weekNum} />
					<input type="hidden" name="activate" value={isWeekActive ? 'false' : 'true'} />
					<button type="submit" disabled={activating}
						class="rounded border px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50
							{isWeekActive
								? 'border-red-800 text-red-400 hover:bg-red-950/40'
								: 'border-green-700 text-green-400 hover:bg-green-950/40'}">
						{activating ? '…' : isWeekActive ? 'Deactivate Week' : 'Activate Week'}
					</button>
				</form>
			{/if}
		</div>
	</div>

	{#if games.length === 0}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-10 text-center backdrop-blur-sm">
			<p class="text-gray-400 mb-3">No games seeded for Week {weekNum}.</p>
			<p class="text-sm text-gray-600">Run <code class="text-gray-400">pnpm seed:odds</code> to populate the schedule.</p>
		</div>
	{:else}

		<!-- Auto-pick suggestions (shown when active games have odds) -->
		{#if activeGames.length > 0 && weekSetting}
			{#each [biggestFavorite()] as fav}
				{#if fav}
					<div class="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[rgba(201,168,76,0.2)] bg-black/75 px-4 py-3 backdrop-blur-sm">
						<div class="flex items-center gap-3">
							<img src={teamLogoUrl(fav.team?.abbreviation)} alt={fav.team?.abbreviation} class="h-9 w-9 object-contain" />
							<div>
								<p class="text-xs font-semibold uppercase tracking-wider text-[#c9a84c]">LMS Auto-pick — Biggest Favorite</p>
								<p class="text-sm font-medium text-white">{fav.team?.city} {fav.team?.name}</p>
								<p class="text-xs text-gray-500">Spread: {fav.spread > 0 ? '+' : ''}{fav.spread}</p>
							</div>
						</div>
						<form method="POST" action="?/applyAutoPickFromOdds" use:enhance={() => {
							applyingLms = true;
							return async ({ update }) => { await update(); applyingLms = false; };
						}}>
							<input type="hidden" name="weekSettingId" value={weekSetting.id} />
							<input type="hidden" name="teamId"        value={fav.team?.id} />
							<button type="submit" disabled={applyingLms}
								class="rounded border border-[rgba(201,168,76,0.4)] px-3 py-1.5 text-xs text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.1)] disabled:opacity-50">
								{applyingLms ? '…' : 'Set as LMS auto-pick'}
							</button>
						</form>
					</div>
				{/if}
			{/each}
			{#each [longestShot()] as shot}
				{#if shot}
					<div class="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-900 bg-blue-950/20 px-4 py-3 backdrop-blur-sm">
						<div class="flex items-center gap-3">
							<img src={teamLogoUrl(shot.team?.abbreviation)} alt={shot.team?.abbreviation} class="h-9 w-9 object-contain opacity-70" />
							<div>
								<p class="text-xs font-semibold uppercase tracking-wider text-blue-400">2nd Half Auto-pick — Longest Shot</p>
								<p class="text-sm font-medium text-white">{shot.team?.city} {shot.team?.name}</p>
								<p class="text-xs text-gray-500">Spread: +{shot.spread}</p>
							</div>
						</div>
						<form method="POST" action="?/applyAutoPickFromOdds" use:enhance={() => {
							applying2h = true;
							return async ({ update }) => { await update(); applying2h = false; };
						}}>
							<input type="hidden" name="weekSettingId" value={weekSetting.id} />
							<input type="hidden" name="teamId"        value={shot.team?.id} />
							<button type="submit" disabled={applying2h}
								class="rounded border border-blue-800 px-3 py-1.5 text-xs text-blue-400 transition hover:bg-blue-950/40 disabled:opacity-50">
								{applying2h ? '…' : 'Set as 2nd Half auto-pick'}
							</button>
						</form>
					</div>
				{/if}
			{/each}
		{/if}

		<!-- Games table -->
		<form method="POST" action="?/saveOdds" use:enhance={() => {
			savingOdds = true;
			return async ({ update }) => { await update(); savingOdds = false; };
		}}>
			<div class="overflow-hidden rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-800 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
							<th class="px-4 py-3">Matchup</th>
							<th class="px-4 py-3">Time</th>
							<th class="px-4 py-3 text-center">Spread</th>
							<th class="px-4 py-3 text-center">Home ML</th>
							<th class="px-4 py-3 text-center">Away ML</th>
							<th class="px-4 py-3 text-center">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each games as game}
							{@const home = game.expand?.homeTeam}
							{@const away = game.expand?.awayTeam}
							<tr class="border-b border-gray-800/50 transition hover:bg-white/[0.02]
								{game.isActive ? 'bg-green-950/5' : ''}">

								<!-- Matchup -->
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										<div class="flex items-center gap-1.5">
											<img src={teamLogoUrl(away?.abbreviation)} alt={away?.abbreviation} class="h-6 w-6 object-contain opacity-70" />
											<span class="text-gray-400 text-xs">{away?.abbreviation}</span>
										</div>
										<span class="text-gray-600 text-xs">@</span>
										<div class="flex items-center gap-1.5">
											<img src={teamLogoUrl(home?.abbreviation)} alt={home?.abbreviation} class="h-6 w-6 object-contain" />
											<span class="text-white text-xs font-medium">{home?.abbreviation}</span>
										</div>
										{#if game.notes}
											<span class="ml-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">{game.notes}</span>
										{/if}
									</div>
									<p class="mt-0.5 text-xs text-gray-600">
										{away?.city} {away?.name} at {home?.city} {home?.name}
									</p>
								</td>

								<!-- Game time -->
								<td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
									{#if game.gameTime}
										{new Date(game.gameTime).toLocaleString('en-US', {
											weekday: 'short', month: 'short', day: 'numeric',
											hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
										})}
									{:else}
										TBD
									{/if}
								</td>

								<!-- Spread input -->
								<td class="px-3 py-2 text-center">
									<div class="flex flex-col items-center gap-0.5">
										<input
											type="number"
											name="{game.id}_homeSpread"
											value={game.homeSpread ?? ''}
											step="0.5"
											placeholder="0"
											class="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs text-white focus:border-[#c9a84c] focus:outline-none"
										/>
										{#if game.homeSpread != null}
											<span class="text-[10px] text-gray-600">
												{spreadLabel(game.homeSpread, home?.abbreviation, away?.abbreviation)}
											</span>
										{/if}
									</div>
								</td>

								<!-- Home moneyline -->
								<td class="px-3 py-2 text-center">
									<input
										type="number"
										name="{game.id}_homeMoneyline"
										value={game.homeMoneyline ?? ''}
										placeholder="-110"
										class="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs
											{game.homeMoneyline != null && game.homeMoneyline < 0 ? 'text-[#c9a84c]' : 'text-blue-400'}
											focus:border-[#c9a84c] focus:outline-none"
									/>
								</td>

								<!-- Away moneyline -->
								<td class="px-3 py-2 text-center">
									<input
										type="number"
										name="{game.id}_awayMoneyline"
										value={game.awayMoneyline ?? ''}
										placeholder="+110"
										class="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs
											{game.awayMoneyline != null && game.awayMoneyline > 0 ? 'text-blue-400' : 'text-[#c9a84c]'}
											focus:border-[#c9a84c] focus:outline-none"
									/>
								</td>

								<!-- Active status -->
								<td class="px-4 py-3 text-center">
									{#if game.isActive}
										<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">Live</span>
									{:else}
										<span class="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-600">Draft</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-3 flex items-center justify-between gap-3">
				<p class="text-xs text-gray-600">
					Spread: negative = home favored (e.g. <code class="text-gray-400">-7</code> = home -7).
					Moneyline: negative = favorite (e.g. <code class="text-gray-400">-350</code>).
				</p>
				<button type="submit" disabled={savingOdds}
					class="rounded bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
					{savingOdds ? 'Saving…' : 'Save Odds'}
				</button>
			</div>
		</form>
	{/if}
{/if}
