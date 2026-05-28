<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { env } from '$env/dynamic/public';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const redirectTo = $derived($page.url.searchParams.get('redirect') ?? '/dashboard');
	const resetDone  = $derived($page.url.searchParams.get('reset') === '1');
	const siteKey    = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
	let loading = $state(false);
</script>

<svelte:head>
	<title>Sign In — LMS Pool</title>
	{#if siteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="flex min-h-[70vh] items-center justify-center">
	<div class="w-full max-w-md rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/80 p-8 backdrop-blur-sm">

		<h1 class="mb-1 text-2xl font-bold text-white">Sign in</h1>
		<p class="mb-4 text-sm text-gray-400">Welcome back to the pool.</p>

		{#if resetDone}
			<div class="mb-4 rounded border border-green-800 bg-green-950/40 px-4 py-2.5 text-sm text-green-400">
				Password updated — sign in with your new password.
			</div>
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
			<input type="hidden" name="redirect" value={redirectTo} />

			<div class="flex flex-col gap-1">
				<label for="email" class="text-xs font-medium text-gray-400">Email</label>
				<input
					id="email" name="email" type="email" required
					placeholder="you@example.com"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<label for="password" class="text-xs font-medium text-gray-400">Password</label>
					<a href="/forgot-password" class="text-xs text-[#c9a84c] hover:underline">Forgot password?</a>
				</div>
				<input
					id="password" name="password" type="password" required
					placeholder="Your password"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

			<div class="flex flex-col gap-2 rounded border border-gray-800 bg-gray-900/50 p-3">
				<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
					<input type="checkbox" name="remember" class="h-4 w-4 accent-[#c9a84c]" />
					Keep me signed in on this device
				</label>
				<p class="pl-7 text-xs text-gray-500">
					Uncheck if you're on a shared or different computer — your session will end when you close the browser.
				</p>
			</div>

			<!-- Turnstile CAPTCHA — only rendered when site key is configured -->
			{#if siteKey}
				<div class="cf-turnstile" data-sitekey={siteKey} data-theme="dark"></div>
			{/if}

			{#if form?.error}
				<p class="rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">{form.error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="mt-1 rounded bg-[#c9a84c] py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50"
			>
				{loading ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-500">
			Don't have an account?
			<a href="/register" class="text-[#c9a84c] hover:underline">Register here</a>
		</p>
	</div>
</div>
