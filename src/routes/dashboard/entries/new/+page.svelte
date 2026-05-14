<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Request Entry — LMS Pool</title></svelte:head>

<div class="mb-6 flex items-center gap-3">
	<a href="/dashboard/entries" class="text-sm text-gray-500 hover:text-[#c9a84c]">← My Entries</a>
	<h1 class="text-2xl font-bold text-white">Request an Entry</h1>
</div>

<div class="max-w-lg rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
	<p class="mb-5 text-sm text-gray-400">
		Each entry requires a <strong class="text-white">$100 entry fee</strong> paid separately to the Comish.
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
		<div class="flex flex-col gap-1">
			<label for="seasonId" class="text-xs font-medium text-gray-400">Season</label>
			<select id="seasonId" name="seasonId" required
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
				{#each data.seasons as season}
					<option value={season.id}>{season.name} — ${season.entryFee}</option>
				{/each}
			</select>
		</div>

		<div class="flex flex-col gap-1">
			<label for="entryName" class="text-xs font-medium text-gray-400">Entry name</label>
			<input id="entryName" name="entryName" type="text" required minlength="2"
				placeholder="e.g. Dustin Entry 1"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			<p class="text-xs text-gray-600">This is the name shown on the public standings board.</p>
		</div>

		<div class="flex flex-col gap-1">
			<label for="referredBy" class="text-xs font-medium text-gray-400">Referred by (optional)</label>
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
