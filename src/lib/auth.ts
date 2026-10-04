import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { cookieSecure, env } from "../config/env";

export const AUTH_COOKIE = "spend_token";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === "string" || !payload.sub) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: cookieSecure,
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: cookieSecure,
    path: "/",
  });
}
