import { Navigate, Outlet } from "react-router-dom";
import type { UserType } from "@vendor-management/shared";
import { useAuth } from "../lib/auth-context.js";

// Landing route for each side of the app.
const HOME: Record<UserType, string> = { BUYER: "/", VENDOR: "/vendor" };

/**
 * Guards a group of routes. With no `require`, any signed-in user passes. With
 * `require`, a signed-in user of the wrong type is redirected to their own home
 * (a vendor never lands on a buyer screen, and vice versa); anyone signed out
 * goes to /login.
 */
export function ProtectedRoute({ require }: { require?: UserType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (require && user.userType !== require) {
    return <Navigate to={HOME[user.userType]} replace />;
  }

  return <Outlet />;
}
