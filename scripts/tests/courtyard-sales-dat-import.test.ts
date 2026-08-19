import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "@e965/xlsx";
import { mergeDatScreenshotImports, normalizeDatScreenshotData, parseDatWorkbook } from "../../server/courtyardSalesDatImport";
import { isAuthoritativeHotelProductionReport } from "../../server/courtyardSalesImport";

const base = {
  timeFrameStart: "2026-07-01",
  timeFrameEnd: "2026-07-31",
  property: "AUSNL - Courtyard by Marriott Austin Northwest/Lakeline",
  currency: "USD",
};

test("DAT screenshot rows map to the image TimeFrame and calculate production totals", () => {
  const parsed = normalizeDatScreenshotData({
    ...base,
    showsTableStart: true,
    showsTableEnd: true,
    rows: [
      { marketCategory: "TRANSIENT/RENTALS", marketSegment: "Prepay", currentRoomNights: 69, currentRoomRevenue: 6826, currentRoomAdr: 98.93 },
      { marketCategory: "TRANSIENT/RENTALS", marketSegment: "Special Corp", currentRoomNights: 101, currentRoomRevenue: 10400, currentRoomAdr: 102.97 },
    ],
  });

  assert.deepEqual(parsed.reportDateRange, { start: "2026-07-01", end: "2026-07-31" });
  assert.equal(parsed.accepted.reduce((sum, row) => sum + row.roomNights, 0), 170);
  assert.equal(parsed.accepted.reduce((sum, row) => sum + row.roomRevenue, 0), 17226);
  assert.equal(parsed.accepted[1].marketSegment, "Special Corp");
  assert.equal(parsed.accepted[1].totalRevenue, 10400);
});

test("multiple DAT screenshots merge continuation rows without double counting overlap", () => {
  const first = normalizeDatScreenshotData({
    ...base,
    showsTableStart: true,
    showsTableEnd: false,
    rows: [
      { marketCategory: "TRANSIENT/RENTALS", marketSegment: "Prepay", currentRoomNights: 69, currentRoomRevenue: 6826, currentRoomAdr: 98.93 },
      { marketCategory: "TRANSIENT/RENTALS", marketSegment: "Retail", currentRoomNights: 603, currentRoomRevenue: 66150, currentRoomAdr: 109.7 },
    ],
  }, "page 1.png");
  const second = normalizeDatScreenshotData({
    ...base,
    showsTableStart: false,
    showsTableEnd: true,
    rows: [
      { marketCategory: "TRANSIENT/RENTALS", marketSegment: "Retail", currentRoomNights: 603, currentRoomRevenue: 66150, currentRoomAdr: 109.7 },
      { marketCategory: "GROUP", marketSegment: "C Group Corporate", currentRoomNights: 25, currentRoomRevenue: 2294, currentRoomAdr: 91.76 },
    ],
  }, "page 2.png");
  const merged = mergeDatScreenshotImports([first, second]);

  assert.equal(merged.accepted.length, 3);
  assert.equal(merged.duplicateRowCount, 1);
  assert.equal(merged.accepted.reduce((sum, row) => sum + row.roomRevenue, 0), 75270);
  assert.equal(merged.showsTableStart, true);
  assert.equal(merged.showsTableEnd, true);
});

test("DAT is an authoritative hotel-production source and UI supports image uploads", () => {
  assert.equal(isAuthoritativeHotelProductionReport("marriott_dat_analytical_demand_excel"), true);
  assert.equal(isAuthoritativeHotelProductionReport("marriott_dat_analytical_demand_screenshot"), true);
  const page = readFileSync("client/src/pages/courtyard-sales-intelligence.tsx", "utf8");
  assert.match(page, /DAT Excel Export — Preferred/);
  assert.match(page, /DAT Screenshot — Backup/);
  assert.match(page, /TimeFrame \{p\.preview\.reportDateRange\.start\} to \{p\.preview\.reportDateRange\.end\}/);
  assert.match(page, /\.png,\.jpg,\.jpeg,\.webp/);
});

test("DAT Excel export reads its Filters Timeframe and Detail Selection production", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Analytical Demand Analysis Data Export"],
    [], [], [],
    ["Market Category", "Market Segment", "Current Room Nights", "Current Room Revenue", "Current Room ADR", "Occupancy %"],
    ["TRANSIENT/RENTALS", "Retail", 603, 66150, 109.7, 16.5],
    ["GROUP", "C Group Corporate", 25, 2294, 91.76, 0.7],
  ]), "Detail Selection");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Timeframe: Jul 01 2026 - Jul 31 2026"],
    ["Currency", "USD"],
  ]), "Filters");
  const parsed = parseDatWorkbook(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));

  assert.equal(parsed.delimiter, "xlsx");
  assert.deepEqual(parsed.reportDateRange, { start: "2026-07-01", end: "2026-07-31" });
  assert.equal(parsed.accepted.length, 2);
  assert.equal(parsed.accepted.reduce((sum, row) => sum + row.roomNights, 0), 628);
  assert.equal(parsed.accepted.reduce((sum, row) => sum + row.roomRevenue, 0), 68444);
});
