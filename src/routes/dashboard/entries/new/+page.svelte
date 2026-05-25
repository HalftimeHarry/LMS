<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	const seasons = data.seasons as any[];
	let selectedSeasonId = $state(seasons[0]?.id ?? '');
	let entryType        = $state(data.defaultEntryType as 'lms' | 'second_half');

	const selectedSeason   = $derived(seasons.find((s: any) => s.id === selectedSeasonId));
	const lmsOpen          = $derived(data.lmsOpen        as boolean);
	const secondHalfOpen   = $derived(data.secondHalfOpen as boolean);
	const week6Deadline    = $derived((data as any).week6Deadline as string | null);

	// Fee shown in the info blurb
	const entryFee = $derived(
		entryType === 'lms'
			? (selectedSeason?.lmsEntryFee        ?? '—')
			: (selectedSeason?.secondHalfEntryFee ?? '—')
	);
</script>

<svelte:head><title>Request Entry — LMS Pool</title></svelte:head>

<div class="mb-6 flex items-center gap-3">
	<a href="/dashboard/entries" class="text-sm text-gray-500 hover:text-[#c9a84c]">← My Entries</a>
	<h1 class="text-2xl font-bold text-white">Request an Entry</h1>
</div>

<div class="max-w-lg rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">

	<p class="mb-5 text-sm text-gray-400">
		Entry fee: <strong class="text-white">${entryFee}</strong> — paid separately to the Comish.
		Your entry will show as <em>Pending Payment</em> until confirmed by an admin.
	</p>

	{#if form?.error}
		<p class="mb-4 rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">{form.error}</p>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { await update(); loading = false; };
		}}
		class="flex flex-col gap-4"
	>
		<!-- Season -->
		{#if seasons.length > 1}
			<div class="flex flex-col gap-1">
				<label for="seasonId" class="text-xs font-medium text-gray-400">Season</label>
				<select id="seasonId" name="seasonId" required
					bind:value={selectedSeasonId}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
					{#each seasons as season}
						<option value={season.id}>{season.name}</option>
					{/each}
				</select>
			</div>
		{:else}
			<!-- Single season — hidden field, show name as context -->
			<input type="hidden" name="seasonId" value={seasons[0]?.id} />
			<p class="text-xs text-gray-500">Season: <span class="text-gray-300">{seasons[0]?.name}</span></p>
		{/if}

		<!-- Entry type — only show what's open -->
		<div class="flex flex-col gap-2">
			<p class="text-xs font-medium text-gray-400">Pool type</p>
			<div class="grid grid-cols-2 gap-3">

				<!-- LMS -->
				<label class="flex items-start gap-3 rounded-lg border p-3 transition
					{!lmsOpen
						? 'cursor-not-allowed border-gray-800 opacity-40'
						: entryType === 'lms'
							? 'cursor-pointer border-[#c9a84c] bg-[rgba(201,168,76,0.08)]'
							: 'cursor-pointer border-gray-700 hover:border-gray-500'}">
					<input type="radio" name="entryType" value="lms"
						bind:group={entryType}
						disabled={!lmsOpen}
						class="mt-0.5 accent-[#c9a84c]" />
					<div>
						<p class="text-sm font-semibold text-white">LMS Full Season</p>
						{#if lmsOpen}
							<p class="text-xs text-gray-500">Pick the <strong class="text-red-400">loser</strong> · Weeks 1–18 · ${selectedSeason?.lmsEntryFee ?? '—'}</p>
						{:else}
							<p class="text-xs text-gray-600">Registration closed</p>
						{/if}
					</div>
				</label>

				<!-- Second Half -->
				<label class="flex items-start gap-3 rounded-lg border p-3 transition
					{!secondHalfOpen
						? 'cursor-not-allowed border-gray-800 opacity-40'
						: entryType === 'second_half'
							? 'cursor-pointer border-blue-600 bg-blue-950/30'
							: 'cursor-pointer border-gray-700 hover:border-gray-500'}">
					<input type="radio" name="entryType" value="second_half"
						bind:group={entryType}
						disabled={!secondHalfOpen}
						class="mt-0.5 accent-blue-500" />
					<div>
						<p class="text-sm font-semibold text-white">Second Half</p>
						{#if secondHalfOpen}
							<p class="text-xs text-gray-500">Pick the <strong class="text-green-400">winner</strong> · Starts week 6 · ${selectedSeason?.secondHalfEntryFee ?? '—'}
								{#if week6Deadline}· Deadline: {new Date(week6Deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{/if}
							</p>
						{:else}
							<p class="text-xs text-gray-600">
								Registration closed
								{#if week6Deadline} — deadline was {new Date(week6Deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{/if}
							</p>
						{/if}
					</div>
				</label>

			</div>
		</div>

		<!-- Entry name -->
		<div class="flex flex-col gap-1">
			<label for="entryName" class="text-xs font-medium text-gray-400">Entry name</label>
			<input id="entryName" name="entryName" type="text" required minlength="2"
				placeholder="e.g. Dustin Entry 1"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			<p class="text-xs text-gray-600">Shown on the public standings board.</p>
		</div>

		<!-- Referred by -->
		<div class="flex flex-col gap-1">
			<label for="referredBy" class="text-xs font-medium text-gray-400">Referred by <span class="text-gray-600">(optional)</span></label>
			<input id="referredBy" name="referredBy" type="text"
				placeholder="Username of the player who referred you"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
		</div>

		<div class="flex gap-3 pt-1">
			<button type="submit" disabled={loading}
				class="rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{loading ? 'Submitting…' : 'Request entry'}
			</button>
			<a href="/dashboard/entries"
				class="rounded border border-gray-700 px-6 py-2.5 text-sm text-gray-400 transition hover:bg-gray-800">
				Cancel
			</a>
		</div>
	</form>
</div>
