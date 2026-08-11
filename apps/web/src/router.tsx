import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./routes/login.js";
import { RegisterPage } from "./routes/register.js";
import { Dashboard } from "./routes/dashboard.js";
import { NewRequirement } from "./routes/new-requirement.js";
import { RequirementDetailPage } from "./routes/requirement-detail.js";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/requirements/new", element: <NewRequirement /> },
      { path: "/requirements/:id", element: <RequirementDetailPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
