import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth-context.js";
import { Button, cn } from "./ui.js";

const APPROVER_ROLES = ["QUALITY", "FINANCE", "TAX", "LEGAL"];

export function AppShell({
  children,
  subtitle = "Buyer console",
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              V
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Vendor Management</p>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
            {user?.userType === "BUYER" && (
              <nav className="ml-4 flex items-center gap-1 text-sm">
                {user.role === "OWNER" && (
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      cn("rounded-md px-2.5 py-1 font-medium", isActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700")
                    }
                  >
                    Requirements
                  </NavLink>
                )}
                {APPROVER_ROLES.includes(user.role ?? "") && (
                  <NavLink
                    to="/approvals"
                    className={({ isActive }) =>
                      cn("rounded-md px-2.5 py-1 font-medium", isActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700")
                    }
                  >
                    Approvals
                  </NavLink>
                )}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {user?.email}
              {user?.role ? ` · ${user.role}` : ""}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
