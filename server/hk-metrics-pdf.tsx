import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

type HkDailyRollup = {
  occupiedRooms: number;
  roomsSold: number;
  checkouts: number;
  stayovers: number;
  roomsCleaned: number;
  paidHours: number | null;
  totalDailyHours: number | null;
  productiveHours: number | null;
  mporPaid: number | null;
  hpor: number | null;
  avgMinutesPerRoom: number | null;
  hporMissingDays?: number | null;
};

type HkDailyRow = HkDailyRollup & {
  metricDate: string;
};

type HkWeeklyRow = HkDailyRollup & {
  key: string;
  weekStart: string;
  weekEnd: string;
};

type HkMonthlyRow = HkDailyRollup & {
  key: string;
  monthStart: string;
  monthEnd: string;
};

type HkAttendantRow = {
  attendantName: string;
  property: string;
  daysWorked: number;
  roomsCleaned: number;
  paidHours: number | null;
  productiveHours: number | null;
  mporPaid: number | null;
  hpor: number | null;
  avgMinutesPerRoom: number | null;
  varianceHours: number | null;
};

type HkSummary = {
  overall: HkDailyRollup & { standardHours?: number | null; varianceHours?: number | null };
  dailyEntries: HkDailyRow[];
  weeklyRollups: HkWeeklyRow[];
  monthlyRollups: HkMonthlyRow[];
  attendantRollups: HkAttendantRow[];
};

type HkPdfOptions = {
  property: string;
  startDate: string;
  endDate: string;
  summary: HkSummary;
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  summaryItem: {
    borderWidth: 1,
    borderColor: "#d4d4d4",
    padding: 6,
    minWidth: 120,
  },
  summaryLabel: {
    fontSize: 8,
    color: "#4b5563",
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: "#d4d4d4",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeader: {
    backgroundColor: "#f3f4f6",
  },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    flexGrow: 1,
    flexBasis: 0,
  },
  cellLast: {
    borderRightWidth: 0,
  },
  cellText: {
    fontSize: 8,
  },
  headerText: {
    fontSize: 8,
    fontWeight: 700,
  },
});

const formatValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "-";
  return String(value);
};

const renderTable = (headers: string[], rows: Array<(string | number | null | undefined)[]>) => (
  <View style={styles.table}>
    <View style={[styles.tableRow, styles.tableHeader]}>
      {headers.map((header, index) => (
        <View
          key={header}
          style={[styles.cell, index === headers.length - 1 ? styles.cellLast : undefined]}
        >
          <Text style={styles.headerText}>{header}</Text>
        </View>
      ))}
    </View>
    {rows.length === 0 ? (
      <View style={styles.tableRow}>
        <View style={[styles.cell, styles.cellLast]}>
          <Text style={styles.cellText}>No data</Text>
        </View>
      </View>
    ) : (
      rows.map((row, rowIndex) => (
        <View style={styles.tableRow} key={`row-${rowIndex}`}>
          {row.map((value, index) => (
            <View
              key={`cell-${rowIndex}-${index}`}
              style={[styles.cell, index === row.length - 1 ? styles.cellLast : undefined]}
            >
              <Text style={styles.cellText}>{formatValue(value)}</Text>
            </View>
          ))}
        </View>
      ))
    )}
  </View>
);

export async function renderHkMetricsPdf(options: HkPdfOptions) {
  const { property, startDate, endDate, summary } = options;

  const dailyRows = summary.dailyEntries.map((entry) => [
    entry.metricDate,
    entry.occupiedRooms,
    entry.roomsSold,
    entry.checkouts,
    entry.stayovers,
    entry.roomsCleaned,
    entry.paidHours,
    entry.totalDailyHours,
    entry.productiveHours,
    entry.mporPaid,
    entry.hpor,
    entry.avgMinutesPerRoom,
  ]);

  const weeklyRows = summary.weeklyRollups.map((entry) => [
    `${entry.key} (${entry.weekStart})`,
    entry.occupiedRooms,
    entry.roomsSold,
    entry.checkouts,
    entry.stayovers,
    entry.roomsCleaned,
    entry.paidHours,
    entry.totalDailyHours,
    entry.productiveHours,
    entry.mporPaid,
    entry.hpor,
    entry.avgMinutesPerRoom,
  ]);

  const monthlyRows = summary.monthlyRollups.map((entry) => [
    `${entry.key} (${entry.monthStart})`,
    entry.occupiedRooms,
    entry.roomsSold,
    entry.checkouts,
    entry.stayovers,
    entry.roomsCleaned,
    entry.paidHours,
    entry.totalDailyHours,
    entry.productiveHours,
    entry.mporPaid,
    entry.hpor,
    entry.avgMinutesPerRoom,
  ]);

  const attendantRows = summary.attendantRollups.map((entry) => [
    entry.attendantName,
    entry.daysWorked,
    entry.roomsCleaned,
    entry.paidHours,
    entry.productiveHours,
    entry.mporPaid,
    entry.hpor,
    entry.avgMinutesPerRoom,
    entry.varianceHours,
  ]);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>HK Metrics Report</Text>
        <Text style={styles.subtitle}>
          Property: {property || "All"} | Range: {startDate} to {endDate}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Occupied Rooms</Text>
              <Text style={styles.summaryValue}>{formatValue(summary.overall.occupiedRooms)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Rooms Sold</Text>
              <Text style={styles.summaryValue}>{formatValue(summary.overall.roomsSold)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Checkouts / Stayovers</Text>
              <Text style={styles.summaryValue}>
                {formatValue(summary.overall.checkouts)} / {formatValue(summary.overall.stayovers)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Rooms Cleaned</Text>
              <Text style={styles.summaryValue}>{formatValue(summary.overall.roomsCleaned)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Daily Hours</Text>
              <Text style={styles.summaryValue}>{formatValue(summary.overall.totalDailyHours)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Paid / Productive Hours</Text>
              <Text style={styles.summaryValue}>
                {formatValue(summary.overall.paidHours)} / {formatValue(summary.overall.productiveHours)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>MPOR Paid</Text>
              <Text style={styles.summaryValue}>{formatValue(summary.overall.mporPaid)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>HPOR</Text>
              <Text style={styles.summaryValue}>{formatValue(summary.overall.hpor)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Metrics</Text>
          {renderTable(
            ["Date", "Occ", "Sold", "CO", "SO", "Rooms", "Paid", "Daily Hrs", "Prod", "MPOR", "HPOR", "Avg Min"],
            dailyRows
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Rollups</Text>
          {renderTable(
            ["Week", "Occ", "Sold", "CO", "SO", "Rooms", "Paid", "Daily Hrs", "Prod", "MPOR", "HPOR", "Avg Min"],
            weeklyRows
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Rollups</Text>
          {renderTable(
            ["Month", "Occ", "Sold", "CO", "SO", "Rooms", "Paid", "Daily Hrs", "Prod", "MPOR", "HPOR", "Avg Min"],
            monthlyRows
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendant Rollups</Text>
          {renderTable(
            ["Attendant", "Days", "Rooms", "Paid", "Prod", "MPOR", "HPOR", "Avg Min", "Variance"],
            attendantRows
          )}
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
