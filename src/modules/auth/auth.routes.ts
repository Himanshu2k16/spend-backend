import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signToken,
  verifyPassword,
} from "../../lib/auth";
import { generateDemoExpenses } from "../../lib/demo";
import { asyncHandler, ApiError } from "../../middleware/errors";
import { requireAuth } from "../../middleware/auth";
import { loginSchema, registerSchema } from "../validation";

export const authRoutes = Router();

function publicUser(user: { id: string; email: string; name: string; currency: string }) {
  return { id: user.id, email: user.email, name: user.name, currency: user.currency };
}

authRoutes.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: hashPassword(input.password),
        seeded: true,
      },
    });

    // Welcome ledger: seed the sample history so the app is alive on first login.
    const demo = generateDemoExpenses();
    await prisma.expense.createMany({
      data: demo.map((row) => ({ ...row, userId: user.id })),
    });

    setAuthCookie(res, signToken(user.id));
    res.status(201).json({ user: publicUser(user) });
  })
);

authRoutes.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new ApiError(401, "Incorrect email or password");
    }

    setAuthCookie(res, signToken(user.id));
    res.json({ user: publicUser(user) });
  })
);

authRoutes.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new ApiError(401, "Session no longer valid");
    res.json({ user: publicUser(user) });
  })
);
