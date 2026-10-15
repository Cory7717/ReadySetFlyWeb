import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = readFileSync("server/routes/hotelOperationsPhase2.ts", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");
const migration = readFileSync(
  "migrations/0157_add_hotel_operations_sales_inquiries.sql",
  "utf8",
);
const widget = readFileSync(
  "client/src/components/hotel-operations/PublicSalesInquiryWidget.tsx",
  "utf8",
);

test("anonymous sales intake is isolated from authenticated support records", () => {
  assert.match(schema, /hotelOpsSalesInquiries = pgTable/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS hotel_ops_sales_inquiries/);
  assert.doesNotMatch(migration, /hotel_ops_support_conversations/);
  const publicRoute = routes.slice(
    routes.indexOf('"/public/sales-inquiries"'),
    routes.indexOf('"/support-invitations/:token"'),
  );
  assert.ok(publicRoute.length > 0);
  assert.doesNotMatch(publicRoute, /requirePortalSession/);
  assert.match(publicRoute, /publicSalesLimiter/);
  assert.match(publicRoute, /if \(input\.website\)/);
});

test("sales queue access requires support administration", () => {
  assert.match(
    routes,
    /"\/admin\/sales-inquiries"[\s\S]*?requirePortalSession[\s\S]*?supportAdmin/,
  );
  assert.match(
    routes,
    /"\/admin\/sales-inquiries\/:id"[\s\S]*?requirePortalSession[\s\S]*?supportAdmin[\s\S]*?requireCsrf/,
  );
});

test("sales records have bounded fields and retention", () => {
  assert.match(migration, /char_length\(message\) BETWEEN 10 AND 4000/);
  assert.match(migration, /interval '24 months'/);
  assert.match(
    migration,
    /status IN \('new', 'contacted', 'qualified', 'closed'\)/,
  );
  assert.match(routes, /HOTEL_OPS_SALES_EMAIL/);
});

test("public widget sends no session credentials and collects required fields", () => {
  assert.match(widget, /credentials: "omit"/);
  for (const field of [
    "fullName",
    "email",
    "companyName",
    "propertyCount",
    "message",
    "website",
  ]) {
    assert.match(widget, new RegExp(field));
  }
  assert.match(widget, /aria-modal="true"/);
  assert.match(widget, /Questions\? Chat with us/);
});
