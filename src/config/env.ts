// Central config — every value comes from the environment, nothing hardcoded.
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:4321"),
  /** lax for same-site dev; "none" when frontend and API are on different domains (needs HTTPS) */
  COOKIE_SAMESITE: z.enum(["lax", "none", "strict"]).default("lax"),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
/** sameSite "none" is only valid over HTTPS. */
export const cookieSecure = isProd || env.COOKIE_SAMESITE === "none";
