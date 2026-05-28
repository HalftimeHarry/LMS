<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const users       = $derived(data.users       as any[]);
	const entriesByUser = $derived(data.entriesByUser as Record<string, any[]>);

	// ── Selection ─────────────────────────────────────────────────────────────
	let selected = $state<Set<string>>(new Set());

	const allSelected = $derived(users.length > 0 && selected.size === users.length);
	const someSelected = $derived(selected.size > 0);

	function toggleAll() {
		if (allSelected) {
			selected = new Set();
		} else {
			selected = new Set(users.map((u: any) => u.id));
		}
	}

	function toggleOne(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	// ── Confirmation state ────────────────────────────────────────────────────
	// null = no dialog open
	// { ids, names } = pending confirmation
	type PendingDelete = { ids: string[]; names: string[] };
	let pending = $state<PendingDelete | null>(null);

	function requestDelete(ids: string[]) {
		const names = ids.map(id => {
			const u = users.find((u: any) => u.id === id);
			return u?.displayName ?? u?.email ?? id;
		});
		pending = { ids, names };
	}

	function cancelDelete() {
		pending = null;
	}

	// ── Search ────────────────────────────────────────────────────────────────
	let search = $state('');
	const filtered = $derived(
		users.filter((u: any) => {
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return (
				(u.displayName ?? '').toLowerCase().includes(q) ||
				(u.email ?? '').toLowerCase().includes(q)
			);
		})
	);

	// ── After successful delete ───────────────────────────────────────────────
	$effect(() => {
		if ((form as any)?.success) {
			selected = new Set();
			pending  = null;
			invalidateAll();
		}
	});

	// ── Scroll-to-top ─────────────────────────────────────────────────────────
	let scrollEl      = $state<HTMLElement | null>(null);
	let showScrollTop = $state(false);

	function onScroll() {
		showScrollTop = (scrollEl?.scrollTop ?? 0) > 100;
	}
	function scrollToTop() {
		scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head><title>Manage Participants — Admin</title></svelte:head>

<div class="relative rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
		<div>
			<h1 class="text-xl font-bold text-white">Manage Participants</h1>
			<p class="mt-0.5 text-sm text-gray-500">{users.length} participant{users.length !== 1 ? 's' : ''} registered</p>
		</div>
	</div>

	<!-- Toasts -->
	{#if (form as any)?.error}
		<div class="mx-5 mb-3 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">
			{(form as any).error}
		</div>
	{/if}
	{#if (form as any)?.success}
		<div class="mx-5 mb-3 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
			✅ {(form as any).deleted} participant{(form as any).deleted !== 1 ? 's' : ''} deleted.
		</div>
	{/if}

	<!-- Search + bulk delete bar -->
	<div class="flex flex-wrap items-center gap-3 border-t border-gray-800 px-4 py-3">
			<input
				type="text"
				placeholder="Search name or email…"
				bind:value={search}
				class="rounded border border-gray-700 bg-gray-900 py-1.5 pl-3 pr-3 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none w-56"
			/>
			<span class="ml-auto text-xs text-gray-600">{filtered.length} of {users.length} shown</span>
			{#if someSelected}
				<span class="text-xs text-gray-500">{selected.size} selected</span>
				<button type="button" onclick={() => selected = new Set()}
					class="text-xs text-gray-600 hover:text-gray-400">Clear</button>
				<button
					type="button"
					onclick={() => requestDelete([...selected])}
					class="flex items-center gap-1.5 rounded border border-red-700 bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/60"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
					</svg>
					Delete {selected.size} selected
				</button>
			{/if}
		</div>

		<!-- Table -->
		<div
			bind:this={scrollEl}
			onscroll={onScroll}
			class="overflow-x-auto max-h-[60vh] overflow-y-auto"
		>
			<table class="min-w-full text-sm">
				<thead>
					<tr class="sticky top-0 z-10 border-b border-gray-800 bg-[#0a0a0a] text-xs font-medium uppercase tracking-wider text-gray-500">
						<th class="w-10 px-4 py-3"></th>
						<th class="px-4 py-3 text-left">Name</th>
						<th class="px-4 py-3 text-left">Email</th>
						<th class="px-4 py-3 text-center">Entries</th>
						<th class="px-4 py-3 text-left">Joined</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as user (user.id)}
						{@const userEntries = entriesByUser[user.id] ?? []}
						{@const isSelected  = selected.has(user.id)}
						<tr class="border-b border-gray-800/40 transition hover:bg-white/[0.02]
							{isSelected ? 'bg-red-950/10' : ''}">

							<!-- Checkbox -->
							<td class="px-4 py-3">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleOne(user.id)}
									class="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-[#c9a84c]"
								/>
							</td>

							<!-- Name -->
							<td class="px-4 py-3">
								<p class="font-medium text-white">{user.displayName ?? '—'}</p>
							</td>

							<!-- Email -->
							<td class="px-4 py-3 text-gray-400">{user.email}</td>

							<!-- Entries -->
							<td class="px-4 py-3 text-center">
								{#if userEntries.length > 0}
									<span class="font-mono text-sm text-[#c9a84c]">{userEntries.length}</span>
								{:else}
									<span class="text-gray-600">0</span>
								{/if}
							</td>

							<!-- Joined -->
							<td class="px-4 py-3 text-xs text-gray-500">
								{new Date(user.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
							</td>

							<!-- Delete single -->
							<td class="px-4 py-3 text-right">
								<button
									type="button"
									onclick={() => requestDelete([user.id])}
									class="rounded border border-gray-800 px-2.5 py-1 text-xs text-gray-600 transition hover:border-red-800 hover:bg-red-950/40 hover:text-red-400"
								>
									Delete
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-600">
								{search ? 'No participants match your search.' : 'No participants yet.'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<!-- Back to top -->
	{#if showScrollTop}
		<button
			type="button"
			onclick={scrollToTop}
			class="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-[rgba(201,168,76,0.3)] bg-black/90 px-3 py-1.5 text-xs font-medium text-[#c9a84c] shadow-lg backdrop-blur-sm transition hover:bg-[rgba(201,168,76,0.1)]"
		>
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
			</svg>
			Top
		</button>
	{/if}

</div><!-- end single card -->

<!-- ── Confirmation dialog ─────────────────────────────────────────────────── -->
{#if pending}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
		onclick={cancelDelete}
		aria-label="Cancel"
	></button>

	<!-- Dialog -->
	<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-800 bg-[#0d0d0d] p-6 shadow-2xl">

		<!-- Warning icon + title -->
		<div class="mb-4 flex items-start gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-800 bg-red-950/60">
				<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
				</svg>
			</div>
			<div>
				<h2 class="text-base font-bold text-white">
					Delete {pending.ids.length === 1 ? 'participant' : `${pending.ids.length} participants`}?
				</h2>
				<p class="mt-1 text-sm text-red-400 font-medium">This cannot be undone.</p>
			</div>
		</div>

		<!-- Who is being deleted -->
		<div class="mb-4 max-h-36 overflow-y-auto rounded-lg border border-gray-800 bg-black/60 px-3 py-2">
			{#each pending.names as name}
				<p class="py-0.5 text-sm text-gray-300">{name}</p>
			{/each}
		</div>

		<!-- What gets deleted -->
		<div class="mb-5 rounded-lg border border-yellow-900/50 bg-yellow-950/20 px-3 py-2.5 text-xs text-yellow-600 space-y-1">
			<p>⚠️ Deleting a participant will also permanently delete:</p>
			<ul class="ml-4 list-disc space-y-0.5 text-yellow-700">
				<li>All of their pool entries</li>
				<li>Their account and login access</li>
			</ul>
			<p class="mt-1 font-medium text-yellow-500">There is no way to recover this data.</p>
		</div>

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				type="button"
				onclick={cancelDelete}
				class="flex-1 rounded border border-gray-700 bg-gray-900 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
			>
				Cancel
			</button>

			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
				class="flex-1"
			>
				{#each pending.ids as id}
					<input type="hidden" name="ids" value={id} />
				{/each}
				<button
					type="submit"
					class="w-full rounded border border-red-700 bg-red-950/80 py-2 text-sm font-bold text-red-400 transition hover:bg-red-900"
				>
					Yes, delete permanently
				</button>
			</form>
		</div>
	</div>
{/if}
