import { useEffect, useState } from "react";
import type { DirectoryVendor } from "@vendor-management/shared";
import { AppShell } from "../components/AppShell.js";
import { Card, Spinner, cn } from "../components/ui.js";
import { getDirectory } from "../lib/candidates-api.js";

const BADGE: Record<DirectoryVendor["badgeState"], { label: string; className: string }> = {
  VERIFIED: { label: "Verified", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20" },
  LISTED: { label: "Listed", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20" },
  STALE: { label: "Stale", className: "bg-muted text-muted-foreground ring-border" },
};

export function DirectoryPage() {
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<DirectoryVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetch when the (debounced) search changes; ignore results from a stale
  // request so fast typing can't render an out-of-order response.
  useEffect(() => {
    let active = true;
    setError(null);
    const t = setTimeout(() => {
      getDirectory({ search: search.trim() || undefined })
        .then((v) => active && setVendors(v))
        .catch(() => active && setError("Couldn't load the directory."));
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search]);

  return (
    <AppShell subtitle="Directory">
      <h1 className="text-2xl font-bold">Directory</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Your verified vendor pool. Onboarded vendors are added automatically as{" "}
        <strong>Verified</strong>; vendors that cleared pre-qualification but weren't awarded are{" "}
        <strong>Listed</strong> as warm leads.
      </p>

      <div className="mt-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by legal name…"
          className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-ring"
        />
      </div>

      <Card className="mt-4 divide-y divide-border p-0">
        {vendors === null && !error && (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" /> Loading…
          </p>
        )}
        {error && <p className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        {vendors && vendors.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No vendors match.</p>
        )}
        {vendors?.map((v) => {
          const badge = BADGE[v.badgeState];
          const location = [v.city, v.state].filter(Boolean).join(", ");
          return (
            <div key={v.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{v.legalName}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {location || "—"}
                  {v.processTags.length > 0 && <> · {v.processTags.slice(0, 3).join(", ")}</>}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{v.contactEmail}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </AppShell>
  );
}
