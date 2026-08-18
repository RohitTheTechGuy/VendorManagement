import { LINK_STATE_META, type Court, type LinkState } from "@vendor-management/shared";
import { cn } from "./ui.js";

// Distinct hues per court, rendered dark-aware (translucent fill + lighter
// dark: text) so the badge stays legible on both light and dark surfaces.
const COURT_STYLE: Record<Court, string> = {
  vendor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20",
  buyer: "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20",
  system: "bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/20",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
};

// Terminal-ish negative states read better in red.
const NEGATIVE: LinkState[] = ["REJECTED", "WITHDRAWN", "ERP_FAILED", "EXPIRED"];

export function StatusBadge({ state }: { state: LinkState }) {
  const meta = LINK_STATE_META[state];
  const style = NEGATIVE.includes(state)
    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20"
    : COURT_STYLE[meta.court];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ring-1 ring-inset",
        style,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}
