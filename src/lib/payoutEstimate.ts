export type PoolEstimateInput = {
  pot: number | null | undefined;
  totalAliveEntries: number | null | undefined;
  userAliveEntries: number | null | undefined;
  confirmedAllocation?: number | null | undefined;
};

export function calculatePerEntryEstimate(
  pot: number | null | undefined,
  totalAliveEntries: number | null | undefined,
): number | null {
  if (
    pot == null ||
    totalAliveEntries == null ||
    !Number.isFinite(pot) ||
    !Number.isFinite(totalAliveEntries) ||
    totalAliveEntries <= 0
  ) {
    return null;
  }

  return pot / totalAliveEntries;
}

export function buildPoolEstimateBySeason(
  poolStatsBySeason: Record<string, any>,
): Record<string, { lms: { pot: number | null; alive: number; perEntry: number | null }; sh: { pot: number | null; alive: number; perEntry: number | null } }> {
  const estimates: Record<string, { lms: { pot: number | null; alive: number; perEntry: number | null }; sh: { pot: number | null; alive: number; perEntry: number | null } }> = {};

  for (const [seasonId, stats] of Object.entries(poolStatsBySeason ?? {})) {
    const lmsPot = typeof stats?.lms?.pot === 'number' ? stats.lms.pot : null;
    const shPot = typeof stats?.sh?.pot === 'number' ? stats.sh.pot : null;
    const lmsAlive = Number.isFinite(stats?.lms?.active) ? Number(stats.lms.active) : 0;
    const shAlive = Number.isFinite(stats?.sh?.active) ? Number(stats.sh.active) : 0;

    estimates[seasonId] = {
      lms: {
        pot: lmsPot,
        alive: lmsAlive,
        perEntry: calculatePerEntryEstimate(lmsPot, lmsAlive),
      },
      sh: {
        pot: shPot,
        alive: shAlive,
        perEntry: calculatePerEntryEstimate(shPot, shAlive),
      },
    };
  }

  return estimates;
}

export function getEstimatedShareDisplay(params: PoolEstimateInput & { currencyFormatter?: (amount: number) => string }) {
  const {
    pot,
    totalAliveEntries,
    userAliveEntries,
    confirmedAllocation,
    currencyFormatter = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  } = params;

  if (pot == null || totalAliveEntries == null || !Number.isFinite(pot) || !Number.isFinite(totalAliveEntries)) {
    return {
      kind: 'unavailable',
      display: 'Estimate unavailable.',
      perEntryAmount: null,
      combinedAmount: null,
      userAliveEntries: userAliveEntries ?? 0,
      totalAliveEntries,
    };
  }

  if (totalAliveEntries <= 0) {
    return {
      kind: 'pending',
      display: confirmedAllocation != null ? currencyFormatter(Number(confirmedAllocation)) : 'Settlement pending.',
      perEntryAmount: null,
      combinedAmount: null,
      userAliveEntries: userAliveEntries ?? 0,
      totalAliveEntries,
    };
  }

  const perEntryAmount = pot / totalAliveEntries;

  if ((userAliveEntries ?? 0) <= 0) {
    return {
      kind: 'no_alive_entries',
      display: 'No alive entries',
      perEntryAmount: null,
      combinedAmount: null,
      userAliveEntries: 0,
      totalAliveEntries,
    };
  }

  const safeUserAliveEntries = userAliveEntries ?? 0;
  const combinedAmount = perEntryAmount * safeUserAliveEntries;

  if (safeUserAliveEntries === 1) {
    return {
      kind: 'single_entry',
      display: 'Estimated equal-split share',
      value: currencyFormatter(perEntryAmount),
      perEntryAmount,
      combinedAmount,
      userAliveEntries,
      totalAliveEntries,
    };
  }

  return {
    kind: 'multi_entry',
    display: `Your ${userAliveEntries} alive entries: ${currencyFormatter(combinedAmount)} estimated`,
    value: currencyFormatter(combinedAmount),
    perEntryAmount,
    combinedAmount,
    userAliveEntries,
    totalAliveEntries,
  };
}
