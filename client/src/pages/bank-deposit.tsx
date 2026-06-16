import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Banknote, CalendarDays, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const C = {
  page: "min-h-screen bg-[#f5efe7] text-[#201814]",
  shell: "!border-[#ddccb5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(74,54,34,0.10)]",
  muted: "!text-[#5f5247]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  menu: "!border-[#cdbda8] !bg-white !text-[#201814]",
};

type DepositRow = {
  system: string;
  cash: string;
  check: string;
};

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 6 + index, 1);
    const value = monthKey(date);
    const label = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return { value, label };
  });
}

function daysInMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function formatDay(key: string, day: number) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function money(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number.isFinite(value) ? value : 0);
}

function parseMoney(value: string) {
  const numeric = Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function storageKey(key: string) {
  return `courtyard-bank-deposit:${key}`;
}

export default function BankDepositPage() {
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [rows, setRows] = useState<Record<number, DepositRow>>({});
  const options = useMemo(monthOptions, []);
  const dayCount = daysInMonth(selectedMonth);
  const monthLabel = options.find((option) => option.value === selectedMonth)?.label || selectedMonth;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(selectedMonth));
      setRows(stored ? JSON.parse(stored) : {});
    } catch {
      setRows({});
    }
  }, [selectedMonth]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(selectedMonth), JSON.stringify(rows));
  }, [rows, selectedMonth]);

  const totals = useMemo(() => {
    return Array.from({ length: dayCount }, (_, index) => index + 1).reduce(
      (sum, day) => {
        const row = rows[day] || { system: "", cash: "", check: "" };
        const system = parseMoney(row.system);
        const cash = parseMoney(row.cash);
        const check = parseMoney(row.check);
        const total = cash + check;
        return {
          system: sum.system + system,
          cash: sum.cash + cash,
          check: sum.check + check,
          total: sum.total + total,
          variance: sum.variance + (total - system),
        };
      },
      { system: 0, cash: 0, check: 0, total: 0, variance: 0 },
    );
  }, [dayCount, rows]);

  const updateRow = (day: number, field: keyof DepositRow, value: string) => {
    setRows((current) => ({
      ...current,
      [day]: {
        system: current[day]?.system || "",
        cash: current[day]?.cash || "",
        check: current[day]?.check || "",
        [field]: value,
      },
    }));
  };

  return (
    <div className={C.page}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              <Banknote className="h-7 w-7 text-[#2f5f46]" />
              Bank Deposit Drops
            </h1>
          </div>
          <Button asChild variant="outline" className={C.outline}>
            <Link href="/courtyard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Courtyard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Card className={C.shell}>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Daily Drop Count</CardTitle>
                <CardDescription className={C.muted}>
                  Select a month and enter the system amount, cash drop, check drop, and review the total variance by day.
                </CardDescription>
              </div>
              <div className="w-full md:w-64">
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className={C.field}>
                    <CalendarDays className="mr-2 h-4 w-4 text-[#8a6b3f]" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={C.menu}>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[#e0d3c1] bg-white p-4">
                <div className="text-sm text-[#5f5247]">System total</div>
                <div className="mt-1 text-2xl font-semibold">{money(totals.system)}</div>
              </div>
              <div className="rounded-lg border border-[#bdd5c3] bg-[#e8f1ea] p-4">
                <div className="text-sm text-[#315842]">Deposit total</div>
                <div className="mt-1 text-2xl font-semibold text-[#173c2a]">{money(totals.total)}</div>
              </div>
              <div className={`rounded-lg border p-4 ${totals.variance === 0 ? "border-[#e0d3c1] bg-white" : totals.variance > 0 ? "border-[#bdd5c3] bg-[#e8f1ea]" : "border-[#e4b6bd] bg-[#fae8ea]"}`}>
                <div className="text-sm text-[#5f5247]">Variance total</div>
                <div className={`mt-1 text-2xl font-semibold ${totals.variance < 0 ? "text-[#9f1239]" : "text-[#173c2a]"}`}>{money(totals.variance)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-[#d6c8b5] bg-[#fbf6ee] px-3 py-2 text-sm text-[#5f5247]">
              <Save className="h-4 w-4 text-[#2f5f46]" />
              Entries for {monthLabel} autosave on this device.
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#d6c8b5]">
              <table className="w-full min-w-[720px] border-collapse bg-white text-sm">
                <thead>
                  <tr className="bg-[#243847] text-white">
                    <th className="w-[180px] border border-[#d6c8b5] px-3 py-3 text-left">Day</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">System</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Cash</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Check</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Total</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: dayCount }, (_, index) => {
                    const day = index + 1;
                    const row = rows[day] || { system: "", cash: "", check: "" };
                    const total = parseMoney(row.cash) + parseMoney(row.check);
                    const variance = total - parseMoney(row.system);
                    return (
                      <tr key={day} className={day % 2 === 0 ? "bg-[#fbf6ee]" : "bg-white"}>
                        <td className="border border-[#d6c8b5] px-3 py-2 font-semibold">{formatDay(selectedMonth, day)}</td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <Input className={C.field} inputMode="decimal" value={row.system} onChange={(event) => updateRow(day, "system", event.target.value)} placeholder="$0.00" />
                        </td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <Input className={C.field} inputMode="decimal" value={row.cash} onChange={(event) => updateRow(day, "cash", event.target.value)} placeholder="$0.00" />
                        </td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <Input className={C.field} inputMode="decimal" value={row.check} onChange={(event) => updateRow(day, "check", event.target.value)} placeholder="$0.00" />
                        </td>
                        <td className="border border-[#d6c8b5] px-3 py-2 font-semibold">
                          {money(total)}
                        </td>
                        <td className={`border border-[#d6c8b5] px-3 py-2 font-semibold ${variance < 0 ? "text-[#9f1239]" : variance > 0 ? "text-[#166534]" : "text-[#201814]"}`}>
                          {money(variance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#e8f1ea] font-semibold text-[#173c2a]">
                    <td className="border border-[#d6c8b5] px-3 py-3">Monthly total</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.system)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.cash)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.check)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.total)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.variance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
