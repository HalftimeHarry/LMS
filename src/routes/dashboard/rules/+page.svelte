<script lang="ts">
	import archer from '$lib/assets/lms_images/archer_2_1.png';
</script>

<svelte:head>
	<title>Rules — LMS Pool 2027</title>
</svelte:head>

<!-- Page header with archer -->
<div class="mb-10 flex items-end justify-between gap-6">
	<div>
		<p class="mb-1 text-sm font-medium uppercase tracking-widest text-[#c9a84c]">Official</p>
		<h1 class="text-4xl font-bold leading-tight text-white">
			Last Man / Last Woman<br />
			<span class="text-[#c9a84c]">Standing 2027</span>
		</h1>
		<p class="mt-3 text-gray-400">Entry Information, Procedure &amp; Rules</p>
	</div>
	<img
		src={archer}
		alt="The Comish"
		class="hidden h-36 w-auto shrink-0 object-contain object-bottom drop-shadow-xl sm:block md:h-44 lg:h-52"
	/>
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
	<h2 class="mb-4 text-xl font-bold text-[#c9a84c]">Payment — $100 per Entry</h2>
	<p class="mb-4 text-sm text-gray-300">
		Entry fees must be received by <strong class="text-white">12:00 PM PST, September 10, 2026</strong> — the sooner the better.
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
			{ rule: 'All picks are due by <strong class="text-white">Thursday 3:00 PM PST</strong> with NO EXCEPTIONS. After the deadline you can view everyone\'s picks.' },
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
		<strong class="text-[#c9a84c]">First pick deadline:</strong> 3:00 PM PST, Thursday September 10, 2027.
		It is your responsibility to get your pick in on time.
	</div>
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
				All picks are due by <strong class="text-white">Thursday 3:00 PM PST</strong> with no exceptions.
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

<!-- Sign off -->
<section class="rounded-xl border border-[rgba(201,168,76,0.3)] bg-black/75 p-6 backdrop-blur-sm md:p-8">
	<div class="flex items-end gap-6">
		<div class="flex-1">
			<p class="mb-3 text-sm text-gray-300">Feel free to email if you have any questions.</p>
			<p class="text-sm text-gray-300">Thank you,</p>
			<p class="mt-1 text-lg font-bold text-white">The Comish — Mike</p>
			<a href="mailto:sportscards46@gmail.com" class="text-sm text-[#c9a84c] hover:underline">
				sportscards46@gmail.com
			</a>
		</div>
		<img
			src={archer}
			alt="The Comish"
			class="hidden h-28 w-auto shrink-0 object-contain object-bottom drop-shadow-xl sm:block"
		/>
	</div>
</section>
