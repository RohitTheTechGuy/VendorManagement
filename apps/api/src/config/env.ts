import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Must match the client origin exactly for cross-origin auth cookies to work.
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  // Fail loudly at boot if the JWT secret is missing.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // Base URL used to build vendor magic links (vendor portal is out of scope).
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  // Optional: when absent, invite emails are logged to the console instead of sent.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("onboarding@vendor.local"),
});

const testDefaults = process.env.NODE_ENV === "test"
  ? {
      DATABASE_URL: "postgresql://localhost/test",
      JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    }
  : {};

const environment = {
  ...testDefaults,
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL?.replace(/^["']|["']$/g, ""),
};

export const env = envSchema.parse(environment);
