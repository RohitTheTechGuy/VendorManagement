// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { APPROVER_ROLES } from "@vendor-management/shared";
import type { AccessRoles } from "../lib/route-access.js";
import { RequireRole } from "./RequireRole.js";

// Swap out the auth context so we can drive the current role directly.
const auth = vi.hoisted(() => ({ role: null as string | null }));
vi.mock("../lib/auth-context.js", () => ({ useAuth: () => ({ role: auth.role }) }));

afterEach(cleanup);

function renderAt(path: string, role: string | null, roles: AccessRoles) {
  auth.role = role;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/approvals"
          element={
            <RequireRole roles={roles}>
              <div>Approvals page</div>
            </RequireRole>
          }
        />
        <Route path="/" element={<div>Requirements home</div>} />
        <Route path="/activity" element={<div>Activity home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireRole", () => {
  it("renders the page when the role is allowed", () => {
    renderAt("/approvals", "QUALITY", APPROVER_ROLES);
    expect(screen.getByText("Approvals page")).toBeInTheDocument();
  });

  it("redirects a disallowed role to its persona home", () => {
    // OWNER opening an approver-only page is bounced to the requirements home.
    renderAt("/approvals", "OWNER", APPROVER_ROLES);
    expect(screen.queryByText("Approvals page")).toBeNull();
    expect(screen.getByText("Requirements home")).toBeInTheDocument();
  });

  it("sends an unknown role to the always-open Activity feed", () => {
    renderAt("/approvals", null, APPROVER_ROLES);
    expect(screen.getByText("Activity home")).toBeInTheDocument();
  });
});
