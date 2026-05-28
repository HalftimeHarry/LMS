<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const users      = $derived(data.users as any[]);
	const entryCounts = $derived(data.entryCounts as Record<string, number>);

	let search        = $state('');
	let selected      = $state<Set<string>>(new Set());
	let deleteConfirm = $state(false);
	let loading       = $state(false);

	const filtered = $derived(
		users.filter((u: any) =>
			!search ||
			u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
			u.email?.toLowerCase().includes(search.toLowerCase())
		)
	);

	const participants = $derived(filtered.filter((u: any) => u.role === 'participant'));
	const admins       = $derived(filtered.filter((u: any) => u.role !== 'participant'));

	function toggleAll() {
		if (selected.size === participants.length) {
			selected = new Set();
		} else {
			selected = new Set(participants.map((u: any) => u.id));
		}
	}

	function toggle(id: string) {
		const s = new Set(selected);
		s.has(id) ? s.delete(id) : s.add(id);
		selected = s;
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head><title>Manage Users — Admin</title></svelte:head>

<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Manage Users</h1>
			<p class="mt-1 text-sm text-gray-500">View and remove participant accounts. Admin accounts cannot be bulk-deleted.</p>
		</div>
		<div class="flex items-center gap-3">
			<input
				type="text"
				bind:value={search}
				placeholder="Search name or email…"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none w-56"
			/>
		</div>
	</div>

	<!-- Stats row -->
	<div class="mt-4 grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-gray-800">
		<div class="bg-black/60 px-4 py-3">
			<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Total Users</p>
			<p class="mt-1 text-xl font-bold text-white">{users.length}</p>
		</div>
		<div class="bg-black/60 px-4 py-3">
			<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Participants</p>
			<p class="mt-1 text-xl font-bold text-white">{users.filter((u: any) => u.role === 'participant').length}</p>
		</div>
		<div class="bg-black/60 px-4 py-3">
			<p class="text-xs font-medium uppercase tracking-wider text-gray-500">Admins</p>
			<p class="mt-1 text-xl font-bold text-white">{users.filter((u: any) => u.role !== 'participant').length}</p>
		</div>
	</div>
</div>

{#if form?.error}
	<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">{form.error}</div>
{/if}
{#if (form as any)?.success}
	<div class="mb-4 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
		Deleted {(form as any).deleted} user{(form as any).deleted !== 1 ? 's' : ''}.
	</div>
{/if}

<!-- Bulk delete bar -->
{#if selected.size > 0}
	<div class="mb-4 flex items-center justify-between rounded-lg border border-red-900 bg-red-950/30 px-4 py-3">
		<span class="text-sm text-red-300">{selected.size} user{selected.size !== 1 ? 's' : ''} selected</span>
		<div class="flex items-center gap-3">
			{#if deleteConfirm}
				<span class="text-sm text-red-400">Are you sure? This cannot be undone.</span>
				<form method="POST" action="?/deleteUsers" use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
						selected = new Set();
						deleteConfirm = false;
						await invalidateAll();
					};
				}}>
					{#each [...selected] as id}
						<input type="hidden" name="ids" value={id} />
					{/each}
					<button type="submit" disabled={loading}
						class="rounded border border-red-500 bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-900/60 disabled:opacity-40">
						{loading ? 'Deleting…' : 'Confirm Delete'}
					</button>
				</form>
				<button type="button" onclick={() => deleteConfirm = false}
					class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800">
					Cancel
				</button>
			{:else}
				<button type="button" onclick={() => deleteConfirm = true}
					class="rounded border border-red-800 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-950/70">
					Delete Selected
				</button>
				<button type="button" onclick={() => selected = new Set()}
					class="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800">
					Clear
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- Participants table -->
<div class="rounded-xl border border-gray-800 bg-black/75 backdrop-blur-sm overflow-hidden">
	<div class="flex items-center justify-between border-b border-gray-800 px-5 py-3">
		<p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Participants ({participants.length})</p>
		{#if participants.length > 0}
			<button type="button" onclick={toggleAll}
				class="text-xs text-gray-500 hover:text-gray-300 transition">
				{selected.size === participants.length ? 'Deselect all' : 'Select all'}
			</button>
		{/if}
	</div>

	{#if participants.length === 0}
		<p class="px-5 py-8 text-center text-sm text-gray-600">No participants found.</p>
	{:else}
		<div class="divide-y divide-gray-800/60">
			{#each participants as u}
				{@const count = entryCounts[u.id] ?? 0}
				<div class="flex items-center gap-4 px-5 py-3 transition hover:bg-gray-900/40
					{selected.has(u.id) ? 'bg-red-950/10' : ''}">
					<input type="checkbox" checked={selected.has(u.id)}
						onchange={() => toggle(u.id)}
						class="h-4 w-4 accent-red-500 shrink-0" />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-white">{u.displayName || '—'}</p>
						<p class="truncate text-xs text-gray-500">{u.email}</p>
					</div>
					<div class="flex items-center gap-3 shrink-0">
						{#if count > 0}
							<span class="rounded border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-xs text-[#c9a84c]">
								{count} {count === 1 ? 'entry' : 'entries'}
							</span>
						{/if}
						{#if !u.verified}
							<span class="rounded border border-yellow-800 bg-yellow-950/40 px-2 py-0.5 text-xs text-yellow-500">unverified</span>
						{/if}
						<span class="text-xs text-gray-600">{fmtDate(u.created)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Admins table (read-only) -->
{#if admins.length > 0}
	<div class="mt-4 rounded-xl border border-gray-800 bg-black/75 backdrop-blur-sm overflow-hidden">
		<div class="border-b border-gray-800 px-5 py-3">
			<p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Admins ({admins.length})</p>
		</div>
		<div class="divide-y divide-gray-800/60">
			{#each admins as u}
				<div class="flex items-center gap-4 px-5 py-3">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-white">{u.displayName || '—'}</p>
						<p class="truncate text-xs text-gray-500">{u.email}</p>
					</div>
					<span class="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-xs text-gray-400">{u.role}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
