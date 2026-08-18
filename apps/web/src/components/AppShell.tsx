import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth-context.js";
import { cn } from "./ui.js";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo.js";
import { ModeToggle } from "./ModeToggle.js";

const APPROVER_ROLES = ["QUALITY", "FINANCE", "TAX", "LEGAL"];

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

export function AppShell({
  children,
  subtitle = "Buyer console",
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Logo subtitle={subtitle} />
            {user?.userType === "BUYER" && (
              <nav className="ml-4 flex items-center gap-1">
                {user.role === "OWNER" && (
                  <>
                    <NavLink to="/" end className={navClass}>
                      Requirements
                    </NavLink>
                    <NavLink to="/directory" className={navClass}>
                      Directory
                    </NavLink>
                    <NavLink to="/team" className={navClass}>
                      Team
                    </NavLink>
                  </>
                )}
                {APPROVER_ROLES.includes(user.role ?? "") && (
                  <NavLink to="/approvals" className={navClass}>
                    Approvals
                  </NavLink>
                )}
                {/* Every buyer can see the org activity feed. */}
                <NavLink to="/activity" className={navClass}>
                  Activity
                </NavLink>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {user?.email}
              {user?.role ? ` · ${user.role}` : ""}
            </span>
            <ModeToggle />
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
