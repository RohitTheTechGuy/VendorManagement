import { APPROVER_ROLES, type BuyerRole } from "@vendor-management/shared";

// Which buyer roles may see a route: an explicit list, or every buyer.
export type AccessRoles = readonly BuyerRole[] | "ALL_BUYERS";

export type BuyerRouteDef = {
  path: string;
  roles: AccessRoles;
  // Present when the route appears in the buyer top nav (rendered in this order).
  nav?: { label: string; end?: boolean };
};

/**
 * The single source of truth for buyer-side page access.
 *
 * Both the router (route guards, via RequireRole) and the AppShell (nav links)
 * read this list, so a page can't be gated in one place and left open in the
 * other — which is exactly how /approvals and /directory were reachable by the
 * wrong role before. Add a new buyer page here with its owning role(s), give it
 * a component in router.tsx, and both the guard and the nav follow.
 */
export const BUYER_ROUTES: readonly BuyerRouteDef[] = [
  { path: "/", roles: ["OWNER"], nav: { label: "Requirements", end: true } },
  { path: "/directory", roles: ["OWNER"], nav: { label: "Directory" } },
  { path: "/team", roles: ["OWNER"], nav: { label: "Team" } },
  { path: "/requirements/new", roles: ["OWNER"] },
  { path: "/requirements/:id", roles: ["OWNER"] },
  { path: "/approvals", roles: APPROVER_ROLES, nav: { label: "Approvals" } },
  { path: "/activity", roles: "ALL_BUYERS", nav: { label: "Activity" } },
];

// Nav links, in declaration order, for the routes that surface in the top nav.
export const BUYER_NAV = BUYER_ROUTES.filter(
  (r): r is BuyerRouteDef & { nav: NonNullable<BuyerRouteDef["nav"]> } => r.nav != null,
);

/** True when `role` is allowed to see a route with the given access rule. */
export function canAccess(role: string | null | undefined, roles: AccessRoles): boolean {
  if (roles === "ALL_BUYERS") return true;
  return role != null && (roles as readonly string[]).includes(role);
}

const APPROVER_SET = new Set<string>(APPROVER_ROLES);

/**
 * The page a buyer should land on — their persona home. Used to redirect a
 * buyer who reaches a page outside their role. An unknown role falls back to
 * the always-accessible Activity feed, which also prevents a redirect loop.
 */
export function buyerHome(role: string | null | undefined): string {
  if (role === "OWNER") return "/";
  if (role != null && APPROVER_SET.has(role)) return "/approvals";
  return "/activity";
}
