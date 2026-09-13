const STORAGE_PREFIX = 'admin-results-draft';

export function getResultsDraftKey(year: string | number, week: number) {
  return `${STORAGE_PREFIX}:${String(year)}:${String(week)}`;
}

function getStorage(): Storage | null {
  const storage = globalThis.localStorage;
  if (!storage || typeof storage.getItem !== 'function') return null;
  return storage;
}

export function loadResultsDraftOutcomes(year: string | number, week: number): Record<string, string> {
  const storage = getStorage();
  if (!storage) return {};

  const key = getResultsDraftKey(year, week);
  const raw = storage.getItem(key);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function saveResultsDraftOutcomes(year: string | number, week: number, outcomes: Record<string, string>) {
  const storage = getStorage();
  if (!storage) return;
  const key = getResultsDraftKey(year, week);
  storage.setItem(key, JSON.stringify(outcomes));
}

export function clearResultsDraftOutcomes(year: string | number, week: number) {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(getResultsDraftKey(year, week));
}
