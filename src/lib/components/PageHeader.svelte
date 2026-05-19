<script lang="ts">
	let {
		title,
		description = '',
	}: {
		title: string;
		description?: string;
	} = $props();
</script>

<div class="mb-6">
	<h1 class="text-2xl font-bold text-white">{title}</h1>
	{#if description}
		<p class="mt-1 text-sm text-gray-500">{description}</p>
	{/if}
</div>
