// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RegisterPage } from "./register.js";

const register = vi.hoisted(() => vi.fn());
vi.mock("../lib/auth-context.js", () => ({
  useAuth: () => ({ user: null, loading: false, register }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<div>Verify screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillCommon() {
  fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Acme" } });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Owner" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
}

describe("RegisterPage — confirm password", () => {
  it("blocks submit and shows an error when the two passwords differ", async () => {
    renderPage();
    fillCommon();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "supersecret" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different99" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("submits only the four core fields (no confirmPassword) when they match", async () => {
    register.mockResolvedValue({ needsVerification: true, email: "owner@example.com" });
    renderPage();
    fillCommon();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "supersecret" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "supersecret" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        orgName: "Acme",
        fullName: "Owner",
        email: "owner@example.com",
        password: "supersecret",
      }),
    );
    await waitFor(() => expect(screen.getByText("Verify screen")).toBeInTheDocument());
  });
});
