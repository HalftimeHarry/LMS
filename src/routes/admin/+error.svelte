<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head><title>Error — Admin</title></svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="w-full max-w-lg rounded-xl border border-red-900/60 bg-gray-950 p-8">
		<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-red-600">
			{$page.status} Error
		</p>
		<h1 class="mb-3 text-2xl font-bold text-white">Something went wrong</h1>

		{#if $page.error?.message?.includes('PocketBase unreachable') || $page.status === 500}
			<p class="mb-4 text-sm text-gray-400">
				The database backend is not responding. This is usually a temporary outage with the
				hosting service.
			</p>
			<div class="mb-6 rounded-lg border border-gray-800 bg-black px-4 py-3 text-sm text-gray-400">
				<p class="mb-2 font-semibold text-white">What to check</p>
				<ol class="flex flex-col gap-1.5">
					<li class="flex gap-2">
						<span class="shrink-0 text-gray-600">1.</span>
						Verify the PocketBase service is running on Railway (or your host) and hasn't been
						suspended or deleted.
					</li>
					<li class="flex gap-2">
						<span class="shrink-0 text-gray-600">2.</span>
						Confirm <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">PUBLIC_POCKETBASE_URL</code>
						in your Netlify environment variables points to the correct live URL.
					</li>
					<li class="flex gap-2">
						<span class="shrink-0 text-gray-600">3.</span>
						Check that <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">POCKETBASE_ADMIN_EMAIL</code>
						and <code class="rounded bg-gray-800 px-1 text-xs text-gray-300">POCKETBASE_ADMIN_PASSWORD</code>
						are set correctly in Netlify.
					</li>
				</ol>
			</div>
		{:else}
			<p class="mb-6 text-sm text-gray-400">
				{$page.error?.message ?? 'An unexpected error occurred.'}
			</p>
		{/if}

		<div class="flex gap-3">
			<button
				onclick={() => window.location.reload()}
				class="rounded border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
			>
				Try again
			</button>
			<a
				href="/admin"
				class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]"
			>
				Admin home
			</a>
		</div>
	</div>
</div>
