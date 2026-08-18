import { useParams } from "react-router-dom";
import type { VendorLinkDTO } from "@vendor-management/shared";
import { AppShell } from "../components/AppShell.js";
import { OnboardingForm } from "../components/OnboardingForm.js";
import { VendorTracker } from "../components/VendorTracker.js";
import { ContractsPanel } from "../components/ContractsPanel.js";
import { Card, Spinner } from "../components/ui.js";
import { getLink } from "../lib/vendor-api.js";
import { usePolling } from "../lib/use-polling.js";

const EDITABLE = new Set(["PREQUAL_IN_PROGRESS", "FULL_IN_PROGRESS"]);

const STAGE_HEADING: Record<string, string> = {
  PREQUAL_IN_PROGRESS: "Pre-qualification",
  FULL_IN_PROGRESS: "Full onboarding pack",
};

export function VendorLinkPage() {
  const { linkId = "" } = useParams();
  const { data: link, error, refresh } = usePolling<VendorLinkDTO>(() => getLink(linkId), {
    intervalMs: 5000,
  });

  return (
    <AppShell subtitle="Vendor portal">
      {!link ? (
        error ? (
          <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">{error}</Card>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{link.requirement.buyerOrgName}</p>
            <h1 className="text-2xl font-bold">{link.requirement.title}</h1>
          </div>

          <VendorTracker link={link} />

          {link.contracts.length > 0 && (
            <ContractsPanel contracts={link.contracts} side="VENDOR" onChanged={refresh} />
          )}

          {EDITABLE.has(link.state) && (
            <>
              <h2 className="text-sm font-medium text-muted-foreground">
                {STAGE_HEADING[link.state] ?? "Onboarding"}
              </h2>
              {/* key on state so the form resets cleanly when the stage changes */}
              <OnboardingForm key={link.state} link={link} reload={refresh} onSubmitted={() => void refresh()} />
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
