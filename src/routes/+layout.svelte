<script lang="ts">
	import '../app.css';
	import bg   from '$lib/assets/lms_images/bk_15.jpg';
	import logo from '$lib/assets/lms_images/h_group6.png';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet, data: LayoutData } = $props();

	const user = $derived(data.user);
	const initials = $derived(
		user?.displayName
			? user.displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
			: '?'
	);

	const roleLabel: Record<string, string> = {
		super_admin: 'Super Admin',
		pool_admin:  'Pool Admin',
		participant: 'Participant'
	};

	let menuOpen = $state(false);
</script>

<!-- Full-page background -->
<div class="min-h-screen bg-cover bg-center bg-fixed" style="background-image: url({bg})">
<div class="min-h-screen bg-black/60">

	<!-- Header -->
	<header class="fixed inset-x-0 top-0 z-50 border-b border-[rgba(201,168,76,0.3)] bg-black/80 backdrop-blur-sm">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">

			<!-- Logo — scales sm→lg -->
			<a href="/" class="flex items-center gap-3">
				<img src={logo} alt="Last Man / Last Woman Standing" class="h-10 w-auto sm:h-12 md:h-14 lg:h-16" />
			</a>

			<!-- Nav -->
			<nav class="flex items-center gap-6 text-sm font-medium">
				{#if user}
					<!-- Signed-in nav -->
					<a href="/dashboard"           class="text-gray-300 transition hover:text-[#c9a84c]">Dashboard</a>
					<a href="/dashboard/standings" class="text-gray-300 transition hover:text-[#c9a84c]">Standings</a>
					<a href="/dashboard/odds"      class="text-gray-300 transition hover:text-[#c9a84c]">Latest Odds</a>
					<a href="/dashboard/rules"     class="text-gray-300 transition hover:text-[#c9a84c]">Rules</a>
					{#if user.role === 'super_admin' || user.role === 'pool_admin'}
						<a href="/admin" class="text-gray-300 transition hover:text-[#c9a84c]">Admin</a>
					{/if}

					<!-- User menu -->
					<div class="relative">
						<button
							onclick={() => menuOpen = !menuOpen}
							class="flex items-center gap-2 rounded-full border border-[rgba(201,168,76,0.4)] bg-black/60 px-3 py-1.5 text-sm text-[#c9a84c] transition hover:border-[#c9a84c]"
						>
							<span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#c9a84c] text-xs font-bold text-black">
								{initials}
							</span>
							<span class="hidden sm:inline">{user.displayName}</span>
							<svg class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{#if menuOpen}
							<!-- Backdrop -->
							<button
								class="fixed inset-0 z-40"
								onclick={() => menuOpen = false}
								aria-label="Close menu"
							></button>
							<!-- Dropdown -->
							<div class="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-[rgba(201,168,76,0.3)] bg-gray-950 py-1 shadow-xl">
								<div class="border-b border-gray-800 px-4 py-2">
									<p class="text-sm font-medium text-white">{user.displayName}</p>
									<p class="text-xs text-gray-500">{user.email}</p>
									<span class="mt-1 inline-block rounded bg-[rgba(201,168,76,0.15)] px-2 py-0.5 text-xs text-[#c9a84c]">
										{roleLabel[user.role] ?? user.role}
									</span>
								</div>
								<a
									href="/dashboard"
									onclick={() => menuOpen = false}
									class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
								>My Dashboard</a>
								<a
									href="/dashboard/entries"
									onclick={() => menuOpen = false}
									class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
								>My Entries</a>
								<a
									href="/dashboard/profile"
									onclick={() => menuOpen = false}
									class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
								>My Profile</a>
								<div class="border-t border-gray-800 pt-1">
									<form method="POST" action="/signout">
										<button
											type="submit"
											class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-800 hover:text-red-300"
										>
											Sign out
										</button>
									</form>
								</div>
							</div>
						{/if}
					</div>

				{:else}
					<!-- Signed-out nav -->
					<a href="/dashboard/standings" class="text-gray-300 transition hover:text-[#c9a84c]">Standings</a>
					<a href="/dashboard/odds"      class="text-gray-300 transition hover:text-[#c9a84c]">Latest Odds</a>
					<a href="/dashboard/rules"     class="text-gray-300 transition hover:text-[#c9a84c]">Rules</a>
					<a href="/register"
						class="rounded bg-[#c9a84c] px-4 py-1.5 font-semibold text-black transition hover:bg-[#e8c96a]"
					>Register</a>
					<a href="/login"
						class="rounded border border-[#c9a84c] bg-black/80 px-4 py-1.5 text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black"
					>Sign In</a>
				{/if}
			</nav>

		</div>
	</header>

	<!-- Spacer to clear the fixed header (matches header height at each breakpoint) -->
	<div class="h-[58px] sm:h-[64px] md:h-[72px] lg:h-[80px]"></div>

	<!-- Page content -->
	<main class="mx-auto max-w-6xl px-4 py-10">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-[rgba(201,168,76,0.3)] bg-black/80 py-6 text-center text-xs text-gray-500">
		&copy; {new Date().getFullYear()} Last Man / Last Woman Standing Pool. All rights reserved.
	</footer>

</div>
</div>
