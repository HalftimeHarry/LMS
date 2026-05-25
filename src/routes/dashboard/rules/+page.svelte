<script lang="ts">
	import archer from '$lib/assets/lms_images/archer_2_1.png';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const season       = $derived((data as any).season as any);
	const week6Deadline = $derived((data as any).week6Deadline as string | null);

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
	<h2 class="mb-5 text-xl font-bold text-[#c9a84c]">Last Man Standing Rules</h2>
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

	<div class="mt-6 rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.05)] p-4 text-sm text-gray-300">
		<strong class="text-[#c9a84c]">First pick deadline:</strong> {pickDeadline}.
		It is your responsibility to get your pick in on time.
	</div>
</section>

<!-- Second Half rules -->
<section class="mb-6 rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<h2 class="mb-2 text-xl font-bold text-[#c9a84c]">Second Half Pool Rules</h2>
	<p class="mb-4 text-sm text-gray-400">
		A separate pool that starts at Week 6. Entry deadline: <strong class="text-white">{shDeadline}</strong>.
		Entry fee: <strong class="text-white">${shFee}</strong>.
	</p>
	<ol class="space-y-4">
		{#each [
			{ rule: 'Pick one NFL team each week to <strong class="text-white">WIN</strong> their game outright — no point spread.' },
			{ rule: 'Once you use a team you <strong class="text-white">cannot use that team again</strong> for the rest of the season.' },
			{ rule: 'If the team you picked <strong class="text-white">LOSES</strong> its game, you are eliminated.' },
			{ rule: '<strong class="text-white">Weeks 6–9:</strong> pick <strong class="text-white">1 team</strong> per week. From <strong class="text-white">Week 10 onward:</strong> pick <strong class="text-white">2 teams</strong> per week — both must win.' },
			{ rule: 'All picks are due by the <strong class="text-white">weekly deadline</strong> with NO EXCEPTIONS. Missed picks receive the biggest favourite automatically.' },
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
				the first week's deadline is <strong class="text-white">{pickDeadline}</strong>.
				After the deadline passes you can log in and see everyone's picks. The site will not show
				other players' picks until after the deadline — but you can change your own pick up until then.
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
		{#each [
			{ year: '2022', winner: 'McLovin',                        location: 'San Diego, CA',       payout: '$20,500' },
			{ year: '2023', winner: 'JACDAR',                         location: 'New Orleans, LA',     payout: '$25,400' },
			{ year: '2024', winner: 'PhoebeD, T-Bone & Guillermo',    location: 'Split pot',           payout: '$28,800 total' },
			{ year: '2025', winner: 'ereiz03, PaulH, quinn3443 & themilkman805', location: 'Split pot', payout: '$7,000 each' },
		] as w}
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
