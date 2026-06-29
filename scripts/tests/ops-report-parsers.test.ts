import assert from "node:assert/strict";
import test from "node:test";
import { excelDateToIso, parseOpsReportFile } from "../../server/opsReportParsers";
import { opsLaborBreakdownLabelForSchedule, opsLaborBucketForSchedule } from "../../server/routes/opsReport";

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

test("OpsReport scheduled labor buckets Bistro worked shifts before employee profile fallback", () => {
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
    department: "BREAKFAST / BISTRO HOURS",
    label: "Bistro Attendant",
  });

  const managerBucket = opsLaborBucketForSchedule(
    { displayName: "Michael Pracht", department: "Bistro", position: "Bistro Manager", rolesJson: ["Bistro Manager"], isDepartmentManager: true },
    { roleWorked: "Bistro Manager", shiftDate: "2026-07-04" },
    { label: "Bistro Manager", departmentHint: "Bistro" },
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

test("OTB reports are classified by selected and next report month", async () => {
  const header = "Date,Rms Active,Rms Available,Rms Sold,Group PU,Group UnPU,Occ %,Guests (A/C),Arr,Dept,OOO,OTM,Hold,ADR Occupied ($),ADR Sold ($),RevPAR ($),Rm Rev ($)";
  const june = await parseOpsReportFile(csvFile("June Month OTB.csv", `${header}\n\"Jun 01, 2026\",118,64,49,10,0,43.4,77/0,25,19,5,0,0,98.02,98.02,40.70,4802.77\nTOTAL,118,118,49,10,0,Avg: 43.4,77/0,25,19,5,0,0,98.02,98.02,40.70,4802.77`), context);
  const july = await parseOpsReportFile(csvFile("06092026_July OTB.csv", `${header}\n\"Jul 01, 2026\",118,98,19,0,11,16.2,11/0,3,0,1,0,0,93.32,93.32,15.03,1773.06\nTOTAL,118,118,19,0,11,Avg: 16.2,11/0,3,0,1,0,0,93.32,93.32,15.03,1773.06`), context);
  assert.equal(june.reportType, "current_month_otb");
  assert.equal(july.reportType, "next_month_otb");
  assert.equal((june.mapping.total as any).roomsSold, 49);
  assert.equal((july.mapping.total as any).roomRevenue, 1773.06);
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

test("AR Aging warns on missing buckets and aggregates available balances", async () => {
  const report = await parseOpsReportFile(csvFile("AR Aging.csv", "Account,Current,1-30,31-60,61-90,120+,Total\nCompany A,100,20,10,5,2,137"), context);
  assert.equal(report.reportType, "ar_aging");
  assert.equal((report.mapping.summary as any).total, 137);
  assert.equal((report.mapping.summary as any).d120, 2);
});
