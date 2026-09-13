export type ResultsDraftOutcomes = Record<string, string>;

const draftStore = new Map<string, ResultsDraftOutcomes>();

export function getResultsDraftKey(year: string | number, week: number) {
	return `admin-results-draft:${String(year)}:${String(week)}`;
}

export function loadResultsDraftOutcomes(year: string | number, week: number): ResultsDraftOutcomes {
	const key = getResultsDraftKey(year, week);
	const value = draftStore.get(key);
	return value ? { ...value } : {};
}

export function saveResultsDraftOutcomes(year: string | number, week: number, outcomes: ResultsDraftOutcomes) {
	const key = getResultsDraftKey(year, week);
	const next = Object.fromEntries(
		Object.entries(outcomes ?? {}).filter(([, value]) => value != null && value !== '')
	) as ResultsDraftOutcomes;
	if (Object.keys(next).length === 0) {
		draftStore.delete(key);
		return {};
	}
	draftStore.set(key, next);
	return { ...next };
}

export function clearResultsDraftOutcomes(year: string | number, week: number) {
	draftStore.delete(getResultsDraftKey(year, week));
	return true;
}
