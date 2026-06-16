import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Banknote, CalendarDays, FileImage, Info, KeyRound, Save, Upload, X } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  frontDeskCash: string;
  bistroCash: string;
  check: string;
  checkDetails?: {
    companyGuest: string;
    checkNumber: string;
    checkDate: string;
  };
  receipt?: {
    name: string;
    type: string;
    dataUrl: string;
    uploadedAt: string;
  };
  trialBalanceReport?: SourceReport;
  microsReport?: SourceReport;
  mappingNotes?: string[];
};

type SourceReport = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
  parsedAmount?: string;
  parsedDate?: string;
};

type SharedPinStatus = {
  unlocked: boolean;
  hasPin: boolean;
  requiresLogin?: boolean;
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

function moneyInput(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

function storageKey(key: string) {
  return `courtyard-bank-deposit:${key}`;
}

function emptyRow(): DepositRow {
  return { system: "", frontDeskCash: "", bistroCash: "", check: "" };
}

function checkDetailsSummary(row?: DepositRow) {
  const details = row?.checkDetails;
  if (!details || ![details.companyGuest, details.checkNumber, details.checkDate].some(Boolean)) return "";
  return [
    details.companyGuest ? `Name: ${details.companyGuest}` : "",
    details.checkNumber ? `Check #: ${details.checkNumber}` : "",
    details.checkDate ? `Date: ${details.checkDate}` : "",
  ].filter(Boolean).join(" | ");
}

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayFromDateKey(selectedMonth: string, dateKey: string) {
  if (!dateKey.startsWith(`${selectedMonth}-`)) return null;
  const day = Number(dateKey.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= daysInMonth(selectedMonth) ? day : null;
}

function detectDateKey(text: string, fallbackName = "") {
  const source = `${text || ""} ${fallbackName || ""}`;
  const numeric = source.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2}|\d{2})\b/);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return localDateKey(new Date(year, month - 1, day));
  }
  const compact = source.match(/\b(20\d{2})(\d{2})(\d{2})\b|\b(\d{2})(\d{2})(20\d{2})\b/);
  if (compact) {
    if (compact[1]) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    return `${compact[6]}-${compact[4]}-${compact[5]}`;
  }
  return "";
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseMoneyCandidate(value: string) {
  if (!/[0-9]/.test(value || "")) return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseTrialBalanceCsv(text: string, selectedMonth: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { results: [] as Array<{ day: number; amount: number }>, notes: ["Trial Balance CSV was empty."] };
  const rows = lines.map(splitCsvLine);
  const header = rows[0].map((cell) => cell.toLowerCase());
  const dateIndex = header.findIndex((cell) => /date|business/.test(cell));
  const amountIndex = header.findIndex((cell) => /front.*desk.*cash|cash.*front.*desk|fd.*cash|cash/.test(cell));
  const results: Array<{ day: number; amount: number }> = [];
  const notes: string[] = [];

  rows.slice(dateIndex >= 0 || amountIndex >= 0 ? 1 : 0).forEach((cells) => {
    const rowText = cells.join(" ");
    const dateKey = dateIndex >= 0 ? detectDateKey(cells[dateIndex] || "") : detectDateKey(rowText);
    const day = dateKey ? dayFromDateKey(selectedMonth, dateKey) : null;
    if (!day) return;
    const amount = amountIndex >= 0 ? parseMoneyCandidate(cells[amountIndex] || "") : cells.map(parseMoneyCandidate).filter((value): value is number => value !== null).at(-1);
    if (amount == null) return;
    results.push({ day, amount });
  });

  if (!results.length) notes.push("Could not confidently map Front Desk cash from the Trial Balance CSV. Check the report columns or enter the amount manually.");
  return { results, notes };
}

function parseMicrosCash(text: string, fileName: string, selectedMonth: string) {
  const dateKey = detectDateKey(text, fileName);
  const day = dateKey ? dayFromDateKey(selectedMonth, dateKey) : null;
  const normalized = text.replace(/\s+/g, " ");
  const cashMatch = normalized.match(/(?:cash|cash\s+tender|cash\s+payments?)[^0-9$-]{0,40}\$?\s*(-?\d[\d,]*\.?\d{0,2})/i);
  const amount = cashMatch ? parseMoneyCandidate(cashMatch[1]) : null;
  const notes: string[] = [];
  if (!day) notes.push("Could not find a report date in the Micros PDF or filename.");
  if (amount == null) notes.push("Could not confidently find Bistro cash in the Micros PDF. Enter the amount manually if needed.");
  return { day, amount, notes, dateKey };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function normalizeStoredRows(value: unknown) {
  const rawRows = (value && typeof value === "object" ? value : {}) as Record<string, any>;
  return Object.fromEntries(Object.entries(rawRows).map(([day, row]) => [
    Number(day),
    {
      ...emptyRow(),
      ...row,
      frontDeskCash: row.frontDeskCash ?? row.cash ?? "",
      bistroCash: row.bistroCash ?? "",
      check: row.check ?? "",
      system: row.system ?? "",
    } as DepositRow,
  ]));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function BankDepositPinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const login = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tips/shared-pin/login", { pin }),
    onSuccess: () => {
      toast({ title: "Bank deposits unlocked" });
      onUnlocked();
    },
    onError: (error: Error) => toast({ title: "Unable to unlock", description: error.message, variant: "destructive" }),
  });
  return (
    <div className={C.page}>
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <CardTitle>Enter team PIN</CardTitle>
            <CardDescription className={C.muted}>Use the same 5 digit PIN used for Tips to open the bank deposit log.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              className={`${C.field} h-14 text-center text-2xl tracking-[0.35em]`}
              inputMode="numeric"
              maxLength={5}
              placeholder="00000"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && pin.length === 5) login.mutate();
              }}
            />
            <Button className={`w-full ${C.green}`} disabled={pin.length !== 5 || login.isPending} onClick={() => login.mutate()}>
              <KeyRound className="mr-2 h-4 w-4" />
              {login.isPending ? "Checking PIN..." : "Open bank deposits"}
            </Button>
            <Button asChild variant="outline" className={`w-full ${C.outline}`}>
              <Link href="/courtyard">Back to Courtyard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function BankDepositPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [rows, setRows] = useState<Record<number, DepositRow>>({});
  const [checkDetailsDay, setCheckDetailsDay] = useState<number | null>(null);
  const [viewReceiptDay, setViewReceiptDay] = useState<number | null>(null);
  const [viewSource, setViewSource] = useState<{ day: number; kind: "trialBalanceReport" | "microsReport" } | null>(null);
  const options = useMemo(monthOptions, []);
  const dayCount = daysInMonth(selectedMonth);
  const monthLabel = options.find((option) => option.value === selectedMonth)?.label || selectedMonth;
  const selectedCheckRow = checkDetailsDay ? rows[checkDetailsDay] || emptyRow() : null;
  const selectedReceipt = viewReceiptDay ? rows[viewReceiptDay]?.receipt : null;
  const selectedSource = viewSource ? rows[viewSource.day]?.[viewSource.kind] : null;
  const pinStatus = useQuery<SharedPinStatus>({
    queryKey: ["/api/tips/shared-pin/status"],
    queryFn: () => fetchJson("/api/tips/shared-pin/status"),
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(selectedMonth));
      setRows(stored ? normalizeStoredRows(JSON.parse(stored)) : {});
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
        const row = rows[day] || emptyRow();
        const system = parseMoney(row.system);
        const frontDeskCash = parseMoney(row.frontDeskCash);
        const bistroCash = parseMoney(row.bistroCash);
        const check = parseMoney(row.check);
        const total = frontDeskCash + bistroCash + check;
        return {
          system: sum.system + system,
          frontDeskCash: sum.frontDeskCash + frontDeskCash,
          bistroCash: sum.bistroCash + bistroCash,
          check: sum.check + check,
          total: sum.total + total,
          variance: sum.variance + (total - system),
        };
      },
      { system: 0, frontDeskCash: 0, bistroCash: 0, check: 0, total: 0, variance: 0 },
    );
  }, [dayCount, rows]);

  const updateRow = (day: number, field: keyof DepositRow, value: string) => {
    setRows((current) => ({
      ...current,
      [day]: {
        ...emptyRow(),
        ...current[day],
        system: current[day]?.system || "",
        frontDeskCash: current[day]?.frontDeskCash || "",
        bistroCash: current[day]?.bistroCash || "",
        check: current[day]?.check || "",
        [field]: value,
      },
    }));
  };

  const addMappingNote = (day: number, note: string) => {
    setRows((current) => ({
      ...current,
      [day]: {
        ...emptyRow(),
        ...current[day],
        mappingNotes: Array.from(new Set([...(current[day]?.mappingNotes || []), note])),
      },
    }));
  };

  const updateCheckDetails = (day: number, field: keyof NonNullable<DepositRow["checkDetails"]>, value: string) => {
    setRows((current) => ({
      ...current,
      [day]: {
        ...emptyRow(),
        ...current[day],
        checkDetails: {
          companyGuest: current[day]?.checkDetails?.companyGuest || "",
          checkNumber: current[day]?.checkDetails?.checkNumber || "",
          checkDate: current[day]?.checkDetails?.checkDate || "",
          [field]: value,
        },
      },
    }));
  };

  const handleReceiptUpload = (day: number, file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setRows((current) => ({
        ...current,
        [day]: {
          ...emptyRow(),
          ...current[day],
          receipt: {
            name: file.name,
            type: file.type,
            dataUrl,
            uploadedAt: new Date().toISOString(),
          },
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeReceipt = (day: number) => {
    setRows((current) => {
      const next = { ...current };
      next[day] = { ...emptyRow(), ...next[day], receipt: undefined };
      return next;
    });
  };

  const importTrialBalance = async (file?: File | null) => {
    if (!file) return;
    const [text, dataUrl] = await Promise.all([file.text(), readFileAsDataUrl(file)]);
    const parsed = parseTrialBalanceCsv(text, selectedMonth);
    const source: SourceReport = { name: file.name, type: file.type || "text/csv", dataUrl, uploadedAt: new Date().toISOString() };
    setRows((current) => {
      const next = { ...current };
      parsed.results.forEach(({ day, amount }) => {
        next[day] = {
          ...emptyRow(),
          ...next[day],
          frontDeskCash: moneyInput(amount),
          trialBalanceReport: { ...source, parsedAmount: moneyInput(amount), parsedDate: `${selectedMonth}-${String(day).padStart(2, "0")}` },
        };
      });
      return next;
    });
    if (parsed.results.length) toast({ title: "Trial Balance imported", description: `Mapped Front Desk cash for ${parsed.results.length} day(s).` });
    parsed.notes.forEach((note) => toast({ title: "Trial Balance mapping note", description: note, variant: "destructive" }));
  };

  const importMicros = async (file?: File | null) => {
    if (!file) return;
    const [text, dataUrl] = await Promise.all([file.text().catch(() => ""), readFileAsDataUrl(file)]);
    const parsed = parseMicrosCash(text, file.name, selectedMonth);
    const source: SourceReport = { name: file.name, type: file.type || "application/pdf", dataUrl, uploadedAt: new Date().toISOString(), parsedDate: parsed.dateKey || undefined, parsedAmount: parsed.amount != null ? moneyInput(parsed.amount) : undefined };
    if (parsed.day) {
      setRows((current) => ({
        ...current,
        [parsed.day!]: {
          ...emptyRow(),
          ...current[parsed.day!],
          ...(parsed.amount != null ? { bistroCash: moneyInput(parsed.amount) } : {}),
          microsReport: source,
          mappingNotes: parsed.notes.length ? Array.from(new Set([...(current[parsed.day!]?.mappingNotes || []), ...parsed.notes])) : current[parsed.day!]?.mappingNotes,
        },
      }));
      toast({ title: "Micros report imported", description: `Mapped Micros report to ${formatDay(selectedMonth, parsed.day)}${parsed.amount != null ? ` for ${money(parsed.amount)}` : ""}.` });
    } else {
      addMappingNote(1, `${file.name}: ${parsed.notes.join(" ")}`);
      toast({ title: "Micros mapping needs review", description: parsed.notes.join(" "), variant: "destructive" });
    }
  };

  if (pinStatus.isLoading) return <div className={C.page}><main className="mx-auto max-w-6xl px-4 py-8">Loading bank deposit access...</main></div>;
  if (pinStatus.data?.requiresLogin) {
    return (
      <div className={C.page}>
        <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
          <Card className={`w-full ${C.shell}`}>
            <CardHeader>
              <CardTitle>Courtyard login required</CardTitle>
              <CardDescription className={C.muted}>Sign in through the Courtyard portal before entering the team PIN.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className={`w-full ${C.green}`}><Link href="/courtyard">Go to Courtyard portal</Link></Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  if (!pinStatus.data?.unlocked) {
    return <BankDepositPinGate onUnlocked={() => queryClient.invalidateQueries({ queryKey: ["/api/tips/shared-pin/status"] })} />;
  }

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

            <div className="grid gap-3 rounded-xl border border-[#d6c8b5] bg-white p-4 md:grid-cols-2">
              <div>
                <h2 className="font-semibold">Import Trial Balance CSV</h2>
                <p className="mb-3 text-sm text-[#5f5247]">Maps Front Desk cash to the matching business date when the report includes a date and cash column.</p>
                <label className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-semibold ${C.outline}`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Trial Balance
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => {
                      importTrialBalance(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div>
                <h2 className="font-semibold">Import Micros PDF</h2>
                <p className="mb-3 text-sm text-[#5f5247]">Maps Bistro cash to the matching report date when the PDF text or filename includes the date and cash amount.</p>
                <label className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-semibold ${C.outline}`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Micros
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      importMicros(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#d6c8b5]">
              <table className="w-full min-w-[980px] border-collapse bg-white text-sm">
                <thead>
                  <tr className="bg-[#243847] text-white">
                    <th className="w-[180px] border border-[#d6c8b5] px-3 py-3 text-left">Day</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">System</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Front Desk Cash</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Bistro Cash</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Check</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Total</th>
                    <th className="border border-[#d6c8b5] px-3 py-3 text-left">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: dayCount }, (_, index) => {
                    const day = index + 1;
                    const row = rows[day] || emptyRow();
                    const total = parseMoney(row.frontDeskCash) + parseMoney(row.bistroCash) + parseMoney(row.check);
                    const variance = total - parseMoney(row.system);
                    const checkSummary = checkDetailsSummary(row);
                    return (
                      <tr key={day} className={day % 2 === 0 ? "bg-[#fbf6ee]" : "bg-white"}>
                        <td className="border border-[#d6c8b5] px-3 py-2 font-semibold">{formatDay(selectedMonth, day)}</td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <Input className={C.field} inputMode="decimal" value={row.system} onChange={(event) => updateRow(day, "system", event.target.value)} placeholder="$0.00" />
                        </td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <Input className={C.field} inputMode="decimal" value={row.frontDeskCash} onChange={(event) => updateRow(day, "frontDeskCash", event.target.value)} placeholder="$0.00" />
                        </td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <Input className={C.field} inputMode="decimal" value={row.bistroCash} onChange={(event) => updateRow(day, "bistroCash", event.target.value)} placeholder="$0.00" />
                        </td>
                        <td className="border border-[#d6c8b5] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Input className={C.field} inputMode="decimal" value={row.check} onChange={(event) => updateRow(day, "check", event.target.value)} placeholder="$0.00" />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={`${C.outline} shrink-0`}
                              title={checkSummary || "Add check details"}
                              onClick={() => setCheckDetailsDay(day)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                          {checkSummary && <div className="mt-1 truncate text-xs text-[#5f5247]" title={checkSummary}>{checkSummary}</div>}
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
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.frontDeskCash)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.bistroCash)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.check)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.total)}</td>
                    <td className="border border-[#d6c8b5] px-3 py-3">{money(totals.variance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="rounded-xl border border-[#d6c8b5] bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Daily deposit receipts</h2>
                  <p className="text-sm text-[#5f5247]">Upload a receipt picture for the corresponding day. The daily variance is shown here for quick matching.</p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: dayCount }, (_, index) => {
                  const day = index + 1;
                  const row = rows[day] || emptyRow();
                  const total = parseMoney(row.frontDeskCash) + parseMoney(row.bistroCash) + parseMoney(row.check);
                  const variance = total - parseMoney(row.system);
                  return (
                    <div key={day} className="flex flex-col gap-2 rounded-lg border border-[#e0d3c1] bg-[#fbf6ee] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold">{formatDay(selectedMonth, day)}</div>
                        <div className={`text-sm font-semibold ${variance < 0 ? "text-[#9f1239]" : variance > 0 ? "text-[#166534]" : "text-[#5f5247]"}`}>
                          Variance: {money(variance)}
                        </div>
                        {row.receipt && <div className="text-xs text-[#5f5247]">Receipt: {row.receipt.name}</div>}
                        {row.mappingNotes?.map((note) => (
                          <div key={note} className="mt-1 flex items-start gap-1 text-xs text-amber-800">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{note}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-semibold ${C.outline}`}>
                          <Upload className="mr-2 h-4 w-4" />
                          {row.receipt ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              handleReceiptUpload(day, event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {row.receipt && (
                          <>
                            <Button type="button" size="sm" variant="outline" className={C.outline} onClick={() => setViewReceiptDay(day)}>
                              <FileImage className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            <Button type="button" size="sm" variant="outline" className={C.outline} onClick={() => removeReceipt(day)}>
                              <X className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </>
                        )}
                        {row.trialBalanceReport && (
                          <Button type="button" size="sm" variant="outline" className={C.outline} onClick={() => setViewSource({ day, kind: "trialBalanceReport" })}>
                            <FileImage className="mr-2 h-4 w-4" />
                            Trial Balance
                          </Button>
                        )}
                        {row.microsReport && (
                          <Button type="button" size="sm" variant="outline" className={C.outline} onClick={() => setViewSource({ day, kind: "microsReport" })}>
                            <FileImage className="mr-2 h-4 w-4" />
                            Micros
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={checkDetailsDay !== null} onOpenChange={(open) => !open && setCheckDetailsDay(null)}>
        <DialogContent className="border-[#ddccb5] bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>Check details</DialogTitle>
            <DialogDescription className="text-[#5f5247]">
              {checkDetailsDay ? formatDay(selectedMonth, checkDetailsDay) : ""} check reference information.
            </DialogDescription>
          </DialogHeader>
          {checkDetailsDay && selectedCheckRow && (
            <div className="space-y-3">
              <div>
                <Label>Company / Guest name</Label>
                <Input
                  className={C.field}
                  value={selectedCheckRow.checkDetails?.companyGuest || ""}
                  onChange={(event) => updateCheckDetails(checkDetailsDay, "companyGuest", event.target.value)}
                  placeholder="Company or guest name"
                />
              </div>
              <div>
                <Label>Check number</Label>
                <Input
                  className={C.field}
                  value={selectedCheckRow.checkDetails?.checkNumber || ""}
                  onChange={(event) => updateCheckDetails(checkDetailsDay, "checkNumber", event.target.value)}
                  placeholder="Check #"
                />
              </div>
              <div>
                <Label>Check date</Label>
                <Input
                  className={C.field}
                  type="date"
                  value={selectedCheckRow.checkDetails?.checkDate || ""}
                  onChange={(event) => updateCheckDetails(checkDetailsDay, "checkDate", event.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button className={C.green} onClick={() => setCheckDetailsDay(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewReceiptDay !== null} onOpenChange={(open) => !open && setViewReceiptDay(null)}>
        <DialogContent className="max-w-3xl border-[#ddccb5] bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>Deposit receipt</DialogTitle>
            <DialogDescription className="text-[#5f5247]">
              {viewReceiptDay ? formatDay(selectedMonth, viewReceiptDay) : ""} receipt image.
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt ? (
            <div className="space-y-3">
              <div className="text-sm text-[#5f5247]">{selectedReceipt.name}</div>
              <img src={selectedReceipt.dataUrl} alt={`Deposit receipt for ${viewReceiptDay ? formatDay(selectedMonth, viewReceiptDay) : "selected day"}`} className="max-h-[70vh] w-full rounded-lg border border-[#d6c8b5] object-contain" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#d6c8b5] p-6 text-sm text-[#5f5247]">No receipt uploaded for this day.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewSource !== null} onOpenChange={(open) => !open && setViewSource(null)}>
        <DialogContent className="max-w-4xl border-[#ddccb5] bg-[#fffaf2] text-[#201814]">
          <DialogHeader>
            <DialogTitle>{viewSource?.kind === "microsReport" ? "Micros source report" : "Trial Balance source report"}</DialogTitle>
            <DialogDescription className="text-[#5f5247]">
              {viewSource ? formatDay(selectedMonth, viewSource.day) : ""} verification report.
            </DialogDescription>
          </DialogHeader>
          {selectedSource ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#d6c8b5] bg-white p-3 text-sm">
                <div className="font-semibold">{selectedSource.name}</div>
                <div className="text-[#5f5247]">
                  Parsed date: {selectedSource.parsedDate || "Not detected"} | Parsed amount: {selectedSource.parsedAmount ? money(parseMoney(selectedSource.parsedAmount)) : "Not detected"}
                </div>
              </div>
              {selectedSource.type.startsWith("image/") ? (
                <img src={selectedSource.dataUrl} alt={selectedSource.name} className="max-h-[70vh] w-full rounded-lg border border-[#d6c8b5] object-contain" />
              ) : selectedSource.type.includes("pdf") ? (
                <iframe title={selectedSource.name} src={selectedSource.dataUrl} className="h-[70vh] w-full rounded-lg border border-[#d6c8b5] bg-white" />
              ) : (
                <div className="rounded-lg border border-[#d6c8b5] bg-white p-4 text-sm text-[#5f5247]">
                  Browser preview is limited for this file type.
                  <a className="ml-2 font-semibold text-[#2f5f46] underline" href={selectedSource.dataUrl} download={selectedSource.name}>Download source file</a>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#d6c8b5] p-6 text-sm text-[#5f5247]">No source report saved for this day.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
