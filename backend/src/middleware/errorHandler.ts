import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Unhandled Server Error]", err);

  const status = (err as any).status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error occurred.",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
