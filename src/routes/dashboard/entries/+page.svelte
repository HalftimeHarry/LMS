<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const allEntries = data.entries as any[];

	const lmsEntries = $derived(allEntries.filter((e: any) => e.entryType === 'lms'));
	const shEntries  = $derived(allEntries.filter((e: any) => e.entryType === 'second_half'));
	const pickView   = $derived((data as any).pickView as 'entries' | 'standings');

	function pickLink(entry: any): string {
		if (pickView === 'standings') {
			const pool = entry.entryType === 'lms' ? 'lms' : 'second_half';
			const seasonId = entry.expand?.season?.id ?? entry.season ?? '';
			return `/dashboard/standings?pool=${pool}&season=${seasonId}`;
		}
		return `/dashboard/entries/${entry.id}`;
	}

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
</script>

<svelte:head><title>My Entries — LMS Pool</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold text-white">My Entries</h1>
	{#if (data.seasons as any[]).length > 0}
		<a href="/dashboard/entries/new"
			class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]">
			+ Request Entry
		</a>
	{/if}
</div>

{#if allEntries.length === 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">You have no entries yet.</p>
		{#if (data.seasons as any[]).length > 0}
			<a href="/dashboard/entries/new" class="mt-3 inline-block text-sm text-[#c9a84c] hover:underline">
				Request your first entry →
			</a>
		{:else}
			<p class="mt-2 text-sm text-gray-600">No seasons are currently open for entry.</p>
		{/if}
	</div>
{:else}

<!-- ── LMS Pool ─────────────────────────────────────────────────────────── -->
{#if lmsEntries.length > 0}
<div class="mb-8">
	<div class="mb-3 flex items-center gap-3">
		<div class="h-px flex-1 bg-[rgba(201,168,76,0.2)]"></div>
		<div class="flex items-center gap-2 rounded-full border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-1">
			<span class="text-xs font-bold uppercase tracking-widest text-[#c9a84c]">Last Man Standing</span>
			<span class="rounded-full bg-[rgba(201,168,76,0.2)] px-2 py-0.5 text-xs font-bold text-[#c9a84c]">{lmsEntries.length}</span>
		</div>
		<div class="h-px flex-1 bg-[rgba(201,168,76,0.2)]"></div>
	</div>
	<p class="mb-4 text-center text-xs text-gray-600">
		Pick the team you think will <strong class="text-red-400">LOSE</strong> each week · One team per week · No repeats
	</p>

	<div class="flex flex-col gap-3">
		{#each lmsEntries as entry}
			<div class="rounded-xl border border-[rgba(201,168,76,0.25)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[rgba(201,168,76,0.45)]">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="text-[10px] font-bold uppercase tracking-wider text-[rgba(201,168,76,0.5)]">LMS</span>
							<p class="truncate font-semibold text-white">{entry.entryName}</p>
						</div>
						<p class="mt-0.5 text-sm text-gray-500">{entry.expand?.season?.name ?? ''}</p>
						{#if entry.status === 'eliminated' && entry.eliminatedWeek}
							<p class="mt-1 text-xs text-red-400">
								Eliminated week {entry.eliminatedWeek}{entry.eliminatedReason ? ` — ${entry.eliminatedReason}` : ''}
							</p>
						{/if}
						{#if entry.status === 'pending_payment'}
							<p class="mt-1 text-xs text-yellow-500">Awaiting payment confirmation from admin.</p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-wrap items-center gap-3">
						{#if entry.paid}
							<span class="text-xs text-green-400">✅ Paid</span>
						{:else}
							<span class="text-xs text-gray-500">Payment pending</span>
						{/if}
						<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[entry.status] ?? ''}">
							{statusLabel[entry.status] ?? entry.status}
						</span>
						{#if entry.status === 'active'}
							<a href={pickLink(entry)}
								class="rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-3 py-1.5 text-xs font-medium text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.18)]">
								{pickView === 'standings' ? 'Standings →' : 'View / Pick →'}
							</a>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
{/if}

<!-- ── Second Half Pool ───────────────────────────────────────────────────── -->
{#if shEntries.length > 0}
<div class="mb-8">
	<div class="mb-3 flex items-center gap-3">
		<div class="h-px flex-1 bg-[rgba(59,130,246,0.2)]"></div>
		<div class="flex items-center gap-2 rounded-full border border-[rgba(59,130,246,0.4)] bg-[rgba(59,130,246,0.08)] px-4 py-1">
			<span class="text-xs font-bold uppercase tracking-widest text-blue-400">Second Half Pool</span>
			<span class="rounded-full bg-[rgba(59,130,246,0.2)] px-2 py-0.5 text-xs font-bold text-blue-400">{shEntries.length}</span>
		</div>
		<div class="h-px flex-1 bg-[rgba(59,130,246,0.2)]"></div>
	</div>
	<p class="mb-4 text-center text-xs text-gray-600">
		Pick the team you think will <strong class="text-green-400">WIN</strong> each week · Starts Week 6 · 1 pick wks 6–9, 2 picks wk 10+
	</p>

	<div class="flex flex-col gap-3">
		{#each shEntries as entry}
			<div class="rounded-xl border border-[rgba(59,130,246,0.25)] bg-black/75 p-5 backdrop-blur-sm transition hover:border-[rgba(59,130,246,0.45)]">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="text-[10px] font-bold uppercase tracking-wider text-blue-500">2H</span>
							<p class="truncate font-semibold text-white">{entry.entryName}</p>
						</div>
						<p class="mt-0.5 text-sm text-gray-500">{entry.expand?.season?.name ?? ''}</p>
						{#if entry.status === 'eliminated' && entry.eliminatedWeek}
							<p class="mt-1 text-xs text-red-400">
								Eliminated week {entry.eliminatedWeek}{entry.eliminatedReason ? ` — ${entry.eliminatedReason}` : ''}
							</p>
						{/if}
						{#if entry.status === 'pending_payment'}
							<p class="mt-1 text-xs text-yellow-500">Awaiting payment confirmation from admin.</p>
						{/if}
					</div>
					<div class="flex shrink-0 flex-wrap items-center gap-3">
						{#if entry.paid}
							<span class="text-xs text-green-400">✅ Paid</span>
						{:else}
							<span class="text-xs text-gray-500">Payment pending</span>
						{/if}
						<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[entry.status] ?? ''}">
							{statusLabel[entry.status] ?? entry.status}
						</span>
						{#if entry.status === 'active'}
							<a href={pickLink(entry)}
								class="rounded border border-blue-700 bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-950/70">
								{pickView === 'standings' ? 'Standings →' : 'View / Pick →'}
							</a>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
{/if}

{/if}
