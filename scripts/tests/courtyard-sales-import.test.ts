import assert from "node:assert/strict";
import test from "node:test";
import { parseSalesImport, recoveryPriority } from "../../server/courtyardSalesImport";

test("parses tab-delimited text with an xls-style report payload and normalized headers", () => {
  const input = Buffer.from("\uFEFFGlobal Ultimate Account Name\tHighest Level Account ID (UAID)\tQualified vs\u00a0Non Qualified\tBooking Office\tCurrent Room Nights\tCurrent Room Revenue\nAcme Group\t123\tQualified\tHotel\t2\t$250\nAcme Group\t123\tQualified\tMobile\t1\t100\n");
  const result = parseSalesImport(input);
  assert.equal(result.delimiter, "tab");
  assert.equal(result.accepted.length, 2);
  assert.equal(result.accepted[0].normalizedAccountKey, result.accepted[1].normalizedAccountKey);
  assert.equal(result.accepted.reduce((sum, row) => sum + row.roomRevenue, 0), 350);
});

test("rejects binary workbooks and missing required headers", () => {
  assert.throws(() => parseSalesImport(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])), /binary Excel workbook/);
  assert.throws(() => parseSalesImport(Buffer.from("Account Name,Current Room Nights\nAcme,2\n")), /Required columns/);
});

test("recovery priority is deterministic and rises with opportunity factors", () => {
  const base = recoveryPriority(1000, 10, 3, 2);
  assert.equal(base, recoveryPriority(1000, 10, 3, 2));
  assert.ok(recoveryPriority(10000, 100, 8, 7) > base);
});
