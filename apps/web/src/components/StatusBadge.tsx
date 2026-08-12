import { LINK_STATE_META, type Court, type LinkState } from "@vendor-management/shared";
import { cn } from "./ui.js";

const COURT_STYLE: Record<Court, string> = {
  vendor: "bg-amber-50 text-amber-700 ring-amber-200",
  buyer: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  system: "bg-sky-50 text-sky-700 ring-sky-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

// Terminal-ish negative states read better in red.
const NEGATIVE: LinkState[] = ["REJECTED", "WITHDRAWN", "ERP_FAILED", "EXPIRED"];

export function StatusBadge({ state }: { state: LinkState }) {
  const meta = LINK_STATE_META[state];
  const style = NEGATIVE.includes(state) ? "bg-rose-50 text-rose-700 ring-rose-200" : COURT_STYLE[meta.court];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        style,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}
