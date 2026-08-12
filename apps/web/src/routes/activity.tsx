import type { ActivityItem } from "@vendor-management/shared";
import { AppShell } from "../components/AppShell.js";
import { Card, Spinner, cn } from "../components/ui.js";
import { getActivity } from "../lib/activity-api.js";
import { usePolling } from "../lib/use-polling.js";

const SIDE_DOT: Record<ActivityItem["side"], string> = {
  vendor: "bg-amber-500",
  buyer: "bg-indigo-500",
  system: "bg-sky-500",
};

const CATEGORY_LABEL: Record<ActivityItem["category"], string> = {
  lifecycle: "Lifecycle",
  approval: "Approval",
  contract: "Contract",
  verification: "Verification",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ActivityPage() {
  const { data: items, loading } = usePolling<ActivityItem[]>(getActivity, { intervalMs: 5000 });

  return (
    <AppShell subtitle="Activity">
      <h1 className="text-2xl font-bold">Activity</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everything happening across your vendors — submissions, verifications, approvals, contracts and onboarding.
      </p>

      {loading && !items ? (
        <div className="mt-8 flex items-center gap-3 text-slate-400">
          <Spinner /> Loading…
        </div>
      ) : !items || items.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-slate-500">No activity yet.</Card>
      ) : (
        <Card className="mt-6 p-2">
          <ol className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SIDE_DOT[it.side])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{it.vendorName}</span>{" "}
                    <span className="text-slate-600">{it.description}</span>
                  </p>
                  <p className="text-xs text-slate-400">{it.requirementTitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {CATEGORY_LABEL[it.category]}
                  </span>
                  <p className="mt-1 text-xs text-slate-400">{relativeTime(it.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </AppShell>
  );
}
