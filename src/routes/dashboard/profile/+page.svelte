<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const roleLabel: Record<string, { label: string; color: string }> = {
		super_admin: { label: 'Super Admin', color: 'bg-red-950/60 text-red-400 border-red-800' },
		pool_admin:  { label: 'Pool Admin',  color: 'bg-blue-950/60 text-blue-400 border-blue-800' },
		participant: { label: 'Participant', color: 'bg-[rgba(201,168,76,0.15)] text-[#c9a84c] border-[rgba(201,168,76,0.4)]' }
	};

	const role = $derived(roleLabel[data.user.role] ?? { label: data.user.role, color: 'bg-gray-800 text-gray-400 border-gray-700' });

	let displayName    = $state(data.user.displayName as string ?? '');
	let profileLoading = $state(false);
	let passwordLoading = $state(false);
	let pickViewLoading = $state(false);

	const pickView = $derived((data as any).pickView as 'entries' | 'standings');

	// Show password section toggle
	let showPasswordForm = $state(false);
</script>

<svelte:head><title>My Profile — LMS Pool</title></svelte:head>

<div class="mx-auto max-w-xl">

	<h1 class="mb-8 text-3xl font-bold text-white">My Profile</h1>

	<!-- Role badge -->
	<div class="mb-8 flex items-center gap-3 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-5 backdrop-blur-sm">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a84c] text-lg font-bold text-black">
			{data.user.displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
		</div>
		<div>
			<p class="font-semibold text-white">{data.user.displayName}</p>
			<p class="text-sm text-gray-400">{data.user.email}</p>
		</div>
		<span class="ml-auto rounded border px-3 py-1 text-xs font-medium {role.color}">
			{role.label}
		</span>
	</div>

	<!-- Profile form -->
	<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<h2 class="mb-4 text-lg font-semibold text-[#c9a84c]">Account Details</h2>

		{#if form?.action === 'profile' && form?.success}
			<p class="mb-4 rounded border border-green-800 bg-green-950/60 px-3 py-2 text-sm text-green-400">
				Profile updated.
			</p>
		{/if}
		{#if form?.action === 'profile' && form?.error}
			<p class="mb-4 rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">
				{form.error}
			</p>
		{/if}

		<form
			method="POST"
			action="?/updateProfile"
			use:enhance={() => {
				profileLoading = true;
				return async ({ update }) => { await update(); profileLoading = false; };
			}}
			class="flex flex-col gap-4"
		>
			<div class="flex flex-col gap-1">
				<label for="displayName" class="text-xs font-medium text-gray-400">Display name</label>
				<input id="displayName" name="displayName" type="text"
					bind:value={displayName}
					required minlength="2"
					class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none" />
			</div>

			<div class="flex flex-col gap-1">
				<label for="email-display" class="text-xs font-medium text-gray-400">Email</label>
				<input id="email-display" type="email" value={data.user.email} disabled
					class="cursor-not-allowed rounded border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-500" />
				<p class="text-xs text-gray-600">Email cannot be changed here. Contact an admin.</p>
			</div>

			<div class="flex flex-col gap-1">
				<p class="text-xs font-medium text-gray-400">Role</p>
				<div class="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/50 px-3 py-2">
					<span class="rounded border px-2 py-0.5 text-xs font-medium {role.color}">{role.label}</span>
					<span class="text-xs text-gray-600">Role is assigned by a super admin.</span>
				</div>
			</div>

			<button type="submit" disabled={profileLoading}
				class="rounded bg-[#c9a84c] py-2.5 font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{profileLoading ? 'Saving…' : 'Save changes'}
			</button>
		</form>
	</section>

	<!-- Pick view preference -->
	<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<h2 class="mb-1 text-lg font-semibold text-[#c9a84c]">Pick Preference</h2>
		<p class="mb-4 text-sm text-gray-500">Choose where "View / Pick" links take you by default.</p>

		{#if form?.action === 'pickView' && form?.success}
			<p class="mb-4 rounded border border-green-800 bg-green-950/60 px-3 py-2 text-sm text-green-400">Preference saved.</p>
		{/if}

		<form method="POST" action="?/setPickView" use:enhance={() => {
			pickViewLoading = true;
			return async ({ update }) => { await update(); pickViewLoading = false; };
		}}>
			<div class="mb-4 grid grid-cols-2 gap-3">
				<!-- Entries view -->
				<label class="flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition
					{pickView === 'entries'
						? 'border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.08)]'
						: 'border-gray-700 bg-gray-900/40 hover:border-gray-500'}">
					<input type="radio" name="pickView" value="entries"
						checked={pickView === 'entries'}
						class="sr-only" />
					<div class="flex items-center gap-2">
						<span class="text-lg">📋</span>
						<span class="font-semibold text-white text-sm">Entry Page</span>
						{#if pickView === 'entries'}
							<span class="ml-auto text-xs text-[#c9a84c]">current</span>
						{/if}
					</div>
					<p class="text-xs text-gray-500 leading-relaxed">
						Opens your entry's pick history. Best for reviewing past picks and submitting one entry at a time.
					</p>
				</label>

				<!-- Standings view -->
				<label class="flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition
					{pickView === 'standings'
						? 'border-blue-600 bg-blue-950/20'
						: 'border-gray-700 bg-gray-900/40 hover:border-gray-500'}">
					<input type="radio" name="pickView" value="standings"
						checked={pickView === 'standings'}
						class="sr-only" />
					<div class="flex items-center gap-2">
						<span class="text-lg">🏆</span>
						<span class="font-semibold text-white text-sm">Standings</span>
						{#if pickView === 'standings'}
							<span class="ml-auto text-xs text-blue-400">current</span>
						{/if}
					</div>
					<p class="text-xs text-gray-500 leading-relaxed">
						Opens the standings grid. Best if you have multiple entries — pick directly from the grid row.
					</p>
				</label>
			</div>

			<button type="submit" disabled={pickViewLoading}
				class="rounded bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a] disabled:opacity-50">
				{pickViewLoading ? 'Saving…' : 'Save preference'}
			</button>
		</form>
	</section>

	<!-- Password section -->
	<section class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm">
		<button
			onclick={() => showPasswordForm = !showPasswordForm}
			class="flex w-full items-center justify-between text-lg font-semibold text-[#c9a84c]"
		>
			Change Password
			<svg
				class="h-4 w-4 transition-transform {showPasswordForm ? 'rotate-180' : ''}"
				fill="none" viewBox="0 0 24 24" stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if showPasswordForm}
			<div class="mt-4">
				{#if form?.action === 'password' && form?.error}
					<p class="mb-4 rounded border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-400">
						{form.error}
					</p>
				{/if}

				<form
					method="POST"
					action="?/changePassword"
					use:enhance={() => {
						passwordLoading = true;
						return async ({ update }) => { await update(); passwordLoading = false; };
					}}
					class="flex flex-col gap-4"
				>
					<div class="flex flex-col gap-1">
						<label for="currentPassword" class="text-xs font-medium text-gray-400">Current password</label>
						<input
							id="currentPassword"
							name="currentPassword"
							type="password"
							required
							class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="newPassword" class="text-xs font-medium text-gray-400">New password</label>
						<input
							id="newPassword"
							name="newPassword"
							type="password"
							required
							minlength="8"
							placeholder="Min. 8 characters"
							class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="confirmPassword" class="text-xs font-medium text-gray-400">Confirm new password</label>
						<input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							required
							class="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#c9a84c] focus:outline-none"
						/>
					</div>

					<p class="text-xs text-gray-500">You will be signed out after changing your password.</p>

					<button
						type="submit"
						disabled={passwordLoading}
						class="rounded border border-[#c9a84c] bg-black/80 py-2.5 font-semibold text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black disabled:opacity-50"
					>
						{passwordLoading ? 'Updating…' : 'Update password'}
					</button>
				</form>
			</div>
		{/if}
	</section>

</div>
