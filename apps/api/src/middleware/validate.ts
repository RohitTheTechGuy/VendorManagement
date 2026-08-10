import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

// Validate the request body against a Zod schema. On success the parsed
// (and coerced) value replaces req.body; on failure returns 400 with issues.
// Never trust the client — every mutating route runs this.
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "Invalid request", issues: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}
