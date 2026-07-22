<script lang="ts">
	import { tick } from 'svelte';

	type TipPlacement = 'center' | 'left';

	let { text, placement = 'center' }: { text: string; placement?: TipPlacement } = $props();
	let visible = $state(false);
	let tipEl = $state<HTMLSpanElement | null>(null);
	let shiftX = $state(0);

	async function showTip() {
		visible = true;
		await tick();
		adjustTipPosition();
	}

	function hideTip() {
		visible = false;
		shiftX = 0;
	}

	async function toggleTip() {
		visible = !visible;
		if (visible) {
			await tick();
			adjustTipPosition();
		} else {
			shiftX = 0;
		}
	}

	function adjustTipPosition() {
		if (!tipEl) return;

		const edgePadding = 12;
		const rect = tipEl.getBoundingClientRect();
		let nextShift = 0;

		if (rect.right > window.innerWidth - edgePadding) {
			nextShift = window.innerWidth - edgePadding - rect.right;
		} else if (rect.left < edgePadding) {
			nextShift = edgePadding - rect.left;
		}

		shiftX = nextShift;
	}
</script>

<svelte:window onresize={() => visible && adjustTipPosition()} />

<span class="relative inline-flex items-center">
	<button
		type="button"
		onmouseenter={showTip}
		onmouseleave={hideTip}
		onfocus={showTip}
		onblur={hideTip}
		onclick={toggleTip}
		aria-label="More info"
		class="flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-[10px] font-bold text-gray-500 transition hover:border-[#c9a84c] hover:text-[#c9a84c] focus:outline-none"
	>?</button>

	{#if visible}
		<span
			bind:this={tipEl}
			role="tooltip"
			class="absolute bottom-full z-[9999] mb-2 w-64 rounded-lg border border-[rgba(201,168,76,0.3)] bg-gray-950 px-3 py-2 text-xs leading-relaxed text-gray-300 shadow-xl {placement === 'left' ? 'right-0' : 'left-1/2 -translate-x-1/2'}"
			style="margin-left: {shiftX}px"
		>
			{text}
			<!-- Arrow -->
			<span class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-950"></span>
		</span>
	{/if}
</span>
