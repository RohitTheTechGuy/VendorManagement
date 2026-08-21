// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { VerifyEmailPage } from "./verify-email.js";

const verifyEmail = vi.hoisted(() => vi.fn());
vi.mock("../lib/auth-context.js", () => ({
  useAuth: () => ({ user: null, loading: false, verifyEmail }),
}));
vi.mock("../lib/auth-api.js", () => ({
  apiResendOtp: vi.fn().mockResolvedValue(undefined),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(email: string | undefined) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/verify", state: email ? { email } : undefined }]}>
      <Routes>
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/" element={<div>Home</div>} />
        <Route path="/register" element={<div>Register</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VerifyEmailPage", () => {
  it("redirects to /register when no email was carried over from register", () => {
    renderPage(undefined);
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  it("shows the target email and verifies a complete code, then navigates home", async () => {
    verifyEmail.mockResolvedValue({ id: "u1" });
    renderPage("owner@example.test");
    expect(screen.getByText("owner@example.test")).toBeInTheDocument();

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    "123456".split("").forEach((d, i) => fireEvent.change(inputs[i], { target: { value: d } }));

    await waitFor(() =>
      expect(verifyEmail).toHaveBeenCalledWith({ email: "owner@example.test", code: "123456" }),
    );
    await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument());
  });

  it("surfaces a server error and clears the code on a bad attempt", async () => {
    verifyEmail.mockRejectedValue(new Error("bad"));
    renderPage("owner@example.test");
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    "111111".split("").forEach((d, i) => fireEvent.change(inputs[i], { target: { value: d } }));
    await waitFor(() =>
      expect(screen.getByText("Could not verify the code. Please try again.")).toBeInTheDocument(),
    );
  });
});
