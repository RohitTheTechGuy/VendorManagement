import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { RequirementStage, RequirementSummary } from "@vendor-management/shared";
import { getRequirements } from "../lib/requirements-api.js";
import { errorMessage } from "../lib/auth-api.js";
import { STAGE_ORDER, STAGE_STYLE } from "../lib/stage.js";
import { AppShell } from "../components/AppShell.js";
import { Button, Card, Spinner, cn } from "../components/ui.js";
import { RequirementCard } from "../components/RequirementCard.js";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; requirements: RequirementSummary[] };

export function Dashboard() {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [filter, setFilter] = useState<RequirementStage | "ALL">("ALL");

  function load() {
    setState({ kind: "loading" });
    getRequirements()
      .then((requirements) => setState({ kind: "ready", requirements }))
      .catch((error) => setState({ kind: "error", message: errorMessage(error, "Could not load requirements.") }));
  }

  useEffect(load, []);

  // Role gating (OWNER-only) is enforced by RequireRole in the router.
  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Requirements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a requirement, shortlist vendors, and dispatch invites.
          </p>
        </div>
        <Link to="/requirements/new">
          <Button>
            <PlusIcon />
            New requirement
          </Button>
        </Link>
      </div>

      {state.kind === "loading" && (
        <div className="mt-16 grid place-items-center text-muted-foreground">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {state.kind === "error" && (
        <Card className="mt-8 p-8 text-center">
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {state.kind === "ready" && <ReadyView requirements={state.requirements} filter={filter} setFilter={setFilter} />}
    </AppShell>
  );
}

function ReadyView({
  requirements,
  filter,
  setFilter,
}: {
  requirements: RequirementSummary[];
  filter: RequirementStage | "ALL";
  setFilter: (f: RequirementStage | "ALL") => void;
}) {
  const counts = useMemo(() => {
    const map = new Map<RequirementStage, number>();
    for (const r of requirements) map.set(r.stage, (map.get(r.stage) ?? 0) + 1);
    return map;
  }, [requirements]);

  const visible = filter === "ALL" ? requirements : requirements.filter((r) => r.stage === filter);

  if (requirements.length === 0) {
    return (
      <Card className="mt-8 grid place-items-center gap-3 p-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <PlusIcon />
        </div>
        <p className="text-base font-semibold">No requirements yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first requirement to start shortlisting and inviting vendors.
        </p>
        <Link to="/requirements/new" className="mt-1">
          <Button>New requirement</Button>
        </Link>
      </Card>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" count={requirements.length} />
        {STAGE_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={STAGE_STYLE[s].label}
            count={counts.get(s) ?? 0}
            dot={STAGE_STYLE[s].dot}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r, i) => (
          <RequirementCard key={r.id} requirement={r} index={i} />
        ))}
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white/80" : dot)} />}
      {label}
      <span className={cn("text-xs", active ? "text-white/80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
    </svg>
  );
}
