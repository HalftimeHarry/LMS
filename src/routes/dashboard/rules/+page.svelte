<script lang="ts">
	import { enhance } from '$app/forms';
	import archer from '$lib/assets/lms_images/archer_2_1.png';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const season       = $derived((data as any).season as any);
	const week6Deadline = $derived((data as any).week6Deadline as string | null);
	const week6Id = $derived((data as any).week6Id as string | null);
	const canEditRules = $derived(!!(data as any).canEditRules);

	// Format a date string for display: "Thursday, September 4, 2027 at 3:00 PM PST"
	function fmtDeadline(iso: string | null | undefined): string {
		if (!iso) return 'TBD';
		return new Date(iso).toLocaleString('en-US', {
			weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}

	function fmtDate(iso: string | null | undefined): string {
		if (!iso) return 'TBD';
		return new Date(iso).toLocaleString('en-US', {
			month: 'long', day: 'numeric', year: 'numeric',
			hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
		});
	}

	const pickDeadline    = $derived(fmtDeadline(season?.firstPickDeadline));
	const paymentDeadline = $derived(fmtDate(season?.paymentDeadline));
	const seasonYear      = $derived(season?.year ? `${season.year}–${Number(season.year)+1}` : '2026–2027');
	const lmsFee          = $derived(season?.lmsEntryFee        ?? 100);
	const shFee           = $derived(season?.secondHalfEntryFee ?? 50);
	const shDeadline      = $derived(fmtDeadline(week6Deadline));
	const shStartWeek     = $derived(season?.secondHalfStartWeek ?? 6);
	const lmsStartWeek    = 1;
	const shDiff          = $derived(week6Deadline ? (new Date(week6Deadline).getTime() - now) : 0);
	const shLive          = $derived(!!week6Deadline && shDiff > 0);
	const shUrgent        = $derived(shLive && shDiff < 3_600_000);
	const shDays          = $derived(shLive ? Math.floor(shDiff / 86_400_000) : 0);
	const shHours         = $derived(shLive ? Math.floor((shDiff % 86_400_000) / 3_600_000) : 0);
	const shMinutes       = $derived(shLive ? Math.floor((shDiff % 3_600_000) / 60_000) : 0);
	const shSeconds       = $derived(shLive ? Math.floor((shDiff % 60_000) / 1_000) : 0);
	const lmsDiff         = $derived(season?.firstPickDeadline ? (new Date(season.firstPickDeadline).getTime() - now) : 0);
	const lmsLive         = $derived(!!season?.firstPickDeadline && lmsDiff > 0);
	const lmsUrgent       = $derived(lmsLive && lmsDiff < 3_600_000);
	const lmsDays         = $derived(lmsLive ? Math.floor(lmsDiff / 86_400_000) : 0);
	const lmsHours        = $derived(lmsLive ? Math.floor((lmsDiff % 86_400_000) / 3_600_000) : 0);
	const lmsMinutes      = $derived(lmsLive ? Math.floor((lmsDiff % 3_600_000) / 60_000) : 0);
	const lmsSeconds      = $derived(lmsLive ? Math.floor((lmsDiff % 60_000) / 1_000) : 0);

	// Live countdown tick for deadline cards
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(id);
	});

	const defaultWinners = [
		{ year: '2022', winner: 'McLovin', location: 'San Diego, CA', payout: '$20,500' },
		{ year: '2023', winner: 'JACDAR', location: 'New Orleans, LA', payout: '$25,400' },
		{ year: '2024', winner: 'PhoebeD, T-Bone & Guillermo', location: 'Split pot', payout: '$28,800 total' },
		{ year: '2025', winner: 'ereiz03, PaulH, quinn3443 & themilkman805', location: 'Split pot', payout: '$7,000 each' },
	];

	function parsePastWinners(raw: string | null | undefined) {
		if (!raw) return defaultWinners;
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return defaultWinners;
			const cleaned = parsed
				.map((w: any) => ({
					year: String(w?.year ?? '').trim(),
					winner: String(w?.winner ?? '').trim(),
					location: String(w?.location ?? '').trim(),
					payout: String(w?.payout ?? '').trim(),
				}))
				.filter((w: any) => w.year && w.winner);
			return cleaned.length ? cleaned : defaultWinners;
		} catch {
			return defaultWinners;
		}
	}

	const pastWinners = $derived(parsePastWinners(season?.pastWinnersJson));
	const rulesDeadlineNote = $derived(
		season?.rulesDeadlineNote?.trim() || 'Picks need to be in by 9:55 AM EST.'
	);
	const winnersLocationNote = $derived(
		season?.winnersLocationNote?.trim() ||
		'Our recent winners are spread across the country, including military players serving overseas.'
	);

	function toDatetimeLocalValue(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}

	let editingRules = $state(false);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state('');

	let firstPickDeadlineInput = $state(toDatetimeLocalValue(season?.firstPickDeadline));
	let secondHalfDeadlineInput = $state(toDatetimeLocalValue(week6Deadline));
	let rulesDeadlineNoteInput = $state(season?.rulesDeadlineNote?.trim() || '');
	let winnersLocationNoteInput = $state(season?.winnersLocationNote?.trim() || '');
	let winnersInput = $state(
		pastWinners.map((w: any) => ({ ...w }))
	);

	$effect(() => {
		if (editingRules) return;
		firstPickDeadlineInput = toDatetimeLocalValue(season?.firstPickDeadline);
		secondHalfDeadlineInput = toDatetimeLocalValue(week6Deadline);
		rulesDeadlineNoteInput = season?.rulesDeadlineNote?.trim() || '';
		winnersLocationNoteInput = season?.winnersLocationNote?.trim() || '';
		winnersInput = pastWinners.map((w: any) => ({ ...w }));
	});

	function addWinnerRow() {
		winnersInput = [...winnersInput, { year: '', winner: '', location: '', payout: '' }];
	}

	function removeWinnerRow(index: number) {
		winnersInput = winnersInput.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>Rules — LMS Pool {seasonYear}</title>
</svelte:head>

<!-- Page header card -->
<div class="mb-8 rounded-xl border border-[rgba(201,168,76,0.5)] bg-gradient-to-br from-[rgba(201,168,76,0.07)] to-black/80 p-6 backdrop-blur-sm md:p-8"
	style="box-shadow: 0 0 40px rgba(201,168,76,0.07);">
	<div class="flex items-end justify-between gap-6">
		<div>
			<p class="mb-1 text-sm font-medium uppercase tracking-widest text-[#c9a84c]">Official</p>
			<h1 class="text-4xl font-bold leading-tight text-white">
				Last Man / Last Woman<br />
				<span class="text-[#c9a84c]">Standing {season?.year ?? '2027'}</span>
			</h1>
			<p class="mt-3 text-gray-400">Entry Information, Procedure &amp; Rules</p>
		</div>
		<img
			src={archer}
			alt="The Comish"
			class="hidden h-36 w-auto shrink-0 object-contain object-bottom drop-shadow-xl sm:block md:h-44 lg:h-52"
		/>
	</div>
</div>

<!-- How to enter -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<h2 class="mb-4 text-xl font-bold text-[#c9a84c]">How to Enter</h2>
	<div class="space-y-3 text-sm leading-relaxed text-gray-300">
		<p>
			If you wish to participate again, go to
			<a href="https://theblizzardofodds.com/" target="_blank" rel="noopener noreferrer"
				class="text-[#c9a84c] underline hover:text-[#e8c96a]">theblizzardofodds.com</a>
			using the same username/password (or the email attached to that account).
			<strong class="text-white">Users MUST re-establish their password.</strong>
		</p>
		<p>
			After logging in you may request multiple entries using only one account. Once we receive your
			<strong class="text-white">$100 per entry</strong> each will be included in the Entry List.
			After that you can log in to make your picks.
		</p>
	</div>
</section>

<!-- Payment -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<h2 class="mb-4 text-xl font-bold text-[#c9a84c]">Payment — ${lmsFee} per Entry</h2>
	<p class="mb-4 text-sm text-gray-300">
		Entry fees must be received by <strong class="text-white">{paymentDeadline}</strong> — the sooner the better.
	</p>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each [
			{ method: 'Venmo',   detail: '@Michael-Campo-5' },
			{ method: 'PayPal',  detail: 'sportscards46@gmail.com' },
			{ method: 'Zelle',   detail: '1-505-604-1843 (Julia Campo)' },
			{ method: 'Check',   detail: 'Michael Campo, 610 Rincon De Romos Dr SE, Rio Rancho, NM 87124' },
		] as p}
			<div class="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
				<p class="mb-1 text-xs font-semibold uppercase tracking-wider text-[#c9a84c]">{p.method}</p>
				<p class="text-sm text-gray-300">{p.detail}</p>
			</div>
		{/each}
	</div>
	<div class="mt-4 rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-300">
		<p><span class="text-white font-medium">Email:</span> sportscards46@gmail.com</p>
		<p><span class="text-white font-medium">Phone:</span> 505-892-8583 — please use email for non-emergency matters.</p>
	</div>
</section>

<!-- Rules -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-xl font-bold text-[#c9a84c]">Last Man Standing Rules</h2>
		{#if canEditRules}
			<button
				type="button"
				onclick={() => {
					editingRules = !editingRules;
					saveState = 'idle';
					saveError = '';
				}}
				class="rounded border border-[rgba(201,168,76,0.45)] bg-[rgba(201,168,76,0.09)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.16)]"
			>
				{editingRules ? 'Close Edit Panel' : 'Edit Rules and Winners'}
			</button>
		{/if}
	</div>

	{#if canEditRules && editingRules}
		<form
			method="POST"
			action="?/updateRulesContent"
			use:enhance={() => {
				saveState = 'saving';
				saveError = '';
				return async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						saveState = 'saved';
						editingRules = false;
					} else {
						saveState = 'error';
						saveError = (result.type === 'failure' ? (result.data as any)?.error : '') || 'Save failed.';
					}
				};
			}}
			class="mb-5 rounded-lg border border-[rgba(201,168,76,0.25)] bg-black/60 p-4"
		>
			<input type="hidden" name="seasonId" value={season?.id ?? ''} />
			<input type="hidden" name="shWeekId" value={week6Id ?? ''} />
			<div class="grid gap-4 md:grid-cols-2">
				<div>
					<label for="firstPickDeadline" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">First Pick Deadline</label>
					<input
						id="firstPickDeadline"
						type="datetime-local"
						name="firstPickDeadline"
						bind:value={firstPickDeadlineInput}
						class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
					/>
				</div>
				<div>
					<label for="secondHalfDeadline" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Second Half Entry Deadline</label>
					<input
						id="secondHalfDeadline"
						type="datetime-local"
						name="secondHalfDeadline"
						bind:value={secondHalfDeadlineInput}
						class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
					/>
				</div>
			</div>

			<div class="mt-4">
				<label for="rulesDeadlineNote" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Rules Deadline Note</label>
				<textarea
					id="rulesDeadlineNote"
					name="rulesDeadlineNote"
					rows="2"
					bind:value={rulesDeadlineNoteInput}
					placeholder="Example: Picks need to be in by 9:55 AM EST."
					class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
				></textarea>
			</div>

			<div class="mt-4">
				<label for="winnersLocationNote" class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">Winner Location Message</label>
				<textarea
					id="winnersLocationNote"
					name="winnersLocationNote"
					rows="2"
					bind:value={winnersLocationNoteInput}
					placeholder="Example: Winners are across the country and military overseas."
					class="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-[#c9a84c] focus:outline-none"
				></textarea>
			</div>

			<div class="mt-4">
				<div class="mb-2 flex items-center justify-between gap-2">
					<p class="text-xs font-semibold uppercase tracking-wider text-gray-400">Past Winners</p>
					<button type="button" onclick={addWinnerRow}
						class="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-300 transition hover:border-gray-500 hover:text-white">+ Add winner</button>
				</div>
				<div class="space-y-2">
					{#each winnersInput as winner, i}
						<div class="grid grid-cols-1 gap-2 rounded border border-gray-800 bg-gray-900/60 p-2 md:grid-cols-[96px_1fr_1fr_120px_auto]">
							<input type="text" name="winnerYear" bind:value={winner.year} placeholder="Year"
								class="rounded border border-gray-700 bg-black/60 px-2 py-1.5 text-xs text-white focus:border-[#c9a84c] focus:outline-none" />
							<input type="text" name="winnerName" bind:value={winner.winner} placeholder="Winner"
								class="rounded border border-gray-700 bg-black/60 px-2 py-1.5 text-xs text-white focus:border-[#c9a84c] focus:outline-none" />
							<input type="text" name="winnerLocation" bind:value={winner.location} placeholder="Location"
								class="rounded border border-gray-700 bg-black/60 px-2 py-1.5 text-xs text-white focus:border-[#c9a84c] focus:outline-none" />
							<input type="text" name="winnerPayout" bind:value={winner.payout} placeholder="Payout"
								class="rounded border border-gray-700 bg-black/60 px-2 py-1.5 text-xs text-white focus:border-[#c9a84c] focus:outline-none" />
							<button type="button" onclick={() => removeWinnerRow(i)}
								class="rounded border border-red-900 px-2 py-1 text-xs text-red-400 transition hover:bg-red-950/40">Remove</button>
						</div>
					{/each}
				</div>
			</div>

			<div class="mt-4 flex items-center gap-3">
				<button type="submit"
					class="rounded border border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] px-4 py-2 text-sm font-semibold text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.18)]">
					{saveState === 'saving' ? 'Saving...' : 'Save Changes'}
				</button>
				{#if saveState === 'saved'}
					<span class="text-xs text-green-400">Saved.</span>
				{/if}
				{#if saveState === 'error'}
					<span class="text-xs text-red-400">{saveError}</span>
				{/if}
			</div>
		</form>
	{/if}

	<div class="mb-5 rounded-xl border border-[rgba(201,168,76,0.35)] bg-black/70 p-5 backdrop-blur-sm">
		<div class="mb-3 flex items-center gap-2 border-b border-[rgba(201,168,76,0.15)] pb-3">
			<span class="text-[10px] font-bold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">Last Man Standing</span>
			<span class="ml-auto text-[10px] text-gray-600">Pick the <span class="font-medium text-red-400">LOSER</span></span>
		</div>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-xl font-bold text-white">Week {lmsStartWeek} start</p>
				<p class="mt-1 text-xs text-gray-400">
					Pick deadline:
					<span class="text-white">{season?.firstPickDeadline
						? new Date(season.firstPickDeadline).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
						: 'TBD'}</span>
				</p>
			</div>
			<div class="flex items-center gap-3">
				{#if season?.firstPickDeadline && lmsLive}
					<span class="font-mono text-xl font-bold tabular-nums {lmsUrgent ? 'text-red-400' : 'text-[#c9a84c]'}">
						{#if lmsDays > 0}{lmsDays}d {/if}{String(lmsHours).padStart(2, '0')}:{String(lmsMinutes).padStart(2, '0')}:{String(lmsSeconds).padStart(2, '0')}
					</span>
				{/if}
				<span class="text-sm font-medium {season?.firstPickDeadline ? (lmsLive ? 'text-green-400' : 'text-gray-500') : 'text-gray-500'}">
					{season?.firstPickDeadline ? (lmsLive ? 'OPEN' : 'CLOSED') : 'TBD'}
				</span>
			</div>
		</div>
		{#if season?.firstPickDeadline && lmsLive}
			<p class="mt-3 text-xs {lmsUrgent ? 'text-red-400' : 'text-[#c9a84c]'}">
				Picks are open. Submit or update your pick from each active entry below before the deadline.
			</p>
		{:else if season?.firstPickDeadline && !lmsLive}
			<p class="mt-3 text-xs text-gray-500">Picks are closed for Week {lmsStartWeek}.</p>
		{:else}
			<p class="mt-3 text-xs text-gray-500">Week {lmsStartWeek} deadline will appear when it is published.</p>
		{/if}
	</div>

	<ol class="space-y-4">
		{#each [
			{ rule: 'Pick one NFL team each week to <strong class="text-white">LOSE</strong> their game outright — no point spread.' },
			{ rule: 'Once you use a team you <strong class="text-white">cannot use that team again</strong> for the rest of the season.' },
			{ rule: 'If the team you picked <strong class="text-white">WINS</strong> its game, you are eliminated.' },
			{ rule: '<strong class="text-white">TIES:</strong> Rare in the NFL, but if a tie occurs both teams are eliminated.' },
			{ rule: `All picks are due by the <strong class="text-white">weekly deadline</strong> with NO EXCEPTIONS. After the deadline you can view everyone's picks.` },
			{ rule: 'If you miss the deadline, you automatically receive the <strong class="text-white">biggest favourite on the board</strong> as your pick. If you\'ve already used that team, you are eliminated.' },
			{ rule: 'This pool applies to the <strong class="text-white">NFL regular season only</strong>.' },
			{ rule: 'If <strong class="text-white">5 or fewer players remain</strong>, all may agree to split the pot. All active entries must agree — if not, picks continue as normal.' },
		] as item, i}
			<li class="flex gap-4 text-sm text-gray-300">
				<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(201,168,76,0.4)] text-xs text-[#c9a84c]">
					{i + 1}
				</span>
				<span>{@html item.rule}</span>
			</li>
		{/each}
	</ol>
</section>

<!-- Second Half rules -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<h2 class="mb-2 text-xl font-bold text-[#c9a84c]">Second Half Pool Rules</h2>
	<div class="mb-5 rounded-xl border border-blue-900/40 bg-black/70 p-5 backdrop-blur-sm">
		<div class="mb-3 flex items-center gap-2 border-b border-blue-900/20 pb-3">
			<span class="text-[10px] font-bold uppercase tracking-widest text-blue-500/60">Second Half Pool</span>
			<span class="ml-auto text-[10px] text-gray-600">Pick the <span class="font-medium text-green-400">WINNER</span> · Picks start Wk {shStartWeek}</span>
		</div>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-xl font-bold text-white">Week {shStartWeek} start</p>
				<p class="mt-1 text-xs text-gray-400">
					Registration closes:
					<span class="text-white">{week6Deadline
						? new Date(week6Deadline).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
						: 'TBD'}</span>
				</p>
			</div>
			<div class="flex items-center gap-3">
				{#if week6Deadline && shLive}
					<span class="font-mono text-xl font-bold tabular-nums {shUrgent ? 'text-red-400' : 'text-blue-400'}">
						{#if shDays > 0}{shDays}d {/if}{String(shHours).padStart(2, '0')}:{String(shMinutes).padStart(2, '0')}:{String(shSeconds).padStart(2, '0')}
					</span>
				{/if}
				<span class="text-sm font-medium {week6Deadline ? (shLive ? 'text-green-400' : 'text-gray-500') : 'text-gray-500'}">
					{week6Deadline ? (shLive ? 'OPEN' : 'CLOSED') : 'TBD'}
				</span>
			</div>
		</div>
		{#if week6Deadline && shLive}
			<p class="mt-3 text-xs {shUrgent ? 'text-red-400' : 'text-blue-400'}">
				{shUrgent ? 'Registration closing soon.' : 'Registration is open.'}
				<a href="/dashboard/entries/new" class="underline hover:opacity-80">Register now →</a>
			</p>
		{:else if week6Deadline && !shLive}
			<p class="mt-3 text-xs text-gray-500">Registration is closed.</p>
		{:else}
			<p class="mt-3 text-xs text-gray-500">Registration opens when the Week {shStartWeek} deadline is published.</p>
		{/if}
	</div>
	<p class="mb-4 text-sm text-gray-400">
		A separate pool that starts at Week {shStartWeek}. Entry deadline: <strong class="text-white">{shDeadline}</strong>.
		Entry fee: <strong class="text-white">${shFee}</strong>.
	</p>
	<ol class="space-y-4">
		{#each [
			{ rule: 'Pick one NFL team each week to <strong class="text-white">WIN</strong> their game outright — no point spread.' },
			{ rule: 'Once you use a team you <strong class="text-white">cannot use that team again</strong> for the rest of the season.' },
			{ rule: 'If the team you picked <strong class="text-white">LOSES</strong> its game, you are eliminated.' },
			{ rule: '<strong class="text-white">Weeks 6–9:</strong> pick <strong class="text-white">1 team</strong> per week. From <strong class="text-white">Week 10 onward:</strong> pick <strong class="text-white">2 teams</strong> per week — both must win.' },
			{ rule: `All picks are due by the <strong class="text-white">weekly deadline</strong> with NO EXCEPTIONS. Missed picks receive the biggest favourite automatically. ${rulesDeadlineNote}` },
			{ rule: 'Pool runs through the <strong class="text-white">NFL regular season only</strong>.' },
		] as item, i}
			<li class="flex gap-4 text-sm text-gray-300">
				<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(201,168,76,0.4)] text-xs text-[#c9a84c]">
					{i + 1}
				</span>
				<span>{@html item.rule}</span>
			</li>
		{/each}
	</ol>
</section>

<!-- FAQs -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<h2 class="mb-5 text-xl font-bold text-[#c9a84c]">FAQs</h2>
	<div class="space-y-6">
		<div>
			<p class="mb-1 font-semibold text-white">Can I make picks for future weeks in advance?</p>
			<p class="text-sm text-gray-300">
				Yes. For those who anticipate travel, make your picks in advance — you can always change them
				up to the current week's deadline. Make picks <strong class="text-white">sequentially</strong>:
				Week 2 before Week 3, etc.
			</p>
		</div>
		<div>
			<p class="mb-1 font-semibold text-white">When do picks need to be submitted?</p>
			<p class="text-sm text-gray-300">
				All picks are due by the <strong class="text-white">weekly deadline</strong> with no exceptions —
				After the deadline passes you can log in and see everyone's picks. The site will not show other
				players' picks until after the deadline — but you can change your own pick up until then.
				Results and commentary are sent by email on Tuesday after each week's results.
			</p>
		</div>
		<div>
			<p class="mb-1 font-semibold text-white">Can I refer new players?</p>
			<p class="text-sm text-gray-300">
				Yes — the player who brings in the most new entries earns a free entry.
				New players <strong class="text-white">must tell us who referred them</strong> so the referring player gets credit.
			</p>
		</div>
	</div>
</section>

<!-- Past winners -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<h2 class="mb-5 text-xl font-bold text-[#c9a84c]">Past Winners</h2>
	<div class="space-y-3">
		{#each pastWinners as w}
			<div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
				<div>
					<span class="mr-3 text-xs font-bold text-[#c9a84c]">{w.year}</span>
					<span class="text-sm font-medium text-white">{w.winner}</span>
					<span class="ml-2 text-xs text-gray-500">{w.location}</span>
				</div>
				<span class="text-sm font-bold text-[#c9a84c]">{w.payout}</span>
			</div>
		{/each}
	</div>
	<p class="mt-4 text-sm text-gray-300">{winnersLocationNote}</p>
	<p class="mt-4 text-center text-sm text-gray-400">
		Last season we had <strong class="text-white">288 entries</strong>. Let's do more this year!
	</p>
</section>

<!-- The Comish card -->
<section class="rounded-xl border border-[rgba(201,168,76,0.5)] bg-gradient-to-br from-[rgba(201,168,76,0.08)] to-black/80 p-6 backdrop-blur-sm md:p-8"
	style="box-shadow: 0 0 40px rgba(201,168,76,0.08);">
	<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
		<img
			src={archer}
			alt="The Comish"
			class="h-40 w-auto shrink-0 object-contain object-bottom drop-shadow-2xl sm:h-48 md:h-56"
		/>
		<div class="flex-1 text-center sm:text-left">
			<p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[rgba(201,168,76,0.6)]">From the desk of</p>
			<h2 class="text-2xl font-bold text-white">The Comish — Mike</h2>
			<p class="mt-3 text-sm leading-relaxed text-gray-300">
				Feel free to reach out with any questions. Good luck this season — may the best survivor win!
			</p>
			<div class="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
				<a href="mailto:sportscards46@gmail.com"
					class="inline-flex items-center gap-2 rounded-lg border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 py-2 text-sm font-medium text-[#c9a84c] transition hover:bg-[rgba(201,168,76,0.15)]">
					✉ sportscards46@gmail.com
				</a>
				<a href="tel:5058928583"
					class="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white">
					📞 505-892-8583
				</a>
			</div>
			<p class="mt-3 text-xs text-gray-600">Please use email for non-emergency matters.</p>
		</div>
	</div>
</section>
