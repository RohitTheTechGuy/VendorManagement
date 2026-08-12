import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
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

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/invite/:token", element: <InviteRedeemPage /> },
  {
    // Buyer shell — a vendor who lands here is bounced to the vendor portal.
    element: <ProtectedRoute require="BUYER" />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/directory", element: <DirectoryPage /> },
      { path: "/approvals", element: <ApprovalsPage /> },
      { path: "/activity", element: <ActivityPage /> },
      { path: "/team", element: <TeamPage /> },
      { path: "/requirements/new", element: <NewRequirement /> },
      { path: "/requirements/:id", element: <RequirementDetailPage /> },
    ],
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
