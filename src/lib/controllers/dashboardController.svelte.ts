import { DashboardProvider } from '$lib/providers';

export interface DashboardCardGroupViewModel {
	group: { season: any; entries: any[] };
	lmsCard: ReturnType<typeof DashboardProvider.buildPoolCardViewModel> | null;
	secondHalfCard: ReturnType<typeof DashboardProvider.buildPoolCardViewModel> | null;
}

interface DashboardControllerInput {
	seasonGroups: Array<{ season: any; entries: any[] }>;
	selectedSeasonId: string;
	currentWeekBySeason: Record<string, any>;
	currentWeekSHBySeason?: Record<string, any>;
	week6BySeason: Record<string, any>;
	entries: any[];
	now: number;
}

export function createDashboardController(input: DashboardControllerInput) {
	const visibleGroups = input.seasonGroups.filter((group) => {
		if (!input.selectedSeasonId) return true;
		return group.season.id === input.selectedSeasonId || group.entries.some((entry: any) => entry.season === input.selectedSeasonId);
	});

	const cardGroups = visibleGroups.length ? visibleGroups : input.seasonGroups;

	const groups = cardGroups.map((group) => {
		const season = group.season;
		const currentWeek = input.currentWeekBySeason[season.id] ?? null;
		const currentWeekSH = input.currentWeekSHBySeason?.[season.id] ?? currentWeek;
		const week6Week = input.week6BySeason[season.id] ?? null;
		const seasonEntries = input.entries.filter((entry: any) => entry.season === season.id);
		const lmsEntries = seasonEntries.filter((entry: any) => entry.entryType === 'lms');
		const secondHalfEntries = seasonEntries.filter((entry: any) => entry.entryType === 'second_half');
		const lmsEntryCount = lmsEntries.filter((entry: any) => entry.status === 'active').length;
		const secondHalfEntryCount = secondHalfEntries.filter((entry: any) => entry.status === 'active').length;
		const userHasLmsEntry = lmsEntryCount > 0;
		const userHasSecondHalfEntry = secondHalfEntryCount > 0;

		return {
			group,
			lmsCard: DashboardProvider.buildPoolCardViewModel({
				type: 'lms',
				season,
				currentWeek,
				week6Week,
				now: input.now,
				entries: lmsEntries,
				myEntryCount: lmsEntryCount,
				userHasEntry: userHasLmsEntry,
				shStartWeek: season.secondHalfStartWeek ?? 6
			}),
			secondHalfCard: season.secondHalfEnabled === false ? null : DashboardProvider.buildPoolCardViewModel({
				type: 'second_half',
				season,
				currentWeek: currentWeekSH,
				week6Week,
				now: input.now,
				entries: secondHalfEntries,
				myEntryCount: secondHalfEntryCount,
				userHasEntry: userHasSecondHalfEntry,
				shStartWeek: season.secondHalfStartWeek ?? 6
			})
		} satisfies DashboardCardGroupViewModel;
	});

	return {
		get cardGroups() {
			return groups;
		}
	};
}
