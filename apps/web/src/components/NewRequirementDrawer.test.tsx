// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { DirectoryVendor } from "@vendor-management/shared";
import { NewRequirementDrawer } from "./NewRequirementDrawer.js";

// Modal reads prefers-reduced-motion; jsdom has no matchMedia. Returning
// matches:true makes Modal skip its GSAP entrance in tests.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: true,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const createRequirement = vi.hoisted(() => vi.fn());
const getDirectory = vi.hoisted(() => vi.fn());
const addCandidates = vi.hoisted(() => vi.fn());

vi.mock("../lib/requirements-api.js", () => ({ createRequirement }));
vi.mock("../lib/candidates-api.js", () => ({ getDirectory, addCandidates }));
vi.mock("../lib/auth-api.js", () => ({ errorMessage: (_e: unknown, fallback: string) => fallback }));

function vendor(over: Partial<DirectoryVendor>): DirectoryVendor {
  return {
    id: "v1",
    legalName: "Acme",
    pan: null,
    primaryGstin: null,
    contactEmail: "a@b.com",
    city: "Pune",
    state: "MH",
    processTags: ["CNC Turning"],
    certificationTags: [],
    badgeState: "VERIFIED",
    ...over,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NewRequirementDrawer — in-flow shortlisting", () => {
  it("matches directory vendors by process and adds the selected ones on create", async () => {
    getDirectory.mockResolvedValue([vendor({ id: "v1", legalName: "Acme", processTags: ["CNC Turning"] })]);
    createRequirement.mockResolvedValue({ id: "req-1" });
    addCandidates.mockResolvedValue({});
    const onCreated = vi.fn();

    render(<NewRequirementDrawer open onClose={() => {}} onCreated={onCreated} />);

    // No process picked yet → no vendor list.
    expect(screen.getByText(/Pick a process to see matching vendors/i)).toBeInTheDocument();

    // Pick the process → Acme (shares CNC Turning) appears.
    fireEvent.click(screen.getByRole("button", { name: "CNC Turning" }));
    expect(await screen.findByText("Acme")).toBeInTheDocument();

    // Select Acme, fill the title, create.
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText(/Forged steering knuckles/i), { target: { value: "Knuckles" } });
    fireEvent.click(screen.getByRole("button", { name: /Create with 1 vendor/i }));

    await waitFor(() => expect(createRequirement).toHaveBeenCalled());
    await waitFor(() =>
      expect(addCandidates).toHaveBeenCalledWith("req-1", [{ source: "directory", directoryVendorId: "v1" }]),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "req-1" }));
  });

  it("shows an empty state when no directory vendor matches the chosen process", async () => {
    getDirectory.mockResolvedValue([vendor({ processTags: ["Plating"] })]);
    render(<NewRequirementDrawer open onClose={() => {}} onCreated={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "CNC Turning" }));
    expect(await screen.findByText(/No matching vendors in your directory/i)).toBeInTheDocument();
    expect(addCandidates).not.toHaveBeenCalled();
  });
});
