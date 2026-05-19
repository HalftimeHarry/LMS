<script lang="ts">
	let { text }: { text: string } = $props();
	let visible = $state(false);
</script>

<span class="relative inline-flex items-center">
	<button
		type="button"
		onmouseenter={() => visible = true}
		onmouseleave={() => visible = false}
		onfocus={() => visible = true}
		onblur={() => visible = false}
		onclick={() => visible = !visible}
		aria-label="More info"
		class="flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] font-bold text-gray-500 transition hover:border-[#c9a84c] hover:text-[#c9a84c] focus:outline-none"
	>?</button>

	{#if visible}
		<span
			role="tooltip"
			class="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-[rgba(201,168,76,0.3)] bg-gray-950 px-3 py-2 text-xs leading-relaxed text-gray-300 shadow-xl"
		>
			{text}
			<!-- Arrow -->
			<span class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-950"></span>
		</span>
	{/if}
</span>
