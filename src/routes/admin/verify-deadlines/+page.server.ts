import { pbAdmin } from '$lib/server/pb-admin';
import { getKickoffIso, isTestSeason, KICKOFF_FIELDS } from '$lib/server/deadlines';
import { resolveOddsSourceSeason, verifyWeekDeadline } from '$lib/server/deadline-verification';
import type { PageServerLoad } from './$types';

/**
 * Read-only deadline verification report. Never writes to PocketBase.
 * Covers upcoming, non-completed weeks (open + locked) across seasons.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const pb = await pbAdmin();
	const isSuperAdmin = locals.role === 'super_admin';
	const now = new Date();

	const allSeasons = (await pb.collection('seasons').getFullList({ sort: '-year' })) as any[];
	// Non-super-admins never see test seasons (same rule as Weekly Deadlines)
	const seasons = isSuperAdmin ? allSeasons : allSeasons.filter((s: any) => !isTestSeason(s));

	const rows: any[] = [];

	for (const season of seasons) {
		const isTest = isTestSeason(season);
		// Second Half seasons share their LMS anchor's game_odds (existing pairing rule)
		const oddsSource = resolveOddsSourceSeason(season, seasons);
		const viaAnchor  = oddsSource.id !== season.id;
		const shStartWeek = season.secondHalfStartWeek ?? oddsSource.secondHalfStartWeek ?? 6;

		const [weeks, odds] = (await Promise.all([
			pb.collection('weekly_settings').getFullList({
				filter: `season = "${season.id}"`, sort: 'week'
			}).catch(() => []),
			pb.collection('game_odds').getFullList({
				filter: `season = "${oddsSource.id}" && isActive = true`,
				expand: 'homeTeam,awayTeam',
				fields: `week,${KICKOFF_FIELDS},expand`
			}).catch(() => [])
		])) as [any[], any[]];

		// Earliest kickoff + game label per week
		const kickoffByWeek = new Map<number, { iso: string; label: string }>();
		const oddsWeeks = new Set<number>();
		for (const g of odds) {
			const wk = Number(g.week);
			oddsWeeks.add(wk);
			const iso = getKickoffIso(g);
			if (!iso) continue;
			const label = `${g.expand?.awayTeam?.abbreviation ?? '?'} @ ${g.expand?.homeTeam?.abbreviation ?? '?'}`;
			const prev = kickoffByWeek.get(wk);
			if (!prev || iso < prev.iso) kickoffByWeek.set(wk, { iso, label });
		}

		for (const w of weeks as any[]) {
			// Upcoming, non-completed weeks only: open or locked (incl. wrongly-locked)
			if (w.status !== 'open' && w.status !== 'locked') continue;
			// Second Half seasons only play from secondHalfStartWeek onward
			if (viaAnchor && Number(w.week) < shStartWeek) continue;

			const kickoff = kickoffByWeek.get(Number(w.week)) ?? null;
			const verification = verifyWeekDeadline({
				week: Number(w.week),
				status: w.status,
				storedDeadline: w.deadline ?? null,
				firstKickoffIso: kickoff?.iso ?? null,
				hasOdds: oddsWeeks.has(Number(w.week)),
				isTest,
				now
			});

			rows.push({
				...verification,
				seasonId:   season.id,
				seasonName: season.name,
				firstGame:    kickoff?.label ?? null,
				firstKickoff: kickoff?.iso ?? null,
				oddsSource: viaAnchor ? oddsSource.name : null,
				// No audit trail exists for weekly_settings.deadline — never inferred from timestamps.
				deadlineChangeNote: 'Change source unavailable'
			});
		}
	}

	// Earliest effective deadline first; unresolved deadlines pinned to the top.
	rows.sort((a, b) => {
		if (!a.effectiveDeadline && !b.effectiveDeadline) return 0;
		if (!a.effectiveDeadline) return -1;
		if (!b.effectiveDeadline) return 1;
		return a.effectiveDeadline < b.effectiveDeadline ? -1 : 1;
	});

	const counts = {
		upcoming:    rows.length,
		mismatches:  rows.filter((r) => r.flags.includes('MISMATCH')).length,
		earlyLocks:  rows.filter((r) => r.flags.includes('EARLY_LOCK')).length,
		missingData: rows.filter((r) => r.flags.includes('MISSING_DATA')).length
	};

	return { rows, counts, checkedAt: now.toISOString(), isSuperAdmin };
};
