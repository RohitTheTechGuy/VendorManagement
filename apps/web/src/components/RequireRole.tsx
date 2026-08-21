import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth-context.js";
import { canAccess, buyerHome, type AccessRoles } from "../lib/route-access.js";

/**
 * Role gate for a single buyer page. A signed-in buyer whose role isn't allowed
 * for this route is redirected to their persona home (see buyerHome). This
 * renders inside <ProtectedRoute require="BUYER" />, which has already handled
 * the loading state, sign-in, and BUYER-vs-VENDOR user type — so here we only
 * decide the role.
 */
export function RequireRole({ roles, children }: { roles: AccessRoles; children: ReactNode }) {
  const { role } = useAuth();
  if (!canAccess(role, roles)) return <Navigate to={buyerHome(role)} replace />;
  return <>{children}</>;
}
