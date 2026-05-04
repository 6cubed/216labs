import type { ErrorRequestHandler } from "express";
import { errorJson, normalizeError } from "./app-error";
import type { AppError } from "./app-error";

export type ExpressErrorHandlerOptions = {
  /** Log stack for 5xx (default: true). */
  log?: (err: unknown, normalized: AppError) => void;
};

export function expressErrorHandler(
  options?: ExpressErrorHandlerOptions,
): ErrorRequestHandler {
  return (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const ae = normalizeError(err);
    const log = options?.log ?? defaultLog;
    if (ae.statusCode >= 500) {
      log(err, ae);
    }
    res.status(ae.statusCode).json(errorJson(err));
  };
}

function defaultLog(err: unknown, ae: AppError) {
  const base = err instanceof Error ? err : new Error(String(err));
  console.error(`[${ae.code}] ${ae.statusCode}`, base.message, base.stack);
}
