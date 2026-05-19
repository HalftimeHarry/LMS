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

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-1">
				<label for="lmsEntryFee" class="text-xs font-medium text-gray-400">LMS entry fee ($)</label>
				<p class="text-xs text-gray-500">Pick the loser — 1 pick/week, full season</p>
				<input id="lmsEntryFee" name="lmsEntryFee" type="number" required placeholder="100" min="1"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>
			<div class="flex flex-col gap-1">
				<label for="secondHalfEntryFee" class="text-xs font-medium text-gray-400">Second Half entry fee ($)</label>
				<p class="text-xs text-gray-500">Pick the winner — starts Week 10</p>
				<input id="secondHalfEntryFee" name="secondHalfEntryFee" type="number" required placeholder="50" min="1"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<label for="secondHalfPicksPerWeek" class="text-xs font-medium text-gray-400">Second Half picks per week</label>
			<p class="text-xs text-gray-500">Default 1. Increase to 2 or 3 to reduce tie risk over the shorter period.</p>
			<select id="secondHalfPicksPerWeek" name="secondHalfPicksPerWeek"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
				<option value="1" selected>1 pick per week</option>
				<option value="2">2 picks per week</option>
				<option value="3">3 picks per week</option>
			</select>
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

		<!-- Pool configuration -->
		<div class="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Pool Configuration</p>
			<div class="flex flex-col gap-3">
				<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
					<input type="checkbox" name="lmsEnabled" checked class="h-4 w-4 accent-[#c9a84c]" />
					LMS pool enabled
				</label>
				<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
					<input type="checkbox" name="secondHalfEnabled" checked class="h-4 w-4 accent-[#c9a84c]" />
					2nd Half pool enabled
				</label>
				<div class="grid gap-4 sm:grid-cols-3 pt-1">
					<div class="flex flex-col gap-1">
						<label for="secondHalfStartWeek" class="text-xs font-medium text-gray-400">2nd Half registration opens (week)</label>
						<p class="text-xs text-gray-600">Week players can start registering for 2nd Half</p>
						<input id="secondHalfStartWeek" name="secondHalfStartWeek" type="number" value="6" min="1" max="18"
							class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
					</div>
					<div class="flex flex-col gap-1">
						<label for="secondHalfPicksStartWeek" class="text-xs font-medium text-gray-400">Picks increase (week)</label>
						<p class="text-xs text-gray-600">Week picks-per-week increases to the value below</p>
						<input id="secondHalfPicksStartWeek" name="secondHalfPicksStartWeek" type="number" value="10" min="1" max="18"
							class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
					</div>
					<div class="flex flex-col gap-1">
						<label for="secondHalfPicksPerWeek2" class="text-xs font-medium text-gray-400">Picks per week (after increase)</label>
						<p class="text-xs text-gray-600">How many picks 2nd Half entries make from that week on</p>
						<select id="secondHalfPicksPerWeek2" name="secondHalfPicksPerWeek"
							class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
							<option value="1">1 pick per week</option>
							<option value="2" selected>2 picks per week</option>
							<option value="3">3 picks per week</option>
						</select>
					</div>
				</div>
			</div>
		</div>

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
