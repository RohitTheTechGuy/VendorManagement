import type { RequirementStage } from "@vendor-management/shared";

interface StageStyle {
  label: string;
  badge: string; // pill classes (bg + text + ring)
  dot: string; // status dot colour
}

// Distinct hues per stage (at-a-glance identification) rendered dark-aware:
// a translucent 500/10 fill sits on any surface, and the text gets a lighter
// dark: shade. DRAFT uses neutral tokens since it isn't a real status color.
export const STAGE_STYLE: Record<RequirementStage, StageStyle> = {
  DRAFT: { label: "Draft", badge: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground" },
  CANDIDATES_SELECTED: { label: "Candidates selected", badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20", dot: "bg-sky-500" },
  INVITES_SENT: { label: "Invites sent", badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20", dot: "bg-violet-500" },
  IN_PROGRESS: { label: "In progress", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20", dot: "bg-amber-500" },
  CLOSED: { label: "Closed", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20", dot: "bg-emerald-500" },
};

export const STAGE_ORDER: RequirementStage[] = [
  "DRAFT",
  "CANDIDATES_SELECTED",
  "INVITES_SENT",
  "IN_PROGRESS",
  "CLOSED",
];
