import type { RequirementStage } from "@vendor-management/shared";

interface StageStyle {
  label: string;
  badge: string; // pill classes (bg + text + ring)
  dot: string; // status dot colour
}

export const STAGE_STYLE: Record<RequirementStage, StageStyle> = {
  DRAFT: { label: "Draft", badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  CANDIDATES_SELECTED: { label: "Candidates selected", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  INVITES_SENT: { label: "Invites sent", badge: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  IN_PROGRESS: { label: "In progress", badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  CLOSED: { label: "Closed", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
};

export const STAGE_ORDER: RequirementStage[] = [
  "DRAFT",
  "CANDIDATES_SELECTED",
  "INVITES_SENT",
  "IN_PROGRESS",
  "CLOSED",
];
