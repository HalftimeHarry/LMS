<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusColors: Record<string, string> = {
		pending_payment: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		active:          'bg-green-950/60 text-green-400 border-green-800',
		eliminated:      'bg-red-950/60 text-red-400 border-red-800',
		winner:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	const statusLabel: Record<string, string> = {
		pending_payment: 'Pending Payment',
		active:          'Active',
		eliminated:      'Eliminated',
		winner:          'Winner',
	};

	const active    = $derived(data.entries.filter((e: { status: string }) => e.status === 'active'));
	const pending   = $derived(data.entries.filter((e: { status: string }) => e.status === 'pending_payment'));
	const eliminated= $derived(data.entries.filter((e: { status: string }) => e.status === 'eliminated'));
</script>

<svelte:head><title>My Entries — LMS Pool</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold text-white">My Entries</h1>
	{#if data.seasons.length > 0}
		<a
			href="/dashboard/entries/new"
			class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]"
		>+ Request Entry</a>
	{/if}
</div>

{#if data.entries.length === 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">You have no entries yet.</p>
		{#if data.seasons.length > 0}
			<a href="/dashboard/entries/new" class="mt-3 inline-block text-sm text-[#c9a84c] hover:underline">
				Request your first entry →
			</a>
		{:else}
			<p class="mt-2 text-sm text-gray-600">No seasons are currently open for entry.</p>
		{/if}
	</div>
{:else}
	<!-- Summary bar -->
	<div class="mb-6 grid grid-cols-3 gap-4">
		{#each [
			{ label: 'Active',    count: active.length,     color: 'text-green-400' },
			{ label: 'Pending',   count: pending.length,    color: 'text-yellow-400' },
			{ label: 'Eliminated',count: eliminated.length, color: 'text-red-400' },
		] as s}
			<div class="rounded-lg border border-[rgba(201,168,76,0.3)] bg-black/75 p-4 text-center backdrop-blur-sm">
				<div class="text-2xl font-bold {s.color}">{s.count}</div>
				<div class="mt-0.5 text-xs text-gray-500">{s.label}</div>
			</div>
		{/each}
	</div>

	<!-- Entry list -->
	<div class="flex flex-col gap-3">
		{#each data.entries as entry}
			<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p class="font-semibold text-white">{entry.entryName}</p>
						<p class="mt-0.5 text-sm text-gray-400">
							{entry.expand?.season?.name ?? 'Unknown season'}
						</p>
						{#if entry.status === 'eliminated' && entry.eliminatedWeek}
							<p class="mt-1 text-xs text-red-400">
								Eliminated week {entry.eliminatedWeek}
								{#if entry.eliminatedReason} — {entry.eliminatedReason}{/if}
							</p>
						{/if}
						{#if entry.status === 'pending_payment'}
							<p class="mt-1 text-xs text-yellow-500">
								Awaiting payment confirmation from admin.
							</p>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						{#if entry.paid}
							<span class="text-xs text-green-400">✅ Paid</span>
						{:else}
							<span class="text-xs text-gray-500">Payment pending</span>
						{/if}
						<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[entry.status] ?? ''}">
							{statusLabel[entry.status] ?? entry.status}
						</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
