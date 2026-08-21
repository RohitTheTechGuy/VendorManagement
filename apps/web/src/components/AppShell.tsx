import { useRef, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuth } from "../lib/auth-context.js";
import { BUYER_NAV, canAccess } from "../lib/route-access.js";
import { cn } from "./ui.js";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo.js";
import { ModeToggle } from "./ModeToggle.js";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "relative px-1 py-1 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
    "after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:bg-gradient-accent after:transition-opacity",
    isActive
      ? "text-foreground after:opacity-100"
      : "text-muted-foreground hover:text-foreground after:opacity-0",
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
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Page-enter transition: content fades/rises in on every navigation.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // clearProps removes the inline transform when the tween ends — a lingering
      // transform on <main> would become the containing block for fixed children.
      gsap.from(mainRef.current, {
        opacity: 0,
        y: 12,
        duration: 0.4,
        ease: "power2.out",
        clearProps: "transform",
      });
    },
    { scope: mainRef, dependencies: [location.pathname] },
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Logo subtitle={subtitle} />
            {user?.userType === "BUYER" && (
              <nav className="ml-4 flex items-center gap-1">
                {/* Nav mirrors route access — a link shows only if the role can
                    open the page (BUYER_NAV / RequireRole share one source). */}
                {BUYER_NAV.filter((r) => canAccess(user.role, r.roles)).map((r) => (
                  <NavLink key={r.path} to={r.path} end={r.nav.end} className={navClass}>
                    {r.nav.label}
                  </NavLink>
                ))}
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
      <main ref={mainRef} className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
