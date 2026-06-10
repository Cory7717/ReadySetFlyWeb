import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type MonthlySummaryAccount = { name: string; roomNights: string };
export type OpsMonthlySummaryPayload = {
  reportMonth: string;
  presentedTo: string;
  hotelName: string;
  generalManager: string;
  issuedBy: string;
  issueDate: string;
  occupancyRate: string;
  occupancyComparison: string;
  adr: string;
  adrComparison: string;
  revpar: string;
  revparComparison: string;
  totalRevenue: string;
  totalRevenueComparison: string;
  guestSatisfaction: string;
  increasedOccupancy: string;
  enhancedGuestExperience: string;
  staffPerformance: string;
  seasonalVariability: string;
  operationalCosts: string;
  marketingStrategies: string;
  costManagement: string;
  guestEngagement: string;
  forecastComment: string;
  forecastKeyDrivers: string;
  risksAndChallenges: string;
  opportunitiesForGrowth: string;
  currentRoomNights: string;
  currentAccountRevenue: string;
  previousRoomNights: string;
  roomNightVariance: string;
  previousAccountRevenue: string;
  accountRevenueVariance: string;
  corporateAccounts: MonthlySummaryAccount[];
  groups: MonthlySummaryAccount[];
  salesNotes: string[];
};

const TEMPLATE_PATH = path.resolve("server/templates/monthly-performance-summary-template.docx");

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function replaceTextNodes(fragment: string, values: string[]) {
  let index = 0;
  return fragment.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_match, open, _value, close) => {
    const value = index < values.length ? values[index] : "";
    index += 1;
    return `${open}${xmlEscape(value)}${close}`;
  });
}

function replaceParagraph(documentXml: string, marker: string, values: string[]) {
  let replaced = false;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (replaced || !xmlText(paragraph).includes(marker)) return paragraph;
    replaced = true;
    return replaceTextNodes(paragraph, values);
  });
}

function replaceCell(cellXml: string, value: string) {
  return replaceTextNodes(cellXml, [value]);
}

function replaceTopAccountsTable(documentXml: string, payload: OpsMonthlySummaryPayload, monthName: string) {
  return documentXml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table) => {
    if (!xmlText(table).includes("TOP CORPORATE ACCOUNTS")) return table;
    const rows = table.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    const updatedRows = rows.map((row, rowIndex) => {
      const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
      if (rowIndex === 0) {
        if (cells[0]) cells[0] = replaceCell(cells[0], `TOP CORPORATE ACCOUNTS for ${monthName}`);
        if (cells[cells.length - 1]) cells[cells.length - 1] = replaceCell(cells[cells.length - 1], `TOP Groups for ${monthName}`);
      } else if (rowIndex >= 2 && rowIndex <= 11) {
        const itemIndex = rowIndex - 2;
        const corporate = payload.corporateAccounts[itemIndex] || { name: "", roomNights: "" };
        const group = payload.groups[itemIndex] || { name: "", roomNights: "" };
        const values = [String(itemIndex + 1), corporate.name, corporate.roomNights, "", String(itemIndex + 1), group.name, group.roomNights];
        cells.forEach((cell, cellIndex) => { cells[cellIndex] = replaceCell(cell, values[cellIndex] || ""); });
      } else if (rowIndex === 12) {
        const corporateTotal = payload.corporateAccounts.reduce((sum, item) => sum + Number(item.roomNights || 0), 0);
        const groupTotal = payload.groups.reduce((sum, item) => sum + Number(item.roomNights || 0), 0);
        const values = ["", "TOTAL", String(corporateTotal), "", "", "TOTAL", String(groupTotal)];
        cells.forEach((cell, cellIndex) => { cells[cellIndex] = replaceCell(cell, values[cellIndex] || ""); });
      }
      let cellIndex = 0;
      return row.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => cells[cellIndex++] || "");
    });
    let rowIndex = 0;
    return table.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, () => updatedRows[rowIndex++] || "");
  });
}

function monthName(reportMonth: string) {
  const [year, month] = reportMonth.split("-").map(Number);
  return new Date(Date.UTC(year || 2000, (month || 1) - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function displayIssueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildMonthlySummaryDocx(payload: OpsMonthlySummaryPayload) {
  const zip = new AdmZip(fs.readFileSync(TEMPLATE_PATH));
  const documentEntry = zip.getEntry("word/document.xml");
  if (!documentEntry) throw new Error("Monthly performance Word template is unavailable.");
  let xml = documentEntry.getData().toString("utf8");
  const reportMonthName = monthName(payload.reportMonth);

  const replacements: Array<[string, string[]]> = [
    ["Globiwest Hospitality - Corporate Office", [payload.presentedTo]],
    ["Hotel & General Manager Name XXX", [payload.issuedBy || `${payload.hotelName} & ${payload.generalManager}`]],
    ["February 3, 2025.", [displayIssueDate(payload.issueDate)]],
    ["Occupancy Rate:", ["Occupancy Rate:", ` ${payload.occupancyRate} (compared to ${payload.occupancyComparison})`]],
    ["Average Daily Rate (ADR):", ["Average Daily Rate (ADR):", ` ${payload.adr} (compared to ${payload.adrComparison})`]],
    ["Revenue per Available Room (RevPAR):", ["Revenue per Available Room (RevPAR):", ` ${payload.revpar} (compared to ${payload.revparComparison})`]],
    ["Total Revenue:", ["Total Revenue:", ` ${payload.totalRevenue} (compared to ${payload.totalRevenueComparison})`]],
    ["Guest Satisfaction Score:", ["Guest Satisfaction Score:", ` ${payload.guestSatisfaction}`]],
    ["Increased Occupancy:", ["Increased Occupancy:", ` ${payload.increasedOccupancy}`]],
    ["Enhanced Guest Experience:", ["Enhanced Guest Experience:", ` ${payload.enhancedGuestExperience}`]],
    ["Staff Performance:", ["Staff Performance:", ` ${payload.staffPerformance}`]],
    ["Seasonal Variability:", ["Seasonal Variability:", ` ${payload.seasonalVariability}`]],
    ["Operational Costs:", ["Operational Costs:", ` ${payload.operationalCosts}`]],
    ["Marketing Strategies:", ["Marketing Strategies:", ` ${payload.marketingStrategies}`]],
    ["Cost Management:", ["Cost Management:", ` ${payload.costManagement}`]],
    ["Guest Engagement:", ["Guest Engagement:", ` ${payload.guestEngagement}`]],
    ["Three-month Forecast comment:", [`Three-month Forecast comment: ${payload.forecastComment}`]],
    ["Identify the key factors", [payload.forecastKeyDrivers]],
    ["Discuss any potential risks", [payload.risksAndChallenges]],
    ["Highlight potential opportunities", [payload.opportunitiesForGrowth]],
    ["134 (Room Night)", [`${payload.currentRoomNights} (Room Nights), Total Revenue $ ${payload.currentAccountRevenue}`]],
    ["Last month vs. Current week", [`Last month vs. Current month ${payload.previousRoomNights} (Room Nights) / ${payload.currentRoomNights} (Room Nights) = ${payload.roomNightVariance} RN`]],
    ["Total Revenue Last week vs. Current week", [`Total Revenue Last month vs. Current month $ ${payload.previousAccountRevenue} / $ ${payload.currentAccountRevenue} = $ ${payload.accountRevenueVariance}`]],
    ["TOP ACCOUNTS FOR THE Month", [`TOP ACCOUNTS FOR ${reportMonthName.toUpperCase()}`]],
  ];
  for (const [marker, values] of replacements) xml = replaceParagraph(xml, marker, values);
  const noteMarkers = [
    "ODC Wedding confirmed",
    "Proposal sent for 56 pax",
    "Proposal sent for Delta",
    "Proposal sent to Fulcrum",
  ];
  noteMarkers.forEach((marker, index) => { xml = replaceParagraph(xml, marker, [payload.salesNotes[index] || ""]); });
  xml = replaceTopAccountsTable(xml, payload, reportMonthName);
  zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of String(text || "").split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line || " ");
  }
  return lines;
}

export async function buildMonthlySummaryPdf(payload: OpsMonthlySummaryPayload) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 72;
  const contentWidth = pageSize[0] - margin * 2;
  const black = rgb(0, 0, 0);
  const border = rgb(0.55, 0.55, 0.55);
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = 744;
  };
  const ensure = (height: number) => {
    if (y - height < 54) newPage();
  };
  const line = (text: string, size = 11, isBold = false, indent = 0, gap = 15) => {
    const font = isBold ? bold : regular;
    const lines = wrapText(text, font, size, contentWidth - indent);
    ensure(lines.length * gap + 4);
    for (const item of lines) {
      page.drawText(item, { x: margin + indent, y, size, font, color: black });
      y -= gap;
    }
  };
  const labeled = (label: string, value: string) => {
    const labelWidth = bold.widthOfTextAtSize(label, 11);
    const lines = wrapText(value, regular, 11, contentWidth - labelWidth - 4);
    ensure(Math.max(1, lines.length) * 15 + 2);
    page.drawText(label, { x: margin, y, size: 11, font: bold });
    page.drawText(lines[0] || "", { x: margin + labelWidth + 4, y, size: 11, font: regular });
    y -= 15;
    for (const item of lines.slice(1)) {
      page.drawText(item, { x: margin, y, size: 11, font: regular });
      y -= 15;
    }
  };
  const heading = (text: string) => {
    y -= 5;
    line(text, 13, true, 0, 18);
  };

  newPage();
  line("Monthly Performance Review", 18, true, 0, 24);
  const metaRows = [
    ["Presented to:", payload.presentedTo],
    ["Issued by:", payload.issuedBy || `${payload.hotelName} & ${payload.generalManager}`],
    ["Date:", displayIssueDate(payload.issueDate)],
  ];
  for (const [label, value] of metaRows) {
    page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 22, borderColor: border, borderWidth: 0.7 });
    page.drawLine({ start: { x: margin + 118, y: y + 2 }, end: { x: margin + 118, y: y - 20 }, thickness: 0.7, color: border });
    page.drawText(label, { x: margin + 6, y: y - 13, size: 10, font: bold });
    page.drawText(value || "", { x: margin + 124, y: y - 13, size: 10, font: regular });
    y -= 22;
  }
  y -= 12;
  heading("Key Performance Indicators (KPIs)");
  labeled("Occupancy Rate:", `${payload.occupancyRate} (compared to ${payload.occupancyComparison})`);
  labeled("Average Daily Rate (ADR):", `${payload.adr} (compared to ${payload.adrComparison})`);
  labeled("Revenue per Available Room (RevPAR):", `${payload.revpar} (compared to ${payload.revparComparison})`);
  labeled("Total Revenue:", `${payload.totalRevenue} (compared to ${payload.totalRevenueComparison})`);
  labeled("Guest Satisfaction Score:", payload.guestSatisfaction);
  heading("Highlights");
  labeled("Increased Occupancy:", payload.increasedOccupancy);
  labeled("Enhanced Guest Experience:", payload.enhancedGuestExperience);
  labeled("Staff Performance:", payload.staffPerformance);
  heading("Challenges");
  labeled("Seasonal Variability:", payload.seasonalVariability);
  labeled("Operational Costs:", payload.operationalCosts);
  heading("Recommendations");
  labeled("Marketing Strategies:", payload.marketingStrategies);
  labeled("Cost Management:", payload.costManagement);
  labeled("Guest Engagement:", payload.guestEngagement);
  heading(`Three-month Forecast comment: ${payload.forecastComment}`);
  line("Forecast: Key Drivers:", 11, true);
  line(payload.forecastKeyDrivers);
  line("Risks and Challenges:", 11, true);
  line(payload.risksAndChallenges);
  line("Opportunities for Growth:", 11, true);
  line(payload.opportunitiesForGrowth);
  heading("Top Corporate Accounts and Groups:");
  line(`${payload.currentRoomNights} (Room Nights), Total Revenue $ ${payload.currentAccountRevenue}`, 11, false, 18);
  line(`Last month vs. Current month ${payload.previousRoomNights} (Room Nights) / ${payload.currentRoomNights} (Room Nights) = ${payload.roomNightVariance} RN`, 11, false, 18);
  line(`Total Revenue Last month vs. Current month $ ${payload.previousAccountRevenue} / $ ${payload.currentAccountRevenue} = $ ${payload.accountRevenueVariance}`, 11, false, 18);

  newPage();
  const reportMonthName = monthName(payload.reportMonth);
  line(`TOP ACCOUNTS FOR ${reportMonthName.toUpperCase()}`, 13, true, 0, 22);
  const tableX = margin;
  const widths = [24, 150, 42, 24, 150, 42];
  const headers = ["", `TOP CORPORATE ACCOUNTS for ${reportMonthName}`, "RMNTS", "", `TOP Groups for ${reportMonthName}`, "RMNTS"];
  const drawTableRow = (values: string[], height: number, header = false) => {
    let x = tableX;
    values.forEach((value, index) => {
      page.drawRectangle({ x, y: y - height, width: widths[index], height, borderColor: black, borderWidth: 0.7 });
      const font = header ? bold : regular;
      const lines = wrapText(value, font, header ? 8 : 9, widths[index] - 6).slice(0, 2);
      lines.forEach((item, lineIndex) => page.drawText(item, { x: x + 3, y: y - 12 - lineIndex * 10, size: header ? 8 : 9, font }));
      x += widths[index];
    });
    y -= height;
  };
  drawTableRow(headers, 34, true);
  for (let index = 0; index < 10; index += 1) {
    const corporate = payload.corporateAccounts[index] || { name: "", roomNights: "" };
    const group = payload.groups[index] || { name: "", roomNights: "" };
    drawTableRow([String(index + 1), corporate.name, corporate.roomNights, String(index + 1), group.name, group.roomNights], 28);
  }
  const corporateTotal = payload.corporateAccounts.reduce((sum, item) => sum + Number(item.roomNights || 0), 0);
  const groupTotal = payload.groups.reduce((sum, item) => sum + Number(item.roomNights || 0), 0);
  drawTableRow(["", "TOTAL", String(corporateTotal), "", "TOTAL", String(groupTotal)], 24, true);
  y -= 18;
  for (const note of payload.salesNotes.filter(Boolean)) line(`• ${note}`, 11, false, 0, 16);
  return Buffer.from(await pdf.save());
}
