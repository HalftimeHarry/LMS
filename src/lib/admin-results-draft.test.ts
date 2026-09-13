import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getResultsDraftKey,
  loadResultsDraftOutcomes,
  saveResultsDraftOutcomes,
  clearResultsDraftOutcomes,
} from './adminResultsDraft';

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => (storage.has(key) ? storage.get(key)! : null)),
      setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
      removeItem: vi.fn((key: string) => { storage.delete(key); }),
    },
    configurable: true,
  });
});

describe('admin results draft storage', () => {
  it('persists and restores outcomes for a year/week key', () => {
    const key = getResultsDraftKey('2027', 1);
    const outcomes = { game1: 'home', game2: 'away' };

    saveResultsDraftOutcomes('2027', 1, outcomes);

    expect(loadResultsDraftOutcomes('2027', 1)).toEqual(outcomes);
    expect(localStorage.getItem(key)).toContain('game1');
  });

  it('clears only the matching week key', () => {
    saveResultsDraftOutcomes('2027', 1, { game1: 'home' });
    saveResultsDraftOutcomes('2027', 2, { game2: 'tie' });

    clearResultsDraftOutcomes('2027', 1);

    expect(loadResultsDraftOutcomes('2027', 1)).toEqual({});
    expect(loadResultsDraftOutcomes('2027', 2)).toEqual({ game2: 'tie' });
  });
});
