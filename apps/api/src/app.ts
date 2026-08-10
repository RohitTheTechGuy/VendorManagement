import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { auth } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "2mb" }));
app.use("/api", healthRouter);

app.all("/api/*splat", (_request, response) => {
  response.status(404).json({ success: false, error: "API route not found" });
});

if (env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "apps/api/frontend");
  app.use(express.static(frontendDist));
  app.get("/*splat", (_request, response) => {
    response.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);
