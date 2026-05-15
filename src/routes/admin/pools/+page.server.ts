import { fail } from '@sveltejs/kit';
import { pbAdmin } from '$lib/server/pb-admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const pb = await pbAdmin();

	// All active seasons
	const seasons = await pb.collection('seasons').getFullList({
		filter: 'status = "active" || status = "open"',
		sort:   'name'
	}).catch(() => []);

	// All weeks for active seasons, sorted
	const seasonIds = seasons.map((s: any) => s.id);
	const weeks = seasonIds.length
		? await pb.collection('weekly_settings').getFullList({
				filter: seasonIds.map(id => `season = "${id}"`).join(' || '),
				sort:   'season,week'
		  }).catch(() => [])
		: [];

	// All NFL teams for filter labels
	const teams = await pb.collection('nfl_teams').getFullList({ sort: 'name' }).catch(() => []);

	// All picks with entry + user + pickedTeams expanded
	const picks = await pb.collection('picks').getFullList({
		expand: 'entry,entry.user,pickedTeams,week',
		sort:   'week'
	}).catch(() => []);

	// Eliminated entries for active seasons, with their picks expanded
	const eliminatedEntries = seasonIds.length
		? await pb.collection('entries').getFullList({
				filter: `(${seasonIds.map(id => `season = "${id}"`).join(' || ')}) && status = "eliminated"`,
				expand: 'user,season',
				sort:   '-eliminatedWeek'
		  }).catch(() => [])
		: [];

	// For each eliminated entry, fetch the pick for the eliminated week so we
	// can show which team they picked that got them knocked out.
	const eliminatedWithPicks = await Promise.all(
		(eliminatedEntries as any[]).map(async (entry) => {
			if (!entry.eliminatedWeek) return { ...entry, eliminatedPick: null };
			// Find the week record matching eliminatedWeek number for this season
			const weekRecords = (weeks as any[]).filter(
				w => w.season === entry.season && w.week === entry.eliminatedWeek
			);
			const weekId = weekRecords[0]?.id;
			if (!weekId) return { ...entry, eliminatedPick: null };
			const pick = await pb.collection('picks')
				.getFirstListItem(`entry = "${entry.id}" && week = "${weekId}"`, { expand: 'pickedTeams' })
				.catch(() => null);
			return { ...entry, eliminatedPick: pick };
		})
	);

	return {
		seasons:          seasons          as any[],
		weeks:            weeks            as any[],
		teams:            teams            as any[],
		picks:            picks            as any[],
		eliminatedEntries: eliminatedWithPicks as any[]
	};
};

export const actions: Actions = {
	// Remove all @blo.com test data
	clearTestData: async () => {
		const pb = await pbAdmin();

		async function getAllInChunks(collection: string, ids: string[], field: string) {
			const CHUNK = 20;
			const results: any[] = [];
			for (let i = 0; i < ids.length; i += CHUNK) {
				const chunk  = ids.slice(i, i + CHUNK);
				const filter = chunk.map(id => `${field} = "${id}"`).join(' || ');
				const items  = await pb.collection(collection).getFullList({ filter }).catch(() => []);
				results.push(...items);
			}
			return results;
		}

		// Find test users
		const testUsers   = await pb.collection('users').getFullList({ filter: 'email ~ "@blo.com"' }).catch(() => []);
		const testUserIds = testUsers.map((u: any) => u.id);

		// Find Second Half season
		const shSeasons = await pb.collection('seasons').getFullList({ filter: 'name = "2026 - 2027 Second Half"' }).catch(() => []);
		const shSeason  = shSeasons[0] ?? null;

		// Find all entries for test users
		const testEntries   = testUserIds.length ? await getAllInChunks('entries', testUserIds, 'user') : [];
		const testEntryIds  = testEntries.map((e: any) => e.id);

		// Delete picks → entries → weeks → season → users (dependency order)
		const picks = testEntryIds.length ? await getAllInChunks('picks', testEntryIds, 'entry') : [];
		for (const p of picks)       await pb.collection('picks').delete(p.id).catch(() => {});
		for (const e of testEntries) await pb.collection('entries').delete(e.id).catch(() => {});

		if (shSeason) {
			const weeks = await pb.collection('weekly_settings').getFullList({ filter: `season = "${shSeason.id}"` }).catch(() => []);
			for (const w of weeks) await pb.collection('weekly_settings').delete(w.id).catch(() => {});
			await pb.collection('seasons').delete(shSeason.id).catch(() => {});
		}

		for (const u of testUsers) await pb.collection('users').delete(u.id).catch(() => {});

		return {
			cleared: true,
			counts: { picks: picks.length, entries: testEntries.length, users: testUsers.length }
		};
	},

	// Reinstate a single eliminated entry back to active
	reinstate: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const entryId = data.get('entryId') as string;

		if (!entryId) return fail(400, { error: 'No entry specified.' });

		try {
			await pb.collection('entries').update(entryId, {
				status:           'active',
				eliminatedWeek:   0,
				eliminatedReason: ''
			});
			return { reinstated: true };
		} catch (e: any) {
			return fail(400, { error: e?.message ?? 'Failed to reinstate entry.' });
		}
	},

	// Bulk eliminate entries
	eliminate: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();

		const entryIds   = data.getAll('entryIds') as string[];
		const weekNumber = data.get('weekNumber')  as string;
		const teamId     = data.get('teamId')      as string;
		const reason     = (data.get('reason') as string) || '';

		if (!entryIds.length) {
			return fail(400, { error: 'No entries selected.' });
		}

		// Build a descriptive reason that includes the team if selected
		let eliminatedReason = reason;
		if (teamId && !reason) {
			const team = await pb.collection('nfl_teams').getOne(teamId).catch(() => null) as any;
			if (team) eliminatedReason = `${team.city} ${team.name}`;
		} else if (teamId && reason) {
			eliminatedReason = reason;
		}

		let eliminated = 0;
		const errors: string[] = [];

		for (const id of entryIds) {
			try {
				await pb.collection('entries').update(id, {
					status:           'eliminated',
					eliminatedWeek:   parseInt(weekNumber) || 0,
					eliminatedReason
				});
				eliminated++;
			} catch (e: any) {
				errors.push(id);
			}
		}

		if (errors.length) {
			return fail(400, {
				error:      `${eliminated} eliminated, ${errors.length} failed.`,
				eliminated
			});
		}

		return { success: true, eliminated };
	}
};
