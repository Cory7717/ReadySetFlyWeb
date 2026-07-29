import assert from "node:assert/strict";
import test from "node:test";
import {
  consecutiveComparableMonths,
  detectStaySalesReportType,
  normalizeSalesMarketSegment,
  parseSalesImport,
  parseStayGroupSummaryImport,
  parseStayMarketSegmentImport,
  parseStayReservationsCompanyImport,
  recoveryPriority,
} from "../../server/courtyardSalesImport";

test("recovery aging stops when a comparable monthly source is missing", () => {
  assert.equal(
    consecutiveComparableMonths(100, 103, new Set([101, 102, 103])),
    3,
  );
  assert.equal(
    consecutiveComparableMonths(100, 103, new Set([101, 103])),
    null,
  );
  assert.equal(consecutiveComparableMonths(103, 103, new Set([103])), 0);
});

test("combines related STAY market segments into sales families", () => {
  assert.equal(normalizeSalesMarketSegment("Group Contract"), "Group");
  assert.equal(normalizeSalesMarketSegment("Group Corporate"), "Group");
  assert.equal(
    normalizeSalesMarketSegment("Centrally Priced Special Corp"),
    "Special Corp",
  );
  assert.equal(
    normalizeSalesMarketSegment("Local Special Corp"),
    "Special Corp",
  );
  assert.equal(normalizeSalesMarketSegment("Govt/Military"), "Government");
  assert.equal(normalizeSalesMarketSegment("Government"), "Government");
  assert.equal(normalizeSalesMarketSegment("Retail"), "Retail");
});

test("detects each STAY report format from its headers", () => {
  assert.equal(
    detectStaySalesReportType(
      Buffer.from("Group,Profile,Dates,Picked Up,Room Revenue ($),ADR ($)\n"),
    ),
    "stay_group_summary",
  );
  assert.equal(
    detectStaySalesReportType(
      Buffer.from("CATEGORY,DATE,MARKET SEGMENT,ROOMS SOLD,ROOM REVENUE\n"),
    ),
    "stay_revenue_by_market_segment_with_groups",
  );
});

test("parses tab-delimited text with an xls-style report payload and normalized headers", () => {
  const input = Buffer.from(
    "\uFEFFGlobal Ultimate Account Name\tHighest Level Account ID (UAID)\tQualified vs\u00a0Non Qualified\tBooking Office\tCurrent Room Nights\tCurrent Room Revenue\nAcme Group\t123\tQualified\tHotel\t2\t$250\nAcme Group\t123\tQualified\tMobile\t1\t100\n",
  );
  const result = parseSalesImport(input);
  assert.equal(result.delimiter, "tab");
  assert.equal(result.accepted.length, 2);
  assert.equal(
    result.accepted[0].normalizedAccountKey,
    result.accepted[1].normalizedAccountKey,
  );
  assert.equal(
    result.accepted.reduce((sum, row) => sum + row.roomRevenue, 0),
    350,
  );
});

test("rejects binary workbooks and missing required headers", () => {
  assert.throws(
    () => parseSalesImport(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
    /binary Excel workbook/,
  );
  assert.throws(
    () =>
      parseSalesImport(
        Buffer.from("Account Name,Current Room Nights\nAcme,2\n"),
      ),
    /Required columns/,
  );
});

test("recovery priority is deterministic and rises with opportunity factors", () => {
  const base = recoveryPriority(1000, 10, 3, 2);
  assert.equal(base, recoveryPriority(1000, 10, 3, 2));
  assert.ok(recoveryPriority(10000, 100, 8, 7) > base);
});

test("parses STAY daily market-segment production and preserves adjustments", () => {
  const input = Buffer.from(
    '\uFEFFCATEGORY,SUBCATEGORY,DATE,MARKET SEGMENT,GUEST TYPE,ROOMS SOLD,ROOM REVENUE,ADR,GROUP PICKED UP ROOM REVENUE\nGroup Other,Group Other,"Jan 05, 2026",Group Other,Group,4,$440.00,$110.00,$440.00\nAssociate Leisure,Associate Leisure,"Jan 06, 2026",Associate Leisure,Transient,0,-$57.00,$0.00,0.00\n',
  );
  const result = parseStayMarketSegmentImport(input);
  assert.equal(result.delimiter, "comma");
  assert.equal(result.accepted.length, 2);
  assert.equal(result.accepted[0].normalizedAccountKey, "stay-segment:group");
  assert.equal(result.accepted[0].marketSegment, "Group");
  assert.equal(
    result.accepted.reduce((sum, row) => sum + row.roomNights, 0),
    4,
  );
  assert.equal(
    result.accepted.reduce((sum, row) => sum + row.roomRevenue, 0),
    383,
  );
  assert.deepEqual(result.reportDateRange, {
    start: "2026-01-05",
    end: "2026-01-06",
  });
});

test("parses parent Group Summary rows and uses picked up as room production", () => {
  const input = Buffer.from(
    'Group,Profile,Dates,Room Type,CONTRACTED,Total Blocked,Picked Up,remaining,Cancelled,No show,Room Revenue ($),ADR ($),Cut Off Date,released\n"Example Volleyball - AS123ABC[Self Payment | Self Booking]",Example Profile,Jan 11 2026 - Jan 15 2026,,20,18,16,2,1,0,1600,100,"Jan 09, 2026",Y\n,,"Jan 11, 2026",2 Queen Beds,5,5,5,0,0,0,500,100,,\n',
  );
  const result = parseStayGroupSummaryImport(input);
  assert.equal(result.rowsFound, 2);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.ignoredRowCount, 1);
  assert.equal(result.accepted[0].accountName, "Example Volleyball");
  assert.equal(result.accepted[0].groupBookingCode, "AS123ABC");
  assert.equal(result.accepted[0].roomNights, 16);
  assert.equal(result.accepted[0].blockedRoomNights, 18);
  assert.equal(result.accepted[0].released, true);
});

test("aggregates the current daily-detail Group Summary layout by booking code", () => {
  const input = Buffer.from(
    "GROUP NAME,GROUP CODE,ARRIVAL DATE,DEPARTURE DATE,DATES,ROOM TYPE,CONTRACTED,BLOCKED,PICKED UP,REMAINING,CANCELLED,NO SHOWS,ROOM REVENUE,ADR,CUT OFF DATE,RELEASED\nExample Team,ABC123,Jan 01 2026,Jan 03 2026,Jan 01 2026,King,2,2,2,0,0,0,200,100,Dec 20 2025,Yes\nExample Team,ABC123,Jan 01 2026,Jan 03 2026,Jan 02 2026,King,2,1,1,0,1,0,100,100,Dec 20 2025,Yes\n",
  );
  const result = parseStayGroupSummaryImport(input);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].accountName, "Example Team");
  assert.equal(result.accepted[0].roomNights, 3);
  assert.equal(result.accepted[0].roomRevenue, 300);
});

test("Reservations Report retains company names without adding production", () => {
  const input = Buffer.from(
    "GUEST NAME,ARRIVE,DEPART,RATE($),COMPANY,GROUP\nPerson One,2026-01-01,2026-01-02,RFP1 - 100,Acme Corp,\nPerson Two,2026-01-02,2026-01-03,GOV1 - 110,Government of The United States,\nPerson Three,2026-01-03,2026-01-04,AAA - 90,AAA,\n",
  );
  const result = parseStayReservationsCompanyImport(input);
  assert.equal(result.accepted.length, 2);
  assert.equal(
    result.accepted.reduce((sum, row) => sum + row.roomRevenue, 0),
    0,
  );
  assert.deepEqual(result.accepted.map((row) => row.marketSegment).sort(), [
    "Government",
    "Special Corp",
  ]);
});
