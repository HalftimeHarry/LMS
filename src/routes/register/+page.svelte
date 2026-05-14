<script lang="ts">
	import { pb, persistAuth } from '$lib';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const reason = $derived($page.url.searchParams.get('reason'));

	let displayName = $state('');
	let email       = $state('');
	let password    = $state('');
	let confirm     = $state('');
	let remember    = $state(true);
	let error       = $state('');
	let loading     = $state(false);

	async function register() {
		error = '';
		if (password !== confirm) { error = 'Passwords do not match.'; return; }
		if (password.length < 8)  { error = 'Password must be at least 8 characters.'; return; }

		loading = true;
		try {
			await pb.collection('users').create({
				email,
				password,
				passwordConfirm: confirm,
				displayName,
				role: 'participant'
			});
			await pb.collection('users').authWithPassword(email, password);
			persistAuth(remember);
			goto('/dashboard');
		} catch (e: unknown) {
			error = (e as { message?: string })?.message ?? 'Registration failed.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Register — LMS Pool</title></svelte:head>

<div class="flex min-h-[70vh] items-center justify-center">
	<div class="w-full max-w-md rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/80 p-8 backdrop-blur-sm">

		<h1 class="mb-1 text-2xl font-bold text-white">Create your account</h1>
		<p class="mb-4 text-sm text-gray-400">Join the Last Man / Last Woman Standing pool.</p>

		{#if reason === 'standings'}
			<div class="mb-4 rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-3 text-sm text-[#c9a84c]">
				You need an account to view standings. Register below or
				<a href="/login" class="font-semibold underline hover:text-[#e8c96a]">sign in</a> if you already have one.
			</div>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); register(); }} class="flex flex-col gap-4">

			<div class="flex flex-col gap-1">
				<label for="displayName" class="text-xs font-medium text-gray-400">Display name</label>
				<input
					id="displayName"
					type="text"
					bind:value={displayName}
					required
					placeholder="Dustin"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

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
					placeholder="Min. 8 characters"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label for="confirm" class="text-xs font-medium text-gray-400">Confirm password</label>
				<input
					id="confirm"
					type="password"
					bind:value={confirm}
					required
					placeholder="Repeat password"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
				/>
			</div>

			<!-- Remember me -->
			<label class="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
				<input
					type="checkbox"
					bind:checked={remember}
					class="h-4 w-4 accent-[#c9a84c]"
				/>
				Keep me signed in on this device
			</label>

			{#if error}
				<p class="rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="mt-1 rounded bg-[#c9a84c] py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50"
			>
				{loading ? 'Creating account…' : 'Create account'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-500">
			Already have an account?
			<a href="/login" class="text-[#c9a84c] hover:underline">Sign in</a>
		</p>
	</div>
</div>
