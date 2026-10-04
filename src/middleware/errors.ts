import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export interface ApiErrorShape {
  error: string;
  details?: unknown;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/** Wrap async route handlers so rejections reach the error handler. */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    const body: ApiErrorShape = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ error: "Invalid input", details: err.issues } satisfies ApiErrorShape);
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({ error: "That record already exists" } satisfies ApiErrorShape);
    return;
  }
  console.error("[spend-backend] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" } satisfies ApiErrorShape);
}
