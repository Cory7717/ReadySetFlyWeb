import assert from "node:assert/strict";
import test from "node:test";
import { CorsOriginDeniedError } from "../../server/corsOptions";
import { globalErrorHandler } from "../../server/middleware/globalErrorHandler";

function invoke(error: any, options: { headersSent?: boolean; requestId?: string } = {}) {
  let statusCode = 0, body: any, delegated: any;
  const req = { method: "GET", path: "/api/example" } as any;
  const res = {
    headersSent: Boolean(options.headersSent), locals: { requestId: options.requestId },
    status(value: number) { statusCode = value; return this; }, json(value: any) { body = value; return this; },
  } as any;
  globalErrorHandler(error, req, res, (value?: any) => { delegated = value; });
  return { statusCode, body, delegated };
}

test("unexpected errors return a generic 500 without rethrowing or leaking credentials", () => {
  const secret = "postgresql://synthetic_user:synthetic_password@example.invalid/db";
  const logs: string[] = [], original = console.error;
  console.error = (...values: unknown[]) => logs.push(values.map(String).join(" "));
  try {
    const result = invoke(Object.assign(new Error(`connection failed: ${secret}`), { code: "ECONNREFUSED" }), { requestId: "req-123" });
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { message: "Internal Server Error", requestId: "req-123" });
    assert.equal(result.delegated, undefined);
    assert.equal(logs.join(" ").includes(secret), false);
    assert.match(logs[0], /"event":"unhandled_request_error"/);
  } finally { console.error = original; }
});

test("expected application 4xx messages remain client visible", () => {
  const result = invoke(Object.assign(new Error("Invitation expired"), { status: 409 }));
  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, { message: "Invitation expired", requestId: undefined });
});

test("CORS denials preserve the safe 403 contract", () => {
  const result = invoke(new CorsOriginDeniedError(), { requestId: "cors-123" });
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { message: "Origin not allowed", requestId: "cors-123" });
});

test("errors after headers are sent delegate to Express", () => {
  const error = new Error("late failure");
  const result = invoke(error, { headersSent: true });
  assert.equal(result.delegated, error);
  assert.equal(result.statusCode, 0);
});
