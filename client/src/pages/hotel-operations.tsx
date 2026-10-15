import {
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  Gauge,
  Hotel,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  UserPlus,
  Users,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { calculateLaborRoi } from "@/lib/inntrix-roi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SupportWidget from "@/components/hotel-operations/SupportWidget";

type PortalSession = {
  account: { id: string; email: string; displayName: string };
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    isDemo: boolean;
  }>;
  activeOrganizationId: string | null;
  supportRole?: string | null;
};
type HotelRecord = {
  id: string;
  propertyCode: string;
  name: string;
  brand?: string | null;
  city: string;
  state: string;
  timeZone: string;
  roomCount?: number | null;
  status: string;
};
type Dashboard = {
  organization: { id: string; name: string; isDemo: boolean };
  role: string;
  canUseAllProperties: boolean;
  selectedHotelId: string | null;
  hotels: HotelRecord[];
  permissions: Array<{
    hotelId: string;
    moduleKey: string;
    canView: boolean;
    canManage: boolean;
  }>;
  portfolio: {
    propertyCount: number;
    activePropertyCount: number;
    assignedGmCount: number;
    reportingReadyCount: number;
    metricsAvailable: boolean;
    incidentSummaryAvailable: boolean;
  };
};

const MODULES = [
  [
    "operations_reporting",
    "Operations Reporting",
    "Portfolio-ready shell",
    "Requires Multi-Property Adaptation / Reporting Integration",
  ],
  [
    "revenue_intelligence",
    "Revenue Intelligence",
    "Pacing and forecast visibility",
    "Requires Reporting Integration",
  ],
  [
    "sales_intelligence",
    "Sales Intelligence",
    "Pipeline and group production",
    "Requires Reporting Integration",
  ],
  [
    "staff_scheduling",
    "Staff Scheduling",
    "Property labor planning",
    "Requires Multi-Property Adaptation",
  ],
  [
    "incident_reporting",
    "Incident Reporting",
    "Controlled property documentation",
    "Preview Only",
  ],
  [
    "restaurant_operations",
    "Restaurant / Bistro Operations",
    "Outlet controls and gratuities",
    "Requires Multi-Property Adaptation",
  ],
  [
    "meeting_group_calendar",
    "Meeting & Group Calendar",
    "Events, BEOs and group resumes",
    "Requires Multi-Property Adaptation",
  ],
  [
    "budget_financial",
    "Budget & Financial",
    "Budget and ownership review",
    "Preview Only",
  ],
  ["bank_deposits", "Bank Deposits", "Deposit reconciliation", "Preview Only"],
  [
    "comptroller",
    "Comptroller",
    "Financial oversight workspace",
    "Preview Only",
  ],
] as const;

const ROLE_NAMES: Record<string, string> = {
  platform_owner: "Platform Owner",
  above_property_admin: "Above Property Admin",
  property_admin: "Property Admin / GM",
  property_manager: "Property Manager",
  property_employee: "Property Employee",
};

function readCookie(name: string) {
  return (
    document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}

async function portalFetch(path: string, init: RequestInit = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set(
      "x-hotel-ops-csrf",
      decodeURIComponent(readCookie("hotel_ops_csrf")),
    );
  const response = await fetch(apiUrl(`/api/hotel-operations${path}`), {
    ...init,
    headers,
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#184f46] text-white">
        <Building2 size={21} />
      </div>
      <div>
        <div className="font-semibold tracking-tight text-[#153d37]">
          Hotel Operations
        </div>
        {!compact && (
          <div className="text-xs uppercase tracking-[.2em] text-[#997744]">
            Enterprise Management
          </div>
        )}
      </div>
    </div>
  );
}

function PublicBrand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="INNTRIX">
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl ${light ? "bg-white text-[#174d45]" : "bg-[#174d45] text-white"}`}
      >
        <Building2 size={20} aria-hidden="true" />
      </div>
      <div>
        <div
          className={`text-lg font-bold tracking-[.16em] ${light ? "text-white" : "text-[#153d37]"}`}
        >
          INNTRIX
        </div>
        <div
          className={`text-[10px] font-semibold uppercase tracking-[.17em] ${light ? "text-white/65" : "text-[#8a6b35]"}`}
        >
          Hospitality Operations Intelligence
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#27443f]">
      <span>{label}</span>
      <Input {...props} className="border-[#d8d1c4] bg-white" />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  newPassword = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  newPassword?: boolean;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#27443f]">
      <span>{label}</span>
      <span className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={newPassword ? 12 : undefined}
          maxLength={200}
          autoComplete={autoComplete}
          className="border-[#d8d1c4] bg-white pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#66756f] hover:text-[#184f46]"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {newPassword && (
        <span className="text-xs font-normal leading-5 text-[#6b7974]">
          Use 12–200 characters. A longer, unique passphrase is recommended.
        </span>
      )}
    </label>
  );
}

function Landing({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [currentHours, setCurrentHours] = useState(675);
  const [targetHours, setTargetHours] = useState(600);
  const [hourlyCost, setHourlyCost] = useState(20);
  const [monthlySubscription, setMonthlySubscription] = useState(199);

  const {
    currentWeeklyHours: current,
    targetWeeklyHours: target,
    weeklyHoursSaved,
    annualizedHoursSaved: annualHoursSaved,
    estimatedAnnualLaborSavings: annualLaborSavings,
    estimatedAnnualSubscriptionExpense: annualSubscription,
    estimatedAnnualNetBenefit: annualNetBenefit,
  } = calculateLaborRoi({
    currentWeeklyHours: currentHours,
    targetWeeklyHours: targetHours,
    hourlyLaborCost: hourlyCost,
    monthlySubscription,
  });
  const laborScale = Math.max(current, target, 1);
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const updateNumber = (
    setter: (value: number) => void,
    value: string,
  ) => setter(value === "" ? 0 : Math.max(0, Number(value) || 0));

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await portalFetch("/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          returnTo: "/hoteloperations/dashboard",
        }),
      });
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    }
  }
  async function reset() {
    setError("");
    if (!email) return setError("Enter your work email first.");
    await portalFetch("/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setResetSent(true);
  }
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ec] text-[#172e2a]">
      <header className="sticky top-0 z-40 border-b border-[#ded6c7]/80 bg-[#f7f4ec]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58a43]">
            <PublicBrand />
          </a>
          <nav className="flex items-center gap-2" aria-label="Primary navigation">
            <a href="#capabilities" className="hidden px-3 py-2 text-sm font-medium text-[#52645f] hover:text-[#174d45] md:block">
              Platform
            </a>
            <a href="#roi" className="hidden px-3 py-2 text-sm font-medium text-[#52645f] hover:text-[#174d45] md:block">
              ROI calculator
            </a>
            <a href="#login" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#174d45] hover:bg-[#e5ece8]">
              Login
            </a>
            <a href="#login" className="rounded-lg bg-[#174d45] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#103c35]">
              Get started
            </a>
          </nav>
        </div>
      </header>

      <section id="top" className="relative isolate bg-[#123b35] text-white">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-32 -top-52 h-[36rem] w-[36rem] rounded-full bg-[#bf9651]/20 blur-3xl" />
          <div className="absolute -bottom-64 left-1/4 h-[32rem] w-[32rem] rounded-full bg-[#2b766a]/35 blur-3xl" />
          <div className="absolute inset-0 opacity-[.055]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-[#f0d8a9]">
              <Sparkles size={15} aria-hidden="true" /> Hospitality Operations Intelligence
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl">
              Run a smarter hotel. Control costs. Improve performance.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/75 md:text-xl">
              INNTRIX brings operational planning, labor intelligence, and management visibility into one platform designed for hotel operators.
            </p>
            <div className="mt-7 flex max-w-2xl items-center gap-4 border-l-2 border-[#d6ad68] pl-4">
              <div className="shrink-0 text-center">
                <div className="text-2xl font-semibold leading-none text-[#f0cc8d]">15+</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-white/55">Years</div>
              </div>
              <p className="text-sm leading-6 text-white/70">
                Created by a hotel operations professional with more than 15 years of hands-on hospitality management experience.
              </p>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#roi" className="inline-flex items-center gap-2 rounded-xl bg-[#c79a4f] px-5 py-3 font-semibold text-[#102d29] shadow-lg shadow-black/10 hover:bg-[#dab36f]">
                Estimate your opportunity <ArrowRight size={17} />
              </a>
              <a href="#capabilities" className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10">
                Explore the platform
              </a>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [TrendingDown, "Cost visibility", "Surface preventable labor inefficiencies before they become recurring expenses."],
              [Gauge, "Demand-led planning", "Connect staffing decisions to operational demand and expected workload."],
              [BarChart3, "Actionable insight", "Give property and above-property leaders a clearer operating picture."],
              [Users, "Stronger accountability", "Keep priorities, ownership, and follow-through visible across the team."],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="rounded-2xl border border-white/15 bg-white/[.08] p-5 backdrop-blur-sm">
                <Icon className="text-[#e0b66e]" size={23} aria-hidden="true" />
                <h2 className="mt-4 font-semibold">{String(title)}</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">{String(copy)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#ded8cc] bg-white px-5 py-20 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
          <div className="relative overflow-hidden rounded-3xl bg-[#163f38] p-8 text-white shadow-xl shadow-[#274a42]/10 md:p-10">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[32px] border-white/[.04]" aria-hidden="true" />
            <div className="relative">
              <p className="text-6xl font-semibold tracking-tight text-[#e0b76f] md:text-7xl">15+</p>
              <p className="mt-3 max-w-xs text-sm font-bold uppercase leading-6 tracking-[.18em] text-white/80">
                Years of Hospitality Operations Experience
              </p>
              <div className="mt-8 h-px w-16 bg-[#d5aa63]" />
              <p className="mt-6 text-sm leading-6 text-white/65">
                Firsthand experience across labor, staffing, guest satisfaction, maintenance, inventory control, management reporting, and profitability.
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#936d34]">Experience behind the platform</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              Built by a Hotelier. Designed for the Realities of Hotel Operations.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[#566762]">
              INNTRIX was built from firsthand experience in hotel operations—not assumptions about how hotels should operate. More than 15 years of hospitality management experience shaped a platform intended to simplify daily responsibilities, reduce unnecessary administrative work, maximize operational efficiency, and help teams identify opportunities to improve hotel profitability.
            </p>
            <p className="mt-5 text-base leading-7 text-[#687570]">
              Its workflows reflect the practical needs of General Managers and department heads at the property level, while giving ownership groups and hotel management companies the visibility needed to support informed decisions across a portfolio.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["General Managers", "Department Heads", "Ownership Groups", "Management Companies"].map((audience) => (
                <span key={audience} className="rounded-full border border-[#d5cbb9] bg-[#f8f5ee] px-3 py-1.5 text-sm font-medium text-[#40534e]">
                  {audience}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#9a7136]">One operational view</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Intelligence that helps operators act.</h2>
          <p className="mt-5 text-lg leading-8 text-[#5d6b67]">Focus the team on the work, labor, and decisions that shape property performance—without losing portfolio-level visibility.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {[
            { icon: CalendarRange, title: "Labor & Scheduling Intelligence", status: "Available", copy: "Demand-driven housekeeping staffing recommendations, labor efficiency review, schedule optimization, and forecast-based operational planning.", available: true },
            { icon: ClipboardCheck, title: "Hotel Operations Management", status: "Available", copy: "Centralized daily management workflows, operational accountability, task tracking, and property or organization oversight.", available: true },
            { icon: PackageSearch, title: "Inventory Intelligence", status: "Planned", copy: "Maintenance tools and equipment, housekeeping supply par levels, and Front Desk Market inventory and loss tracking.", available: false },
            { icon: Sparkles, title: "Guest Experience Intelligence", status: "Planned", copy: "AI-assisted forensic GSS investigations, room-level issue heat maps, and corrective-action recommendations and tracking.", available: false },
          ].map(({ icon: Icon, title, status, copy, available }) => (
            <article key={title} className={`rounded-3xl border p-6 md:p-8 ${available ? "border-[#d8d2c5] bg-white shadow-sm" : "border-dashed border-[#d0c5af] bg-[#f1ede3]/70"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${available ? "bg-[#deebe6] text-[#174d45]" : "bg-[#e8e0d1] text-[#806333]"}`}><Icon size={23} aria-hidden="true" /></div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${available ? "bg-[#e1eee9] text-[#175347]" : "bg-[#e9dfcc] text-[#795d2d]"}`}>{status}</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-[#65726e]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roi" className="bg-[#e8eee9] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#8b672f]">Interactive labor ROI calculator</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Put your labor opportunity into perspective.</h2>
            <p className="mt-5 text-lg leading-8 text-[#5b6965]">Adjust the assumptions to model the financial effect of moving from current labor usage toward an operational target.</p>
          </div>
          <div className="mt-12 grid overflow-hidden rounded-[2rem] border border-[#cdd7d1] bg-white shadow-xl shadow-[#2f5148]/10 lg:grid-cols-[.82fr_1.18fr]">
            <div className="border-b border-[#d9e0dc] bg-[#faf9f5] p-6 md:p-9 lg:border-b-0 lg:border-r">
              <h3 className="text-lg font-semibold">Your assumptions</h3>
              <div className="mt-6 grid gap-5">
                {[
                  ["Current average weekly labor hours", currentHours, setCurrentHours, "hours"],
                  ["Target average weekly labor hours", targetHours, setTargetHours, "hours"],
                  ["Fully burdened hourly labor cost", hourlyCost, setHourlyCost, "$ / hour"],
                  ["Estimated monthly INNTRIX subscription", monthlySubscription, setMonthlySubscription, "$ / month"],
                ].map(([label, value, setter, suffix], index) => (
                  <label key={String(label)} className="grid gap-2 text-sm font-semibold text-[#304b45]">
                    <span>{String(label)}</span>
                    <span className="relative">
                      <Input type="number" min="0" step={index > 1 ? "0.01" : "1"} value={Number(value)} onChange={(event) => updateNumber(setter as (value: number) => void, event.target.value)} className="h-12 border-[#cdd7d1] bg-white pr-24 text-base" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[#74817d]">{String(suffix)}</span>
                    </span>
                    {index === 3 && <span className="font-normal text-[#7b8783]">Illustrative placeholder—not published pricing.</span>}
                  </label>
                ))}
              </div>
              <div className="mt-8 border-t border-[#ddd8cd] pt-6">
                <div className="mb-3 flex justify-between text-xs font-semibold"><span>Current labor</span><span>{current.toLocaleString()} hrs</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-[#e3ded2]"><div className="h-full rounded-full bg-[#806a48] transition-all" style={{ width: `${(current / laborScale) * 100}%` }} /></div>
                <div className="mb-3 mt-5 flex justify-between text-xs font-semibold"><span>Target labor</span><span>{target.toLocaleString()} hrs</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-[#e3ded2]"><div className="h-full rounded-full bg-[#2d7165] transition-all" style={{ width: `${(target / laborScale) * 100}%` }} /></div>
              </div>
            </div>
            <div className="bg-[#143f38] p-6 text-white md:p-9">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#e7c488]"><BarChart3 size={18} /> Illustrative annual impact</div>
              <div className="mt-6 rounded-2xl bg-white/10 p-6">
                <p className="text-sm text-white/65">Potential annual labor savings</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{currency.format(annualLaborSavings)}</p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  ["Weekly hours saved", weeklyHoursSaved.toLocaleString()],
                  ["Annual hours saved", annualHoursSaved.toLocaleString()],
                  ["Annual net benefit", currency.format(annualNetBenefit)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
                    <p className="text-xs leading-5 text-white/60">{label}</p>
                    <p className="mt-2 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[#d4b16f]/25 bg-[#d4b16f]/10 p-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#e5c17e]" size={18} />
                <div><p className="text-sm font-semibold">Subscription assumption: {currency.format(annualSubscription)} annually</p><p className="mt-1 text-xs leading-5 text-white/60">Based on the monthly placeholder entered at left.</p></div>
              </div>
              <p className="mt-6 text-xs leading-5 text-white/55">Illustrative estimates only. Actual results depend on staffing requirements, occupancy, service standards, payroll costs, and management decisions. INNTRIX does not guarantee savings, and software alone does not create the modeled labor reduction.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[1fr_.8fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#936d34]">Smarter operations. Stronger performance.</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Give every operating decision better context.</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d6c67]">Bring property teams and ownership closer to the same operational truth—with access that remains controlled by organization and property.</p>
          <ul className="mt-7 grid gap-3 text-[#40534e] sm:grid-cols-2">
            {["Identify cost-control opportunities", "Improve operational visibility", "Strengthen management accountability", "Plan staffing around demand"].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#2a7164]" /> {item}</li>)}
          </ul>
        </div>

        <form id="login" onSubmit={login} className="scroll-mt-28 rounded-3xl border border-[#d9d0bf] bg-white p-7 shadow-xl shadow-[#42534b]/10 md:p-9">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e5ede9] text-[#174d45]"><LockKeyhole size={21} /></div>
            <div><h2 className="text-xl font-semibold">INNTRIX portal sign in</h2><p className="text-sm text-[#6b7874]">Use the account created from your invitation.</p></div>
          </div>
          <div className="grid gap-4">
            <Field label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {resetSent && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">If that account exists, a reset link has been sent.</p>}
            <Button className="h-11 bg-[#184f46] hover:bg-[#123d36]">Sign in securely <ChevronRight size={16} /></Button>
            <button type="button" onClick={reset} className="text-sm text-[#5d6c68] underline underline-offset-4">Forgot password?</button>
          </div>
          <p className="mt-6 border-t pt-5 text-xs leading-5 text-[#7a8581]">INNTRIX is currently invitation-only. Get Started brings invited hotel teams to this secure sign-in; access is provisioned by an authorized portfolio or property administrator.</p>
        </form>
      </section>

      <footer className="bg-[#102e29] px-5 py-8 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <PublicBrand light />
          <p className="text-sm text-white/55">Operational intelligence for independent hotel teams and portfolios.</p>
        </div>
      </footer>
    </main>
  );
}

function HotelForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    propertyCode: "",
    name: "",
    brand: "",
    propertyType: "branded",
    ownershipEntity: "",
    managementEntity: "",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
    timeZone: "America/Chicago",
    roomCount: "",
    activeRoomCount: "",
    meetingRoomCount: "",
    foodBeverageOutletCount: "",
    pmsProvider: "",
    reportingPlatform: "",
    accountingSystem: "",
    laborSchedulingSystem: "",
    brandReportingEcosystem: "",
    businessDayCutoff: "03:00",
    currency: "USD",
    departments: "Front Desk, Housekeeping, Maintenance",
    enabledModules: "",
    reportSourceTypes: "",
    reportingIntegrationStatus: "not_configured",
  });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const numbers = [
        "roomCount",
        "activeRoomCount",
        "meetingRoomCount",
        "foodBeverageOutletCount",
      ] as const;
      const lists = [
        "departments",
        "enabledModules",
        "reportSourceTypes",
      ] as const;
      const body: any = { ...form };
      numbers.forEach((key) => {
        body[key] = form[key] ? Number(form[key]) : null;
      });
      lists.forEach((key) => {
        body[key] = form[key]
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      });
      await portalFetch("/hotels", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add hotel");
    }
  }
  const labels: Record<string, string> = {
    propertyCode: "Property code",
    name: "Hotel name",
    brand: "Brand / flag",
    propertyType: "Hotel type (branded, independent, boutique)",
    ownershipEntity: "Ownership entity",
    managementEntity: "Management entity",
    streetAddress: "Street address",
    city: "City",
    state: "State / province",
    postalCode: "Postal code",
    country: "Country",
    phone: "Property phone",
    timeZone: "IANA time zone",
    roomCount: "Total room count",
    activeRoomCount: "Active / sellable rooms",
    meetingRoomCount: "Meeting room count",
    foodBeverageOutletCount: "Food & beverage outlets",
    pmsProvider: "PMS provider",
    reportingPlatform: "Reporting platform",
    accountingSystem: "Accounting system",
    laborSchedulingSystem: "Labor / scheduling system",
    brandReportingEcosystem: "Brand reporting ecosystem",
    businessDayCutoff: "Business-day cutoff (HH:MM)",
    currency: "Currency",
    departments: "Departments (comma-separated)",
    enabledModules: "Enabled module keys (comma-separated)",
    reportSourceTypes: "Report source types (comma-separated)",
    reportingIntegrationStatus: "Integration status",
  };
  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-2xl border border-[#d9d1c2] bg-white p-5 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h3 className="font-semibold">Add a hotel</h3>
        <p className="text-sm text-[#687671]">
          Complete the property profile. Reporting mappings remain unconfigured
          until source formats are reviewed and validated.
        </p>
      </div>
      {Object.entries(labels).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          type={
            [
              "roomCount",
              "activeRoomCount",
              "meetingRoomCount",
              "foodBeverageOutletCount",
            ].includes(key)
              ? "number"
              : "text"
          }
          value={(form as any)[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          required={[
            "propertyCode",
            "name",
            "city",
            "state",
            "country",
            "timeZone",
            "propertyType",
          ].includes(key)}
        />
      ))}
      {error && <p className="md:col-span-2 text-sm text-red-700">{error}</p>}
      <div className="md:col-span-2">
        <Button className="bg-[#184f46]">Create hotel</Button>
      </div>
    </form>
  );
}

function InviteForm({
  hotels,
  actorRole,
  onChanged,
}: {
  hotels: HotelRecord[];
  actorRole: string;
  onChanged?: () => void;
}) {
  const roleOptions =
    actorRole === "property_manager"
      ? [["property_employee", "Property Employee"]]
      : actorRole === "property_admin"
        ? [
            ["property_manager", "Property Manager"],
            ["property_employee", "Property Employee"],
          ]
        : actorRole === "platform_owner"
          ? [
              ["above_property_admin", "Above Property Administrator"],
              ["property_admin", "Property Admin / GM"],
              ["property_manager", "Property Manager"],
              ["property_employee", "Property Employee"],
            ]
          : [
              ["property_admin", "Property Admin / GM"],
              ["property_manager", "Property Manager"],
              ["property_employee", "Property Employee"],
            ];
  const [form, setForm] = useState({
    email: "",
    role: roleOptions[0][0],
    hotelId: hotels[0]?.id || "",
    moduleKeys: [] as string[],
  });
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!form.hotelId && hotels[0])
      setForm((value) => ({ ...value, hotelId: hotels[0].id }));
  }, [hotels, form.hotelId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...form,
        hotelId: form.role === "above_property_admin" ? null : form.hotelId,
      };
      const result = await portalFetch("/invitations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage(
        result.invitation.delivered
          ? "Invitation sent."
          : result.demoLink
            ? `Email delivery unavailable. Demo link: ${result.demoLink}`
            : "Invitation created, but email delivery needs configuration.",
      );
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to invite user");
    }
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-2xl border border-[#d9d1c2] bg-white p-5 md:grid-cols-3"
    >
      <div className="md:col-span-3">
        <h3 className="font-semibold">
          Invite a property leader or team member
        </h3>
        <p className="text-sm text-[#687671]">
          Invitations are single-use, expire in 72 hours, and never grant access
          beyond the selected property.
        </p>
      </div>
      <Field
        label="Work email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <label className="grid gap-1.5 text-sm font-medium">
        <span>Role</span>
        <select
          className="h-10 rounded-md border border-[#d8d1c4] bg-white px-3"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          {roleOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        <span>Hotel</span>
        <select
          className="h-10 rounded-md border border-[#d8d1c4] bg-white px-3"
          value={form.hotelId}
          onChange={(e) => setForm({ ...form, hotelId: e.target.value })}
          required={form.role !== "above_property_admin"}
          disabled={form.role === "above_property_admin"}
        >
          <option value="">
            {form.role === "above_property_admin"
              ? "Portfolio-wide role"
              : "Select hotel"}
          </option>
          {hotels.map((hotel) => (
            <option value={hotel.id} key={hotel.id}>
              {hotel.name}
            </option>
          ))}
        </select>
      </label>
      {form.role !== "above_property_admin" && (
        <fieldset className="md:col-span-3">
          <legend className="mb-2 text-sm font-semibold">
            Assigned modules
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(([key, name]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-[#ddd7cb] p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.moduleKeys.includes(key)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      moduleKeys: e.target.checked
                        ? [...form.moduleKeys, key]
                        : form.moduleKeys.filter((item) => item !== key),
                    })
                  }
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {message && (
        <p className="md:col-span-3 break-all text-sm text-[#536761]">
          {message}
        </p>
      )}
      <div className="md:col-span-3">
        <Button className="bg-[#184f46]">
          <UserPlus size={16} /> Send invitation
        </Button>
      </div>
    </form>
  );
}

function TeamPanel({
  hotels,
  actorRole,
}: {
  hotels: HotelRecord[];
  actorRole: string;
}) {
  const [data, setData] = useState<{
    portfolioMembers: any[];
    members: any[];
    invitations: any[];
  }>({ portfolioMembers: [], members: [], invitations: [] });
  const [error, setError] = useState("");
  const load = () =>
    portalFetch("/team")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  async function revoke(id: string) {
    try {
      await portalFetch(`/invitations/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to revoke invitation");
    }
  }
  async function toggleMember(member: any) {
    try {
      await portalFetch(`/team/${encodeURIComponent(member.id)}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          hotelId: member.hotelId,
          role: member.role,
          moduleKeys: member.moduleKeys || [],
          status: member.status === "active" ? "inactive" : "active",
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to change access");
    }
  }
  async function revokePortfolioMember(member: any) {
    try {
      await portalFetch(
        `/team/${encodeURIComponent(member.id)}/organization-access`,
        { method: "PATCH", body: JSON.stringify({ status: "inactive" }) },
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to change portfolio access",
      );
    }
  }
  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <InviteForm hotels={hotels} actorRole={actorRole} onChanged={load} />
      <section className="rounded-2xl border border-[#d9d1c2] bg-white p-5">
        <h3 className="font-semibold">Current access</h3>
        <div className="mt-3 grid gap-2">
          {data.portfolioMembers.map((member) => (
            <div
              key={`org-${member.id}`}
              className="flex items-center justify-between rounded-lg bg-[#f6f3ec] p-3 text-sm"
            >
              <div>
                <b>{member.displayName}</b>
                <div className="text-[#6b7974]">
                  {member.email} · {ROLE_NAMES[member.role]}
                </div>
              </div>
              {actorRole === "platform_owner" &&
                member.role === "above_property_admin" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void revokePortfolioMember(member)}
                  >
                    Revoke access
                  </Button>
                )}
            </div>
          ))}
          {data.members.map((member) => (
            <div
              key={`${member.id}-${member.hotelId}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f3ec] p-3 text-sm"
            >
              <div>
                <b>{member.displayName}</b>
                <div className="text-[#6b7974]">
                  {member.hotelName} · {ROLE_NAMES[member.role]} ·{" "}
                  {member.moduleKeys.length} modules · {member.status}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void toggleMember(member)}
              >
                {member.status === "active"
                  ? "Revoke access"
                  : "Restore access"}
              </Button>
            </div>
          ))}
          {data.portfolioMembers.length + data.members.length === 0 && (
            <p className="text-sm text-[#6b7974]">
              No team members have accepted invitations yet.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-[#d9d1c2] bg-white p-5">
        <h3 className="font-semibold">Pending invitations</h3>
        <div className="mt-3 grid gap-2">
          {data.invitations.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f3ec] p-3 text-sm"
            >
              <div>
                <b>{invite.email}</b>
                <div className="text-[#6b7974]">
                  {ROLE_NAMES[invite.role]} · expires{" "}
                  {new Date(invite.expiresAt).toLocaleString()}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void revoke(invite.id)}
              >
                Revoke
              </Button>
            </div>
          ))}
          {data.invitations.length === 0 && (
            <p className="text-sm text-[#6b7974]">No pending invitations.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AuditPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    portalFetch("/audit")
      .then((result) => setEvents(result.events || []))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="rounded-2xl border border-[#d9d1c2] bg-white p-5">
      <h3 className="font-semibold">Administrative audit history</h3>
      <p className="mt-1 text-sm text-[#687671]">
        The newest 100 provisioning, access, invitation, and property changes.
      </p>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 grid gap-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="grid gap-1 rounded-lg bg-[#f6f3ec] p-3 text-sm sm:grid-cols-[180px_1fr_1fr]"
          >
            <span className="text-[#6b7974]">
              {new Date(event.createdAt).toLocaleString()}
            </span>
            <b>{String(event.action).replaceAll("_", " ")}</b>
            <span className="text-[#6b7974]">
              {event.targetType || "system"}
              {event.hotelId ? " · property-scoped" : ""}
            </span>
          </div>
        ))}
        {events.length === 0 && !error && (
          <p className="text-sm text-[#6b7974]">
            No audit events are available yet.
          </p>
        )}
      </div>
    </section>
  );
}

function DashboardView({
  session,
  reloadSession,
}: {
  session: PortalSession;
  reloadSession: () => void;
}) {
  const [, navigate] = useLocation();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [organizationId, setOrganizationId] = useState(
    session.activeOrganizationId || session.organizations[0]?.id || "",
  );
  const [hotelId, setHotelId] = useState("all");
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  async function load(nextHotelId = hotelId) {
    try {
      const data = await portalFetch(
        `/dashboard?organizationId=${encodeURIComponent(organizationId)}&hotelId=${encodeURIComponent(nextHotelId)}`,
      );
      setDashboard(data);
      if (data.selectedHotelId && data.selectedHotelId !== nextHotelId)
        setHotelId(data.selectedHotelId);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load dashboard");
    }
  }
  useEffect(() => {
    if (organizationId) void load();
  }, [organizationId, hotelId]);
  async function logout() {
    await portalFetch("/logout", { method: "POST" });
    reloadSession();
    navigate("/hoteloperations");
  }
  async function toggleHotelStatus(hotel: HotelRecord) {
    try {
      await portalFetch(`/hotels/${encodeURIComponent(hotel.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: hotel.status === "active" ? "inactive" : "active",
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update hotel");
    }
  }
  const canPortfolioAdmin =
    dashboard &&
    ["platform_owner", "above_property_admin"].includes(dashboard.role);
  const canTeamAdmin =
    dashboard &&
    [
      "platform_owner",
      "above_property_admin",
      "property_admin",
      "property_manager",
    ].includes(dashboard.role);
  const activeHotel = dashboard?.hotels.find((hotel) => hotel.id === hotelId);
  const visibleModules = dashboard
    ? dashboard.canUseAllProperties
      ? MODULES
      : MODULES.filter(([key]) =>
          dashboard.permissions.some(
            (permission) =>
              permission.hotelId === dashboard.selectedHotelId &&
              permission.moduleKey === key &&
              permission.canView,
          ),
        )
    : [];
  return (
    <div className="min-h-screen bg-[#f4f2ec] text-[#17332e]">
      <header className="sticky top-0 z-20 border-b border-[#d9d4c8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Brand compact />
          <div className="flex items-center gap-3">
            {session.organizations.some(
              (org) => org.role === "platform_owner",
            ) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/hoteloperations/admin")}
              >
                Platform admin
              </Button>
            )}
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">
                {session.account.displayName}
              </div>
              <div className="text-xs text-[#71807b]">
                {session.account.email}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut size={15} /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl bg-[#153f38] p-4 text-white">
            <div className="text-xs uppercase tracking-widest text-[#b8d0c8]">
              Organization
            </div>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-sm"
            >
              {session.organizations.map((org) => (
                <option className="text-black" value={org.id} key={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            {dashboard?.organization.isDemo && (
              <div className="mt-3 rounded-md bg-amber-300/20 px-2 py-1 text-xs text-amber-100">
                Demo organization · fictional data only
              </div>
            )}
          </div>
          <nav className="grid gap-1">
            {[
              ["overview", "Overview", LayoutDashboard],
              ["hotels", "Hotels", Hotel],
              ["team", "Team access", UserPlus],
            ].map(([key, label, Icon]: any) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${tab === key ? "bg-white shadow-sm" : "text-[#5c6c67] hover:bg-white/60"}`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
            {canPortfolioAdmin && (
              <button
                onClick={() => setTab("audit")}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${tab === "audit" ? "bg-white shadow-sm" : "text-[#5c6c67] hover:bg-white/60"}`}
              >
                <ShieldCheck size={17} />
                Audit history
              </button>
            )}
          </nav>
        </aside>
        <main>
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {!dashboard ? (
            <div className="rounded-2xl bg-white p-10 text-center">
              Loading portfolio…
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-widest text-[#9b783b]">
                    {ROLE_NAMES[dashboard.role] || dashboard.role}
                  </div>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    {tab === "overview"
                      ? "Portfolio overview"
                      : tab === "hotels"
                        ? "Hotel administration"
                        : tab === "audit"
                          ? "Audit history"
                          : "Team access"}
                  </h1>
                </div>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#61716c]">
                  <span>Property context</span>
                  <select
                    className="min-w-64 rounded-lg border border-[#d3ccbf] bg-white px-3 py-2 text-sm normal-case tracking-normal"
                    value={hotelId}
                    onChange={(e) => setHotelId(e.target.value)}
                  >
                    {dashboard.canUseAllProperties && (
                      <option value="all">All authorized properties</option>
                    )}
                    {dashboard.hotels.map((hotel) => (
                      <option value={hotel.id} key={hotel.id}>
                        {hotel.name} · {hotel.propertyCode}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {tab === "overview" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-[#ddd7cb] bg-white p-5">
                      <div className="text-sm text-[#687671]">
                        Authorized properties
                      </div>
                      <div className="mt-2 text-3xl font-semibold">
                        {dashboard.portfolio.propertyCount}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ddd7cb] bg-white p-5">
                      <div className="text-sm text-[#687671]">
                        Active properties
                      </div>
                      <div className="mt-2 text-3xl font-semibold">
                        {dashboard.portfolio.activePropertyCount}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ddd7cb] bg-white p-5">
                      <div className="text-sm text-[#687671]">Assigned GMs</div>
                      <div className="mt-2 text-3xl font-semibold">
                        {dashboard.portfolio.assignedGmCount}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ddd7cb] bg-white p-5">
                      <div className="text-sm text-[#687671]">
                        Reporting validated
                      </div>
                      <div className="mt-2 text-3xl font-semibold">
                        {dashboard.portfolio.reportingReadyCount}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ddd7cb] bg-white p-5">
                      <div className="text-sm text-[#687671]">
                        Incident summary
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[#8b6a31]">
                        Awaiting safe integration
                      </div>
                    </div>
                  </div>
                  <section className="mt-7">
                    <h2 className="text-xl font-semibold">
                      Operations modules
                    </h2>
                    <p className="mt-1 text-sm text-[#687671]">
                      Availability reflects current multi-property and
                      report-mapping readiness. No legacy property data is
                      exposed here.
                    </p>
                    {visibleModules.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-[#cfc5b2] bg-white p-8 text-center text-sm text-[#687671]">
                        No operational modules are assigned for this property
                        yet.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleModules.map(([key, name, copy, status]) => (
                          <article
                            key={key}
                            className="rounded-2xl border border-[#ddd7cb] bg-white p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-semibold">{name}</h3>
                              <span className="rounded-full bg-[#f1ece1] px-2 py-1 text-[10px] font-bold uppercase text-[#80642f]">
                                Not enabled
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#697671]">
                              {copy}
                            </p>
                            <div className="mt-5 border-t pt-3 text-xs font-semibold text-[#8a6a32]">
                              {status}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                  {activeHotel && (
                    <div className="mt-7 rounded-2xl border border-[#ddd7cb] bg-white p-5">
                      <h2 className="font-semibold">{activeHotel.name}</h2>
                      <p className="mt-1 text-sm text-[#687671]">
                        {activeHotel.brand || "Independent / unassigned brand"}{" "}
                        · {activeHotel.city}, {activeHotel.state} ·{" "}
                        {activeHotel.roomCount || "Room count pending"}
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "hotels" && (
                <div className="space-y-5">
                  {dashboard.hotels.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cfc5b2] bg-white p-10 text-center">
                      <Hotel className="mx-auto text-[#98763c]" />
                      <h2 className="mt-3 font-semibold">
                        No hotels configured yet
                      </h2>
                      <p className="mt-1 text-sm text-[#6c7975]">
                        Add the first property to establish secure property
                        context.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {dashboard.hotels.map((hotel) => (
                        <div
                          key={hotel.id}
                          className="flex items-center justify-between rounded-xl border border-[#ddd7cb] bg-white p-4"
                        >
                          <div>
                            <div className="font-semibold">{hotel.name}</div>
                            <div className="text-sm text-[#6c7975]">
                              {hotel.propertyCode} · {hotel.city}, {hotel.state}{" "}
                              · {hotel.status}
                            </div>
                          </div>
                          {canPortfolioAdmin && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void toggleHotelStatus(hotel)}
                            >
                              {hotel.status === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canPortfolioAdmin && (
                    <HotelForm onCreated={() => void load()} />
                  )}
                </div>
              )}
              {tab === "team" &&
                (canTeamAdmin ? (
                  <TeamPanel
                    hotels={dashboard.hotels}
                    actorRole={dashboard.role}
                  />
                ) : (
                  <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#697671]">
                    Team administration is managed by your authorized property
                    or portfolio administrator.
                  </div>
                ))}
              {tab === "audit" && canPortfolioAdmin && <AuditPanel />}
            </>
          )}
        </main>
      </div>
      <SupportWidget organizationId={organizationId} hotelId={hotelId} />
    </div>
  );
}

function TokenPage({
  mode,
  token,
}: {
  mode: "invite" | "reset" | "support";
  token: string;
}) {
  const [, navigate] = useLocation();
  const [meta, setMeta] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (mode === "invite")
      portalFetch(`/invitations/${encodeURIComponent(token)}`)
        .then(setMeta)
        .catch((e) => setError(e.message));
    if (mode === "support")
      portalFetch(`/support-invitations/${encodeURIComponent(token)}`)
        .then(setMeta)
        .catch((e) => setError(e.message));
  }, [mode, token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== passwordConfirmation)
      return setError("Passwords do not match.");
    try {
      if (mode === "invite")
        await portalFetch(`/invitations/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          body: JSON.stringify({ displayName, password, passwordConfirmation }),
        });
      else if (mode === "support")
        await portalFetch(
          `/support-invitations/${encodeURIComponent(token)}/accept`,
          {
            method: "POST",
            body: JSON.stringify({
              displayName,
              password,
              passwordConfirmation,
            }),
          },
        );
      else
        await portalFetch(`/password-reset/${encodeURIComponent(token)}`, {
          method: "POST",
          body: JSON.stringify({ password, passwordConfirmation }),
        });
      navigate(
        mode === "support"
          ? "/hoteloperations/admin/support"
          : mode === "invite"
            ? "/hoteloperations/dashboard"
            : "/hoteloperations",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete request");
    }
  }
  const accepting = mode !== "reset";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f2e9] p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl border border-[#d9d0bf] bg-white p-7 shadow-xl"
      >
        <Brand />
        <h1 className="mt-8 text-2xl font-semibold">
          {accepting ? "Accept your invitation" : "Choose a new password"}
        </h1>
        {meta && (
          <p className="mt-2 text-sm text-[#66746f]">
            {mode === "support"
              ? `Join the platform support team as ${meta.role === "support_administrator" ? "Support Administrator" : "Support Specialist"}.`
              : `Join ${meta.organizationName}${meta.hotelName ? ` at ${meta.hotelName}` : ""} as ${ROLE_NAMES[meta.role] || meta.role}.`}
          </p>
        )}
        <div className="mt-6 grid gap-4">
          {accepting && (
            <Field
              label="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <PasswordField
            label={
              accepting
                ? meta?.existingAccount
                  ? "Current password"
                  : "Create password"
                : "New password"
            }
            value={password}
            onChange={setPassword}
            newPassword
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm password"
            value={passwordConfirmation}
            onChange={setPasswordConfirmation}
            newPassword
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button className="bg-[#184f46]">
            {accepting ? "Complete secure setup" : "Reset password"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export default function HotelOperationsPage({
  mode,
  token,
}: {
  mode?: "invite" | "reset" | "support";
  token?: string;
}) {
  const [session, setSession] = useState<PortalSession | null | undefined>(
    undefined,
  );
  const [, navigate] = useLocation();
  const reload = () =>
    portalFetch("/session")
      .then((value) => setSession(value))
      .catch(() => setSession(null));
  useEffect(() => {
    void reload();
  }, []);
  if (mode && token) return <TokenPage mode={mode} token={token} />;
  if (session === undefined)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f2e9] text-[#54645f]">
        Loading secure portal…
      </div>
    );
  if (!session)
    return (
      <Landing
        onSignedIn={() => {
          reload();
          navigate("/hoteloperations/dashboard");
        }}
      />
    );
  if (session.organizations.length === 0 && session.supportRole) {
    navigate("/hoteloperations/admin/support");
    return null;
  }
  return <DashboardView session={session} reloadSession={reload} />;
}
