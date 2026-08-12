import { useState } from "react";
import type { ApproverTask, LinkState } from "@vendor-management/shared";
import { AppShell } from "../components/AppShell.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { VendorDrawer } from "../components/VendorDrawer.js";
import { Card, Spinner, cn } from "../components/ui.js";
import { listMyTasks } from "../lib/approver-api.js";
import { usePolling } from "../lib/use-polling.js";

const TASK_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  APPROVED: "bg-emerald-50 text-emerald-700",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
};

export function ApprovalsPage() {
  const { data: tasks, loading, refresh } = usePolling<ApproverTask[]>(listMyTasks, { intervalMs: 5000 });
  const [openLink, setOpenLink] = useState<string | null>(null);

  return (
    <AppShell subtitle="Approver queue">
      <h1 className="text-2xl font-bold">My approvals</h1>
      <p className="mt-1 text-sm text-slate-500">Tasks assigned to your role. You only see and action your own.</p>

      {loading && !tasks ? (
        <div className="mt-8 flex items-center gap-3 text-slate-400">
          <Spinner /> Loading…
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-slate-500">No tasks assigned to you yet.</Card>
      ) : (
        <div className="mt-6 space-y-3">
          {tasks.map((t) => (
            <Card
              key={t.id}
              className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5 transition hover:border-indigo-300"
              onClick={() => setOpenLink(t.linkId)}
            >
              <div>
                <p className="font-medium">{t.vendorName}</p>
                <p className="text-xs text-slate-400">{t.requirementTitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge state={t.linkState as LinkState} />
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    TASK_STATUS_STYLE[t.status] ?? "bg-slate-100 text-slate-600",
                  )}
                >
                  {t.status.replace("_", " ").toLowerCase()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VendorDrawer
        linkId={openLink}
        open={openLink !== null}
        onClose={() => setOpenLink(null)}
        onChanged={refresh}
      />
    </AppShell>
  );
}
