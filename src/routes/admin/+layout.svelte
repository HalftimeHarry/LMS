<script lang="ts">
	import type { LayoutData } from './$types';
	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const isSuperAdmin = $derived(data.role === 'super_admin');

	// super_admin sees everything; pool_admin sees entries/payments/weeks only
	const navItems = $derived(
		isSuperAdmin
			? [
					{ href: '/admin',         label: 'Overview' },
					{ href: '/admin/seasons', label: 'Seasons' },
					{ href: '/admin/entries', label: 'Entries' },
					{ href: '/admin/weeks',   label: 'Weekly Settings' },
					{ href: '/admin/teams',   label: 'NFL Teams' },
			  ]
			: [
					{ href: '/admin',         label: 'Overview' },
					{ href: '/admin/entries', label: 'Entries & Payments' },
					{ href: '/admin/weeks',   label: 'Weekly Settings' },
			  ]
	);
</script>

<div class="flex min-h-[80vh] gap-6">
	<!-- Sidebar -->
	<aside class="hidden w-48 shrink-0 md:block">
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 backdrop-blur-sm">
			<p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">Admin</p>
			<p class="mb-3 text-xs text-gray-600">
				{isSuperAdmin ? 'Super Admin' : 'Pool Admin'}
			</p>
			<nav class="flex flex-col gap-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="rounded px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white"
					>{item.label}</a>
				{/each}
			</nav>
		</div>
	</aside>

	<!-- Content -->
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
