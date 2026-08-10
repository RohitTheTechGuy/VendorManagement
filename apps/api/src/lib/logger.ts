import pino from "pino";

export const logger = pino({
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
});
