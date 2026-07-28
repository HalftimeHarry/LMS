<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { teamLogoUrl } from '$lib/teamLogos';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const seasons      = $derived(data.seasons      as any[]);
	const activeSeason = $derived(data.activeSeason as any);
	const weekNum      = $derived(data.weekNum      as number);
	const games        = $derived(data.games        as any[]);
	const weekSummary  = $derived(data.weekSummary  as any[]);
	const isSuperAdmin = $derived(!!(data as any).isSuperAdmin);

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

	let savingGames   = $state(new Set<string>());
	let savedGames    = $state(new Set<string>());
	let errorGames    = $state<Record<string, string>>({});
	let activating    = $state(false);
	let applyingLms   = $state(false);
	let applying2h    = $state(false);

	function switchWeek(w: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('week', String(w));
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function switchSeason(id: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('season', id);
		params.delete('week'); // let server default to the open week for this season
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

	function toDatetimeLocalValue(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}
</script>

<svelte:head><title>Manage Odds — Admin</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4 backdrop-blur-sm">
	<div>
		<h1 class="text-2xl font-bold text-white">Manage Odds</h1>
		{#if activeSeason}
			<p class="mt-1 text-sm text-gray-500">{activeSeason.name}</p>
		{/if}
	</div>
	<!-- Season selector — super_admin only; pool_admin gets the active season automatically -->
	{#if isSuperAdmin && seasons?.length > 1}
		<div class="flex items-center gap-2">
			<label for="season-select" class="text-xs font-medium uppercase tracking-wider text-gray-500">Season</label>
			<select
				id="season-select"
				value={activeSeason?.id ?? ''}
				onchange={(e) => switchSeason((e.target as HTMLSelectElement).value)}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
			>
				{#each seasons as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>

{#if !activeSeason}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-5 py-4 backdrop-blur-sm">
		<p class="text-sm text-gray-500">No active season found.</p>
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
				{#if !isWeekActive}
					<!-- Any admin can activate -->
					<form method="POST" action="?/activateWeek" use:enhance={() => {
						activating = true;
						return async ({ update }) => { await update({ reset: false }); activating = false; };
					}}>
						<input type="hidden" name="seasonId" value={activeSeason.id} />
						<input type="hidden" name="week"     value={weekNum} />
						<input type="hidden" name="activate" value="true" />
						<button type="submit" disabled={activating}
							class="rounded border border-green-700 px-4 py-1.5 text-sm font-semibold text-green-400 transition hover:bg-green-950/40 disabled:opacity-50">
							{activating ? '…' : 'Activate Week'}
						</button>
					</form>
				{:else if isSuperAdmin}
					<!-- Only super_admin can deactivate -->
					<form method="POST" action="?/activateWeek" use:enhance={() => {
						activating = true;
						return async ({ update }) => { await update({ reset: false }); activating = false; };
					}}>
						<input type="hidden" name="seasonId" value={activeSeason.id} />
						<input type="hidden" name="week"     value={weekNum} />
						<input type="hidden" name="activate" value="false" />
						<button type="submit" disabled={activating}
							class="rounded border border-red-800 px-4 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-950/40 disabled:opacity-50">
							{activating ? '…' : 'Deactivate Week'}
						</button>
					</form>
				{:else}
					<!-- Pool admin sees a read-only Live badge when week is active -->
					<span class="rounded border border-green-800 bg-green-950/40 px-4 py-1.5 text-sm font-semibold text-green-400">● Live</span>
				{/if}
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
								<p class="text-xs font-semibold uppercase tracking-wider text-[#c9a84c]">LMS Auto-pick — Biggest Favorite (penalty default)</p>
								<p class="text-sm font-medium text-white">{fav.team?.city} {fav.team?.name}</p>
								<p class="text-xs text-gray-500">Spread: {fav.spread > 0 ? '+' : ''}{fav.spread}</p>
							</div>
						</div>
						<form method="POST" action="?/applyAutoPickFromOdds" use:enhance={() => {
							applyingLms = true;
							return async ({ update }) => { await update({ reset: false }); applyingLms = false; };
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
					<div class="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-800 bg-blue-950 px-4 py-3 backdrop-blur-sm">
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
							return async ({ update }) => { await update({ reset: false }); applying2h = false; };
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

		<!-- Games list — one form per row -->
		<div class="overflow-hidden rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm">
			<!-- Header row -->
			<div class="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-x-2 border-b border-gray-800 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
				<span>Matchup</span>
				<span class="w-44 text-center">Kickoff</span>
				<span class="w-20 text-center">Spread</span>
				<span class="w-20 text-center">Home ML</span>
				<span class="w-20 text-center">Away ML</span>
				<span class="w-14 text-center">Status</span>
				<span class="w-14 text-center"></span>
			</div>

			{#each games as game (game.id)}
				{@const home   = game.expand?.homeTeam}
				{@const away   = game.expand?.awayTeam}
				{@const saving = savingGames.has(game.id)}
				{@const saved  = savedGames.has(game.id)}
				{@const errMsg = errorGames[game.id]}

				<form method="POST" action="?/saveOdds"
					use:enhance={() => {
						savingGames = new Set([...savingGames, game.id]);
						savedGames  = new Set([...savedGames].filter(id => id !== game.id));
						errorGames  = { ...errorGames, [game.id]: '' };
						return async ({ result, update }) => {
							await update({ reset: false });
							savingGames = new Set([...savingGames].filter(id => id !== game.id));
							if (result.type === 'success') {
								savedGames = new Set([...savedGames, game.id]);
								setTimeout(() => {
									savedGames = new Set([...savedGames].filter(id => id !== game.id));
								}, 2500);
							} else if (result.type === 'failure') {
								errorGames = { ...errorGames, [game.id]: (result.data as any)?.error ?? 'Save failed.' };
							}
						};
					}}
					class="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-x-2 border-b border-gray-800/50 px-4 py-2.5 transition
						{game.isActive ? 'bg-green-950/5' : ''}
						{saved ? 'bg-[rgba(201,168,76,0.04)]' : ''}
						hover:bg-white/[0.02]"
				>
					<!-- Matchup -->
					<div>
						<div class="flex items-center gap-2">
							<div class="flex items-center gap-1.5">
								<img src={teamLogoUrl(away?.abbreviation)} alt={away?.abbreviation} class="h-6 w-6 object-contain opacity-70" />
								<span class="text-xs text-gray-400">{away?.abbreviation}</span>
							</div>
							<span class="text-xs text-gray-600">@</span>
							<div class="flex items-center gap-1.5">
								<img src={teamLogoUrl(home?.abbreviation)} alt={home?.abbreviation} class="h-6 w-6 object-contain" />
								<span class="text-xs font-medium text-white">{home?.abbreviation}</span>
							</div>
							{#if game.notes}
								<span class="ml-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">{game.notes}</span>
							{/if}
						</div>
						<p class="mt-0.5 text-xs text-gray-600">{away?.city} {away?.name} at {home?.city} {home?.name}</p>
					</div>

					<!-- Game time + note editable -->
					<div class="w-44">
						<input
							type="datetime-local"
							name="{game.id}_gameTime"
							value={toDatetimeLocalValue(game.gameTime)}
							class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs text-white focus:border-[#c9a84c] focus:outline-none"
						/>
						<input
							type="text"
							name="{game.id}_notes"
							value={game.notes ?? ''}
							placeholder="Optional note"
							class="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-[10px] text-gray-300 focus:border-[#c9a84c] focus:outline-none"
						/>
					</div>

					<!-- Spread -->
					<div class="flex w-20 flex-col items-center gap-0.5">
						<input
							type="number"
							name="{game.id}_homeSpread"
							value={game.homeSpread ?? ''}
							step="0.5"
							placeholder="0"
							class="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs text-white focus:border-[#c9a84c] focus:outline-none"
						/>
						{#if game.homeSpread != null}
							<span class="text-[10px] text-gray-600">{spreadLabel(game.homeSpread, home?.abbreviation, away?.abbreviation)}</span>
						{/if}
					</div>

					<!-- Home ML -->
					<input
						type="number"
						name="{game.id}_homeMoneyline"
						value={game.homeMoneyline ?? ''}
						placeholder="-110"
						class="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs focus:border-[#c9a84c] focus:outline-none
							{game.homeMoneyline != null && game.homeMoneyline < 0 ? 'text-[#c9a84c]' : 'text-blue-400'}"
					/>

					<!-- Away ML -->
					<input
						type="number"
						name="{game.id}_awayMoneyline"
						value={game.awayMoneyline ?? ''}
						placeholder="+110"
						class="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-xs focus:border-[#c9a84c] focus:outline-none
							{game.awayMoneyline != null && game.awayMoneyline > 0 ? 'text-blue-400' : 'text-[#c9a84c]'}"
					/>

					<!-- Status badge -->
					<div class="w-14 text-center">
						{#if game.isActive}
							<span class="rounded border border-green-800 bg-green-950/60 px-2 py-0.5 text-xs text-green-400">Live</span>
						{:else}
							<span class="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-600">Draft</span>
						{/if}
					</div>

					<!-- Save button + feedback -->
					<div class="flex w-14 flex-col items-center gap-1">
						<button type="submit" disabled={saving}
							class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-3 py-1 text-xs font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.15)] disabled:opacity-40">
							{saving ? '…' : 'Save'}
						</button>
						{#if saved}
							<span class="text-[10px] text-green-400">Saved ✓</span>
						{:else if errMsg}
							<span class="text-[10px] text-red-400" title={errMsg}>Error</span>
						{/if}
					</div>
				</form>
			{/each}
		</div>

		<div class="mt-3 rounded-xl border border-[rgba(201,168,76,0.15)] bg-black/60 px-4 py-3 backdrop-blur-sm">
			<p class="text-xs text-gray-500">
				<span class="font-medium text-gray-400">Spread:</span> negative = home favored (e.g. <code class="rounded bg-gray-800 px-1 text-gray-300">-7</code> = home -7).
				&nbsp;
				<span class="font-medium text-gray-400">Moneyline:</span> negative = favorite (e.g. <code class="rounded bg-gray-800 px-1 text-gray-300">-350</code>).
			</p>
		</div>
	{/if}
{/if}
