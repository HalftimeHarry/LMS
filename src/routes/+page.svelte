<script lang="ts">
	import { pb } from '$lib';
	import logo from '$lib/assets/lms_images/h_group6.png';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let pbStatus = $state<'checking' | 'ok' | 'error'>('checking');

	$effect(() => {
		pb.health.check()
			.then(() => { pbStatus = 'ok'; })
			.catch(() => { pbStatus = 'error'; });
	});

	const rules = [
		'Pick one NFL team each week to <strong>lose</strong> its game outright. No point spread.',
		'If your team loses — you survive. If your team wins or ties — you are eliminated.',
		'Each team can only be used <strong>once per entry</strong> per season.',
		'Picks are due <strong>20 minutes before the first kickoff of the week</strong>. No exceptions.',
		'Miss the deadline? You automatically receive the biggest favourite on the board.',
		'Pool covers the <strong>NFL regular season only</strong>.',
		'If 5 or fewer entries remain, players may propose a split — all active entries must agree.',
	];

	// Live countdown to the current LMS pick deadline
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(t);
	});

	const deadline     = $derived(data.lmsDeadline ? new Date(data.lmsDeadline).getTime() : null);
	const lmsWeek      = $derived(data.lmsWeek      as number | null);
	const lmsEntryFee  = $derived(data.lmsEntryFee  as number | null);

	const countdown = $derived(() => {
		if (!deadline) return null;
		const diff = deadline - now;
		if (diff <= 0) return { label: 'Deadline passed', urgent: false, expired: true };
		const d = Math.floor(diff / 86_400_000);
		const h = Math.floor((diff % 86_400_000) / 3_600_000);
		const m = Math.floor((diff % 3_600_000) / 60_000);
		const s = Math.floor((diff % 60_000) / 1_000);
		const urgent = diff < 3_600_000;
		const label = d > 0
			? `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`
			: h > 0
				? `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
				: `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
		return { label, urgent, expired: false };
	});
</script>

<svelte:head>
	<title>Last Man / Last Woman Standing — NFL Pool</title>
</svelte:head>

<!-- Hero + stats card -->
<section class="mb-12">
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

		<!-- Title + tagline + buttons -->
		<div class="px-8 py-10 text-center">
			<h1 class="mb-3 text-5xl font-bold tracking-tight text-white drop-shadow-lg">
				Last Man / Last Woman <span class="text-[#c9a84c]">Standing</span>
			</h1>
			<p class="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
				The NFL's most unforgiving survivor pool. Pick a loser every week.
				One wrong call and you're out.
			</p>
			<div class="flex justify-center gap-4">
				<a
					href="/register"
					class="rounded bg-[#c9a84c] px-8 py-3 font-semibold text-black shadow-lg transition hover:bg-[#e8c96a]"
				>
					Enter the Pool
				</a>
				<a
					href="/dashboard/rules"
					class="rounded border border-[#c9a84c] bg-black/80 px-8 py-3 font-semibold text-[#c9a84c] transition hover:bg-[#c9a84c] hover:text-black"
				>
					Read the Rules
				</a>
			</div>
		</div>

		<!-- Stats row -->
		<div class="grid grid-cols-2 border-t border-[rgba(201,168,76,0.15)] sm:grid-cols-4">
			<!-- Entry fee -->
			<div class="border-r border-[rgba(201,168,76,0.15)] p-5 text-center">
				<div class="text-2xl font-bold text-[#c9a84c]">
					{lmsEntryFee != null ? `$${lmsEntryFee}` : '$—'}
				</div>
				<div class="mt-1 text-sm text-gray-400">Entry Fee</div>
			</div>

			<!-- Season -->
			<div class="p-5 text-center sm:border-r sm:border-[rgba(201,168,76,0.15)]">
				<div class="text-2xl font-bold text-[#c9a84c]">2025 NFL</div>
				<div class="mt-1 text-sm text-gray-400">Season</div>
			</div>

			<!-- Live countdown -->
			<div class="col-span-2 border-t border-[rgba(201,168,76,0.15)] p-5 text-center sm:border-t-0
				{countdown()?.urgent ? 'bg-red-950/30' : deadline ? 'bg-[rgba(201,168,76,0.04)]' : ''}">
				{#if countdown() && !countdown()?.expired}
					<div class="font-mono text-2xl font-bold tabular-nums {countdown()?.urgent ? 'text-red-400' : 'text-[#c9a84c]'}">
						{countdown()?.label}
					</div>
					<div class="mt-1 text-sm text-gray-400">
						{lmsWeek ? `Week ${lmsWeek} pick deadline` : 'Pick deadline'}
					</div>
				{:else if countdown()?.expired}
					<div class="text-2xl font-bold text-gray-500">—</div>
					<div class="mt-1 text-sm text-gray-500">Deadline passed</div>
				{:else}
					<div class="text-2xl font-bold text-gray-500">—</div>
					<div class="mt-1 text-sm text-gray-500">Season not started</div>
				{/if}
			</div>
		</div>

	</div>
</section>

<!-- Logo above the card -->
<div class="mb-6 flex justify-center">
	<img
		src={logo}
		alt="Last Man / Last Woman Standing"
		class="h-28 w-auto object-contain sm:h-36 md:h-44 lg:h-56"
	/>
</div>

<!-- How It Works + Rules + Multiple Entries card -->
<section class="mb-12">
	<div class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 backdrop-blur-sm overflow-hidden">

		<!-- How It Works -->
		<div class="px-8 py-6">
			<h2 class="mb-6 text-2xl font-bold text-[#c9a84c]">How It Works</h2>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="flex flex-col gap-2 rounded-lg border border-[rgba(201,168,76,0.15)] bg-black/40 p-5">
					<div class="text-4xl font-black text-[rgba(201,168,76,0.4)]">01</div>
					<h3 class="font-semibold text-white">Enter & Pay</h3>
					<p class="text-sm text-gray-400">Register, request your entry, and pay the $100 entry fee before the season deadline.</p>
				</div>
				<div class="flex flex-col gap-2 rounded-lg border border-[rgba(201,168,76,0.15)] bg-black/40 p-5">
					<div class="text-4xl font-black text-[rgba(201,168,76,0.4)]">02</div>
					<h3 class="font-semibold text-white">Pick a Loser</h3>
					<p class="text-sm text-gray-400">Each week, pick one NFL team you think will lose. Each team can only be used once all season.</p>
				</div>
				<div class="flex flex-col gap-2 rounded-lg border border-[rgba(201,168,76,0.15)] bg-black/40 p-5">
					<div class="text-4xl font-black text-[rgba(201,168,76,0.4)]">03</div>
					<h3 class="font-semibold text-white">Last One Standing Wins</h3>
					<p class="text-sm text-gray-400">If your team wins or ties, you're eliminated. Survive the most weeks to take the pot.</p>
				</div>
			</div>
		</div>

		<!-- Official Rules -->
		<div class="border-t border-[rgba(201,168,76,0.15)] px-8 py-6">
			<h2 class="mb-6 text-2xl font-bold text-[#c9a84c]">Official Rules</h2>
			<ol class="space-y-3">
				{#each rules as rule, i}
					<li class="flex gap-4 text-sm text-gray-300">
						<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(201,168,76,0.4)] text-xs text-[#c9a84c]">{i + 1}</span>
						<span>{@html rule}</span>
					</li>
				{/each}
			</ol>
		</div>

		<!-- Multiple Entries -->
		<div class="border-t border-[rgba(201,168,76,0.15)] px-8 py-6">
			<h2 class="mb-3 text-2xl font-bold text-[#c9a84c]">Multiple Entries</h2>
			<p class="text-sm text-gray-300">
				Players may request more than one entry. Each entry is independent — separate picks, separate eliminations,
				separate entry fees. Manage all your entries from your dashboard.
			</p>
		</div>

	</div>
</section>

<!-- PocketBase status (dev indicator) -->
{#if pbStatus !== 'ok'}
	<div class="fixed bottom-4 right-4 rounded border px-3 py-2 text-xs backdrop-blur-sm
		{pbStatus === 'checking' ? 'border-gray-600 bg-black/80 text-gray-400' : 'border-red-700 bg-red-950/80 text-red-400'}">
		{pbStatus === 'checking' ? 'Connecting to API…' : '⚠ API unreachable'}
	</div>
{/if}
