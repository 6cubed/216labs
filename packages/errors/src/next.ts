import { NextResponse } from "next/server";
import { AppError, errorJson, isAppError, normalizeError } from "./app-error";

/** Return a JSON error response for App Router route handlers. */
export function nextErrorResponse(err: unknown): NextResponse {
  const ae = normalizeError(err);
  return NextResponse.json(errorJson(err), { status: ae.statusCode });
}

/** Throw in route handlers only when you catch and rethrow; prefer `return nextErrorResponse(e)`. */
export function fail(error: AppError): never {
  throw error;
}

export { AppError, isAppError, normalizeError, errorJson };
