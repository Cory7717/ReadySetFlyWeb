export type BenchmarkFormat = "currency" | "rooms" | "percent";

export function formatBenchmarkValue(value: unknown, format: BenchmarkFormat): string {
  if (value == null || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (format === "currency") return number.toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (format === "percent") return number.toLocaleString("en-US", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return number.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function editableBenchmarkValue(value: unknown, format: BenchmarkFormat): string {
  if (value == null || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (format === "currency") return number.toFixed(2);
  if (format === "percent") return (number * 100).toFixed(2);
  return String(number);
}

// Occupancy is shown as a percentage but remains a decimal in API payloads.
export function parseBenchmarkValue(input: string, format: BenchmarkFormat): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/[$,%\s]/g, "");
  if (!(format === "rooms" ? /^\d+$/.test(normalized) : /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || (format === "percent" && number > 100)) return null;
  return format === "percent" ? String(number / 100) : String(number);
}

export function budgetVsPriorYearPercent(budget: unknown, priorYearActual: unknown): number | null {
  if (budget == null || budget === "" || priorYearActual == null || priorYearActual === "") return null;
  const budgetValue = Number(budget);
  const priorValue = Number(priorYearActual);
  if (!Number.isFinite(budgetValue) || !Number.isFinite(priorValue) || priorValue <= 0) return null;
  return (budgetValue - priorValue) / priorValue * 100;
}

export function formatBudgetVsPriorYearVariance(budget: unknown, priorYearActual: unknown): string {
  const percent = budgetVsPriorYearPercent(budget, priorYearActual);
  if (percent == null) return "—";
  return `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
}
