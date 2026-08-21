import { createBrowserRouter, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { RequireRole } from "./components/RequireRole.js";
import { BUYER_ROUTES } from "./lib/route-access.js";
import { LoginPage } from "./routes/login.js";
import { RegisterPage } from "./routes/register.js";
import { Dashboard } from "./routes/dashboard.js";
import { NewRequirement } from "./routes/new-requirement.js";
import { RequirementDetailPage } from "./routes/requirement-detail.js";
import { DirectoryPage } from "./routes/directory.js";
import { VendorHome } from "./routes/vendor-home.js";
import { VendorLinkPage } from "./routes/vendor-link.js";
import { InviteRedeemPage } from "./routes/invite-redeem.js";
import { ApprovalsPage } from "./routes/approvals.js";
import { TeamPage } from "./routes/team.js";
import { ActivityPage } from "./routes/activity.js";

// The component behind each buyer path. Access (which role sees each path) lives
// in BUYER_ROUTES — the single source of truth; this map is only the wiring.
const BUYER_PAGES: Record<string, ReactNode> = {
  "/": <Dashboard />,
  "/directory": <DirectoryPage />,
  "/team": <TeamPage />,
  "/requirements/new": <NewRequirement />,
  "/requirements/:id": <RequirementDetailPage />,
  "/approvals": <ApprovalsPage />,
  "/activity": <ActivityPage />,
};

// Build the guarded buyer routes from the manifest. Missing a component for a
// declared route fails loudly here rather than rendering a blank page.
const buyerChildren = BUYER_ROUTES.map((r) => {
  const element = BUYER_PAGES[r.path];
  if (!element) throw new Error(`No component wired for buyer route ${r.path}`);
  return { path: r.path, element: <RequireRole roles={r.roles}>{element}</RequireRole> };
});

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/invite/:token", element: <InviteRedeemPage /> },
  {
    // Buyer shell — a vendor who lands here is bounced to the vendor portal.
    // Each child is additionally role-gated by RequireRole (see BUYER_ROUTES).
    element: <ProtectedRoute require="BUYER" />,
    children: buyerChildren,
  },
  {
    // Vendor shell — a buyer who lands here is bounced to the buyer console.
    element: <ProtectedRoute require="VENDOR" />,
    children: [
      { path: "/vendor", element: <VendorHome /> },
      { path: "/vendor/:linkId", element: <VendorLinkPage /> },
    ],
  },
  // Unknown paths go to "/"; the buyer guard then re-routes vendors onward.
  { path: "*", element: <Navigate to="/" replace /> },
]);
