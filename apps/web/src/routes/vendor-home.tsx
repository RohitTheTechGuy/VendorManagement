import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { VendorLinkSummary } from "@vendor-management/shared";
import { AppShell } from "../components/AppShell.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Card, Spinner } from "../components/ui.js";
import { listMyLinks } from "../lib/vendor-api.js";

/**
 * Vendor landing. A vendor engages one requirement at a time in this build, so
 * we send them straight to their active link; if there are several we list them.
 */
export function VendorHome() {
  const [links, setLinks] = useState<VendorLinkSummary[] | null>(null);

  useEffect(() => {
    void listMyLinks().then(setLinks).catch(() => setLinks([]));
  }, []);

  if (links === null) {
    return (
      <AppShell subtitle="Vendor portal">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner /> Loading…
        </div>
      </AppShell>
    );
  }

  if (links.length === 1) {
    return <Navigate to={`/vendor/${links[0].id}`} replace />;
  }

  return (
    <AppShell subtitle="Vendor portal">
      <h1 className="text-2xl font-bold">Your onboarding</h1>
      {links.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          You have no active onboarding. Open the magic link in your invitation email to get started.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {links.map((l) => (
            <Link key={l.id} to={`/vendor/${l.id}`} className="block">
              <Card className="flex items-center justify-between p-5 transition hover:border-primary/50">
                <span className="font-medium">{l.requirementTitle}</span>
                <StatusBadge state={l.state} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
