import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { excelDateToIso, parseOooText, parseOpsReportFile } from "../../server/opsReportParsers";
import { addLaborWageEstimate, emptyLaborWageEstimates, finalizeLaborWageEstimates, parseLaborSummaryText, opsLaborBreakdownLabelForSchedule, opsLaborBucketForSchedule } from "../../server/routes/opsReport";
import { ABACUS_LABOR_DEPARTMENT_MAP, parseAbacusLaborCsv } from "../../server/abacusLaborParser";

const context = { weekStart: "2026-05-30", weekEnd: "2026-06-05", reportMonth: "2026-06" };

function csvFile(originalname: string, body: string) {
  return {
    originalname,
    mimetype: "text/csv",
    buffer: Buffer.from(body),
  } as Express.Multer.File;
}

const abacusHeader = "Date,Legal Company Code,Client Name,Employee Number,Employee Name,Labor Value,Labor Title,Earnings Type,Earnings Code,Earning Title,Hours,Rate,Other,Total";

function abacusRow(date: string, code: string, title: string, earningsCode: string, earningTitle: string, hours: string | number, total: string | number) {
  return [date, "HOTEL", "Test Hotel", "100", "Test Associate", code, title, "E", earningsCode, earningTitle, hours, "0", "0", total].join(",");
}

test("Abacus labor-code mapping is centralized and covers the configured hotel departments", () => {
  assert.equal(ABACUS_LABOR_DEPARTMENT_MAP["109"], "BREAKFAST / BISTRO HOURS");
  assert.equal(ABACUS_LABOR_DEPARTMENT_MAP["200"], "FRONT DESK / NIGHT AUDIT HOURS");
  assert.equal(ABACUS_LABOR_DEPARTMENT_MAP["300"], "HOUSEKEEPING HOURS");
  assert.equal(ABACUS_LABOR_DEPARTMENT_MAP["400"], "MAINTENANCE HOURS");
});

test("Abacus September 12-18 fixture reproduces department and hotel totals exactly", () => {
  const csv = [
    abacusHeader,
    abacusRow("9/12/2026", "300", "300 - Room Attendant", "1", "Regular", 259.21, 4412.67),
    abacusRow("9/13/2026", "300", "300 - Room Attendant", "2", "Overtime - Blended Rate", 65, 1691.66),
    abacusRow("9/14/2026", "300", "300 - Room Attendant", "M1", "Memo Hours", 11.99, 204.72),
    abacusRow("9/12/2026", "200", "200 - Front Desk", "1", "Regular", 160.59, 2890.51),
    abacusRow("9/13/2026", "200", "200 - Front Desk", "2", "Overtime - Blended Rate", 25.72, 735.23),
    abacusRow("9/14/2026", "200", "200 - Front Desk", "M1", "Memo Hours", 0.98, 19.20),
    abacusRow("9/15/2026", "109", "109 - Barista Manager", "1", "Regular", 113.85, 2222.91),
    abacusRow("9/16/2026", "400", "400 - Maintenance", "1", "Regular", 56.12, 1410.10),
    abacusRow("9/17/2026", "400", "400 - Maintenance", "2", "Overtime - Blended Rate", 2, 84),
    abacusRow("9/18/2026", "400", "400 - Maintenance", "M1", "Memo Hours", 1.05, 18.90),
    ",,,,,,,,,,696.51,3481.75,0,13689.90",
  ].join("\n");
  const parsed = parseAbacusLaborCsv(Buffer.from(csv), "Abacus fixture.csv");
  const departments = Object.fromEntries(parsed.departments.map((department) => [department.department, department]));
  assert.deepEqual([parsed.weekStart, parsed.weekEnd], ["2026-09-12", "2026-09-18"]);
  assert.equal(departments["HOUSEKEEPING HOURS"].totalHours, 336.20);
  assert.equal(departments["HOUSEKEEPING HOURS"].totalPayroll, 6309.05);
  assert.equal(departments["FRONT DESK / NIGHT AUDIT HOURS"].totalHours, 187.29);
  assert.equal(departments["BREAKFAST / BISTRO HOURS"].totalHours, 113.85);
  assert.equal(departments["MAINTENANCE HOURS"].totalHours, 59.17);
  assert.equal(parsed.hotelTotal.regularHours, 589.77);
  assert.equal(parsed.hotelTotal.overtimeHours, 92.72);
  assert.equal(parsed.hotelTotal.memoHours, 14.02);
  assert.equal(parsed.hotelTotal.totalHours, 696.51);
  assert.equal(parsed.hotelTotal.totalPayroll, 13689.90);
  assert.equal(parsed.reconciled, true);
});

test("Abacus parser preserves unknown codes, ignores blank/header rows, and safely handles malformed numerics", () => {
  const csv = [
    abacusHeader,
    abacusHeader,
    ",,,,,,,,,,,,,",
    abacusRow("9/12/2026", "999", "999 - Special Project", "1", "Regular", 4, 100),
    abacusRow("9/13/2026", "999", "999 - Special Project", "2", "Overtime", "bad", "invalid"),
    ",,,,,,,,,,4,0,0,100",
  ].join("\n");
  const parsed = parseAbacusLaborCsv(Buffer.from(csv), "Abacus unknown.csv");
  const unmapped = parsed.departments.find((department) => department.department === "UNMAPPED / REVIEW REQUIRED");
  assert.equal(unmapped?.laborCodes[0].laborCode, "999");
  assert.equal(unmapped?.totalHours, 4);
  assert.equal(unmapped?.totalPayroll, 100);
  assert.match(parsed.warnings.join(" "), /unmapped labor code/i);
  assert.match(parsed.warnings.join(" "), /malformed numeric/i);
});

test("Excel serial dates normalize without time-zone drift", () => {
  assert.equal(excelDateToIso("46177.488703703704"), "2026-06-04");
  assert.equal(excelDateToIso(" May 30, 2026"), "2026-05-30");
});

test("OpsReport scheduled labor counts front desk supervisor with Front Desk and labels Bistro managers correctly", () => {
  const crossTrainedFrontDeskEmployee = {
    displayName: "Avalon Fletcher",
    department: "Front Desk",
    position: "Front Desk Supervisor",
    rolesJson: ["FD AM", "FD PM", "Night Audit", "Bistro Attendant"],
    isDepartmentManager: true,
  };
  const attendantBucket = opsLaborBucketForSchedule(
    crossTrainedFrontDeskEmployee,
    { roleWorked: "Bistro Attendant", shiftDate: "2026-07-04" },
    { label: "Bistro Attendant", departmentHint: "Bistro" },
  );
  assert.deepEqual(attendantBucket, {
    department: "FRONT DESK / NIGHT AUDIT HOURS",
    label: "Front Desk Supervisor (Avalon Fletcher)",
  });

  const managerBucket = opsLaborBucketForSchedule(
    { displayName: "Michael Pracht", department: "Bistro", position: "Bistro Manager", rolesJson: ["Bistro Manager"], isDepartmentManager: true },
    { roleWorked: "Manager Coverage", shiftDate: "2026-07-04" },
    { label: "MOD", departmentHint: "Managers" },
  );
  assert.deepEqual(managerBucket, {
    department: "BREAKFAST / BISTRO HOURS",
    label: "Bistro Manager",
  });
});

test("OpsReport Front Desk and Night Audit hover labels stay aggregated", () => {
  assert.equal(
    opsLaborBreakdownLabelForSchedule({ department: "FRONT DESK / NIGHT AUDIT HOURS", label: "Front Desk" }),
    "Front Desk",
  );
  assert.equal(
    opsLaborBreakdownLabelForSchedule({ department: "FRONT DESK / NIGHT AUDIT HOURS", label: "Night Audit" }),
    "Night Audit",
  );
});

test("OpsReport wage estimates produce hourly-only and with-salary blended rates", () => {
  const estimates = emptyLaborWageEstimates();
  addLaborWageEstimate(estimates, "OTHER", 40, 30, false);
  addLaborWageEstimate(estimates, "OTHER", 45, 35, true);
  addLaborWageEstimate(estimates, "FRONT DESK / NIGHT AUDIT HOURS", 16, 22, false);

  const finalized = finalizeLaborWageEstimates(estimates);
  assert.equal(finalized.OTHER.scheduledHourlyHours, 40);
  assert.equal(finalized.OTHER.scheduledWages, 1200);
  assert.equal(finalized.OTHER.scheduledHours, 85);
  assert.equal(finalized.OTHER.scheduledWagesIncludingSalary, 2600);
  assert.equal(finalized.OTHER.blendedHourlyRate, 30);
  assert.equal(finalized.OTHER.blendedRateIncludingSalary, 30.59);
  assert.equal(finalized["FRONT DESK / NIGHT AUDIT HOURS"].blendedHourlyRate, 22);
});

test("OpsReport actual labor excludes GM DOS and Other while counting front desk supervisor with Front Desk", () => {
  const parsed = parseLaborSummaryText([
    "Department(Management) ~ Position(General Manager) Totals",
    "Total Earnings 40.00",
    "Department(Sales) ~ Position(Director of Sales) Totals",
    "Total Earnings 32.00",
    "Department(Front Desk) ~ Position(Front Desk Supervisor) Totals",
    "Total Earnings 38.00",
    "Department(Front Desk) ~ Position(Front Desk Agent) Totals",
    "Total Earnings 80.00",
    "Department(Admin) ~ Position(Other) Totals",
    "Total Earnings 12.00",
    "Grand Totals",
  ].join("\n"));

  assert.equal("OTHER" in parsed.departments, false);
  assert.equal(parsed.departments["FRONT DESK / NIGHT AUDIT HOURS"], 118);
  assert.equal(Object.values(parsed.departments).reduce((sum, hours) => sum + hours, 0), 118);
});

test("OTB reports are classified by selected and next report month", async () => {
  const header = "Date,Rms Active,Rms Available,Rms Sold,Group PU,Group UnPU,Occ %,Guests (A/C),Arr,Dept,OOO,OTM,Hold,ADR Occupied ($),ADR Sold ($),RevPAR ($),Rm Rev ($)";
  const june = await parseOpsReportFile(csvFile("June Month OTB.csv", `${header}\n\"Jun 01, 2026\",118,64,49,10,0,43.4,77/0,25,19,5,0,0,98.02,98.02,40.70,4802.77\nTOTAL,118,118,49,10,0,Avg: 43.4,77/0,25,19,5,0,0,98.02,98.02,40.70,4802.77`), context);
  const july = await parseOpsReportFile(csvFile("06092026_July OTB.csv", `${header}\n\"Jul 01, 2026\",118,98,19,0,11,16.2,11/0,3,0,1,0,0,93.32,93.32,15.03,1773.06\nTOTAL,118,118,19,0,11,Avg: 16.2,11/0,3,0,1,0,0,93.32,93.32,15.03,1773.06`), context);
  assert.equal(june.reportType, "current_month_otb");
  assert.equal(july.reportType, "next_month_otb");
  assert.equal((june.mapping.total as any).roomsSold, 49);
  assert.equal((july.mapping.total as any).roomRevenue, 1773.06);
});

test("OTB uploaded from Weekly Performance maps to previous-week totals instead of Current Month", async () => {
  const header = "Date,Rms Active,Rms Available,Rms Sold,Group PU,Group UnPU,Occ %,Guests (A/C),Arr,Dept,OOO,OTM,Hold,ADR Occupied ($),ADR Sold ($),RevPAR ($),Rm Rev ($)";
  const report = await parseOpsReportFile(csvFile("OTB-export.csv", [
    header,
    '"Jun 01, 2026",118,118,40,0,0,33.9,40/0,8,8,0,0,0,100,100,33.9,4000',
    '"Jun 02, 2026",118,118,50,0,0,42.4,50/0,10,10,0,0,0,110,110,46.6,5500',
    "TOTAL,236,236,90,0,0,Avg: 38.1,90/0,18,18,0,0,0,105.56,105.56,40.25,9500",
  ].join("\n")), { ...context, importTarget: "weekly_performance" });

  assert.equal(report.reportType, "previous_week_otb");
  assert.equal((report.mapping.total as any).roomsSold, 90);
  assert.equal((report.mapping.total as any).roomRevenue, 9500);

  const pageSource = readFileSync("client/src/pages/ops-report.tsx", "utf8");
  assert.match(pageSource, /report\.reportType === "previous_week_otb"[\s\S]*?\? "previous_week_otb"[\s\S]*?mapping\.total && mappingMonth === reportMonth/);
  assert.match(pageSource, /form\.append\("importTarget", opsImportTarget\(sourceLabel\)\)/);
});

test("Guest Satisfaction upload target sends a generically named score export to the GSS parser", async () => {
  const report = await parseOpsReportFile(csvFile("export.xlsx.csv", [
    "Metric,Jun,Total,Benchmark,Difference",
    "Intent to Recommend Property,75,72,70,2",
    "Cleanliness,80,78,74,4",
  ].join("\n")), { ...context, importTarget: "guest_satisfaction" });

  assert.equal(report.reportType, "gss_scores");
  assert.equal((report.mapping.gssRows as any[]).find((row) => row.label === "ITR")?.hotel, "75");
  assert.equal((report.mapping.gssRows as any[]).find((row) => row.label === "Cleanliness")?.brand, "74");
});

test("Remaining Month OTB is kept separate from the full current-month report", async () => {
  const header = "Date,Rms Active,Rms Available,Rms Sold,Group PU,Group UnPU,Occ %,Guests (A/C),Arr,Dept,OOO,OTM,Hold,ADR Occupied ($),ADR Sold ($),RevPAR ($),Rm Rev ($)";
  const report = await parseOpsReportFile(csvFile("06092026_Remaining Month OTB.csv", `${header}\n" Jun 09, 2026",118,63,53,10,0,45.7,77/3,20,5,2,0,0,102.14,102.14,45.88,5413.45\n" Jun 30, 2026",118,112,5,0,0,4.27,8/0,1,11,1,0,0,107.93,107.93,4.57,539.64\nTOTAL,236,236,58,10,0,Avg: 24.58,85/3,21,16,3,0,0,102.64,102.64,25.22,5953.09`), context);
  assert.equal(report.reportType, "remaining_month_otb");
  assert.equal((report.mapping.total as any).roomsSold, 58);
  assert.equal((report.mapping as any).dateStart, "2026-06-09");
});

test("Current Month OTB splits MTD through yesterday and remaining month from business date", async () => {
  const header = "Date,Rms Active,Rms Available,Rms Sold,Group PU,Group UnPU,Occ %,Guests (A/C),Arr,Dept,OOO,OTM,Hold,ADR Occupied ($),ADR Sold ($),RevPAR ($),Rm Rev ($)";
  const report = await parseOpsReportFile(csvFile("June Month OTB.csv", [
    header,
    "\"Jun 01, 2026\",118,118,10,0,0,8.47,10/0,2,2,0,0,0,100,100,8.47,1000",
    "\"Jun 28, 2026\",118,118,5,0,0,4.24,5/0,1,1,0,0,0,120,120,5.08,600",
    "\"Jun 29, 2026\",118,118,4,0,0,3.39,4/0,1,1,0,0,0,150,150,5.08,600",
    "\"Jun 30, 2026\",118,118,2,0,0,1.69,2/0,1,1,0,0,0,200,200,3.39,400",
    "TOTAL,472,472,21,0,0,Avg: 4.45,21/0,5,5,0,0,0,123.81,123.81,5.51,2600",
  ].join("\n")), { ...context, businessDate: "2026-06-29" });
  assert.equal(report.reportType, "current_month_otb");
  assert.equal((report.mapping as any).businessDate, "2026-06-29");
  assert.equal((report.mapping as any).mtd.dateStart, "2026-06-01");
  assert.equal((report.mapping as any).mtd.dateEnd, "2026-06-28");
  assert.equal((report.mapping as any).mtd.total.roomsSold, 15);
  assert.equal((report.mapping as any).mtd.total.roomRevenue, 1600);
  assert.equal((report.mapping as any).remainingMonth.dateStart, "2026-06-29");
  assert.equal((report.mapping as any).remainingMonth.dateEnd, "2026-06-30");
  assert.equal((report.mapping as any).remainingMonth.total.roomsSold, 6);
  assert.equal((report.mapping as any).remainingMonth.total.roomRevenue, 1000);
});

test("Detailed Flash maps MTD and YTD room revenue from transient plus group", async () => {
  const report = await parseOpsReportFile(csvFile("Detailed Flash_AUSNL.csv", [
    "GROUP,CATEGORY,TODAY/ROOMS,TODAY/GUESTS #,TODAY/RATIO,MONTH-TO-DATE/ ROOMS,MONTH-TO-DATE/GUESTS #,MONTH-TO-DATE/RATIO,YEAR-TO-DATE/ ROOMS,YEAR-TO-DATE/GUESTS #,YEAR-TO-DATE/RATIO",
    "Availability,Rooms Occupied,51,74,0.43,442,714,0.42,10423,17233,0.55",
    "Availability,Total rooms sold,51,74,0.43,442,714,0.42,10354,17088,0.55",
    "Revenue,Room Revenue Transient,4251.73,,,33779.66,,,922184.73,,",
    "Revenue,Room Revenue Group,974,,,8706,,,122839.50,,",
    "Revenue,ADR Sold,102.47,,,96.12,,,100.93,,",
  ].join("\n")), context);
  assert.equal(report.reportType, "detailed_flash");
  assert.equal((report.mapping.mtd as any).roomRevenue, 42485.66);
  assert.equal((report.mapping.ytd as any).roomRevenue, 1045024.23);
  assert.equal((report.mapping.mtd as any).occupancy, 0.42);
});

test("Marriott Responses parser accepts current export header variants and maps weekly reviews", async () => {
  const report = await parseOpsReportFile(csvFile("Marriott Responses Export.csv", [
    "Guest Name,Survey Response Date,Room No,Room Type,ITR,Guest Comments,Cleanliness,Staff,Maintenance,Elite",
    "\"Smith, John\",2026-06-01,214,KING,10,Great stay and clean room,10,10,10,9",
    "Guest Two,2026-06-03,318,QQ,6,The elevator was broken and room had odor,7,8,5,8",
  ].join("\n")), context);

  assert.equal(report.reportType, "marriott_responses");
  assert.equal((report.mapping.positiveReviews as any[]).length, 1);
  assert.equal((report.mapping.negativeReviews as any[]).length, 1);
  assert.equal((report.mapping.positiveReviews as any[])[0].source, "John S.");
  assert.match(String((report.mapping.negativeReviews as any[])[0].comment), /elevator was broken/);
});

test("Marriott Responses parser reports out-of-week comments without silently rendering blank rows", async () => {
  const report = await parseOpsReportFile(csvFile("Marriott Responses Export.csv", [
    "Guest Name,Response Date,Intent to Recommend,Overall Comment",
    "Old Guest,2026-05-20,10,Excellent stay",
  ].join("\n")), context);

  assert.equal(report.reportType, "marriott_responses");
  assert.equal((report.mapping.positiveReviews as any[]).length, 0);
  assert.match(report.warnings.join(" "), /No commented responses fell inside the selected report week/);
  assert.match(report.warnings.join(" "), /2026-05-20 to 2026-05-20/);
});

test("AR Aging warns on missing buckets and aggregates available balances", async () => {
  const report = await parseOpsReportFile(csvFile("AR Aging.csv", "Account,Current,1-30,31-60,61-90,120+,Total\nCompany A,100,20,10,5,2,137"), context);
  assert.equal(report.reportType, "ar_aging");
  assert.equal((report.mapping.summary as any).total, 137);
  assert.equal((report.mapping.summary as any).d120, 2);
});

test("OOO Rooms parser extracts table-style PDF text rows", () => {
  const parsed = parseOooText([
    "OOO Rooms",
    "Start Date: Jun 01, 2026 - End Date: Jun 07, 2026",
    "Room No Room Type Type Reason Status OOO Start Date Expected Return",
    "214 KING OOO HVAC repair VAC Jun 01, 2026 Jun 03, 2026",
    "318 QQ OUT OF ORDER Plumbing leak DIRTY 06/02/2026 06/04/2026",
  ].join("\n"));

  assert.deepEqual(parsed.reportRange, { startDate: "2026-06-01", endDate: "2026-06-07" });
  assert.equal(parsed.rooms.length, 2);
  assert.equal(parsed.rooms[0].room, "214");
  assert.equal(parsed.rooms[0].startDate, "2026-06-01");
  assert.equal(parsed.rooms[0].returnDate, "2026-06-03");
  assert.equal(parsed.rooms[1].oooType, "OUT_OF_ORDER");
  assert.equal(parsed.rooms[1].startDate, "2026-06-02");
});

test("OOO Rooms parser keeps compact hotel export rows working", () => {
  const parsed = parseOooText("start date Jun 01, 2026 || end date Jun 07, 2026 HOTEL214KINGOOOHVAC repairVACJun 01, 2026Jun 03, 2026");

  assert.equal(parsed.rooms.length, 1);
  assert.equal(parsed.rooms[0].room, "214");
  assert.equal(parsed.rooms[0].roomType, "KING");
  assert.equal(parsed.rooms[0].comment, "OOO / VAC - HVAC repair (KING)");
});

test("Next Month Data uses one MINT pacing PNG instead of the CSV OTB upload", () => {
  const pageSource = readFileSync("client/src/pages/ops-report.tsx", "utf8");
  const parserSource = readFileSync("server/opsReportParsers.ts", "utf8");

  assert.match(pageSource, /name:\s*"Next Month OTB"[\s\S]*Grand Total TY rooms[\s\S]*Pacing\.png/);
  assert.match(pageSource, /reports=\{reportGuideFor\("Next Month OTB"\)\}/);
  assert.doesNotMatch(pageSource, /reports=\{reportGuideFor\("Next Month OTB", "Next Month SDLY OTB"\)\}/);
  assert.match(parserSource, /isCurrentMonthPacing \? "current_month_sdly_otb" : "next_month_otb"/);
  assert.match(parserSource, /priorYearTotal: stlyTotal/);
});
