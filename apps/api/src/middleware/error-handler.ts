import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  logger.error(error);
  response.status(500).json({ success: false, error: "Internal server error" });
};
