import type { DirectoryVendor } from "@vendor-management/shared";

export interface MatchedVendor {
  vendor: DirectoryVendor;
  /** The requirement processes this vendor's tags cover — for display + ranking. */
  sharedProcesses: string[];
}

// Directory freshness, best first.
const BADGE_RANK: Record<string, number> = { VERIFIED: 0, LISTED: 1, STALE: 2 };

/**
 * Rank directory vendors against a requirement's process needs (and optional
 * plant location), entirely client-side. A vendor matches when it shares at
 * least one process tag with the requirement. Ranking, best first:
 *   1. more shared processes
 *   2. location match (vendor city/state appears in the plant-location text)
 *   3. directory badge (VERIFIED > LISTED > STALE)
 *   4. name (A→Z)
 * Returns [] when no processes are chosen yet.
 */
export function matchVendors(
  vendors: DirectoryVendor[],
  criteria: { processCategories: string[]; location?: string },
): MatchedVendor[] {
  const wanted = new Set(criteria.processCategories);
  if (wanted.size === 0) return [];

  const loc = criteria.location?.trim().toLowerCase() ?? "";
  const locationHit = (v: DirectoryVendor) =>
    loc.length > 0 && [v.city, v.state].some((x) => x != null && loc.includes(x.toLowerCase()));

  return vendors
    .map((vendor) => ({ vendor, sharedProcesses: vendor.processTags.filter((t) => wanted.has(t)) }))
    .filter((m) => m.sharedProcesses.length > 0)
    .sort((a, b) => {
      if (b.sharedProcesses.length !== a.sharedProcesses.length) {
        return b.sharedProcesses.length - a.sharedProcesses.length;
      }
      const locDelta = Number(locationHit(b.vendor)) - Number(locationHit(a.vendor));
      if (locDelta !== 0) return locDelta;
      const badgeDelta = (BADGE_RANK[a.vendor.badgeState] ?? 3) - (BADGE_RANK[b.vendor.badgeState] ?? 3);
      if (badgeDelta !== 0) return badgeDelta;
      return a.vendor.legalName.localeCompare(b.vendor.legalName);
    });
}
