import { LINK_STATE_META, type LinkState, type Tat } from "@vendor-management/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dual turnaround time: how long the link has spent waiting on the vendor vs on
 * the buyer, derived purely from the append-only event timeline. Each segment
 * between two timeline points is attributed to whichever side's court the state
 * in that segment belongs to (system/done time counts for neither).
 *
 * `points` must be sorted ascending; each point is the state STARTING at `at`.
 */
export function computeDualTat(points: { at: Date; state: LinkState }[], now: Date = new Date()): Tat {
  let vendorMs = 0;
  let buyerMs = 0;
  for (let i = 0; i < points.length; i++) {
    const start = points[i].at.getTime();
    const end = i + 1 < points.length ? points[i + 1].at.getTime() : now.getTime();
    const duration = Math.max(0, end - start);
    const court = LINK_STATE_META[points[i].state].court;
    if (court === "vendor") vendorMs += duration;
    else if (court === "buyer") buyerMs += duration;
  }
  return {
    vendorPendingDays: Math.round((vendorMs / DAY_MS) * 100) / 100,
    buyerPendingDays: Math.round((buyerMs / DAY_MS) * 100) / 100,
  };
}
