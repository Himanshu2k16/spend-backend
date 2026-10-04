import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errors";
import { requireAuth } from "../../middleware/auth";
import { expenseInputSchema, expensePatchSchema } from "../validation";
import { generateDemoExpenses } from "../../lib/demo";

export const expensesRoutes = Router();

expensesRoutes.use(requireAuth);

interface ExpenseRow {
  id: string;
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  method: string;
  createdAt: Date;
}

/** Shape a DB row into the contract the frontend store expects. */
function toExpense(e: ExpenseRow) {
  return {
    id: e.id,
    amount: e.amount,
    categoryId: e.categoryId,
    date: e.date,
    note: e.note,
    method: e.method,
    createdAt: Number(e.createdAt.getTime()),
  };
}

function orderByNewestFirst(): Prisma.ExpenseOrderByWithRelationInput[] {
  return [{ date: "desc" }, { createdAt: "desc" }];
}

expensesRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.expense.findMany({
      where: { userId: req.userId },
      orderBy: orderByNewestFirst(),
    });
    res.json(rows.map(toExpense));
  })
);

expensesRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = expenseInputSchema.parse(req.body);
    const created = await prisma.expense.create({
      data: { ...input, userId: req.userId as string },
    });
    res.status(201).json(toExpense(created));
  })
);

expensesRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      throw new ApiError(404, "Expense not found");
    }
    const patch = expensePatchSchema.parse(req.body);
    const updated = await prisma.expense.update({ where: { id }, data: patch });
    res.json(toExpense(updated));
  })
);

expensesRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      throw new ApiError(404, "Expense not found");
    }
    await prisma.expense.delete({ where: { id } });
    res.json({ ok: true });
  })
);

/** Clear the ledger. */
expensesRoutes.delete(
  "/",
  asyncHandler(async (req, res) => {
    await prisma.expense.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  })
);

/** Replace the ledger with the sample history. */
expensesRoutes.post(
  "/demo",
  asyncHandler(async (req, res) => {
    await prisma.expense.deleteMany({ where: { userId: req.userId } });
    const demo = generateDemoExpenses();
    await prisma.expense.createMany({
      data: demo.map((row) => ({ ...row, userId: req.userId as string })),
    });
    const rows = await prisma.expense.findMany({
      where: { userId: req.userId },
      orderBy: orderByNewestFirst(),
    });
    res.json(rows.map(toExpense));
  })
);
