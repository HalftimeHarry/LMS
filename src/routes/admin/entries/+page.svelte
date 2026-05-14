<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const statusOptions = [
		{ value: 'pending_payment', label: 'Pending Payment' },
		{ value: 'active',          label: 'Active' },
		{ value: 'eliminated',      label: 'Eliminated' },
		{ value: 'all',             label: 'All' },
	];

	const statusColors: Record<string, string> = {
		pending_payment: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
		active:          'bg-green-950/60 text-green-400 border-green-800',
		eliminated:      'bg-red-950/60 text-red-400 border-red-800',
		winner:          'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]',
	};

	const paymentMethods = ['check', 'venmo', 'paypal', 'zelle', 'cash'];

	let selectedMethod: Record<string, string> = {};
	let createLoading = $state(false);
	let showCreateForm = $state(false);

	// Auto-fill base name when user is selected
	let selectedUserId = $state('');
	const selectedUser = $derived(data.users.find((u: { id: string }) => u.id === selectedUserId));
	const autoBaseName = $derived(
		selectedUser?.displayName
			? `${selectedUser.displayName} Entry`
			: 'Entry'
	);

	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set(key, value);
		goto(`?${params.toString()}`, { replaceState: true });
	}
</script>

<svelte:head><title>Entries — Admin</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-2xl font-bold text-white">Entries</h1>
	<button
		onclick={() => showCreateForm = !showCreateForm}
		class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]"
	>+ Add Entries</button>
</div>

<!-- Success toast -->
{#if form?.action === 'create' && form?.success}
	<div class="mb-4 rounded border border-green-800 bg-green-950/60 px-4 py-3 text-sm text-green-400">
		Created: {(form.created as string[]).join(', ')}
	</div>
{/if}
{#if form?.action === 'create' && form?.error}
	<div class="mb-4 rounded border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-400">{form.error}</div>
{/if}

<!-- Create entries form -->
{#if showCreateForm}
<div class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
	<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-[#c9a84c]">Add Entries for a Player</h2>
	<form
		method="POST"
		action="?/createEntries"
		use:enhance={() => {
			createLoading = true;
			return async ({ update }) => { await update(); createLoading = false; showCreateForm = false; };
		}}
		class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
	>
		<!-- Season -->
		<div class="flex flex-col gap-1">
			<label for="seasonId" class="text-xs font-medium text-gray-400">Season</label>
			<select id="seasonId" name="seasonId" required
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
				<option value="">Select season…</option>
				{#each data.seasons as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		</div>

		<!-- User -->
		<div class="flex flex-col gap-1">
			<label for="userId" class="text-xs font-medium text-gray-400">Player</label>
			<select id="userId" name="userId" required bind:value={selectedUserId}
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none">
				<option value="">Select player…</option>
				{#each data.users as u}
					<option value={u.id}>{u.displayName || u.email}</option>
				{/each}
			</select>
		</div>

		<!-- Number of entries -->
		<div class="flex flex-col gap-1">
			<label for="count" class="text-xs font-medium text-gray-400">Number of entries</label>
			<input id="count" name="count" type="number" min="1" max="20" value="1" required
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none" />
			<p class="text-xs text-gray-600">More than 1 appends a number: "Entry 1", "Entry 2"…</p>
		</div>

		<!-- Base name -->
		<div class="flex flex-col gap-1">
			<label for="baseName" class="text-xs font-medium text-gray-400">Entry base name</label>
			<input id="baseName" name="baseName" type="text" required
				value={autoBaseName}
				placeholder="e.g. Dustin Entry"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			<p class="text-xs text-gray-600">Single entry keeps this name as-is unless they already have entries.</p>
		</div>

		<!-- Referred by -->
		<div class="flex flex-col gap-1">
			<label for="referredBy" class="text-xs font-medium text-gray-400">Referred by (optional)</label>
			<input id="referredBy" name="referredBy" type="text"
				placeholder="Referring player's username"
				class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
		</div>

		<!-- Submit -->
		<div class="flex items-end gap-3">
			<button type="submit" disabled={createLoading}
				class="rounded bg-[#c9a84c] px-6 py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{createLoading ? 'Creating…' : 'Create'}
			</button>
			<button type="button" onclick={() => showCreateForm = false}
				class="rounded border border-gray-700 px-4 py-2.5 text-sm text-gray-400 transition hover:bg-gray-800">
				Cancel
			</button>
		</div>
	</form>
</div>
{/if}
	<div class="flex flex-wrap gap-3">
		<!-- Season filter -->
		<select
			value={data.seasonFilter ?? ''}
			onchange={(e) => updateFilter('season', (e.target as HTMLSelectElement).value)}
			class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
		>
			<option value="">All seasons</option>
			{#each data.seasons as s}
				<option value={s.id}>{s.name}</option>
			{/each}
		</select>
		<!-- Status filter -->
		<select
			value={data.statusFilter}
			onchange={(e) => updateFilter('status', (e.target as HTMLSelectElement).value)}
			class="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
		>
			{#each statusOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
</div>

<p class="mb-4 text-sm text-gray-500">{data.entries.length} entr{data.entries.length === 1 ? 'y' : 'ies'}</p>

{#if data.entries.length === 0}
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-12 text-center backdrop-blur-sm">
		<p class="text-gray-400">No entries match this filter.</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each data.entries as entry}
			<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<!-- Entry info -->
					<div>
						<p class="font-semibold text-white">{entry.entryName}</p>
						<p class="mt-0.5 text-sm text-gray-400">
							{entry.expand?.user?.displayName ?? entry.expand?.user?.email ?? 'Unknown user'}
							· {entry.expand?.season?.name ?? '—'}
						</p>
						{#if entry.referredBy}
							<p class="mt-0.5 text-xs text-gray-500">Referred by: {entry.referredBy}</p>
						{/if}
						{#if entry.paid && entry.paymentMethod}
							<p class="mt-1 text-xs text-green-400">
								Paid via {entry.paymentMethod}
								{#if entry.paidAt} on {new Date(entry.paidAt).toLocaleDateString()}{/if}
							</p>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex flex-wrap items-center gap-2">
						<span class="rounded border px-2.5 py-1 text-xs font-medium {statusColors[entry.status] ?? ''}">
							{entry.status.replace('_', ' ')}
						</span>

						{#if !entry.paid}
							<!-- Mark paid -->
							<form method="POST" action="?/markPaid" use:enhance class="flex items-center gap-2">
								<input type="hidden" name="id" value={entry.id} />
								<select
									name="paymentMethod"
									bind:value={selectedMethod[entry.id]}
									class="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-[#c9a84c] focus:outline-none"
								>
									<option value="">Method…</option>
									{#each paymentMethods as m}
										<option value={m}>{m}</option>
									{/each}
								</select>
								<button
									type="submit"
									disabled={!selectedMethod[entry.id]}
									class="rounded border border-green-800 bg-green-950/40 px-3 py-1 text-xs text-green-400 transition hover:bg-green-950/70 disabled:opacity-40"
								>Mark Paid</button>
							</form>
						{:else}
							<!-- Mark unpaid -->
							<form method="POST" action="?/markUnpaid" use:enhance>
								<input type="hidden" name="id" value={entry.id} />
								<button type="submit"
									class="rounded border border-gray-700 px-3 py-1 text-xs text-gray-400 transition hover:bg-gray-800">
									Undo Paid
								</button>
							</form>
						{/if}

						<!-- Delete -->
						<form method="POST" action="?/deleteEntry" use:enhance>
							<input type="hidden" name="id" value={entry.id} />
							<button
								type="submit"
								onclick={(e) => { if (!confirm(`Delete "${entry.entryName}"?`)) e.preventDefault(); }}
								class="rounded border border-red-900 px-3 py-1 text-xs text-red-500 transition hover:bg-red-950/40"
							>Delete</button>
						</form>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
