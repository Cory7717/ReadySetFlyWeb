import type { ErrorRequestHandler } from "express";
import { CorsOriginDeniedError } from "../corsOptions";

function safeStatus(error: any): number {
  const candidate = Number(error?.status || error?.statusCode || 500);
  return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function safeErrorCode(value: unknown): string | undefined {
  const code = String(value || "").trim();
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(code) ? code : undefined;
}

export const globalErrorHandler: ErrorRequestHandler = (err: any, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof CorsOriginDeniedError || err?.code === "CORS_ORIGIN_DENIED") {
    res.status(403).json({
      message: "Origin not allowed",
      requestId: res.locals.requestId || undefined,
    });
    return;
  }

  const status = safeStatus(err);
  const expectedClientError = status >= 400 && status < 500;
  if (!expectedClientError) {
    console.error(JSON.stringify({
      event: "unhandled_request_error",
      status,
      requestId: res.locals.requestId || undefined,
      method: req.method,
      pathname: String(req.path || "/").slice(0, 300),
      code: safeErrorCode(err?.code),
    }));
  }

  res.status(status).json({
    message: expectedClientError && typeof err?.message === "string" && err.message
      ? err.message
      : "Internal Server Error",
    requestId: res.locals.requestId || undefined,
  });
};
