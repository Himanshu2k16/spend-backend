import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errors";
import { requireAuth } from "../../middleware/auth";
import { budgetsSchema, preferencesSchema } from "../validation";
import { convert, getUsdRates, round2 } from "../../lib/rates";

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);

type BudgetMap = Record<string, number>;

async function readBudgets(userId: string): Promise<{ budgets: BudgetMap; overallBudget: number | null }> {
  const [rows, user] = await Promise.all([
    prisma.budget.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { overallBudget: true } }),
  ]);
  const budgets: BudgetMap = {};
  for (const row of rows) budgets[row.categoryId] = row.amount;
  return { budgets, overallBudget: user?.overallBudget ?? null };
}

settingsRoutes.get(
  "/budgets",
  asyncHandler(async (req, res) => {
    res.json(await readBudgets(req.userId as string));
  })
);

/** Upsert the budget envelope map and/or the overall limit. */
settingsRoutes.put(
  "/budgets",
  asyncHandler(async (req, res) => {
    const input = budgetsSchema.parse(req.body);
    const userId = req.userId as string;

    if (input.budgets) {
      const entries = Object.entries(input.budgets).filter(([, amount]) => amount > 0);
      await prisma.$transaction([
        prisma.budget.deleteMany({ where: { userId } }),
        prisma.budget.createMany({
          data: entries.map(([categoryId, amount]) => ({ userId, categoryId, amount })),
        }),
      ]);
    }
    if (input.overallBudget !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { overallBudget: input.overallBudget },
      });
    }

    res.json(await readBudgets(userId));
  })
);

settingsRoutes.get(
  "/currencies",
  asyncHandler(async (_req, res) => {
    const rates = await getUsdRates();
    res.json({
      codes: Object.keys(rates.usdTo).sort(),
      rates: { usdTo: rates.usdTo, fetchedAt: rates.fetchedAt, live: rates.live },
    });
  })
);

settingsRoutes.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { currency: true, name: true, email: true },
    });
    res.json(user);
  })
);

settingsRoutes.put(
  "/preferences",
  asyncHandler(async (req, res) => {
    const input = preferencesSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { currency: input.currency },
      select: { currency: true, name: true, email: true },
    });
    res.json(user);
  })
);

/**
 * Switch display currency: fetch live rates server-side, re-denominate every
 * expense, budget envelope and the overall limit, then return the fresh ledger.
 */
settingsRoutes.post(
  "/currency",
  asyncHandler(async (req, res) => {
    const input = preferencesSchema.parse(req.body);
    const userId = req.userId as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User vanished mid-request");

    const rates = await getUsdRates();
    const from = user.currency;

    if (from !== input.currency) {
      const cv = (amount: number) => round2(convert(amount, from, input.currency, rates));

      const expenses = await prisma.expense.findMany({ where: { userId } });
      await prisma.$transaction(
        expenses.map((e) =>
          prisma.expense.update({ where: { id: e.id }, data: { amount: cv(e.amount) } })
        )
      );
      const budgets = await prisma.budget.findMany({ where: { userId } });
      if (budgets.length > 0) {
        await prisma.$transaction(
          budgets.map((b) =>
            prisma.budget.update({ where: { id: b.id }, data: { amount: cv(b.amount) } })
          )
        );
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          currency: input.currency,
          overallBudget: user.overallBudget != null ? cv(user.overallBudget) : null,
        },
      });
    }

    const [rows, budgetState, updated] = await Promise.all([
      prisma.expense.findMany({
        where: { userId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      readBudgets(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
    ]);

    res.json({
      currency: updated?.currency ?? input.currency,
      expenses: rows.map((e) => ({
        id: e.id,
        amount: e.amount,
        categoryId: e.categoryId,
        date: e.date,
        note: e.note,
        method: e.method,
        createdAt: Number(e.createdAt.getTime()),
      })),
      ...budgetState,
      rates: { usdTo: rates.usdTo, fetchedAt: rates.fetchedAt, live: rates.live },
    });
  })
);
