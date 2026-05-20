import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { WeekProvider, SeasonProvider, TeamProvider, EntryProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';
import type { EntryType } from '$lib/providers';

const RESULTS_DELAY_MS  = 10 * 60 * 1000;
const COMPLETE_DELAY_MS = 18 * 60 * 1000;

export const load: PageServerLoad = async ({ url }) => {
	const pb       = await pbAdmin();
	const seasonId = url.searchParams.get('season') ?? '';
	const poolType = (url.searchParams.get('poolType') ?? 'lms') as EntryType;

	const seasonProvider = new SeasonProvider(pb);
	const weekProvider   = new WeekProvider(pb);
	const teamProvider   = new TeamProvider(pb);
	const entryProvider  = new EntryProvider(pb);

	const [seasons, teams] = await Promise.all([
		seasonProvider.getAll(),
		teamProvider.getAll()
	]);

	const activeSeason = seasonId
		? seasons.find(s => s.id === seasonId) ?? seasons[0]
		: seasons[0];

	const weeks = activeSeason
		? await weekProvider.getAll({ seasonId: activeSeason.id, poolType })
		: [];

	// Pick counts per week — only fetch if there are weeks to show
	const pickCountsByWeek: Record<string, number> = {};
	if (activeSeason && weeks.length > 0) {
		try {
			const picks = await pb.collection('picks').getFullList({
				filter: `season = "${activeSeason.id}"`,
				fields: 'week'
			});
			for (const p of picks) {
				const wid = (p as any).week as string;
				pickCountsByWeek[wid] = (pickCountsByWeek[wid] ?? 0) + 1;
			}
		} catch {
			// picks collection may not exist yet — silently skip
		}
	}

	// Active entry count for the season (to compute "missing picks")
	const activeEntryCount = activeSeason
		? (await entryProvider.getStatsFields(activeSeason.id))
				.filter(e => e.status === 'active').length
		: 0;

	// Existing week numbers so the UI can show how many are missing
	const existingWeekNumbers = weeks.map(w => w.week);

	// Earliest game time for week 1 — used to pre-fill the deadline field
	let firstGameTime: string | null = null;
	// Longest shot per week — biggest underdog (most positive spread) from active odds
	const longestShotByWeek: Record<number, { teamId: string; abbreviation: string; city: string; name: string; spread: number }> = {};
	if (activeSeason) {
		try {
			const odds = await pb.collection('game_odds').getFirstListItem(
				`season = "${activeSeason.id}" && week = 1 && isActive = true`,
				{ sort: 'gameTime', fields: 'gameTime' }
			);
			firstGameTime = odds.gameTime;
		} catch { /* no odds yet */ }

		try {
			const allOdds = await pb.collection('game_odds').getFullList({
				filter: `season = "${activeSeason.id}" && isActive = true && homeSpread != null`,
				expand: 'homeTeam,awayTeam',
			}) as any[];

			for (const g of allOdds) {
				const w      = g.week as number;
				const spread = g.homeSpread as number;
				// Candidates: home team with positive spread, away team with negative spread (= underdog)
				const candidates = [
					{ team: g.expand?.homeTeam, spread:  spread },
					{ team: g.expand?.awayTeam, spread: -spread },
				];
				for (const c of candidates) {
					if (!c.team || c.spread <= 0) continue;
					if (!longestShotByWeek[w] || c.spread > longestShotByWeek[w].spread) {
						longestShotByWeek[w] = {
							teamId:       c.team.id,
							abbreviation: c.team.abbreviation,
							city:         c.team.city,
							name:         c.team.name,
							spread:       c.spread,
						};
					}
				}
			}
		} catch { /* odds not available */ }
	}

	// Compute next scheduled action across all weeks for the timeline display
	const now = Date.now();
	const nextActions = weeks
		.filter(w => w.status !== 'complete')
		.flatMap(w => {
			const dl = new Date(w.deadline).getTime();
			const events = [];
			if (w.status === 'open')             events.push({ weekNum: w.week, at: dl,                    action: 'lock' });
			if (w.status === 'locked')            events.push({ weekNum: w.week, at: dl + RESULTS_DELAY_MS,  action: 'results' });
			if (w.status === 'results_pending')   events.push({ weekNum: w.week, at: dl + COMPLETE_DELAY_MS, action: 'complete' });
			return events;
		})
		.sort((a, b) => a.at - b.at);

	const isTestSeason = activeSeason?.name?.includes('[TEST]') ?? false;

	// Weeks that have at least one active game odd with a spread set
	const activeOddsWeeks = new Set(Object.keys(longestShotByWeek).map(Number));

	return {
		seasons,
		teams,
		weeks,
		activeSeason: activeSeason ?? null,
		poolType,
		pickCountsByWeek,
		activeEntryCount,
		existingWeekNumbers,
		firstGameTime,
		nextActions,
		isTestSeason,
		serverNow: now,
		longestShotByWeek,
		activeOddsWeeks: [...activeOddsWeeks],
	};
};

export const actions: Actions = {
	createWeek: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const seasonId = data.get('seasonId') as string;
		const week     = Number(data.get('week'));
		const deadline = data.get('deadline') as string;
		const notes    = (data.get('notes') as string | null) ?? '';

		if (!seasonId || !week || !deadline) {
			return fail(400, { error: 'Season, week number and deadline are required.' });
		}

		const existing = await pb.collection('weekly_settings').getList(1, 1, {
			filter: `season = "${seasonId}" && week = ${week}`
		});
		if (existing.totalItems > 0) {
			return fail(400, { error: `Week ${week} already exists for this season.` });
		}

		try {
			await pb.collection('weekly_settings').create({
				season: seasonId, week, deadline, status: 'open',
				notes:  notes || null,
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create week.' });
		}
		return { success: true };
	},

	setStatus: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id     = data.get('id')     as string;
		const status = data.get('status') as string;
		try {
			await pb.collection('weekly_settings').update(id, { status });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	setFavorite: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id     = data.get('id')     as string;
		const teamId = data.get('teamId') as string;
		try {
			await pb.collection('weekly_settings').update(id, {
				biggestFavoriteTeam: teamId || null
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	/**
	 * Returns the earliest gameTime from game_odds for a given season+week.
	 * Used to auto-populate the week 1 deadline from the actual schedule.
	 */
	fetchFirstGame: async ({ request }) => {
		const pb       = await pbAdmin();
		const data     = await request.formData();
		const seasonId = data.get('seasonId') as string;
		const week     = Number(data.get('week') ?? 1);

		if (!seasonId) return fail(400, { error: 'seasonId required.' });

		try {
			const odds = await pb.collection('game_odds').getFirstListItem(
				`season = "${seasonId}" && week = ${week} && isActive = true`,
				{ sort: 'gameTime', fields: 'gameTime' }
			);
			return { firstGameTime: odds.gameTime };
		} catch {
			return fail(404, { error: `No odds found for week ${week}. Enter the deadline manually.` });
		}
	},

	/**
	 * Push all week deadlines forward from now so week 1 fires in the future.
	 * Interval is derived from the season name: (1h/week) or (1d/week).
	 * Does NOT touch entries, picks, or pick_results.
	 */
	startSeason: async ({ request }) => {
		const pb       = await pbAdmin();
		const data     = await request.formData();
		const seasonId = data.get('seasonId') as string;
		if (!seasonId) return fail(400, { error: 'seasonId required.' });

		const season = await pb.collection('seasons').getOne(seasonId) as any;
		if (!season.name?.includes('[TEST]')) {
			return fail(400, { error: 'Only test seasons can be restarted this way.' });
		}

		// Derive interval from name
		const m = season.name.match(/\((\d+)(h|d)\/week\)/);
		if (!m) return fail(400, { error: 'Could not determine interval from season name.' });
		const intervalMs = m[2] === 'h'
			? Number(m[1]) * 60 * 60 * 1000
			: Number(m[1]) * 24 * 60 * 60 * 1000;

		const now   = new Date();
		const weeks = await pb.collection('weekly_settings').getFullList({
			filter: `season = "${seasonId}"`, sort: '+week'
		});

		for (const week of weeks as any[]) {
			const slotStart = new Date(now.getTime() + (week.week - 1) * intervalMs);
			const deadline  = new Date(slotStart.getTime() + intervalMs - 20 * 60 * 1000);
			await pb.collection('weekly_settings').update(week.id, {
				deadline: deadline.toISOString().replace('T', ' ').slice(0, 23) + 'Z',
				status:   'open',
			});
		}

		// Update season's firstPickDeadline to match new week 1 deadline
		const newFirstDeadline = new Date(now.getTime() + intervalMs - 20 * 60 * 1000);
		await pb.collection('seasons').update(seasonId, {
			firstPickDeadline: newFirstDeadline.toISOString().replace('T', ' ').slice(0, 23) + 'Z',
			paymentDeadline:   newFirstDeadline.toISOString().replace('T', ' ').slice(0, 23) + 'Z',
		});

		return { success: true, message: `Season restarted — week 1 deadline is now in ${Math.round(intervalMs / 60000 - 20)} minutes.` };
	},

	/**
	 * Full reset: rewind all weeks to open, restore eliminated entries to active,
	 * delete all pick_results and picks, re-seed picks for weeks 1–3, push deadlines forward.
	 */
	resetSeason: async ({ request }) => {
		const pb       = await pbAdmin();
		const data     = await request.formData();
		const seasonId = data.get('seasonId') as string;
		if (!seasonId) return fail(400, { error: 'seasonId required.' });

		const season = await pb.collection('seasons').getOne(seasonId) as any;
		if (!season.name?.includes('[TEST]')) {
			return fail(400, { error: 'Only test seasons can be reset.' });
		}

		const m = season.name.match(/\((\d+)(h|d)\/week\)/);
		if (!m) return fail(400, { error: 'Could not determine interval from season name.' });
		const intervalMs = m[2] === 'h'
			? Number(m[1]) * 60 * 60 * 1000
			: Number(m[1]) * 24 * 60 * 60 * 1000;

		const now   = new Date();
		const weeks = await pb.collection('weekly_settings').getFullList({
			filter: `season = "${seasonId}"`, sort: '+week'
		});

		// 1. Delete pick_results then picks
		const picks = await pb.collection('picks').getFullList({
			filter: weeks.map((w: any) => `week = "${w.id}"`).join(' || ')
		});
		const pickIds = (picks as any[]).map((p: any) => p.id);
		if (pickIds.length) {
			const CHUNK = 20;
			for (let i = 0; i < pickIds.length; i += CHUNK) {
				const chunk  = pickIds.slice(i, i + CHUNK);
				const filter = chunk.map((id: string) => `pick = "${id}"`).join(' || ');
				const results = await pb.collection('pick_results').getFullList({ filter });
				for (const r of results as any[]) await pb.collection('pick_results').delete(r.id).catch(() => {});
			}
			for (const p of picks as any[]) await pb.collection('picks').delete(p.id).catch(() => {});
		}

		// 2. Restore all entries to active (except pending_payment — leave those)
		const entries = await pb.collection('entries').getFullList({
			filter: `season = "${seasonId}" && status = "eliminated"`
		});
		for (const e of entries as any[]) {
			await pb.collection('entries').update(e.id, {
				status: 'active', eliminatedWeek: 0, eliminatedReason: ''
			}).catch(() => {});
		}

		// 3. Reset week deadlines and statuses
		for (const week of weeks as any[]) {
			const slotStart = new Date(now.getTime() + (week.week - 1) * intervalMs);
			const deadline  = new Date(slotStart.getTime() + intervalMs - 20 * 60 * 1000);
			await pb.collection('weekly_settings').update(week.id, {
				deadline: deadline.toISOString().replace('T', ' ').slice(0, 23) + 'Z',
				status:   'open',
			});
		}

		// 4. Update season firstPickDeadline
		const newFirstDeadline = new Date(now.getTime() + intervalMs - 20 * 60 * 1000);
		await pb.collection('seasons').update(seasonId, {
			firstPickDeadline: newFirstDeadline.toISOString().replace('T', ' ').slice(0, 23) + 'Z',
			paymentDeadline:   newFirstDeadline.toISOString().replace('T', ' ').slice(0, 23) + 'Z',
			status: 'active',
		});

		// 5. Re-seed picks for weeks 1–3 for active entries
		const activeEntries = await pb.collection('entries').getFullList({
			filter: `season = "${seasonId}" && status = "active"`
		});
		const teams     = await pb.collection('nfl_teams').getFullList({ sort: 'name' });
		const pickWeeks = (weeks as any[]).slice(0, 3);
		const entryType = season.name.toLowerCase().includes('second half') ? 'second_half' : 'lms';
		let   seeded    = 0;

		function shuffle<T>(arr: T[]): T[] {
			const a = [...arr];
			for (let i = a.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[a[i], a[j]] = [a[j], a[i]];
			}
			return a;
		}

		for (const entry of activeEntries as any[]) {
			if (Math.random() < 0.15) continue;
			const pool = shuffle(teams as any[]);
			let idx = 0;
			for (const week of pickWeeks) {
				if (week.week > 1 && Math.random() < 0.15) continue;
				const team = pool[idx++] as any;
				if (!team) break;
				await pb.collection('picks').create({
					entry: entry.id, week: week.id,
					pickedTeams: [team.id], entryType, isAutoPick: false,
				}).catch(() => {});
				seeded++;
			}
		}

		return {
			success: true,
			message: `Reset complete — ${entries.length} entries restored, ${pickIds.length} picks cleared, ${seeded} new picks seeded. Week 1 deadline in ${Math.round(intervalMs / 60000 - 20)} minutes.`
		};
	},

	/**
	 * Manually runs the advance-weeks logic for a single season.
	 * Useful in dev where the Netlify scheduled function doesn't run.
	 */
	advanceNow: async ({ request }) => {
		const pb       = await pbAdmin();
		const data     = await request.formData();
		const seasonId = data.get('seasonId') as string;
		if (!seasonId) return fail(400, { error: 'seasonId required.' });

		const now    = Date.now();
		const season = await pb.collection('seasons').getOne(seasonId);
		const isTest = (season as any).name?.includes('[TEST]');
		const weeks  = await pb.collection('weekly_settings').getFullList({
			filter: `season = "${seasonId}"`, sort: '+week'
		});

		const log: string[] = [];

		for (const week of weeks as any[]) {
			const dl         = new Date(week.deadline).getTime();
			const resultsAt  = dl + RESULTS_DELAY_MS;
			const completeAt = dl + COMPLETE_DELAY_MS;

			// Lock
			if (now >= dl && week.status === 'open') {
				await pb.collection('weekly_settings').update(week.id, { status: 'locked' });
				// Auto-pick for entries that missed deadline
				if (week.biggestFavoriteTeam) {
					const entries = await pb.collection('entries').getFullList({
						filter: `season = "${seasonId}" && status = "active"`
					});
					const existing = await pb.collection('picks').getFullList({ filter: `week = "${week.id}"` });
					const pickedIds = new Set(existing.map((p: any) => p.entry));
					for (const entry of entries as any[]) {
						if (pickedIds.has(entry.id)) continue;
						await pb.collection('picks').create({
							entry: entry.id, week: week.id,
							pickedTeams: [week.biggestFavoriteTeam],
							entryType: entry.entryType, isAutoPick: true,
						}).catch(() => {});
					}
				}
				log.push(`Week ${week.week}: locked`);
			}

			// Simulate results (test seasons only)
			if (isTest && now >= resultsAt && week.status === 'locked') {
				const picks = await pb.collection('picks').getFullList({ filter: `week = "${week.id}"` });
				const teams = await pb.collection('nfl_teams').getFullList({ fields: 'id' });
				for (const pick of picks as any[]) {
					const pickedTeams = Array.isArray(pick.pickedTeams) ? pick.pickedTeams : [pick.pickedTeams];
					for (const teamId of pickedTeams) {
						const result = Math.random() < 0.5 ? 'correct' : 'incorrect';
						const existing = await pb.collection('pick_results').getFullList({ filter: `pick = "${pick.id}" && team = "${teamId}"` });
						if (existing.length) {
							await pb.collection('pick_results').update(existing[0].id, { result }).catch(() => {});
						} else {
							await pb.collection('pick_results').create({ pick: pick.id, team: teamId, result, notes: 'auto-simulated' }).catch(() => {});
						}
					}
				}
				await pb.collection('weekly_settings').update(week.id, { status: 'results_pending' });
				log.push(`Week ${week.week}: results simulated`);
			}

			// Complete
			if (now >= completeAt && week.status === 'results_pending') {
				const picks = await pb.collection('picks').getFullList({ filter: `week = "${week.id}"` });
				let eliminated = 0;
				for (const pick of picks as any[]) {
					const results = await pb.collection('pick_results').getFullList({ filter: `pick = "${pick.id}"` });
					if (!results.length || results.some((r: any) => r.result === 'incorrect')) {
						const entry = await pb.collection('entries').getOne(pick.entry).catch(() => null);
						if (entry && (entry as any).status === 'active') {
							await pb.collection('entries').update(pick.entry, {
								status: 'eliminated', eliminatedWeek: week.week, eliminatedReason: 'Picked a losing team'
							}).catch(() => {});
							eliminated++;
						}
					}
				}
				await pb.collection('weekly_settings').update(week.id, { status: 'complete' });
				log.push(`Week ${week.week}: complete, ${eliminated} eliminated`);
			}
		}

		if (!log.length) log.push('Nothing to advance — no deadlines have passed yet.');
		return { success: true, advanceLog: log };
	},

	deleteWeek: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id') as string;
		try {
			await pb.collection('weekly_settings').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
	},

	/**
	 * Bulk-create all missing weeks (1–18 for LMS, 10–18 for Second Half).
	 * Skips weeks that already exist. Uses Thursday 3 pm UTC as a placeholder
	 * deadline — admins can edit individual weeks afterward.
	 */
	bulkCreateWeeks: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const seasonId  = data.get('seasonId')  as string;
		const poolType  = (data.get('poolType') as EntryType) ?? 'lms';
		const startWeek = poolType === 'second_half' ? 10 : 1;
		const endWeek   = 18;

		if (!seasonId) return fail(400, { error: 'Season is required.' });

		// Find existing week numbers
		const existing = await pb.collection('weekly_settings').getFullList({
			filter: `season = "${seasonId}"`,
			fields: 'week'
		});
		const existingNums = new Set(existing.map((w: any) => w.week as number));

		// Placeholder: Thursday of each NFL week, starting from the first week of September
		// We use a simple offset from a known date (2026-09-04 = Week 1 Thursday)
		const week1Thursday = new Date('2026-09-04T20:00:00Z'); // 3 pm EDT = 20:00 UTC

		let created = 0;
		for (let w = startWeek; w <= endWeek; w++) {
			if (existingNums.has(w)) continue;
			const deadline = new Date(week1Thursday);
			deadline.setDate(week1Thursday.getDate() + (w - 1) * 7);
			try {
				await pb.collection('weekly_settings').create({
					season:   seasonId,
					week:     w,
					deadline: deadline.toISOString(),
					status:   'open',
					notes:    null,
				});
				created++;
			} catch {
				// skip duplicates or constraint errors
			}
		}

		return { success: true, bulkCreated: created };
	}
};
