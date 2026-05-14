<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>New Season — Admin</title></svelte:head>

<div class="mb-6 flex items-center gap-3">
	<a href="/admin/seasons" class="text-sm text-gray-500 hover:text-[#c9a84c]">← Seasons</a>
	<h1 class="text-2xl font-bold text-white">New Season</h1>
</div>

<div class="max-w-lg rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
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
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-1">
				<label for="name" class="text-xs font-medium text-gray-400">Season name</label>
				<input id="name" name="name" type="text" required placeholder="LMS/LWS 2027"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>
			<div class="flex flex-col gap-1">
				<label for="year" class="text-xs font-medium text-gray-400">Year</label>
				<input id="year" name="year" type="number" required placeholder="2027" min="2020" max="2040"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<label for="entryFee" class="text-xs font-medium text-gray-400">Entry fee ($)</label>
			<input id="entryFee" name="entryFee" type="number" required placeholder="100" min="1"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-1">
				<label for="paymentDeadline" class="text-xs font-medium text-gray-400">Payment deadline</label>
				<input id="paymentDeadline" name="paymentDeadline" type="datetime-local"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
			</div>
			<div class="flex flex-col gap-1">
				<label for="firstPickDeadline" class="text-xs font-medium text-gray-400">First pick deadline</label>
				<input id="firstPickDeadline" name="firstPickDeadline" type="datetime-local"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
			</div>
		</div>

		<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
			<input type="checkbox" name="regularSeasonOnly" checked class="h-4 w-4 accent-[#c9a84c]" />
			Regular season only
		</label>

		<div class="flex flex-col gap-1">
			<label for="notes" class="text-xs font-medium text-gray-400">Notes (optional)</label>
			<textarea id="notes" name="notes" rows="2" placeholder="Any additional info…"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"></textarea>
		</div>

		<div class="flex gap-3 pt-1">
			<button type="submit" disabled={loading}
				class="rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{loading ? 'Creating…' : 'Create season'}
			</button>
			<a href="/admin/seasons"
				class="rounded border border-gray-700 px-6 py-2.5 text-sm text-gray-400 transition hover:bg-gray-800">
				Cancel
			</a>
		</div>
	</form>
</div>
