import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("rental requests do not send renters directly to PayPal before owner approval", () => {
  const source = read("client/src/pages/aircraft-detail.tsx");
  const successStart = source.indexOf("onSuccess: (data:");
  assert.ok(successStart >= 0, "create rental success handler should exist");
  const successBlock = source.slice(successStart, source.indexOf("onError:", successStart));

  assert.match(successBlock, /navigate\("\/dashboard"\)/);
  assert.match(successBlock, /Rental request sent/);
  assert.match(successBlock, /Payment opens after approval/);
  assert.doesNotMatch(successBlock, /navigate\(`\/rental-payment\/\$\{data\.id\}`\)/);
});

test("rental payment page renders PayPal only for approved unpaid rentals", () => {
  const source = read("client/src/pages/rental-payment.tsx");

  assert.match(source, /const isPending = status === "pending"/);
  assert.match(source, /const isApprovedForPayment = status === "approved" && !rental\.isPaid/);
  assert.match(source, /const isPaidOrActive = Boolean\(rental\.isPaid\) \|\| status === "active"/);
  assert.match(source, /data-testid="card-rental-payment-pending"/);
  assert.match(source, /data-testid="card-rental-payment-cancelled"/);
  assert.match(source, /data-testid="card-rental-payment-complete"/);
  assert.match(source, /data-testid="card-rental-payment-unavailable"/);
  assert.match(source, /Payment will become available after the owner approves the rental/);
  assert.match(source, /\{renderStatusPanel\(\)\}/);

  const returnStart = source.indexOf('<div className="min-h-screen rsf-app-shell rsf-rentals-theme">');
  const mainRender = source.slice(returnStart);
  assert.equal((mainRender.match(/<CheckoutForm/g) || []).length, 0, "main render should delegate CheckoutForm to status panel");
});

test("public aircraft rental availability endpoint exposes only safe approved blocks", () => {
  const source = read("server/routes.ts");
  const endpointStart = source.indexOf('app.get("/api/rentals/aircraft/:aircraftId"');
  assert.ok(endpointStart >= 0, "aircraft rental endpoint should exist");
  const privateEndpointStart = source.indexOf('app.get("/api/rentals/:id"', endpointStart);
  const endpoint = source.slice(endpointStart, privateEndpointStart);

  assert.match(endpoint, /\["approved", "active"\]\.includes\(String\(rental\.status\)\)/);
  assert.match(endpoint, /id: rental\.id/);
  assert.match(endpoint, /aircraftId: rental\.aircraftId/);
  assert.match(endpoint, /startDate: rental\.startDate/);
  assert.match(endpoint, /endDate: rental\.endDate/);
  assert.match(endpoint, /status: rental\.status/);
  assert.doesNotMatch(endpoint, /renterId/);
  assert.doesNotMatch(endpoint, /ownerId/);
  assert.doesNotMatch(endpoint, /totalCostRenter/);
  assert.doesNotMatch(endpoint, /paypal/);
});

test("rental lifecycle creates in-app notifications for owner and renter handoffs", () => {
  const source = read("server/routes.ts");

  assert.match(source, /type: "rental_request_received"/);
  assert.match(source, /type: "rental_request_approved"/);
  assert.match(source, /type: "rental_request_cancelled"/);
  assert.match(source, /type: "rental_payment_completed"/);
  assert.match(source, /actionPath: `\/rental-payment\/\$\{rental\.id\}`/);
  assert.match(source, /actionPath: "\/dashboard"/);
});

test("owners must still be verified when approving a rental request", () => {
  const source = read("server/routes.ts");
  const patchStart = source.indexOf('app.patch("/api/rentals/:id"');
  assert.ok(patchStart >= 0, "rental patch endpoint should exist");
  const patchEndpoint = source.slice(patchStart, source.indexOf('app.post("/api/rentals/:id/complete-payment"', patchStart));

  assert.match(patchEndpoint, /const owner = await storage\.getUser\(userId\)/);
  assert.match(patchEndpoint, /if \(!owner\?\.isVerified\)/);
  assert.match(patchEndpoint, /Aircraft owners must remain verified before approving rental requests/);
});
