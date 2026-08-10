import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { requirementsRouter } from "./routes/requirements.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
// CORS origin must equal the client URL exactly, with credentials:true, or the
// browser silently drops the auth cookie on cross-origin requests.
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/requirements", requirementsRouter);

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
