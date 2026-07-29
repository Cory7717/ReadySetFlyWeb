import assert from "node:assert/strict";
import test from "node:test";
import {
  detectStaySalesReportType,
  parseSalesImport,
  parseStayGroupSummaryImport,
  parseStayMarketSegmentImport,
  recoveryPriority,
} from "../../server/courtyardSalesImport";

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
  assert.equal(
    result.accepted[0].normalizedAccountKey,
    "stay-segment:group other",
  );
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
