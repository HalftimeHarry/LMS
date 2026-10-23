import { describe, expect, it } from 'vitest';
import {
  buildPoolEstimateBySeason,
  getEstimatedShareDisplay,
} from '$lib/payoutEstimate';

const money = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

describe('dashboard payout estimate', () => {
  it('calculates the correct pool and season pot estimate per alive entry', () => {
    const estimates = buildPoolEstimateBySeason({
      season_1: {
        lms: { pot: 2400, active: 3, total: 5, eliminated: 2, free: 0, paid: 0 },
        sh: { pot: 1500, active: 5, total: 5, eliminated: 0 },
      },
    });

    expect(estimates.season_1.lms.pot).toBe(2400);
    expect(estimates.season_1.lms.alive).toBe(3);
    expect(estimates.season_1.lms.perEntry).toBeCloseTo(800, 5);
    expect(estimates.season_1.sh.pot).toBe(1500);
    expect(estimates.season_1.sh.alive).toBe(5);
    expect(estimates.season_1.sh.perEntry).toBeCloseTo(300, 5);
  });

  it('shows the per-entry estimate for a single alive entry', () => {
    const state = getEstimatedShareDisplay({
      pot: 1800,
      totalAliveEntries: 3,
      userAliveEntries: 1,
      currencyFormatter: money,
    });

    expect(state.kind).toBe('single_entry');
    expect(state.value).toBe('$600.00');
    expect(state.perEntryAmount).toBe(600);
  });

  it('shows the combined estimate for multiple alive entries', () => {
    const state = getEstimatedShareDisplay({
      pot: 1800,
      totalAliveEntries: 3,
      userAliveEntries: 2,
      currencyFormatter: money,
    });

    expect(state.kind).toBe('multi_entry');
    expect(state.display).toBe('Your 2 alive entries: $1,200.00 estimated');
    expect(state.combinedAmount).toBe(1200);
  });

  it('returns no-alive-entries state when the user has none', () => {
    const state = getEstimatedShareDisplay({
      pot: 1800,
      totalAliveEntries: 3,
      userAliveEntries: 0,
      currencyFormatter: money,
    });

    expect(state.kind).toBe('no_alive_entries');
    expect(state.display).toBe('No alive entries');
  });

  it('shows settlement pending when the pool has no alive entries', () => {
    const state = getEstimatedShareDisplay({
      pot: 1800,
      totalAliveEntries: 0,
      userAliveEntries: 0,
      currencyFormatter: money,
    });

    expect(state.kind).toBe('pending');
    expect(state.display).toBe('Settlement pending.');
  });

  it('returns unavailable when the pot or count is missing', () => {
    const state = getEstimatedShareDisplay({
      pot: null,
      totalAliveEntries: 3,
      userAliveEntries: 1,
      currencyFormatter: money,
    });

    expect(state.kind).toBe('unavailable');
    expect(state.display).toBe('Estimate unavailable.');
  });
});
