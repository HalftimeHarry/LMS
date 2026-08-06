<script lang="ts">
	import { resolveStatusLabelText } from '$lib/utils';

	let {
		title,
		subtitle,
		weekLabel,
		entryDeadlineLabel,
		pickDeadlineLabel,
		registrationLabel,
		picksLabel,
		registrationCountdown,
		picksCountdown,
		registrationLive,
		picksLive,
		registrationUrgent,
		picksUrgent,
		registrationDeadlinePassed,
		picksDeadlinePassed,
		footerMessage,
		ctaHref = null,
		ctaText = null,
		borderClass = 'border-[rgba(201,168,76,0.3)]',
		dividerClass = 'border-[rgba(201,168,76,0.1)]',
		titleClass = 'text-[rgba(201,168,76,0.6)]',
		subtitleClass = 'text-red-400',
		picksClass = 'text-[#c9a84c]',
		footerClass = 'text-[#c9a84c]'
	}: {
		title: string;
		subtitle: string;
		weekLabel: string;
		entryDeadlineLabel: string;
		pickDeadlineLabel: string;
		registrationLabel: string;
		picksLabel: string;
		registrationCountdown: string;
		picksCountdown: string;
		registrationLive: boolean;
		picksLive: boolean;
		registrationUrgent: boolean;
		picksUrgent: boolean;
		registrationDeadlinePassed: boolean;
		picksDeadlinePassed: boolean;
		footerMessage: string;
		ctaHref?: string | null;
		ctaText?: string | null;
		borderClass?: string;
		dividerClass?: string;
		titleClass?: string;
		subtitleClass?: string;
		picksClass?: string;
		footerClass?: string;
	} = $props();
</script>

<div class="relative rounded-xl border bg-black/75 p-5 backdrop-blur-sm transition-[z-index] hover:z-20 focus-within:z-20 {borderClass}">
	<div class="mb-3 flex items-center gap-2 border-b pb-3 {dividerClass}">
		<span class="text-[10px] font-bold uppercase tracking-widest {titleClass}">{title}</span>
		<span class="ml-auto text-[10px] text-gray-600">Pick the <span class="font-medium {subtitleClass}">{subtitle}</span></span>
	</div>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-xl font-bold text-white">{weekLabel}</p>
			<div class="mt-2 space-y-1 text-xs text-gray-400">
				<p class="text-white">{entryDeadlineLabel}</p>
				<p class="text-white">{pickDeadlineLabel}</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<div class="flex flex-col items-end gap-2">
				<div class="min-w-[120px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right">
					<div class="font-mono text-lg font-bold tabular-nums {registrationLive ? (registrationUrgent ? 'text-red-400' : 'text-green-400') : 'text-gray-500'}">{registrationCountdown}</div>
					<div class="text-sm font-medium {registrationDeadlinePassed ? 'text-gray-500' : 'text-green-400'}">{resolveStatusLabelText(false, registrationLabel)}</div>
				</div>
				<div class="min-w-[120px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right">
					<div class="font-mono text-lg font-bold tabular-nums {picksLive ? (picksUrgent ? 'text-red-400' : picksClass) : 'text-gray-500'}">{picksCountdown}</div>
					<div class="text-sm font-medium {picksDeadlinePassed ? 'text-gray-500' : picksClass}">{picksLabel}</div>
				</div>
			</div>
		</div>
	</div>
	{#if footerMessage}
		<p class="mt-3 text-xs {footerClass}">
			{footerMessage}
			{#if ctaHref && ctaText}
				<a href={ctaHref} class="ml-1 underline hover:opacity-80">{ctaText}</a>
			{/if}
		</p>
	{/if}
</div>
