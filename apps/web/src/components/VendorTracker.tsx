import {
  LINK_PROGRESS_RAIL,
  LINK_STATE_META,
  type LinkState,
  type VendorLinkDTO,
} from "@vendor-management/shared";
import { Card, cn } from "./ui.js";
import { StatusBadge } from "./StatusBadge.js";

// How far along the rail each state sits (index into LINK_PROGRESS_RAIL).
// Terminals map to -1 and are shown as a banner instead.
const RAIL_INDEX: Record<LinkState, number> = {
  INVITED: 0,
  PREQUAL_IN_PROGRESS: 1,
  PREQUAL_SUBMITTED: 2,
  PREQUAL_UNDER_REVIEW: 2,
  PREQUAL_CLEARED: 3,
  AWARDED: 4,
  FULL_IN_PROGRESS: 4,
  FULL_SUBMITTED: 5,
  FULL_UNDER_REVIEW: 5,
  CONTRACTS_IN_PROGRESS: 6,
  APPROVED: 7,
  ERP_SYNCING: 7,
  ONBOARDED: 8,
  REJECTED: -1,
  ON_HOLD: -1,
  WITHDRAWN: -1,
  ERP_FAILED: -1,
  EXPIRED: -1,
};

function Rail({ state }: { state: LinkState }) {
  const active = RAIL_INDEX[state];
  return (
    <ol className="flex items-center gap-1 overflow-x-auto">
      {LINK_PROGRESS_RAIL.map((milestone, i) => {
        const done = active >= 0 && i < active;
        const current = active >= 0 && i === active;
        return (
          <li key={milestone} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : done || current ? "bg-indigo-500" : "bg-slate-200")} />
              <span
                className={cn(
                  "h-3 w-3 shrink-0 rounded-full",
                  done ? "bg-indigo-500" : current ? "bg-indigo-500 ring-4 ring-indigo-100" : "bg-slate-300",
                )}
              />
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === LINK_PROGRESS_RAIL.length - 1 ? "opacity-0" : done ? "bg-indigo-500" : "bg-slate-200",
                )}
              />
            </div>
            <span className={cn("truncate text-[10px]", current ? "font-semibold text-indigo-600" : "text-slate-400")}>
              {LINK_STATE_META[milestone].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function VendorTracker({ link }: { link: VendorLinkDTO }) {
  const court = LINK_STATE_META[link.state].court;
  const courtLabel =
    court === "vendor" ? "It's your turn" : court === "buyer" ? `With ${link.requirement.buyerOrgName}` : court === "system" ? "Processing" : "Complete";

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge state={link.state} />
        <span className="text-sm font-medium text-slate-500">{courtLabel}</span>
      </div>

      {RAIL_INDEX[link.state] >= 0 ? (
        <Rail state={link.state} />
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          This application is {LINK_STATE_META[link.state].label.toLowerCase()}.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-700">Pending on you</p>
          <p className="text-xl font-semibold text-amber-800">{link.tat.vendorPendingDays} days</p>
        </div>
        <div className="rounded-lg bg-indigo-50 px-4 py-3">
          <p className="text-xs text-indigo-700">Pending on buyer</p>
          <p className="text-xl font-semibold text-indigo-800">{link.tat.buyerPendingDays} days</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">Buyer contact</p>
          <p className="text-sm font-medium text-slate-700">{link.buyerContact?.name ?? "—"}</p>
          <p className="truncate text-xs text-slate-400">{link.buyerContact?.email}</p>
        </div>
      </div>

      {link.erpVendorCode && (
        <p className="text-sm">
          Vendor code: <span className="font-mono font-semibold">{link.erpVendorCode}</span>
        </p>
      )}
    </Card>
  );
}
