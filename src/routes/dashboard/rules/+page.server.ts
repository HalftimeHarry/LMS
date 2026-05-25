import { pbAdmin } from '$lib/server/pb-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const pb = await pbAdmin();

	// Fetch the active season for dynamic deadline display
	const seasons = await pb.collection('seasons')
		.getFullList({ filter: 'status = "active" || status = "open"', sort: '-year', fields: 'id,name,year,firstPickDeadline,secondHalfStartWeek,lmsEntryFee,secondHalfEntryFee,paymentDeadline' })
		.catch(() => []) as any[];

	const season = seasons[0] ?? null;

	// Fetch week 6 deadline for 2H entry cutoff
	let week6Deadline: string | null = null;
	if (season) {
		const shStartWeek = season.secondHalfStartWeek ?? 6;
		const week6 = await pb.collection('weekly_settings')
			.getFirstListItem(`season = "${season.id}" && week = ${shStartWeek}`, { fields: 'deadline' })
			.catch(() => null) as any;
		week6Deadline = week6?.deadline ?? null;
	}

	return { season, week6Deadline };
};
