import { Router } from "express";
import { createTeamMemberSchema, type CreateTeamMemberInput, type TeamMember } from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { requireBuyer, requireRole, buyerOrgId } from "../middleware/authz.js";
import { validateBody } from "../middleware/validate.js";
import { hashPassword } from "../lib/auth.js";

// Team management is owner-only. Every route is scoped to the owner's org.
export const teamRouter = Router();
teamRouter.use(requireAuth, requireBuyer, requireRole("OWNER"));

function toMember(u: { id: string; email: string; fullName: string | null; role: string | null }, selfId: string): TeamMember {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: (u.role ?? "OWNER") as TeamMember["role"],
    isSelf: u.id === selfId,
  };
}

teamRouter.get("/", async (req, res, next) => {
  try {
    const members = await prisma.appUser.findMany({
      where: { orgId: buyerOrgId(req), userType: "BUYER" },
      select: { id: true, email: true, fullName: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ members: members.map((m) => toMember(m, req.user!.userId)) });
  } catch (error) {
    next(error);
  }
});

teamRouter.post("/", validateBody(createTeamMemberSchema), async (req, res, next) => {
  try {
    const { email, fullName, role, password } = req.body as CreateTeamMemberInput;

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const created = await prisma.appUser.create({
      data: {
        email,
        fullName,
        role,
        userType: "BUYER",
        orgId: buyerOrgId(req),
        passwordHash: await hashPassword(password),
      },
      select: { id: true, email: true, fullName: true, role: true },
    });
    res.status(201).json({ member: toMember(created, req.user!.userId) });
  } catch (error) {
    next(error);
  }
});

teamRouter.delete("/:id", async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (id === req.user!.userId) {
      res.status(409).json({ error: "You can't remove yourself." });
      return;
    }
    // Only within the owner's own org. FK relations (assigned tasks, decisions)
    // are ON DELETE SET NULL, so removing a teammate is safe.
    const result = await prisma.appUser.deleteMany({
      where: { id, orgId: buyerOrgId(req), userType: "BUYER" },
    });
    if (result.count === 0) {
      res.status(404).json({ error: "Team member not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
