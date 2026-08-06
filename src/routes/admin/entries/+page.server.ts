import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { adminCreateEntriesSchema } from '$lib/schemas';
import { EntryProvider, SeasonProvider } from '$lib/providers';
import type { Actions, PageServerLoad } from './$types';
import type { EntryStatus } from '$lib/providers';

export const load: PageServerLoad = async ({ url, locals }) => {
	const pb           = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';

	const statusFilter = (url.searchParams.get('status')   ?? 'all') as EntryStatus | 'all';
	const poolType     = (url.searchParams.get('poolType') ?? 'lms') as 'lms' | 'second_half' | 'all';

	const entryProvider  = new EntryProvider(pb);
	const seasonProvider = new SeasonProvider(pb);

	const [allEntries, statsEntries, allSeasons, participants] = await Promise.all([
		entryProvider.getAll({
			status:    statusFilter,
			entryType: poolType !== 'all' ? poolType : undefined
		}),
		// Unfiltered stats — only the fields needed for the stats panel
		entryProvider.getAll({}),
		seasonProvider.getAll(),
		pb.collection('users').getFullList({
			filter: 'role = "participant"',
			sort:   'displayName',
			fields: 'id,displayName,email'
		})
	]);

	// pool_admin sees no [TEST] seasons or their entries
	const seasons = isSuperAdmin ? allSeasons : allSeasons.filter(s => !s.name?.includes('[TEST]'));
	const testSeasonIds = new Set(allSeasons.filter(s => s.name?.includes('[TEST]')).map(s => s.id));
	const entries      = isSuperAdmin ? allEntries    : allEntries.filter((e: any)    => !testSeasonIds.has(e.season));
	const statsAll     = isSuperAdmin ? statsEntries  : statsEntries.filter((e: any)  => !testSeasonIds.has(e.season));

	// Map seasonId → cutoff (40 min before week 1 kickoff from game_odds).
	const deadlineMap: Record<string, string> = {};
	for (const s of seasons) {
		if (s.name.startsWith('[TEST]')) continue;
		const odds = await pb.collection('game_odds').getFirstListItem(
			`season = "${s.id}" && week = 1 && isActive = true`,
			{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
		).catch(() => null) as any;
		const kickoff = odds?.game_time_stamp ?? odds?.gameTime;
		if (!kickoff) continue;
		const cutoff = new Date(kickoff);
		cutoff.setMinutes(cutoff.getMinutes() - 40);
		deadlineMap[s.id] = cutoff.toISOString();
	}

	// Active season for the deadline notice in the header
	const activeSeason = (seasons as any[]).find(s => s.status === 'active' || s.status === 'open') ?? null;

	// Derive entry deadlines from first game kickoff (40 min before) in game_odds
	// LMS = week 1 first game, 2H = secondHalfStartWeek (default 6) first game
	let lmsEntryDeadline: string | null = null;
	let shEntryDeadline:  string | null = null;

	if (activeSeason) {
		const shStartWeek = (activeSeason as any).secondHalfStartWeek ?? 6;

		const [week1Odds, week6Odds] = await Promise.all([
			pb.collection('game_odds').getFirstListItem(
				`season = "${activeSeason.id}" && week = 1 && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			).catch(() => null),
			pb.collection('game_odds').getFirstListItem(
				`season = "${activeSeason.id}" && week = ${shStartWeek} && isActive = true`,
				{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
			).catch(() => null),
		]);

		const week1Kickoff = week1Odds?.game_time_stamp ?? week1Odds?.gameTime;
		if (week1Kickoff) {
			const t = new Date(week1Kickoff);
			t.setMinutes(t.getMinutes() - 40);
			lmsEntryDeadline = t.toISOString();
		}
		const week6Kickoff = week6Odds?.game_time_stamp ?? week6Odds?.gameTime;
		if (week6Kickoff) {
			const t = new Date(week6Kickoff);
			t.setMinutes(t.getMinutes() - 40);
			shEntryDeadline = t.toISOString();
		}
	}

	return { entries, statsAll, seasons, participants, statusFilter, poolType, deadlineMap, activeSeason, lmsEntryDeadline, shEntryDeadline };
};

export const actions: Actions = {
	createEntries: async ({ request }) => {
		const pb  = await pbAdmin();
		const raw = await request.formData();

		const parsed = adminCreateEntriesSchema.safeParse({
			seasonId:      raw.get('seasonId'),
			userId:        raw.get('userId'),
			entryType:     raw.get('entryType'),
			count:         raw.get('count'),
			baseName:      (raw.get('baseName') as string)?.trim(),
			referredBy:    (raw.get('referredBy') as string)?.trim() || undefined,
			complimentary: raw.get('complimentary') === 'true'
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, action: 'create' });
		}
		const { seasonId, userId, entryType, count, baseName, referredBy = '', complimentary } = parsed.data;

		// Block entry creation after the game-derived deadline (40 min before first kickoff)
		const season = await pb.collection('seasons').getOne(seasonId).catch(() => null) as any;
		const pickWeek = entryType === 'second_half' ? (season?.secondHalfStartWeek ?? 6) : 1;
		const firstOdds = await pb.collection('game_odds').getFirstListItem(
			`season = "${seasonId}" && week = ${pickWeek} && isActive = true`,
			{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
		).catch(() => null) as any;
		const kickoff = firstOdds?.game_time_stamp ?? firstOdds?.gameTime;
		if (kickoff) {
			const deadline = new Date(kickoff);
			deadline.setMinutes(deadline.getMinutes() - 40);
			if (new Date() > deadline) {
				return fail(400, {
					error: `The entry deadline has passed — entries closed 40 minutes before the first Week ${pickWeek} kickoff.`,
					action: 'create'
				});
			}
		}
		const entryProvider = new EntryProvider(pb);
		const existing      = await entryProvider.getAll({ seasonId, userId });
		// Offset by same-type entries only so LMS and 2H number independently
		const offset        = existing.filter((e: any) => e.entryType === entryType).length;

		const created: string[] = [];
		try {
			for (let i = 0; i < count; i++) {
				const entryName = count === 1 && offset === 0
					? baseName
					: `${baseName} ${offset + i + 1}`;
				await pb.collection('entries').create({
					season:        seasonId,
					user:          userId,
					entryType,
					entryName,
					referredBy:    referredBy || null,
					// Complimentary entries are immediately active — no payment step needed
					status:        complimentary ? 'active'          : 'pending_payment',
					paid:          complimentary ? true              : false,
					paidAt:        complimentary ? new Date().toISOString() : null,
					paymentMethod: complimentary ? 'free'            : null,
				});
				created.push(entryName);
			}
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to create entries.', action: 'create' });
		}
		return { success: true, created, action: 'create' };
	},

	renameEntry: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id')        as string;
		const name = (data.get('name') as string)?.trim();
		if (!id)               return fail(400, { error: 'Entry ID required.' });
		if (!name || name.length < 2) return fail(400, { error: 'Name must be at least 2 characters.' });
		try {
			await pb.collection('entries').update(id, { entryName: name });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Rename failed.' });
		}
		return { success: true };
	},

	markPaid: async ({ request }) => {
		const pb            = await pbAdmin();
		const data          = await request.formData();
		const id            = data.get('id')            as string;
		const paymentMethod = data.get('paymentMethod') as string;
		try {
			await pb.collection('entries').update(id, {
				paid: true, paidAt: new Date().toISOString(), paymentMethod, status: 'active'
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	markUnpaid: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const id   = data.get('id') as string;
		try {
			await pb.collection('entries').update(id, {
				paid: false, paidAt: null, paymentMethod: null, status: 'pending_payment'
			});
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Update failed.' });
		}
		return { success: true };
	},

	deleteEntry: async ({ request }) => {
		const pb            = await pbAdmin();
		const data          = await request.formData();
		const id            = data.get('id') as string;
		const entryProvider = new EntryProvider(pb);

		let entry: any;
		try {
			entry = await entryProvider.getById(id);
		} catch {
			return fail(404, { error: 'Entry not found.' });
		}

		const isTestSeason = (entry.expand?.season?.name as string | undefined)?.startsWith('[TEST]');
		let deadline: string | null = null;

		// Source-of-truth deadline: 40 min before first kickoff from game_odds.
		const week1Odds = await pb.collection('game_odds').getFirstListItem(
			`season = "${entry.season}" && week = 1 && isActive = true`,
			{ sort: 'game_time_stamp', fields: 'game_time_stamp,gameTime' }
		).catch(() => null) as any;
		const kickoff = week1Odds?.game_time_stamp ?? week1Odds?.gameTime;
		if (kickoff) {
			const cutoff = new Date(kickoff);
			cutoff.setMinutes(cutoff.getMinutes() - 40);
			deadline = cutoff.toISOString();
		}

		if (!isTestSeason && deadline && new Date() > new Date(deadline)) {
			return fail(400, {
				error: 'The first-game deadline has passed. Entries can no longer be deleted — change the entry status instead.'
			});
		}
		try {
			await pb.collection('entries').delete(id);
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Delete failed.' });
		}
		return { success: true };
	},

	bulkMarkPaid: async ({ request }) => {
		const pb            = await pbAdmin();
		const data          = await request.formData();
		const ids           = data.getAll('ids') as string[];
		const paymentMethod = data.get('paymentMethod') as string;

		if (!ids.length)      return fail(400, { error: 'No entries selected.' });
		if (!paymentMethod)   return fail(400, { error: 'Payment method required.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				await pb.collection('entries').update(id, {
					paid: true, paidAt: new Date().toISOString(), paymentMethod, status: 'active'
				});
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some updates failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	},

	bulkSetStatus: async ({ request }) => {
		const pb     = await pbAdmin();
		const data   = await request.formData();
		const ids    = data.getAll('ids') as string[];
		const status = data.get('status') as string;

		if (!ids.length) return fail(400, { error: 'No entries selected.' });
		if (!status)     return fail(400, { error: 'Status required.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				const patch: Record<string, unknown> = { status };
				// Keep paid flag consistent when activating
				if (status === 'active') patch.paid = true;
				await pb.collection('entries').update(id, patch);
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some updates failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	},

	bulkSetInactive: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const ids  = data.getAll('ids') as string[];

		if (!ids.length) return fail(400, { error: 'No entries selected.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				await pb.collection('entries').update(id, { status: 'eliminated' });
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some updates failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	},

	bulkDelete: async ({ request }) => {
		const pb   = await pbAdmin();
		const data = await request.formData();
		const ids  = data.getAll('ids') as string[];

		if (!ids.length) return fail(400, { error: 'No entries selected.' });

		const errors: string[] = [];
		for (const id of ids) {
			try {
				// Delete associated picks first to avoid orphaned records
				const picks = await pb.collection('picks').getFullList({ filter: `entry = "${id}"` }).catch(() => []);
				for (const p of picks as any[]) {
					await pb.collection('picks').delete(p.id).catch(() => {});
				}
				await pb.collection('entries').delete(id);
			} catch (e: unknown) {
				errors.push(`${id}: ${(e as { message?: string })?.message ?? 'failed'}`);
			}
		}
		if (errors.length) return fail(400, { error: `Some deletes failed: ${errors.join(', ')}` });
		return { success: true, count: ids.length };
	},

	saveMaintenance: async ({ request, locals }) => {
		if (locals.role !== 'super_admin' && locals.role !== 'pool_admin') return fail(403, { error: 'Not authorized.' });
		const pb   = await pbAdmin();
		const data = await request.formData();
		const seasonId = data.get('seasonId') as string;
		const fee      = Number(data.get('maintenanceFee') ?? 0);
		if (!seasonId) return fail(400, { error: 'Season is required.' });
		if (isNaN(fee) || fee < 0) return fail(400, { error: 'Fee must be 0 or a positive number.' });
		try {
			await pb.collection('seasons').update(seasonId, { maintenanceFee: fee });
		} catch (e: unknown) {
			return fail(400, { error: (e as { message?: string })?.message ?? 'Failed to save.' });
		}
		return { success: true };
	},
};
