import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { requirementsRouter } from "./routes/requirements.js";
import { directoryRouter } from "./routes/directory.js";
import { uploadsRouter } from "./routes/uploads.js";
import { filesRouter } from "./routes/files.js";
import { inviteRouter } from "./routes/invite.js";
import { linksRouter } from "./routes/links.js";
import { buyerRouter } from "./routes/buyer.js";
import { approverRouter } from "./routes/approver.js";
import { contractsRouter } from "./routes/contracts.js";
import { teamRouter } from "./routes/team.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
// CORS origin must equal the client URL exactly, with credentials:true, or the
// browser silently drops the auth cookie on cross-origin requests.
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
// Files upload as multipart (handled by multer), not JSON. We still raise the
// JSON limit explicitly so large metadata payloads never hit the default 100kb.
app.use(express.json({ limit: "12mb" }));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/requirements", requirementsRouter);
app.use("/api/directory", directoryRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/files", filesRouter);
app.use("/api/invite", inviteRouter);
app.use("/api/links", linksRouter);
app.use("/api/buyer", buyerRouter);
app.use("/api/approver", approverRouter);
app.use("/api/contracts", contractsRouter);
app.use("/api/team", teamRouter);

app.all("/api/*splat", (_request, response) => {
  response.status(404).json({ error: "API route not found" });
});

if (env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "apps/api/frontend");
  app.use(express.static(frontendDist));
  app.get("/*splat", (_request, response) => {
    response.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);
