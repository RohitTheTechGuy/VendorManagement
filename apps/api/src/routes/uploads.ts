import { Router, type Request, type Response } from "express";
import multer from "multer";
import { uploadKindSchema } from "@vendor-management/shared";
import { requireAuth } from "../middleware/require-auth.js";
import { storeUpload, FileValidationError } from "../lib/files.js";

// The hard ceiling for multer (the larger of the two kinds); storeUpload then
// enforces the per-kind limit (documents 5MB, contracts 10MB).
const MULTER_MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MULTER_MAX_BYTES, files: 1 },
});

// Promisified single-file parse so we can translate multer's own errors
// (e.g. file too large) into clean 400s instead of a generic 500.
function parseSingleFile(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err: unknown) => (err ? reject(err) : resolve()));
  });
}

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.post("/", async (req, res, next) => {
  try {
    try {
      await parseSingleFile(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === "LIMIT_FILE_SIZE" ? "File is larger than the 10 MB limit" : err.message;
        res.status(400).json({ error: msg });
        return;
      }
      throw err;
    }

    const kind = uploadKindSchema.safeParse(req.body?.kind);
    if (!kind.success) {
      res.status(400).json({ error: "Missing or invalid upload kind" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const result = await storeUpload(kind.data, req.file);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof FileValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});
