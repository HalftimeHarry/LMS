import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { WeekProvider, SeasonProvider, TeamProvider, EntryProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';
import type { EntryType } from '$lib/providers';

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

	return {
		seasons,
		teams,
		weeks,
		activeSeason: activeSeason ?? null,
		poolType,
		pickCountsByWeek,
		activeEntryCount,
		existingWeekNumbers
	};
};

export const actions: Actions = {
	createWeek: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const seasonId               = data.get('seasonId') as string;
		const week                   = Number(data.get('week'));
		const deadline               = data.get('deadline') as string;
		const notes                  = (data.get('notes') as string | null) ?? '';
		const picksOverrideRaw       = data.get('secondHalfPicksPerWeek') as string | null;
		const secondHalfPicksPerWeek = picksOverrideRaw ? Number(picksOverrideRaw) : null;

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
				secondHalfPicksPerWeek: secondHalfPicksPerWeek ?? null
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
					secondHalfPicksPerWeek: null
				});
				created++;
			} catch {
				// skip duplicates or constraint errors
			}
		}

		return { success: true, bulkCreated: created };
	}
};
