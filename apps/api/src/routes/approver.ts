import { Router } from "express";
import { decideTaskSchema, type DecideTaskInput } from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { requireAuth } from "../middleware/require-auth.js";
import { requireBuyer } from "../middleware/authz.js";
import { validateBody } from "../middleware/validate.js";
import { transition } from "../lib/link-state.js";
import { checkJoinGate } from "../lib/join-gate.js";
import { loadBuyerLinkDetail } from "../lib/buyer-link-dto.js";

export const approverRouter = Router();
approverRouter.use(requireAuth, requireBuyer);

// An approver's own queue — only the tasks assigned to this user. Never another
// role's tasks.
approverRouter.get("/tasks", async (req, res, next) => {
  try {
    const tasks = await prisma.reviewTask.findMany({
      where: { assignedUserId: req.user!.userId },
      include: {
        link: {
          select: {
            state: true,
            requirement: { select: { title: true } },
            candidate: { select: { legalName: true } },
          },
        },
        decisions: { orderBy: { decidedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      tasks.map((t) => ({
        id: t.id,
        linkId: t.linkId,
        role: t.role,
        status: t.status,
        requirementTitle: t.link.requirement.title,
        vendorName: t.link.candidate.legalName,
        linkState: t.link.state,
        lastComment: t.decisions[0]?.comment ?? null,
      })),
    );
  } catch (error) {
    next(error);
  }
});

// Decide a task. Authorization is enforced two ways: the task must be assigned
// to this user AND its role must match the caller's role — a quality approver
// can never action a finance task.
approverRouter.post(
  "/tasks/:taskId/decide",
  validateBody(decideTaskSchema),
  async (req, res, next) => {
    try {
      const body = req.body as DecideTaskInput;
      const rawId = req.params.taskId;
      const taskId = Array.isArray(rawId) ? rawId[0] : rawId;

      const task = await prisma.reviewTask.findUnique({
        where: { id: taskId },
        include: { link: { select: { id: true, orgId: true, state: true } } },
      });
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      // Org scope + role + assignment all checked.
      if (
        task.link.orgId !== req.user!.orgId ||
        task.role !== req.user!.role ||
        (task.assignedUserId && task.assignedUserId !== req.user!.userId)
      ) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (task.link.state !== "CONTRACTS_IN_PROGRESS") {
        res.status(409).json({ error: "This link is not in the approvals stage." });
        return;
      }

      // Legal owns the contracts — it can only approve once all are executed by
      // both parties. The other roles approve independently.
      if (body.decision === "approve" && task.role === "LEGAL") {
        const [total, executed] = await Promise.all([
          prisma.contract.count({ where: { linkId: task.linkId } }),
          prisma.contract.count({ where: { linkId: task.linkId, state: "EXECUTED" } }),
        ]);
        if (total === 0 || executed !== total) {
          res.status(409).json({
            error: "Legal can approve only after all contracts are signed and executed by both parties.",
          });
          return;
        }
      }

      if (body.decision === "approve") {
        await prisma.$transaction(async (tx) => {
          await tx.reviewTask.update({ where: { id: task.id }, data: { status: "APPROVED" } });
          await tx.approvalDecision.create({
            data: {
              reviewTaskId: task.id,
              linkId: task.linkId,
              decision: "APPROVED",
              comment: body.comment ?? null,
              decidedById: req.user!.userId,
            },
          });
        });
        // Single gate check — advance to APPROVED only if fully satisfied.
        if (await checkJoinGate(task.linkId)) {
          await transition(task.linkId, "APPROVED", {
            actorType: "SYSTEM",
            side: "SYSTEM",
            note: "All approvals granted and all contracts executed",
          });
        }
      } else {
        // Request changes: record it, reopen the vendor's full pack. Other
        // roles' approvals are left intact.
        await prisma.$transaction(async (tx) => {
          await tx.reviewTask.update({ where: { id: task.id }, data: { status: "CHANGES_REQUESTED" } });
          await tx.approvalDecision.create({
            data: {
              reviewTaskId: task.id,
              linkId: task.linkId,
              decision: "CHANGES_REQUESTED",
              comment: body.comment ?? null,
              decidedById: req.user!.userId,
            },
          });
          await tx.submission.updateMany({
            where: { linkId: task.linkId, stage: "FULL" },
            data: { status: "IN_PROGRESS" },
          });
          await transition(
            task.linkId,
            "FULL_IN_PROGRESS",
            { actorType: "BUYER", actorId: req.user!.userId, side: "BUYER", note: `${task.role} requested changes: ${body.comment}` },
            tx,
          );
        });
      }

      res.json(await loadBuyerLinkDetail(task.linkId));
    } catch (error) {
      next(error);
    }
  },
);
