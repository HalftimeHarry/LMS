<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';

	let { form }: { form: ActionData } = $props();

	const siteKey = PUBLIC_TURNSTILE_SITE_KEY ?? '';
	let loading = $state(false);
</script>

<svelte:head>
	<title>Forgot Password — LMS Pool</title>
	{#if siteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-black px-4">
	<div class="w-full max-w-sm">

		<!-- Logo / title -->
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-bold text-white">Reset your password</h1>
			<p class="mt-2 text-sm text-gray-500">
				Enter your email and we'll send you a reset link.
			</p>
		</div>

		{#if (form as any)?.sent}
			<!-- Success state -->
			<div class="rounded-xl border border-green-800 bg-green-950/40 px-6 py-8 text-center">
				<div class="mb-3 text-3xl">✉️</div>
				<p class="font-semibold text-white">Check your inbox</p>
				<p class="mt-2 text-sm text-gray-400">
					If that email is registered, a reset link is on its way. Check your spam folder if it doesn't arrive within a few minutes.
				</p>
				<a href="/login" class="mt-6 block text-sm text-[#c9a84c] hover:underline">← Back to sign in</a>
			</div>
		{:else}
			<!-- Form -->
			<form method="POST" use:enhance={() => {
				loading = true;
				return async ({ update }) => { await update(); loading = false; };
			}}
				class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-6 py-8 backdrop-blur-sm"
				style="background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%), #0a0a0a;"
			>
				{#if (form as any)?.error}
					<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-2.5 text-sm text-red-400">
						{(form as any).error}
					</div>
				{/if}

				<div class="flex flex-col gap-1.5">
					<label for="email" class="text-xs font-medium text-gray-400">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						autocomplete="email"
						placeholder="you@example.com"
						class="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
					/>
				</div>

				<!-- Turnstile widget — only rendered when site key is configured -->
				{#if siteKey}
					<div class="cf-turnstile mt-4" data-sitekey={siteKey} data-theme="dark"></div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="mt-5 w-full rounded-lg bg-[#c9a84c] py-2.5 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50"
				>
					{loading ? 'Sending…' : 'Send reset link'}
				</button>

				<p class="mt-4 text-center text-sm text-gray-600">
					<a href="/login" class="text-[#c9a84c] hover:underline">← Back to sign in</a>
				</p>
			</form>
		{/if}

	</div>
</div>
