"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AppError: () => AppError,
  errorJson: () => errorJson,
  isAppError: () => isAppError,
  normalizeError: () => normalizeError
});
module.exports = __toCommonJS(index_exports);

// src/app-error.ts
var AppError = class _AppError extends Error {
  statusCode;
  code;
  details;
  /** When false, middleware may hide `message` from clients (500). */
  exposeMessage;
  constructor(statusCode, code, message, options) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.exposeMessage = options?.exposeMessage ?? statusCode < 500;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toJSON() {
    const body = {
      error: {
        code: this.code,
        message: this.exposeMessage ? this.message : "Internal Server Error"
      }
    };
    if (this.details !== void 0) {
      body.error.details = this.details;
    }
    return body;
  }
  static badRequest(code, message, details) {
    return new _AppError(400, code, message, { details });
  }
  static unauthorized(code, message, details) {
    return new _AppError(401, code, message, { details });
  }
  static forbidden(code, message, details) {
    return new _AppError(403, code, message, { details });
  }
  static notFound(code, message, details) {
    return new _AppError(404, code, message, { details });
  }
  static conflict(code, message, details) {
    return new _AppError(409, code, message, { details });
  }
  static badGateway(code, message, details) {
    return new _AppError(502, code, message, { details });
  }
  static internal(code = "INTERNAL", message = "Internal Server Error", options) {
    return new _AppError(500, code, message, {
      exposeMessage: false,
      cause: options?.cause
    });
  }
  static serviceUnavailable(code, message, details) {
    return new _AppError(503, code, message, { details });
  }
};
function isAppError(e) {
  return e instanceof AppError;
}
function isZodError(e) {
  return !!e && typeof e === "object" && e.name === "ZodError" && Array.isArray(e.errors);
}
function zodToAppError(err) {
  const first = err.errors[0];
  const path = first?.path?.length ? first.path.join(".") : "request";
  return AppError.badRequest("VALIDATION", first?.message ?? "Invalid input", {
    issues: err.errors,
    path
  });
}
function normalizeError(err) {
  if (isAppError(err)) return err;
  if (isZodError(err)) return zodToAppError(err);
  if (err && typeof err === "object" && "status" in err) {
    const s = err;
    const status = Number(s.statusCode ?? s.status ?? 500);
    const msg = typeof s.message === "string" && s.message ? s.message : "Request failed";
    if (status >= 400 && status < 600) {
      return new AppError(status, "HTTP_ERROR", msg, {
        exposeMessage: status < 500
      });
    }
  }
  if (err instanceof Error) {
    return AppError.internal("INTERNAL", "Internal Server Error", {
      cause: err
    });
  }
  return AppError.internal("INTERNAL", "Internal Server Error");
}
function errorJson(err, opts) {
  const ae = normalizeError(err);
  if (opts?.exposeInternal && ae.statusCode >= 500 && err instanceof Error) {
    return {
      error: {
        code: ae.code,
        message: err.message || ae.message
      }
    };
  }
  return ae.toJSON();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppError,
  errorJson,
  isAppError,
  normalizeError
});
