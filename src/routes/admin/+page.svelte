<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const isSuperAdmin = $derived(data.role === 'super_admin');

	const seasonStatusColors: Record<string, string> = {
		setup:    'text-gray-400',
		open:     'text-blue-400',
		active:   'text-green-400',
		complete: 'text-gray-500',
	};

	// Stats shown to all admins
	const sharedStats = $derived([
		{ label: 'Total Entries',   value: data.stats.totalEntries,      color: 'text-white' },
		{ label: 'LMS Entries',     value: data.stats.lmsEntries,        color: 'text-white' },
		{ label: 'Second Half',     value: data.stats.secondHalfEntries, color: 'text-white' },
		{ label: 'Paid',            value: data.stats.paidEntries,       color: 'text-green-400' },
		{ label: 'Free Entries',    value: data.stats.freeEntries,       color: 'text-blue-400' },
		{ label: 'Pending Payment', value: data.stats.pendingPayment,    color: 'text-yellow-400' },
		{ label: 'Active',          value: data.stats.activeEntries,     color: 'text-green-400' },
		{ label: 'Eliminated',      value: data.stats.eliminatedEntries, color: 'text-red-400' },
		{ label: 'LMS Pot',         value: `$${(data.stats.lmsPot ?? 0).toLocaleString()}`,         color: 'text-[#c9a84c]' },
		{ label: '2nd Half Pot',    value: `$${(data.stats.secondHalfPot ?? 0).toLocaleString()}`,  color: 'text-[#c9a84c]' },
		{ label: 'Total Pot',       value: `$${(data.stats.potEstimate ?? 0).toLocaleString()}`,    color: 'text-[#c9a84c]' },
	]);

	// Extra stats only super_admin needs
	const superStats = $derived([
		{ label: 'Registered Users', value: data.stats.totalUsers, color: 'text-white' },
	]);

	const allStats = $derived(isSuperAdmin ? [...superStats, ...sharedStats] : sharedStats);

	// Quick actions differ by role
	const quickActions = $derived(
		isSuperAdmin
			? [
					{ href: '/admin/entries?status=pending_payment', label: 'Approve Payments', desc: `${data.stats.pendingPayment} pending` },
					{ href: '/admin/seasons',                        label: 'Manage Seasons',   desc: `${data.seasons.length} season${data.seasons.length !== 1 ? 's' : ''}` },
					{ href: '/admin/weeks',                          label: 'Weekly Settings',  desc: 'Deadlines & auto-picks' },
					{ href: '/admin/teams',                          label: 'NFL Teams',        desc: 'View seeded teams' },
			  ]
			: [
					{ href: '/admin/entries?status=pending_payment', label: 'Approve Payments', desc: `${data.stats.pendingPayment} pending` },
					{ href: '/admin/entries',                        label: 'All Entries',      desc: `${data.stats.totalEntries} total` },
					{ href: '/admin/weeks',                          label: 'Weekly Settings',  desc: 'Deadlines & auto-picks' },
			  ]
	);
</script>

<svelte:head><title>Admin Dashboard — LMS Pool</title></svelte:head>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-white">
		{isSuperAdmin ? 'Admin Dashboard' : 'Pool Admin Dashboard'}
	</h1>
	{#if data.activeSeason}
		<p class="mt-1 text-sm text-gray-400">
			Active season:
			<span class="text-[#c9a84c]">{data.activeSeason.name}</span>
			<span class="ml-2 {seasonStatusColors[data.activeSeason.status]}">
				({data.activeSeason.status})
			</span>
		</p>
	{:else}
		<p class="mt-1 text-sm text-gray-500">No active season.</p>
	{/if}
</div>

<!-- Stats grid -->
<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
	{#each allStats as card}
		<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 text-center backdrop-blur-sm">
			<div class="text-2xl font-bold {card.color}">{card.value}</div>
			<div class="mt-1 text-xs text-gray-500">{card.label}</div>
		</div>
	{/each}
</div>

<!-- Quick actions -->
<div class="mb-8">
	<h2 class="mb-4 text-lg font-semibold text-[#c9a84c]">Quick Actions</h2>
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each quickActions as action}
			<a href={action.href}
				class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[#c9a84c]">
				<p class="font-semibold text-white">{action.label}</p>
				<p class="mt-1 text-sm text-gray-500">{action.desc}</p>
			</a>
		{/each}
	</div>
</div>

<!-- All seasons — super_admin only -->
{#if isSuperAdmin && data.seasons.length > 0}
	<div>
		<h2 class="mb-4 text-lg font-semibold text-[#c9a84c]">All Seasons</h2>
		<div class="flex flex-col gap-2">
			{#each data.seasons as season}
				<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-black/60 px-4 py-3">
					<div>
						<span class="font-medium text-white">{season.name}</span>
						<span class="ml-3 text-sm text-gray-500">
							LMS ${season.lmsEntryFee ?? '—'} / 2nd Half ${season.secondHalfEntryFee ?? '—'}
						</span>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-sm {seasonStatusColors[season.status]}">{season.status}</span>
						<a href="/admin/seasons" class="text-xs text-[#c9a84c] hover:underline">Manage →</a>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- pool_admin: pending payments callout -->
{#if !isSuperAdmin && data.stats.pendingPayment > 0}
	<div class="rounded-xl border border-yellow-800 bg-yellow-950/40 p-5">
		<p class="font-semibold text-yellow-400">
			{data.stats.pendingPayment} entr{data.stats.pendingPayment === 1 ? 'y' : 'ies'} awaiting payment approval
		</p>
		<a href="/admin/entries?status=pending_payment" class="mt-2 inline-block text-sm text-[#c9a84c] hover:underline">
			Review now →
		</a>
	</div>
{/if}
