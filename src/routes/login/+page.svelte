<script lang="ts">
	import { pb, persistAuth } from '$lib';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let email    = $state('');
	let password = $state('');
	let remember = $state(false);
	let error    = $state('');
	let loading  = $state(false);

	// Redirect destination — e.g. /login?redirect=/dashboard/picks
	const redirect = $derived($page.url.searchParams.get('redirect') ?? '/dashboard');

	async function login() {
		error = '';
		loading = true;
		try {
			await pb.collection('users').authWithPassword(email, password);
			persistAuth(remember);
			goto(redirect);
		} catch (e: unknown) {
			error = 'Invalid email or password.';
			console.error(e);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Sign In — LMS Pool</title></svelte:head>

<div class="flex min-h-[70vh] items-center justify-center">
	<div class="w-full max-w-md rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/80 p-8 backdrop-blur-sm">

		<h1 class="mb-1 text-2xl font-bold text-white">Sign in</h1>
		<p class="mb-6 text-sm text-gray-400">Welcome back to the pool.</p>

		<form onsubmit={(e) => { e.preventDefault(); login(); }} class="flex flex-col gap-4">

			<div class="flex flex-col gap-1">
				<label for="email" class="text-xs font-medium text-gray-400">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					placeholder="you@example.com"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label for="password" class="text-xs font-medium text-gray-400">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					placeholder="Your password"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

			<!-- Remember me / different computer -->
			<div class="flex flex-col gap-2 rounded border border-gray-800 bg-gray-900/50 p-3">
				<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
					<input
						type="checkbox"
						bind:checked={remember}
						class="h-4 w-4 accent-[#c9a84c]"
					/>
					Keep me signed in on this device
				</label>
				<p class="pl-7 text-xs text-gray-500">
					Uncheck if you're on a shared or different computer — your session will end when you close the browser.
				</p>
			</div>

			{#if error}
				<p class="rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">{error}</p>
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
