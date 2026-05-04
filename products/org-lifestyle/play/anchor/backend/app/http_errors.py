"""
Unified HTTP API errors for Flask / FastAPI services.

JSON shape matches TypeScript @216labs/errors:
  { "error": { "code": str, "message": str, "details": optional } }

Mirror of internal/platform/http_errors.py (keep in sync).
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Operational HTTP error."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        expose_message: bool | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = int(status_code)
        self.code = code
        self.details = details
        if expose_message is None:
            expose_message = self.status_code < 500
        self.expose_message = expose_message

    def to_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "error": {
                "code": self.code,
                "message": self.message if self.expose_message else "Internal Server Error",
            }
        }
        if self.details is not None:
            body["error"]["details"] = self.details
        return body

    @staticmethod
    def bad_request(code: str, message: str, details: dict[str, Any] | None = None) -> AppError:
        return AppError(400, code, message, details=details)

    @staticmethod
    def unauthorized(code: str, message: str, details: dict[str, Any] | None = None) -> AppError:
        return AppError(401, code, message, details=details)

    @staticmethod
    def not_found(code: str, message: str, details: dict[str, Any] | None = None) -> AppError:
        return AppError(404, code, message, details=details)

    @staticmethod
    def internal(code: str = "INTERNAL", message: str = "Internal Server Error") -> AppError:
        return AppError(500, code, message, expose_message=False)

    @staticmethod
    def service_unavailable(code: str, message: str, details: dict[str, Any] | None = None) -> AppError:
        return AppError(503, code, message, details=details)


def register_flask_error_handlers(app: Any) -> None:
    """Register AppError handler on a Flask app (JSON API errors only)."""

    import flask

    @app.errorhandler(AppError)
    def handle_app_error(e: AppError):
        return flask.jsonify(e.to_dict()), e.status_code


def register_fastapi_exception_handlers(app: Any) -> None:
    """Register handlers on a FastAPI application."""

    from fastapi import Request
    from fastapi.responses import JSONResponse
    from starlette.exceptions import HTTPException as StarletteHTTPException

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        msg = detail if isinstance(detail, str) else str(detail)
        code = f"HTTP_{exc.status_code}"
        body = AppError(exc.status_code, code, msg, expose_message=exc.status_code < 500).to_dict()
        return JSONResponse(status_code=exc.status_code, content=body)
