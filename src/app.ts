import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errors";
import { authRoutes } from "./modules/auth/auth.routes";
import { expensesRoutes } from "./modules/expenses/expenses.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "spend-backend", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/expenses", expensesRoutes);
  app.use("/api/settings", settingsRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);
  return app;
}
