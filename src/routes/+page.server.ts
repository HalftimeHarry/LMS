import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const pb = await pbAdmin();

		// Find the active real season
		const seasons = await pb.collection('seasons').getFullList({
			filter: 'status = "active"',
			sort:   '-year',
		}).catch(() => []) as any[];

		const season = seasons.find((s: any) => !s.name?.includes('[TEST]')) ?? seasons[0] ?? null;
		if (!season) return { lmsDeadline: null, lmsWeek: null, lmsEntryFee: null };

		// Find the current open LMS week
		const week = await pb.collection('weekly_settings').getFirstListItem(
			`season = "${season.id}" && status = "open"`,
			{ sort: '+week' }
		).catch(() => null) as any;

		return {
			lmsDeadline:  week?.deadline  ?? null,
			lmsWeek:      week?.week      ?? null,
			lmsEntryFee:  season.lmsEntryFee ?? null,
		};
	} catch {
		return { lmsDeadline: null, lmsWeek: null, lmsEntryFee: null };
	}
};
