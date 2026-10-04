import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE, verifyToken } from "../lib/auth";
import { ApiError } from "./errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/** Requires a valid session cookie; attaches userId to the request. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    next(new ApiError(401, "Not authenticated"));
    return;
  }
  req.userId = userId;
  next();
}
