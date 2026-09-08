import { pbAdmin } from '$lib/server/pb-admin';
import { fail } from '@sveltejs/kit';
import { adminCreateEntriesSchema } from '$lib/schemas';
import { getKickoffIso, KICKOFF_FIELDS } from '$lib/server/deadlines';
import type { Actions, PageServerLoad } from './$types';

function buildEntryName(baseName: string, entryType: 'lms' | 'second_half', sequence: number, count: number): string {
	if (entryType === 'second_half') {
		const cleanedBase = baseName
			.replace(/\s+LMS(?:\s+\d+)?$/i, '')
			.replace(/\s+2nd\s+Half(?:\s+\d+)?$/i, '')
			.trim();
		return `${cleanedBase} 2nd Half ${sequence}`;
	}
	return count === 1 ? baseName : `${baseName} ${sequence}`;
}

export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';

	const [users, entries, seasons] = await Promise.all([
		pb.collection('users').getFullList({
			filter: 'role = "participant"',
			sort:   '+displayName',
			fields: 'id,displayName,email,created,verified',
		}),
		pb.collection('entries').getFullList({
			fields: 'id,user,status,entryType,entryName',
		}),
		pb.collection('seasons').getFullList({
			sort: '+name',
			fields: 'id,name,status,lmsEnabled,secondHalfEnabled,secondHalfStartWeek'
		})
	]);

	const seasonsVisible = isSuperAdmin ? seasons : seasons.filter((s: any) => !s.name?.includes('[TEST]'));
	const deadlineMap: Record<string, string> = {};
	const shDeadlineMap: Record<string, string> = {};
	for (const season of seasonsVisible as any[]) {
		const shStartWeek = season.secondHalfStartWeek ?? 6;
		const [week1Odds, shOdds] = await Promise.all([
			pb.collection('game_odds').getFirstListItem(
				`season = "${season.id}" && week = 1 && isActive = true`,
				{ sort: 'game_time_stamp', fields: KICKOFF_FIELDS }
			).catch(() => null),
			pb.collection('game_odds').getFirstListItem(
				`season = "${season.id}" && week = ${shStartWeek} && isActive = true`,
				{ sort: 'game_time_stamp', fields: KICKOFF_FIELDS }
			).catch(() => null),
		]);
		const week1Kickoff = getKickoffIso(week1Odds as any);
		if (week1Kickoff) {
			const cutoff = new Date(week1Kickoff);
			cutoff.setMinutes(cutoff.getMinutes() - 40);
			deadlineMap[season.id] = cutoff.toISOString();
		}
		const shKickoff = getKickoffIso(shOdds as any);
		if (shKickoff) {
			const cutoff = new Date(shKickoff);
			cutoff.setMinutes(cutoff.getMinutes() - 40);
			shDeadlineMap[season.id] = cutoff.toISOString();
		}
	}

	const entriesByUser: Record<string, any[]> = {};
	for (const e of entries as any[]) {
		if (!entriesByUser[e.user]) entriesByUser[e.user] = [];
		entriesByUser[e.user].push(e);
	}

	return { users, entriesByUser, seasons: seasonsVisible, deadlineMap, shDeadlineMap };
};

export const actions: Actions = {
	createEntries: async ({ request, locals }) => {
		if (locals.role !== 'super_admin' && locals.role !== 'pool_admin') {
			return fail(403, { error: 'Not authorized.', action: 'create' });
		}
		const pb = await pbAdmin();
		const raw = await request.formData();
		const parsed = adminCreateEntriesSchema.safeParse({
			seasonId: raw.get('seasonId'),
			userId: raw.get('userId'),
			entryType: raw.get('entryType'),
			count: raw.get('count'),
			baseName: (raw.get('baseName') as string)?.trim(),
			referredBy: (raw.get('referredBy') as string)?.trim() || undefined,
			complimentary: raw.get('complimentary') === 'true'
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0].message, action: 'create' });
		}
		const { seasonId, userId, entryType, count, baseName, referredBy = '', complimentary } = parsed.data;
		const season = await pb.collection('seasons').getOne(seasonId).catch(() => null) as any;
		const pickWeek = entryType === 'second_half' ? (season?.secondHalfStartWeek ?? 6) : 1;
		const firstOdds = await pb.collection('game_odds').getFirstListItem(
			`season = "${seasonId}" && week = ${pickWeek} && isActive = true`,
			{ sort: 'game_time_stamp', fields: KICKOFF_FIELDS }
		).catch(() => null) as any;
		const kickoff = getKickoffIso(firstOdds);
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
		const existing = await pb.collection('entries').getFullList({
			filter: `season = "${seasonId}" && user = "${userId}"`,
			fields: 'id,entryType'
		}).catch(() => []) as any[];
		const offset = existing.filter((e: any) => e.entryType === entryType).length;
		const created: string[] = [];
		for (let i = 0; i < count; i++) {
			const sequence = offset + i + 1;
			const entryName = buildEntryName(baseName, entryType, sequence, count);
			await pb.collection('entries').create({
				season: seasonId,
				user: userId,
				entryType,
				entryName,
				referredBy: referredBy || null,
				status: complimentary ? 'active' : 'pending_payment',
				paid: complimentary ? true : false,
				paidAt: complimentary ? new Date().toISOString() : null,
				paymentMethod: complimentary ? 'free' : null,
			});
			created.push(entryName);
		}
		return { success: true, created, action: 'create' };
	},

	// Delete one or more participants. Also deletes their entries.
	delete: async ({ request, locals }) => {
		if (locals.role !== 'super_admin' && locals.role !== 'pool_admin') {
			return fail(403, { error: 'Not authorized.' });
		}

		const pb   = await pbAdmin();
		const data = await request.formData();
		const ids  = data.getAll('ids') as string[];

		if (!ids.length) return fail(400, { error: 'No participants selected.' });

		// Verify every id is actually a participant — never delete admins
		const users = await pb.collection('users').getFullList({
			filter: ids.map(id => `id = "${id}"`).join(' || '),
			fields: 'id,role',
		}).catch(() => []) as any[];

		const safeIds = users.filter((u: any) => u.role === 'participant').map((u: any) => u.id);
		if (safeIds.length !== ids.length) {
			return fail(400, { error: 'One or more selected users are not participants.' });
		}

		const errors: string[] = [];
		for (const id of safeIds) {
			try {
				// Delete entries first (cascade not guaranteed)
				const userEntries = await pb.collection('entries').getFullList({
					filter: `user = "${id}"`,
					fields: 'id',
				}).catch(() => []) as any[];
				for (const e of userEntries) {
					await pb.collection('entries').delete(e.id).catch(() => {});
				}
				await pb.collection('users').delete(id);
			} catch {
				errors.push(id);
			}
		}

		if (errors.length) {
			return fail(500, { error: `Failed to delete ${errors.length} participant(s). Others may have been removed.` });
		}
		return { success: true, deleted: safeIds.length };
	},
};
