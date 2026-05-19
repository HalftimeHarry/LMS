<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head><title>Error — LMS Pool</title></svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="w-full max-w-lg rounded-xl border border-red-900/60 bg-gray-950 p-8">
		<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-red-600">
			{$page.status} Error
		</p>
		<h1 class="mb-3 text-2xl font-bold text-white">Something went wrong</h1>

		{#if $page.status === 500}
			<p class="mb-6 text-sm text-gray-400">
				The pool is temporarily unavailable. This is usually a brief outage — try again in a
				moment. If the problem persists, contact the pool admin.
			</p>
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
				href="/dashboard"
				class="rounded bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8c96a]"
			>
				Dashboard
			</a>
		</div>
	</div>
</div>
