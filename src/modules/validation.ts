import { z } from "zod";

export const CATEGORY_IDS = [
  "food",
  "groceries",
  "transport",
  "shopping",
  "fun",
  "bills",
  "health",
  "learning",
  "travel",
  "rent",
  "subs",
  "other",
] as const;

export const METHOD_IDS = ["card", "cash", "upi", "bank"] as const;

export const expenseInputSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero").max(1_000_000_000),
  categoryId: z.enum(CATEGORY_IDS),
  /** ISO date, yyyy-mm-dd */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be yyyy-mm-dd"),
  note: z.string().max(120).default(""),
  method: z.enum(METHOD_IDS).default("card"),
});

export const expensePatchSchema = expenseInputSchema.partial();

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const budgetsSchema = z.object({
  budgets: z
    .record(z.string(), z.number().nonnegative())
    .refine((map) => Object.keys(map).every((k) => (CATEGORY_IDS as readonly string[]).includes(k)), {
      message: "Unknown category in budgets",
    })
    .optional(),
  overallBudget: z.number().positive().nullable().optional(),
});

export const preferencesSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO code"),
});
