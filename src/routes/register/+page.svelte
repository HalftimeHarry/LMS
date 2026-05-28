<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';

	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const reason  = $derived($page.url.searchParams.get('reason'));

	let loading   = $state(false);
</script>

<svelte:head>
	<title>Register — LMS Pool</title>

</svelte:head>

<div class="flex min-h-[70vh] items-center justify-center py-10">
	<div class="w-full max-w-md rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/80 p-8 backdrop-blur-sm">

		<h1 class="mb-1 text-2xl font-bold text-white">Create your account</h1>
		<p class="mb-6 text-sm text-gray-400">Join the Last Man / Last Woman Standing pool.</p>

		{#if reason === 'standings'}
			<div class="mb-5 rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-3 text-sm text-[#c9a84c]">
				You need an account to submit picks. Register below or
				<a href="/login" class="font-semibold underline hover:text-[#e8c96a]">sign in</a> if you already have one.
			</div>
		{/if}

		{#if form?.error}
			<p class="mb-5 rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">{form.error}</p>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ result }) => {
					loading = false;
					if (result.type === 'redirect') {
						await invalidateAll();
						goto(result.location);
					} else {
						await applyAction(result);
					}
				};
			}}
			class="flex flex-col gap-4"
		>
			<div class="flex flex-col gap-1">
				<label for="displayName" class="text-xs font-medium text-gray-400">Entry name <span class="text-red-500">*</span></label>
				<input id="displayName" name="displayName" type="text" required
					placeholder="Dustin Johnson"
					value={form?.fields?.displayName ?? ''}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
				<p class="text-xs text-gray-600">Your name as it appears on the standings.</p>
			</div>

			<div class="flex flex-col gap-1">
				<label for="email" class="text-xs font-medium text-gray-400">Email <span class="text-red-500">*</span></label>
				<input id="email" name="email" type="email" required
					placeholder="you@example.com"
					value={form?.fields?.email ?? ''}
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<div class="border-t border-gray-800 pt-1"></div>

			<div class="flex flex-col gap-1">
				<label for="password" class="text-xs font-medium text-gray-400">Password <span class="text-red-500">*</span></label>
				<input id="password" name="password" type="password" required
					placeholder="Min. 8 characters"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<div class="flex flex-col gap-1">
				<label for="confirm" class="text-xs font-medium text-gray-400">Confirm password <span class="text-red-500">*</span></label>
				<input id="confirm" name="confirm" type="password" required
					placeholder="Repeat password"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
				<input type="checkbox" name="remember" checked class="h-4 w-4 accent-[#c9a84c]" />
				Keep me signed in on this device
			</label>



			<button type="submit" disabled={loading}
				class="mt-1 rounded bg-[#c9a84c] py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{loading ? 'Creating account…' : 'Create account'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-500">
			Already have an account?
			<a href="/login" class="text-[#c9a84c] hover:underline">Sign in</a>
		</p>
	</div>
</div>
