<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading  = $state(false);
	let showPass = $state(false);
</script>

<svelte:head><title>Set New Password — LMS Pool</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-black px-4">
	<div class="w-full max-w-sm">

		<div class="mb-8 text-center">
			<h1 class="text-2xl font-bold text-white">Set a new password</h1>
			<p class="mt-2 text-sm text-gray-500">Choose a strong password — at least 8 characters.</p>
		</div>

		{#if !data.token}
			<div class="rounded-xl border border-red-800 bg-red-950/40 px-6 py-8 text-center">
				<p class="font-semibold text-white">Invalid reset link</p>
				<p class="mt-2 text-sm text-gray-400">This link is missing a token. Use the link directly from your email.</p>
				<a href="/forgot-password" class="mt-6 block text-sm text-[#c9a84c] hover:underline">Request a new link</a>
			</div>
		{:else}
			<form method="POST" use:enhance={() => {
				loading = true;
				return async ({ update }) => { await update(); loading = false; };
			}}
				class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-6 py-8 backdrop-blur-sm"
				style="background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%), #0a0a0a;"
			>
				<input type="hidden" name="token" value={data.token} />

				{#if (form as any)?.error}
					<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-2.5 text-sm text-red-400">
						{(form as any).error}
						{#if (form as any).error.includes('expired')}
							<a href="/forgot-password" class="ml-1 underline">Request a new link →</a>
						{/if}
					</div>
				{/if}

				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-1.5">
						<label for="password" class="text-xs font-medium text-gray-400">New password</label>
						<div class="relative">
							<input
								id="password"
								name="password"
								type={showPass ? 'text' : 'password'}
								required
								minlength="8"
								autocomplete="new-password"
								placeholder="Min. 8 characters"
								class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 pr-10 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
							/>
							<button type="button" onclick={() => showPass = !showPass}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300">
								{showPass ? 'Hide' : 'Show'}
							</button>
						</div>
					</div>

					<div class="flex flex-col gap-1.5">
						<label for="confirm" class="text-xs font-medium text-gray-400">Confirm password</label>
						<input
							id="confirm"
							name="confirm"
							type={showPass ? 'text' : 'password'}
							required
							minlength="8"
							autocomplete="new-password"
							placeholder="Repeat password"
							class="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="mt-6 w-full rounded-lg bg-[#c9a84c] py-2.5 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50"
				>
					{loading ? 'Saving…' : 'Set new password'}
				</button>

				<p class="mt-4 text-center text-sm text-gray-600">
					<a href="/login" class="text-[#c9a84c] hover:underline">← Back to sign in</a>
				</p>
			</form>
		{/if}

	</div>
</div>
