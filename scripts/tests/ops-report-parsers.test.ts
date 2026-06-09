import assert from "node:assert/strict";
import test from "node:test";
import { excelDateToIso, parseOpsReportFile } from "../../server/opsReportParsers";

const context = { weekStart: "2026-05-30", weekEnd: "2026-06-05", reportMonth: "2026-06" };

function csvFile(originalname: string, body: string) {
  return {
    originalname,
    mimetype: "text/csv",
    buffer: Buffer.from(body),
  } as Express.Multer.File;
}

test("Excel serial dates normalize without time-zone drift", () => {
  assert.equal(excelDateToIso("46177.488703703704"), "2026-06-04");
  assert.equal(excelDateToIso(" May 30, 2026"), "2026-05-30");
});

test("OTB reports are classified by selected and next report month", async () => {
  const header = "Date,Rms Active,Rms Available,Rms Sold,Group PU,Group UnPU,Occ %,Guests (A/C),Arr,Dept,OOO,OTM,Hold,ADR Occupied ($),ADR Sold ($),RevPAR ($),Rm Rev ($)";
  const june = await parseOpsReportFile(csvFile("June Month OTB.csv", `${header}\n\"Jun 01, 2026\",118,64,49,10,0,43.4,77/0,25,19,5,0,0,98.02,98.02,40.70,4802.77\nTOTAL,118,118,49,10,0,Avg: 43.4,77/0,25,19,5,0,0,98.02,98.02,40.70,4802.77`), context);
  const july = await parseOpsReportFile(csvFile("July Month OTB.csv", `${header}\n\"Jul 01, 2026\",118,98,19,0,11,16.2,11/0,3,0,1,0,0,93.32,93.32,15.03,1773.06\nTOTAL,118,118,19,0,11,Avg: 16.2,11/0,3,0,1,0,0,93.32,93.32,15.03,1773.06`), context);
  assert.equal(june.reportType, "current_month_otb");
  assert.equal(july.reportType, "next_month_otb");
  assert.equal((june.mapping.total as any).roomsSold, 49);
  assert.equal((july.mapping.total as any).roomRevenue, 1773.06);
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

test("AR Aging warns on missing buckets and aggregates available balances", async () => {
  const report = await parseOpsReportFile(csvFile("AR Aging.csv", "Account,Current,1-30,31-60,61-90,120+,Total\nCompany A,100,20,10,5,2,137"), context);
  assert.equal(report.reportType, "ar_aging");
  assert.equal((report.mapping.summary as any).total, 137);
  assert.equal((report.mapping.summary as any).d120, 2);
});
