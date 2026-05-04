export type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** Operational HTTP error with stable JSON shape for APIs. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  /** When false, middleware may hide `message` from clients (500). */
  readonly exposeMessage: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: { details?: unknown; exposeMessage?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.exposeMessage = options?.exposeMessage ?? statusCode < 500;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): ErrorBody {
    const body: ErrorBody = {
      error: {
        code: this.code,
        message: this.exposeMessage ? this.message : "Internal Server Error",
      },
    };
    if (this.details !== undefined) {
      body.error.details = this.details;
    }
    return body;
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new AppError(400, code, message, { details });
  }

  static unauthorized(code: string, message: string, details?: unknown) {
    return new AppError(401, code, message, { details });
  }

  static forbidden(code: string, message: string, details?: unknown) {
    return new AppError(403, code, message, { details });
  }

  static notFound(code: string, message: string, details?: unknown) {
    return new AppError(404, code, message, { details });
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new AppError(409, code, message, { details });
  }

  static badGateway(code: string, message: string, details?: unknown) {
    return new AppError(502, code, message, { details });
  }

  static internal(
    code = "INTERNAL",
    message = "Internal Server Error",
    options?: { cause?: unknown; logMessage?: string },
  ) {
    return new AppError(500, code, message, {
      exposeMessage: false,
      cause: options?.cause,
    });
  }

  static serviceUnavailable(code: string, message: string, details?: unknown) {
    return new AppError(503, code, message, { details });
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

type ZodLike = { errors: { path: (string | number)[]; message: string }[] };

function isZodError(e: unknown): e is ZodLike {
  return (
    !!e &&
    typeof e === "object" &&
    (e as { name?: string }).name === "ZodError" &&
    Array.isArray((e as ZodLike).errors)
  );
}

function zodToAppError(err: ZodLike): AppError {
  const first = err.errors[0];
  const path = first?.path?.length ? first.path.join(".") : "request";
  return AppError.badRequest("VALIDATION", first?.message ?? "Invalid input", {
    issues: err.errors,
    path,
  });
}

/** Normalize any thrown value to an AppError (never throws). */
export function normalizeError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (isZodError(err)) return zodToAppError(err);
  if (err && typeof err === "object" && "status" in err) {
    const s = err as { status?: number; statusCode?: number; message?: string };
    const status = Number(s.statusCode ?? s.status ?? 500);
    const msg =
      typeof s.message === "string" && s.message
        ? s.message
        : "Request failed";
    if (status >= 400 && status < 600) {
      return new AppError(status, "HTTP_ERROR", msg, {
        exposeMessage: status < 500,
      });
    }
  }
  if (err instanceof Error) {
    return AppError.internal("INTERNAL", "Internal Server Error", {
      cause: err,
    });
  }
  return AppError.internal("INTERNAL", "Internal Server Error");
}

export function errorJson(err: unknown, opts?: { exposeInternal?: boolean }): ErrorBody {
  const ae = normalizeError(err);
  if (opts?.exposeInternal && ae.statusCode >= 500 && err instanceof Error) {
    return {
      error: {
        code: ae.code,
        message: err.message || ae.message,
      },
    };
  }
  return ae.toJSON();
}
