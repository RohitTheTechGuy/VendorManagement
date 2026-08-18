import { Link } from "react-router-dom";
import type { RequirementSummary } from "@vendor-management/shared";
import { formatDate } from "../lib/format.js";
import { Chip, StageBadge } from "./ui.js";

export function RequirementCard({ requirement, index }: { requirement: RequirementSummary; index: number }) {
  const { id, title, partCategory, processCategories, plantLocation, targetAwardDate, stage, candidateCount } =
    requirement;

  return (
    <Link
      to={`/requirements/${id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="group relative flex animate-reveal flex-col overflow-hidden rounded-[14px] border border-border bg-card p-5 shadow-sm transition-all duration-200 before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-accent before:opacity-0 before:transition-opacity hover:border-primary/50 hover:shadow-md hover:before:opacity-100 motion-safe:hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <StageBadge stage={stage} />
        {partCategory && <span className="text-xs font-medium text-muted-foreground">{partCategory}</span>}
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug text-foreground group-hover:text-primary">
        {title}
      </h3>

      {processCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {processCategories.slice(0, 4).map((p) => (
            <Chip key={p}>{p}</Chip>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1" />

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <UsersIcon />
          {candidateCount} {candidateCount === 1 ? "candidate" : "candidates"}
        </span>
        <span className="text-muted-foreground">
          {targetAwardDate ? `Award by ${formatDate(targetAwardDate)}` : plantLocation ?? ""}
        </span>
      </div>
    </Link>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 15.5A5.5 5.5 0 017 10a5.5 5.5 0 015.5 5.5.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5zM14 11c-.6 0-1.16.13-1.67.36A6.98 6.98 0 0113.9 16H18a.5.5 0 00.5-.5A4.5 4.5 0 0014 11z" />
    </svg>
  );
}
