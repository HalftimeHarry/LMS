<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const isSuperAdmin = $derived(data.role === 'super_admin');

	const navItems = $derived(
		isSuperAdmin
			? [
					{ href: '/admin',           label: 'Overview' },
					{ href: '/admin/seasons',   label: 'Seasons' },
					{ href: '/admin/entries',   label: 'Entries' },
					{ href: '/admin/weeks',     label: 'Season Settings' },
					{ href: '/admin/results',   label: 'Results' },
					{ href: '/admin/pools',     label: 'Manage Pools' },
					{ href: '/admin/odds',      label: 'Manage Odds' },
					{ href: '/admin/users',     label: 'Users' },
					{ href: '/admin/picks',     label: 'Manage Picks' },
					{ href: '/admin/duties',    label: 'Admin Duties' },
					{ href: '/admin/teams',     label: 'NFL Teams' },
			  ]
			: [
					{ href: '/admin',           label: 'Overview' },
					{ href: '/admin/entries',   label: 'Entries & Payments' },
					{ href: '/admin/weeks',     label: 'Season Settings' },
					{ href: '/admin/results',   label: 'Results' },
					{ href: '/admin/odds',          label: 'Manage Odds' },
					{ href: '/admin/participants',  label: 'Participants' },
					{ href: '/admin/duties',        label: 'Admin Duties' },
			  ]
	);

	const currentLabel = $derived(
		navItems.find(i => i.href === $page.url.pathname)?.label ?? 'Admin'
	);

	let mobileOpen = $state(false);
	function closeMenu() { mobileOpen = false; }
</script>

<div class="flex min-h-[80vh] gap-6">

	<!-- Desktop sidebar -->
	<aside class="hidden w-48 shrink-0 md:block">
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
			<p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">Admin</p>
			<p class="mb-3 text-xs text-gray-600">{isSuperAdmin ? 'Super Admin' : 'Pool Admin'}</p>
			<nav class="flex flex-col gap-1">
				{#each navItems as item}
					<a href={item.href}
						class="rounded px-3 py-2 text-sm transition
							{$page.url.pathname === item.href
								? 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c]'
								: 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
					>{item.label}</a>
				{/each}
			</nav>
		</div>
	</aside>

	<!-- Content column -->
	<div class="min-w-0 flex-1">

		<!-- Mobile menu bar -->
		<div class="mb-4 md:hidden">
			<button
				type="button"
				onclick={() => mobileOpen = !mobileOpen}
				class="flex w-full items-center justify-between rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 px-4 py-3 backdrop-blur-sm"
			>
				<div class="flex items-center gap-2">
					<span class="text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">Admin</span>
					<span class="text-gray-600">·</span>
					<span class="text-sm text-gray-300">{currentLabel}</span>
				</div>
				<!-- Hamburger / close icon -->
				{#if mobileOpen}
					<svg class="h-5 w-5 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				{:else}
					<svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				{/if}
			</button>

			{#if mobileOpen}
				<button type="button" class="fixed inset-0 z-20" onclick={closeMenu} aria-label="Close menu"></button>
				<div class="relative z-30 mt-1 rounded-xl border border-[rgba(201,168,76,0.3)] shadow-2xl"
					style="background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%), #0a0a0a;">
					<p class="px-4 pb-1 pt-3 text-xs text-gray-600">{isSuperAdmin ? 'Super Admin' : 'Pool Admin'}</p>
					<nav class="flex flex-col py-1">
						{#each navItems as item}
							<a href={item.href} onclick={closeMenu}
								class="px-4 py-2.5 text-sm transition
									{$page.url.pathname === item.href
										? 'bg-[rgba(201,168,76,0.1)] text-[#c9a84c]'
										: 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
							>{item.label}</a>
						{/each}
					</nav>
				</div>
			{/if}
		</div>

		{@render children()}
	</div>
</div>
