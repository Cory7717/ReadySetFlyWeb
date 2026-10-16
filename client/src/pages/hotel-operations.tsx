import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Banknote,
  BedDouble,
  BrainCircuit,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardPlus,
  Coins,
  DollarSign,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Gauge,
  HelpCircle,
  Hotel,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserCog,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SupportWidget from "@/components/hotel-operations/SupportWidget";
import PublicSalesInquiryWidget from "@/components/hotel-operations/PublicSalesInquiryWidget";

type PortalSession = {
  account: { id: string; email: string; displayName: string };
  organizations: Array<{
    id: string;
    name: string;
    organizationNumber: string;
    role: string;
    isDemo: boolean;
  }>;
  activeOrganizationId: string | null;
  supportRole?: string | null;
};
type HotelRecord = {
  id: string;
  propertyIdentifier: string;
  propertyCode: string;
  innCode?: string | null;
  accountingCode?: string | null;
  onboardingStatus: string;
  name: string;
  brand?: string | null;
  streetAddress?: string | null;
  city: string;
  state: string;
  postalCode?: string | null;
  phone?: string | null;
  timeZone: string;
  roomCount?: number | null;
  status: string;
  regionId?: string | null;
};
type RegionRecord = {
  id: string;
  name: string;
  code?: string | null;
  status: string;
};
type Dashboard = {
  organization: { id: string; name: string; organizationNumber: string; isDemo: boolean };
  role: string;
  canUseAllProperties: boolean;
  selectedHotelId: string | null;
  hotels: HotelRecord[];
  regions: RegionRecord[];
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
    "Daily Operations Reporting",
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
    "Employee Scheduling",
    "Property labor planning",
    "Requires Multi-Property Adaptation",
  ],
  [
    "incident_reporting",
    "Incident Management",
    "Controlled property documentation",
    "Preview Only",
  ],
  [
    "restaurant_operations",
    "Employee Tip Management",
    "Outlet controls and gratuities",
    "Requires Multi-Property Adaptation",
  ],
  [
    "meeting_group_calendar",
    "Group & Meeting Management",
    "Events, BEOs and group resumes",
    "Requires Multi-Property Adaptation",
  ],
  [
    "budget_financial",
    "Budget & Financial Intelligence",
    "Budget and ownership review",
    "Preview Only",
  ],
  [
    "bank_deposits",
    "Bank Deposits / Financial Controls",
    "Deposit reconciliation",
    "Preview Only",
  ],
  [
    "comptroller",
    "Financial Performance Analysis",
    "Financial oversight workspace",
    "Preview Only",
  ],
] as const;

type PortalTab = "overview" | "property" | "hotels" | "team" | "audit";
type NavigationAvailability = "available" | "development" | "planned";
type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  availability: NavigationAvailability;
  tab?: PortalTab;
  href?: string;
  action?: "support";
  moduleKey?: (typeof MODULES)[number][0];
  requiresPortfolioAdmin?: boolean;
  requiresTeamAdmin?: boolean;
  requiresPlatformOwner?: boolean;
  requiresRegionalOrPortfolio?: boolean;
};
type NavigationGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
};

const AUTHENTICATED_NAVIGATION: NavigationGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      {
        id: "command-center",
        label: "Property Command Center",
        icon: LayoutDashboard,
        availability: "available",
        tab: "overview",
      },
      {
        id: "property-overview",
        label: "Property Overview",
        icon: Hotel,
        availability: "available",
        tab: "property",
      },
    ],
  },
  {
    id: "revenue-finance",
    label: "Revenue & Finance",
    icon: DollarSign,
    items: [
      {
        id: "revenue-intelligence",
        label: "Revenue Intelligence",
        icon: TrendingUp,
        availability: "development",
        moduleKey: "revenue_intelligence",
      },
      {
        id: "budget-financial",
        label: "Budget & Financial Intelligence",
        icon: BarChart3,
        availability: "development",
        moduleKey: "budget_financial",
      },
      {
        id: "financial-controls",
        label: "Bank Deposits / Financial Controls",
        icon: Banknote,
        availability: "development",
        moduleKey: "bank_deposits",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: Users,
    items: [
      {
        id: "sales-intelligence",
        label: "Sales Intelligence",
        icon: TrendingUp,
        availability: "development",
        moduleKey: "sales_intelligence",
      },
      {
        id: "group-meetings",
        label: "Group & Meeting Management",
        icon: CalendarRange,
        availability: "development",
        moduleKey: "meeting_group_calendar",
      },
      {
        id: "dos-reporting",
        label: "Director of Sales Reporting",
        icon: FileSpreadsheet,
        availability: "development",
        moduleKey: "sales_intelligence",
      },
      {
        id: "crm",
        label: "CRM",
        icon: Users,
        availability: "planned",
      },
      {
        id: "account-leads",
        label: "Account & Lead Management",
        icon: UserPlus,
        availability: "planned",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: ClipboardCheck,
    items: [
      {
        id: "scheduling-labor",
        label: "Employee Scheduling & Labor",
        icon: CalendarRange,
        availability: "development",
        moduleKey: "staff_scheduling",
      },
      {
        id: "housekeeping-productivity",
        label: "Housekeeping Productivity",
        icon: BedDouble,
        availability: "development",
        moduleKey: "staff_scheduling",
      },
      {
        id: "daily-operations",
        label: "Daily Operations Reporting",
        icon: FileSpreadsheet,
        availability: "development",
        moduleKey: "operations_reporting",
      },
      {
        id: "incident-management",
        label: "Incident Management",
        icon: ClipboardPlus,
        availability: "development",
        moduleKey: "incident_reporting",
      },
      {
        id: "tip-management",
        label: "Employee Tip Management",
        icon: Coins,
        availability: "development",
        moduleKey: "restaurant_operations",
      },
    ],
  },
  {
    id: "inventory-maintenance",
    label: "Inventory & Maintenance",
    icon: Wrench,
    items: [
      { id: "maintenance-inventory", label: "Maintenance Inventory", icon: Wrench, availability: "planned" },
      { id: "housekeeping-inventory", label: "Housekeeping Inventory", icon: BedDouble, availability: "planned" },
      { id: "pantry-inventory", label: "Market / Pantry Inventory", icon: PackageSearch, availability: "planned" },
      { id: "asset-accountability", label: "Asset & Tool Accountability", icon: ClipboardCheck, availability: "planned" },
      { id: "preventive-maintenance", label: "Preventive Maintenance", icon: Wrench, availability: "planned" },
    ],
  },
  {
    id: "guest-experience",
    label: "Guest Experience",
    icon: Sparkles,
    items: [
      { id: "guest-intelligence", label: "Guest Experience Intelligence", icon: Sparkles, availability: "planned" },
      { id: "gss-analysis", label: "Forensic GSS Analysis", icon: BrainCircuit, availability: "planned" },
      { id: "room-heatmaps", label: "Room Condition Heat Maps", icon: BedDouble, availability: "planned" },
      { id: "corrective-actions", label: "Corrective Action Tracking", icon: ClipboardCheck, availability: "planned" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    items: [
      {
        id: "property-settings",
        label: "Property Settings",
        icon: Settings,
        availability: "available",
        tab: "hotels",
        requiresRegionalOrPortfolio: true,
      },
      {
        id: "user-management",
        label: "User & Department Management",
        icon: UserCog,
        availability: "available",
        tab: "team",
        requiresTeamAdmin: true,
      },
      {
        id: "audit-history",
        label: "Audit History",
        icon: ShieldCheck,
        availability: "available",
        tab: "audit",
        requiresRegionalOrPortfolio: true,
      },
      { id: "report-automation", label: "Report Automation", icon: FileSpreadsheet, availability: "planned" },
      { id: "subscription-billing", label: "Subscription & Billing", icon: Banknote, availability: "planned" },
      {
        id: "help-support",
        label: "Help & Support",
        icon: HelpCircle,
        availability: "available",
        action: "support",
      },
      {
        id: "platform-administration",
        label: "INNTRIX Platform Administration",
        icon: ShieldCheck,
        availability: "available",
        href: "/hoteloperations/admin",
        requiresPlatformOwner: true,
      },
    ],
  },
];

const PORTAL_PAGE_BRANDING: Record<
  PortalTab,
  { module: string; title: string }
> = {
  overview: {
    module: "INNTRIX | OPERATIONS",
    title: "Property Command Center",
  },
  property: {
    module: "INNTRIX | OPERATIONS",
    title: "Property Overview",
  },
  hotels: {
    module: "INNTRIX | ADMINISTRATION",
    title: "Property Settings",
  },
  team: {
    module: "INNTRIX | ADMINISTRATION",
    title: "User & Department Management",
  },
  audit: {
    module: "INNTRIX | ADMINISTRATION",
    title: "Audit History",
  },
};

const ROLE_NAMES: Record<string, string> = {
  platform_owner: "Platform Owner",
  above_property_admin: "Above Property Admin",
  regional_admin: "Regional Administrator / RVP",
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
    <div className="flex items-center gap-3" aria-label="INNTRIX, Hospitality Operations Intelligence">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#184f46] text-white">
        <Building2 size={21} />
      </div>
      <div className="min-w-0">
        <div className="font-bold tracking-[.14em] text-[#153d37]">
          INNTRIX
        </div>
        <div
          className={`${compact ? "hidden text-[8px] tracking-[.11em] sm:block" : "text-[10px] tracking-[.16em]"} whitespace-nowrap font-semibold uppercase text-[#997744]`}
        >
          Hospitality Operations Intelligence
        </div>
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

type CapabilityStatus = "Available" | "In Development" | "Planned";
type MarketingCapability = {
  icon: LucideIcon;
  title: string;
  status: CapabilityStatus;
  copy: string;
  roi?: {
    result: string;
    calculation: string;
    note: string;
  };
};

const CAPABILITY_GROUPS: Array<{
  eyebrow: string;
  title: string;
  copy: string;
  capabilities: MarketingCapability[];
}> = [
  {
    eyebrow: "Revenue & Sales Intelligence",
    title: "See performance, pace, and opportunity more clearly.",
    copy: "Existing property-level tools are being adapted for secure, multi-property INNTRIX use.",
    capabilities: [
      {
        icon: TrendingUp,
        title: "Revenue Intelligence",
        status: "In Development",
        copy: "Analyze on-the-books revenue, occupancy, ADR, booking pace, pickup, historical comparisons, budget variance, and potential demand opportunities.",
        roi: {
          result: "$18,250 potential annual gross room revenue uplift",
          calculation: "$5 ADR improvement × 10 rooms sold daily × 365 days",
          note: "Assumes the property can capture and sustain the modeled ADR improvement.",
        },
      },
      {
        icon: BarChart3,
        title: "Sales Intelligence",
        status: "In Development",
        copy: "Track account production, group opportunities, historical performance, account activity, and sales-development priorities.",
        roi: {
          result: "$5,000 potential gross room revenue",
          calculation: "40 incremental room nights × $125 ADR",
          note: "Illustrates the value of one incremental room-night opportunity.",
        },
      },
      {
        icon: DollarSign,
        title: "Budget & Financial Intelligence",
        status: "In Development",
        copy: "Monitor budget performance, compare results with prior-year benchmarks, and identify operating and financial variances.",
      },
      {
        icon: CalendarRange,
        title: "Group & Meeting Management",
        status: "In Development",
        copy: "Coordinate meeting-space events, group room blocks, event details, setup requirements, and sales activity in one calendar-driven workflow.",
      },
    ],
  },
  {
    eyebrow: "Operations & Management",
    title: "Connect daily work to stronger operational control.",
    copy: "Practical workflows help hotel teams reduce administrative friction and keep responsibilities visible.",
    capabilities: [
      {
        icon: Users,
        title: "Labor & Scheduling Intelligence",
        status: "In Development",
        copy: "Use demand-based staffing recommendations, employee schedules, room forecasts, and labor-efficiency analysis to support staffing decisions.",
        roi: {
          result: "$26,000 potential annual labor cost avoidance",
          calculation: "25 hours saved weekly × $20 per hour × 52 weeks",
          note: "Assumes hours can be reduced without affecting staffing requirements or service standards.",
        },
      },
      {
        icon: ClipboardCheck,
        title: "Operational Management",
        status: "Available",
        copy: "Centralize management workflows, operational accountability, controlled property access, and organization-level oversight.",
      },
      {
        icon: FileSpreadsheet,
        title: "Daily Operations Reporting",
        status: "In Development",
        copy: "Streamline weekly and daily management reports, departmental updates, operational reviews, and leadership communication.",
        roi: {
          result: "$6,500 in potential annual administrative capacity",
          calculation: "5 hours redirected weekly × $25 per hour × 52 weeks",
          note: "Represents time that may be redirected to higher-value operational work, not guaranteed payroll savings.",
        },
      },
      {
        icon: ClipboardPlus,
        title: "Incident Management",
        status: "In Development",
        copy: "Document incidents, maintain retrievable records, produce consistent reports, and support accountable management follow-up.",
      },
      {
        icon: Banknote,
        title: "Financial Controls & Reporting",
        status: "In Development",
        copy: "Support bank-deposit reconciliation, operating variance visibility, financial accountability, and related daily controls.",
      },
      {
        icon: Coins,
        title: "Employee Tip Management",
        status: "In Development",
        copy: "Simplify employee tip entry, event-tip allocation, documentation, pay-period review, and reporting workflows.",
      },
    ],
  },
  {
    eyebrow: "Advanced Intelligence",
    title: "Extend intelligence into the next operational opportunities.",
    copy: "These planned capabilities reflect the platform roadmap and are not represented as currently available modules.",
    capabilities: [
      {
        icon: PackageSearch,
        title: "Inventory Intelligence",
        status: "Planned",
        copy: "Manage maintenance tools, equipment, linen and supply counts, par levels, valuations, and Front Desk Market discrepancies.",
        roi: {
          result: "$3,000 potential annual inventory cost avoidance",
          calculation: "$250 in reduced inventory losses monthly × 12 months",
          note: "Actual opportunity depends on current purchasing controls, shrinkage, and inventory volume.",
        },
      },
      {
        icon: BrainCircuit,
        title: "Guest Experience Intelligence",
        status: "Planned",
        copy: "Support forensic guest-satisfaction analysis, complaint trends, issue identification, and corrective-action planning.",
        roi: {
          result: "$3,600 potential annual service-recovery cost avoidance",
          calculation: "2 avoided recovery costs monthly × $150 × 12 months",
          note: "Uses an illustrative recovery cost; guest issues and remedies vary by property.",
        },
      },
      {
        icon: BedDouble,
        title: "Room Condition Intelligence",
        status: "Planned",
        copy: "Connect room-specific complaint histories with recurring cleanliness and maintenance patterns and visual issue heat maps.",
      },
      {
        icon: Wrench,
        title: "Maintenance & Asset Management",
        status: "Planned",
        copy: "Track equipment location, condition, quantity, value, and replacement needs to improve asset visibility and purchasing decisions.",
        roi: {
          result: "$2,500 potential annual replacement cost avoidance",
          calculation: "5 premature equipment replacements avoided × $500 average cost",
          note: "Actual value depends on equipment condition, replacement cycles, and purchasing practices.",
        },
      },
      {
        icon: Gauge,
        title: "Operational ROI Intelligence",
        status: "In Development",
        copy: "The public labor opportunity calculator is available today; broader visibility into inventory, maintenance, and administrative efficiency is being developed.",
      },
    ],
  },
];

function CapabilityCard({ capability }: { capability: MarketingCapability }) {
  const { icon: Icon, title, status, copy, roi } = capability;
  const [roiOpen, setRoiOpen] = useState(false);
  const roiId = useId();
  const styles = {
    Available: {
      card: "border-[#d8d2c5] bg-white shadow-sm",
      icon: "bg-[#deebe6] text-[#174d45]",
      badge: "bg-[#e1eee9] text-[#175347]",
    },
    "In Development": {
      card: "border-[#d7c7a9] bg-[#fcfaf5]",
      icon: "bg-[#efe4cf] text-[#80602c]",
      badge: "bg-[#eee1c9] text-[#755626]",
    },
    Planned: {
      card: "border-dashed border-[#cfc8bb] bg-[#f1ede3]/70",
      icon: "bg-[#e5e1d8] text-[#666c68]",
      badge: "bg-[#e5e1d8] text-[#5f6763]",
    },
  }[status];

  return (
    <article className={`group relative flex h-full flex-col rounded-3xl border p-6 md:p-7 ${styles.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${styles.icon}`}>
          <Icon size={23} aria-hidden="true" />
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}>
          {status}
        </span>
      </div>
      <h3 className="mt-6 text-xl font-semibold">{title}</h3>
      <p className="mt-3 leading-7 text-[#65726e]">{copy}</p>
      {roi && (
        <div className="mt-auto pt-6">
          <button
            type="button"
            aria-expanded={roiOpen}
            aria-controls={roiId}
            aria-label={`${roiOpen ? "Hide" : "Show"} potential ROI example for ${title}`}
            onClick={() => setRoiOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setRoiOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#cfb98f] bg-[#f5eddd] px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#735525] transition hover:border-[#ae8444] hover:bg-[#eee0c6] focus:outline-none focus:ring-2 focus:ring-[#ae8444] focus:ring-offset-2"
          >
            <TrendingUp size={14} aria-hidden="true" /> Potential ROI
          </button>
          <div
            id={roiId}
            role="note"
            className={`${roiOpen ? "visible opacity-100 md:visible md:opacity-100" : "invisible opacity-0 md:invisible md:opacity-0 md:group-hover:visible md:group-hover:opacity-100"} absolute inset-x-4 bottom-16 z-10 rounded-2xl border border-[#ccb98f] bg-[#173f38] p-4 text-white shadow-xl transition-opacity duration-150`}
          >
            <p className="text-sm font-semibold leading-5 text-[#f0cf94]">{roi.result}</p>
            <p className="mt-2 text-xs font-medium leading-5 text-white/85">{roi.calculation}</p>
            <p className="mt-2 text-[11px] leading-4 text-white/55">{roi.note}</p>
          </div>
        </div>
      )}
    </article>
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
            <a href="#capabilities" className="hidden px-3 py-2 text-sm font-medium text-[#52645f] hover:text-[#174d45] md:block">
              Potential ROI
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
              <a href="#capabilities" className="inline-flex items-center gap-2 rounded-xl bg-[#c79a4f] px-5 py-3 font-semibold text-[#102d29] shadow-lg shadow-black/10 hover:bg-[#dab36f]">
                Explore potential value <ArrowRight size={17} />
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
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#9a7136]">A comprehensive operating platform</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Intelligence that helps hotel operators act.</h2>
          <p className="mt-5 text-lg leading-8 text-[#5d6b67]">Connect revenue visibility, labor decisions, financial accountability, and daily management workflows without losing property or portfolio context.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#5f6c68]" aria-label="Availability key">
          {[
            ["bg-[#2d7165]", "Available in INNTRIX"],
            ["bg-[#b18442]", "In development for INNTRIX"],
            ["bg-[#858b87]", "Planned capability"],
          ].map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-16 grid gap-16 md:gap-20">
          {CAPABILITY_GROUPS.map((group) => {
            const headingId = `capability-${group.eyebrow.toLowerCase().replace(/[^a-z]+/g, "-")}`;
            return (
              <section key={group.eyebrow} aria-labelledby={headingId}>
                <div className="grid gap-4 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#98713a]">{group.eyebrow}</p>
                    <h3 id={headingId} className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{group.title}</h3>
                  </div>
                  <p className="max-w-2xl leading-7 text-[#687570] lg:justify-self-end">{group.copy}</p>
                </div>
                <div className="mt-7 grid items-stretch gap-5 md:grid-cols-2">
                  {group.capabilities.map((capability) => (
                    <CapabilityCard key={capability.title} capability={capability} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <p className="mt-12 border-t border-[#ddd6c9] pt-5 text-xs leading-5 text-[#77817d]">
          Potential ROI examples are illustrative scenarios, not customer results or guaranteed outcomes. Actual financial impact depends on each property&apos;s occupancy, staffing requirements, rates, costs, operating practices, and ability to implement identified opportunities.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[1fr_.8fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#936d34]">Smarter Operations. Stronger Performance.</p>
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
          <div className="text-right text-sm text-white/55">
            <p>Smarter Operations. Stronger Performance.</p>
            <p className="mt-1 text-xs text-white/40">An independent Ready Set Fly product.</p>
          </div>
        </div>
      </footer>
      <PublicSalesInquiryWidget />
    </main>
  );
}

function HotelForm({
  organizationId,
  regions,
  onCreated,
}: {
  organizationId: string;
  regions: RegionRecord[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    propertyCode: "",
    innCode: "",
    accountingCode: "",
    regionId: "",
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
      body.regionId = form.regionId || null;
      await portalFetch(
        `/hotels?organizationId=${encodeURIComponent(organizationId)}`,
        {
        method: "POST",
        body: JSON.stringify(body),
        },
      );
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add hotel");
    }
  }
  const labels: Record<string, string> = {
    propertyCode: "Management property code",
    innCode: "Brand / PMS Inn Code (optional)",
    accountingCode: "Accounting code (optional)",
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
        <h3 className="font-semibold">Register a property</h3>
        <p className="text-sm text-[#687671]">
          Corporate registration adds the property to the authorized portfolio.
          INNTRIX assigns its permanent property identifier automatically.
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
      <label className="grid gap-1.5 text-sm font-medium">
        <span>Assigned region</span>
        <select
          className="h-10 rounded-md border border-[#d8d1c4] bg-white px-3"
          value={form.regionId}
          onChange={(event) => setForm({ ...form, regionId: event.target.value })}
        >
          <option value="">Unassigned / register only</option>
          {regions
            .filter((region) => region.status === "active")
            .map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
        </select>
      </label>
      {error && <p className="md:col-span-2 text-sm text-red-700">{error}</p>}
      <div className="md:col-span-2">
        <Button className="bg-[#184f46]">Register property</Button>
      </div>
    </form>
  );
}

function RegionalPropertyOnboarding({
  organizationId,
  hotels,
  onChanged,
}: {
  organizationId: string;
  hotels: HotelRecord[];
  onChanged: () => void;
}) {
  const [hotelId, setHotelId] = useState(hotels[0]?.id || "");
  const hotel = hotels.find((item) => item.id === hotelId) || hotels[0];
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!hotel) return;
    setHotelId(hotel.id);
    setForm({
      name: hotel.name || "",
      brand: hotel.brand || "",
      streetAddress: hotel.streetAddress || "",
      city: hotel.city || "",
      state: hotel.state || "",
      postalCode: hotel.postalCode || "",
      phone: hotel.phone || "",
      timeZone: hotel.timeZone || "America/Chicago",
      roomCount: hotel.roomCount == null ? "" : String(hotel.roomCount),
    });
  }, [hotelId, hotel?.id]);
  if (!hotel) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await portalFetch(
        `/hotels/${encodeURIComponent(hotel.id)}?organizationId=${encodeURIComponent(organizationId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...form,
            roomCount: form.roomCount ? Number(form.roomCount) : null,
          }),
        },
      );
      setMessage("Property onboarding information saved.");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save onboarding information");
    }
  }
  const fields = [
    ["name", "Property name"],
    ["brand", "Brand / affiliation"],
    ["streetAddress", "Street address"],
    ["city", "City"],
    ["state", "State / province"],
    ["postalCode", "Postal code"],
    ["phone", "Property phone"],
    ["timeZone", "IANA time zone"],
    ["roomCount", "Room count"],
  ];
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-[#d9d1c2] bg-white p-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <h3 className="font-semibold">Regional property onboarding</h3>
        <p className="text-sm text-[#687671]">
          Complete setup information only for properties corporate has already registered in your regions.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
        Registered property
        <select className="h-10 rounded-md border bg-white px-3" value={hotel.id} onChange={(event) => setHotelId(event.target.value)}>
          {hotels.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.propertyIdentifier}</option>)}
        </select>
      </label>
      {fields.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          type={key === "roomCount" ? "number" : "text"}
          value={form[key] || ""}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          required={["name", "city", "state", "timeZone"].includes(key)}
        />
      ))}
      {message && <p role="status" className="text-sm text-[#5f6e69] md:col-span-2">{message}</p>}
      <div className="md:col-span-2"><Button className="bg-[#184f46]">Save onboarding information</Button></div>
    </form>
  );
}

function RegionManagement({
  organizationId,
  hotels,
  onChanged,
}: {
  organizationId: string;
  hotels: HotelRecord[];
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>({ regions: [], unassignedHotels: [] });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const load = () =>
    portalFetch(`/regions?organizationId=${encodeURIComponent(organizationId)}`)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    void load();
  }, [organizationId]);
  async function createRegion(event: FormEvent) {
    event.preventDefault();
    try {
      await portalFetch("/regions", {
        method: "POST",
        body: JSON.stringify({ organizationId, name, code: code || null }),
      });
      setName("");
      setCode("");
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create region");
    }
  }
  async function updateRegion(region: any, values: Record<string, unknown>) {
    try {
      await portalFetch(`/regions/${encodeURIComponent(region.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ organizationId, ...values }),
      });
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update region");
    }
  }
  async function assignHotel(hotelId: string, regionId: string | null) {
    try {
      await portalFetch(`/hotels/${encodeURIComponent(hotelId)}/region`, {
        method: "PATCH",
        body: JSON.stringify({ organizationId, regionId }),
      });
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to assign hotel");
    }
  }
  return (
    <section className="rounded-2xl border border-[#d9d1c2] bg-white p-5">
      <h3 className="font-semibold">Regional portfolio structure</h3>
      <p className="mt-1 text-sm text-[#687671]">
        Regions belong to this organization. Moving a hotel updates RVP access
        immediately without changing the hotel’s historical records.
      </p>
      <form onSubmit={createRegion} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          placeholder="Region name"
          className="rounded-md border border-[#d8d1c4] px-3 py-2"
        />
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Code (optional)"
          className="rounded-md border border-[#d8d1c4] px-3 py-2"
        />
        <Button className="bg-[#184f46]">Create region</Button>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid gap-3">
        {data.regions.map((region: any) => (
          <div key={region.id} className="rounded-xl border border-[#ddd7cb] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>{region.name}</b>
                <div className="text-xs text-[#6b7974]">
                  {region.code || "No code"} · {region.hotels.length} properties ·{" "}
                  {region.status}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void updateRegion(region, {
                    status: region.status === "active" ? "inactive" : "active",
                  })
                }
              >
                {region.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                aria-label={`Rename ${region.name}`}
                value={edits[region.id] ?? region.name}
                onChange={(event) =>
                  setEdits({ ...edits, [region.id]: event.target.value })
                }
                className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void updateRegion(region, {
                    name: edits[region.id] ?? region.name,
                  })
                }
              >
                Save name
              </Button>
            </div>
            <div className="mt-3 text-sm text-[#687671]">
              RVPs: {region.administrators.map((admin: any) => admin.displayName).join(", ") || "None assigned"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <h4 className="text-sm font-semibold">Hotel region assignments</h4>
        <div className="mt-2 grid gap-2">
          {hotels.map((hotel) => (
            <label key={hotel.id} className="grid gap-2 rounded-lg bg-[#f6f3ec] p-3 text-sm sm:grid-cols-[1fr_220px] sm:items-center">
              <span><b>{hotel.name}</b> · {hotel.propertyCode}</span>
              <select
                aria-label={`Region for ${hotel.name}`}
                value={hotel.regionId || ""}
                onChange={(event) => void assignHotel(hotel.id, event.target.value || null)}
                className="rounded-md border bg-white px-3 py-2"
              >
                <option value="">Unassigned</option>
                {data.regions.filter((region: any) => region.status === "active").map((region: any) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function InviteForm({
  organizationId,
  hotels,
  regions,
  actorRole,
  onChanged,
}: {
  organizationId: string;
  hotels: HotelRecord[];
  regions: RegionRecord[];
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
              ["regional_admin", "Regional Administrator / RVP"],
              ["property_admin", "Property Admin / GM"],
              ["property_manager", "Property Manager"],
              ["property_employee", "Property Employee"],
            ]
          : actorRole === "above_property_admin"
            ? [
                ["regional_admin", "Regional Administrator / RVP"],
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
    regionIds: [] as string[],
  });
  const [message, setMessage] = useState("");
  const selectableHotels =
    form.role === "regional_admin"
      ? hotels.filter(
          (hotel) => hotel.regionId && form.regionIds.includes(hotel.regionId),
        )
      : hotels;
  useEffect(() => {
    if (!hotels.some((hotel) => hotel.id === form.hotelId))
      setForm((value) => ({
        ...value,
        hotelId: hotels[0]?.id || "",
        regionIds: [],
      }));
  }, [hotels, form.hotelId]);
  useEffect(() => {
    setForm((value) => ({
      ...value,
      hotelId: hotels[0]?.id || "",
      regionIds: [],
    }));
  }, [organizationId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...form,
        organizationId,
      };
      const result = await portalFetch("/invitations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage(
        result.invitation.emailStatus === "accepted" ||
          result.invitation.delivered
          ? "Invitation created and accepted by the email provider. Delivery to the inbox may still be pending."
          : result.demoLink
            ? `Email delivery unavailable. Demo link: ${result.demoLink}`
            : "Invitation created, but the email provider did not accept it. Check the email configuration or delivery logs before retrying.",
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
          {form.role === "regional_admin"
            ? "Invite Regional Administrator"
            : "Invite a property leader or team member"}
        </h3>
        <p className="text-sm text-[#687671]">
          Invitations are single-use and expire in 72 hours. Organization and
          property scope are derived from your authorized INNTRIX context.
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
          onChange={(e) =>
            setForm({
              ...form,
              role: e.target.value,
              regionIds:
                e.target.value === "regional_admin" ? form.regionIds : [],
              hotelId: "",
            })
          }
        >
          {roleOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {form.role === "regional_admin" && (
        <fieldset className="md:col-span-3">
          <legend className="mb-2 text-sm font-semibold">
            Authorized regions
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {regions.filter((region) => region.status === "active").map((region) => (
              <label
                key={region.id}
                className="flex items-center gap-2 rounded-lg border border-[#ddd7cb] p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.regionIds.includes(region.id)}
                  onChange={(event) => {
                    const regionIds = event.target.checked
                      ? [...form.regionIds, region.id]
                      : form.regionIds.filter((id) => id !== region.id);
                    setForm({
                      ...form,
                      regionIds,
                      hotelId: hotels.some(
                        (hotel) =>
                          hotel.id === form.hotelId &&
                          hotel.regionId &&
                          regionIds.includes(hotel.regionId),
                      )
                        ? form.hotelId
                        : hotels.find(
                            (hotel) =>
                              hotel.regionId &&
                              regionIds.includes(hotel.regionId),
                          )?.id || "",
                    });
                  }}
                />
                {region.name}
              </label>
            ))}
          </div>
          {regions.length === 0 && (
            <p className="mt-2 text-sm text-amber-800">
              Create and assign a region before inviting an RVP.
            </p>
          )}
        </fieldset>
      )}
      {form.role === "regional_admin" ? (
        <div className="rounded-xl border border-[#ddd7cb] bg-[#f7f4ed] p-3 text-sm md:col-span-3">
          <b>Invitation review</b>
          <div className="mt-1 text-[#60706b]">
            {form.regionIds.length
              ? `${form.regionIds.length} region${form.regionIds.length === 1 ? "" : "s"} selected · Initial context: ${selectableHotels.find((hotel) => hotel.id === form.hotelId)?.name || "No registered hotel is available in the selected regions"}`
              : "Select one or more regions. INNTRIX will derive a valid initial hotel from that regional scope."}
          </div>
        </div>
      ) : (
        <label className="grid gap-1.5 text-sm font-medium">
          <span>{form.role === "above_property_admin" ? "Initial property" : "Hotel"}</span>
          <select
            className="h-10 rounded-md border border-[#d8d1c4] bg-white px-3"
            value={form.hotelId}
            onChange={(e) => setForm({ ...form, hotelId: e.target.value })}
            required
            disabled={selectableHotels.length === 0}
          >
            <option value="">Select hotel</option>
            {selectableHotels.map((hotel) => (
              <option value={hotel.id} key={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {hotels.length === 0 && (
        <p className="md:col-span-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Create at least one hotel and property code for this organization
          before sending an invitation.
        </p>
      )}
      {!['above_property_admin', 'regional_admin'].includes(form.role) && (
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
        <Button
          className="bg-[#184f46]"
          disabled={
            hotels.length === 0 ||
            (form.role === "regional_admin" && selectableHotels.length === 0)
          }
        >
          <UserPlus size={16} /> Send invitation
        </Button>
      </div>
    </form>
  );
}

function TeamPanel({
  organizationId,
  hotels,
  regions,
  actorRole,
}: {
  organizationId: string;
  hotels: HotelRecord[];
  regions: RegionRecord[];
  actorRole: string;
}) {
  const [data, setData] = useState<{
    portfolioMembers: any[];
    regionalMembers: any[];
    members: any[];
    invitations: any[];
  }>({ portfolioMembers: [], regionalMembers: [], members: [], invitations: [] });
  const [error, setError] = useState("");
  const load = () =>
    portalFetch(`/team?organizationId=${encodeURIComponent(organizationId)}`)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [organizationId]);
  async function revoke(id: string) {
    try {
      await portalFetch(
        `/invitations/${encodeURIComponent(id)}/revoke?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "POST" },
      );
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
          organizationId,
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
        {
          method: "PATCH",
          body: JSON.stringify({ organizationId, status: "inactive" }),
        },
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to change portfolio access",
      );
    }
  }
  async function toggleRegionalAssignment(member: any, region: RegionRecord) {
    const assigned = member.regions.some((item: any) => item.id === region.id);
    try {
      await portalFetch(
        `/regions/${encodeURIComponent(region.id)}/members/${encodeURIComponent(member.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            organizationId,
            status: assigned ? "inactive" : "active",
          }),
        },
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to change regional access",
      );
    }
  }
  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <InviteForm
        organizationId={organizationId}
        hotels={hotels}
        regions={regions}
        actorRole={actorRole}
        onChanged={load}
      />
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
          {data.regionalMembers.map((member) => (
            <div
              key={`region-${member.id}`}
              className="rounded-lg bg-[#f6f3ec] p-3 text-sm"
            >
              <b>{member.displayName}</b>
              <div className="text-[#6b7974]">
                {member.email} · {ROLE_NAMES[member.role]} ·{" "}
                {member.regions.map((region: any) => region.name).join(", ") ||
                  "No active regions"}
              </div>
              {["platform_owner", "above_property_admin"].includes(actorRole) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {regions.filter((region) => region.status === "active").map((region) => {
                    const assigned = member.regions.some(
                      (item: any) => item.id === region.id,
                    );
                    return (
                      <Button
                        key={region.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleRegionalAssignment(member, region)}
                      >
                        {assigned ? `Remove ${region.name}` : `Add ${region.name}`}
                      </Button>
                    );
                  })}
                </div>
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
          {data.portfolioMembers.length + data.regionalMembers.length + data.members.length === 0 && (
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

function AuditPanel({ organizationId }: { organizationId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    portalFetch(`/audit?organizationId=${encodeURIComponent(organizationId)}`)
      .then((result) => setEvents(result.events || []))
      .catch((e) => setError(e.message));
  }, [organizationId]);
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
  const [location, navigate] = useLocation();
  const initialDashboardParams = new URLSearchParams(
    location.includes("?") ? location.slice(location.indexOf("?") + 1) : "",
  );
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [organizationId, setOrganizationId] = useState(
    initialDashboardParams.get("organizationId") ||
      session.activeOrganizationId ||
      session.organizations[0]?.id ||
      "",
  );
  const [hotelId, setHotelId] = useState(
    initialDashboardParams.get("hotelId") || "all",
  );
  const [regionId, setRegionId] = useState(
    initialDashboardParams.get("regionId") || "all",
  );
  const [tab, setTab] = useState<PortalTab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        AUTHENTICATED_NAVIGATION.map((group) => [group.id, true]),
      ),
  );
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
      await portalFetch(
        `/hotels/${encodeURIComponent(hotel.id)}?organizationId=${encodeURIComponent(organizationId)}`,
        {
        method: "PATCH",
        body: JSON.stringify({
          status: hotel.status === "active" ? "inactive" : "active",
        }),
        },
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update hotel");
    }
  }
  async function markHotelOperational(hotel: HotelRecord) {
    setError("");
    try {
      await portalFetch(
        `/hotels/${encodeURIComponent(hotel.id)}?organizationId=${encodeURIComponent(organizationId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ onboardingStatus: "operational" }),
        },
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete onboarding");
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
      "regional_admin",
      "property_admin",
      "property_manager",
    ].includes(dashboard.role);
  const canRegionalAudit =
    dashboard &&
    ["platform_owner", "above_property_admin", "regional_admin"].includes(
      dashboard.role,
    );
  const contextHotels = dashboard
    ? regionId === "all"
      ? dashboard.hotels
      : dashboard.hotels.filter((hotel) => hotel.regionId === regionId)
    : [];
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
  const isPlatformOwner = session.organizations.some(
    (organization) => organization.role === "platform_owner",
  );
  function isNavigationItemVisible(item: NavigationItem) {
    if (!dashboard) return false;
    if (item.requiresPlatformOwner && !isPlatformOwner) return false;
    if (item.requiresPortfolioAdmin && !canPortfolioAdmin) return false;
    if (item.requiresRegionalOrPortfolio && !canRegionalAudit) return false;
    if (item.requiresTeamAdmin && !canTeamAdmin) return false;
    if (!item.moduleKey || dashboard.canUseAllProperties) return true;
    return dashboard.permissions.some(
      (permission) =>
        permission.hotelId === dashboard.selectedHotelId &&
        permission.moduleKey === item.moduleKey &&
        permission.canView,
    );
  }
  const navigationGroups = AUTHENTICATED_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(isNavigationItemVisible),
  })).filter((group) => group.items.length > 0);
  const quickAccessItems = navigationGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.availability === "available" &&
        ["property-overview", "user-management", "help-support"].includes(
          item.id,
        ),
    );
  function activateNavigationItem(item: NavigationItem) {
    if (item.availability !== "available") return;
    if (item.tab) setTab(item.tab);
    if (item.href) navigate(item.href);
    if (item.action === "support") {
      const supportButton = document.querySelector<HTMLButtonElement>(
        '[aria-label="Open support"]',
      );
      supportButton?.click();
    }
    setMobileNavigationOpen(false);
  }
  function renderNavigation(compact = false, includeBrand = false) {
    return (
      <>
        {includeBrand &&
          (compact ? (
            <div
              title="INNTRIX — Smarter Operations. Stronger Performance."
              aria-label="INNTRIX"
              className="mb-3 grid h-11 w-full place-items-center rounded-xl border border-[#d7d0c4] bg-white text-xs font-black tracking-[.12em] text-[#184f46]"
            >
              IX
            </div>
          ) : (
            <div className="mb-3 rounded-2xl border border-[#d7d0c4] bg-white px-4 py-3">
              <div className="text-sm font-black tracking-[.16em] text-[#184f46]">
                INNTRIX
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8a6b35]">
                Smarter Operations. Stronger Performance.
              </div>
            </div>
          ))}
        <div
          className={`rounded-2xl bg-[#153f38] text-white ${compact ? "p-3" : "p-4"}`}
        >
          {compact ? (
            <button
              type="button"
              title={dashboard?.organization.name || "Organization"}
              aria-label={`Organization: ${dashboard?.organization.name || "loading"}`}
              onClick={() => setSidebarCollapsed(false)}
              className="grid w-full place-items-center rounded-xl p-2 hover:bg-white/10"
            >
              <Building2 size={20} />
            </button>
          ) : (
            <>
              <div className="text-xs uppercase tracking-widest text-[#b8d0c8]">
                Organization
              </div>
              <select
                aria-label="Organization"
                value={organizationId}
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  setHotelId("all");
                  setRegionId("all");
                }}
                className="mt-2 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-sm"
              >
                {session.organizations.map((organization) => (
                  <option
                    className="text-black"
                    value={organization.id}
                    key={organization.id}
                  >
                    {organization.name}
                  </option>
                ))}
              </select>
              {dashboard?.organization.organizationNumber && (
                <div className="mt-2 text-xs text-[#b8d0c8]">
                  INNTRIX Organization {dashboard.organization.organizationNumber}
                </div>
              )}
              {dashboard?.organization.isDemo && (
                <div className="mt-3 rounded-md bg-amber-300/20 px-2 py-1 text-xs text-amber-100">
                  Demo organization · fictional data only
                </div>
              )}
            </>
          )}
        </div>
        <nav aria-label="INNTRIX workspace" className="mt-4 grid gap-2">
          {navigationGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupIsActive = group.items.some((item) => item.tab === tab);
            if (compact) {
              return (
                <button
                  key={group.id}
                  type="button"
                  title={group.label}
                  aria-label={`${group.label} navigation`}
                  onClick={() => {
                    setSidebarCollapsed(false);
                    setExpandedGroups((current) => ({
                      ...current,
                      [group.id]: true,
                    }));
                  }}
                  className={`mx-auto grid h-11 w-11 place-items-center rounded-xl transition-colors ${
                    groupIsActive
                      ? "bg-[#153f38] text-white shadow-sm"
                      : "text-[#5c6c67] hover:bg-white"
                  }`}
                >
                  <GroupIcon size={19} />
                </button>
              );
            }
            const expanded = expandedGroups[group.id] ?? true;
            return (
              <div key={group.id} className="border-b border-[#ded8cc] pb-2 last:border-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedGroups((current) => ({
                      ...current,
                      [group.id]: !expanded,
                    }))
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[#52635e] hover:bg-white/70"
                >
                  <GroupIcon size={15} aria-hidden="true" />
                  <span className="min-w-0 flex-1">{group.label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <div className="mt-1 grid gap-1">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const available = item.availability === "available";
                      const active = Boolean(item.tab && item.tab === tab);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!available}
                          aria-current={active ? "page" : undefined}
                          aria-label={`${item.label}${available ? "" : `, ${item.availability === "planned" ? "planned" : "in development"}`}`}
                          onClick={() => activateNavigationItem(item)}
                          className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                            active
                              ? "bg-white font-semibold text-[#153f38] shadow-sm"
                              : available
                                ? "text-[#51625d] hover:bg-white/70 hover:text-[#153f38]"
                                : "cursor-not-allowed text-[#7b8783]"
                          }`}
                        >
                          <ItemIcon size={16} className="shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1">{item.label}</span>
                          {!available && (
                            <span className="shrink-0 rounded-full bg-[#e9e4da] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#78633d]">
                              {item.availability === "planned" ? "Planned" : "In dev"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </>
    );
  }
  return (
    <div className="min-h-screen bg-[#f4f2ec] text-[#17332e]">
      <header className="sticky top-0 z-20 border-b border-[#d9d4c8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavigationOpen}
              onClick={() => setMobileNavigationOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d9d4c8] text-[#153f38] lg:hidden"
            >
              <Menu size={20} />
            </button>
            <Brand compact />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">
                {session.account.displayName}
              </div>
              <div className="text-xs text-[#71807b]">
                {session.account.email}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      {mobileNavigationOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setMobileNavigationOpen(false)} className="absolute inset-0 bg-[#0d2722]/55" />
          <aside role="dialog" aria-modal="true" aria-label="INNTRIX navigation" className="absolute inset-y-0 left-0 w-[min(340px,calc(100vw-2rem))] overflow-y-auto bg-[#f4f2ec] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button type="button" aria-label="Close navigation" onClick={() => setMobileNavigationOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9d4c8] bg-white"><X size={19} /></button>
            </div>
            {renderNavigation(false)}
            <div className="mt-5 border-t border-[#d9d4c8] pt-4">
              <div className="text-sm font-semibold">{session.account.displayName}</div>
              <div className="truncate text-xs text-[#71807b]">{session.account.email}</div>
              <Button className="mt-3 w-full" variant="outline" size="sm" onClick={logout}><LogOut size={15} /> Sign out</Button>
            </div>
          </aside>
        </div>
      )}
      <div className={`mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-5 ${sidebarCollapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[290px_1fr]"}`}>
        <aside className="sticky top-[77px] hidden max-h-[calc(100vh-92px)] self-start overflow-y-auto pb-4 lg:block">
          <div className="flex justify-end pb-2">
            <button
              type="button"
              title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#5c6c67] hover:bg-white"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          {renderNavigation(sidebarCollapsed, true)}
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
                    {PORTAL_PAGE_BRANDING[tab].module}
                  </div>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    {PORTAL_PAGE_BRANDING[tab].title}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#687671]">
                    <span className="rounded-full bg-[#e8eee9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#31594f]">
                      {ROLE_NAMES[dashboard.role] || dashboard.role}
                    </span>
                    {activeHotel
                      ? `${activeHotel.name} · ${activeHotel.propertyCode}`
                      : `${dashboard.organization.name} · All authorized properties`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                {dashboard.regions.length > 0 && (
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#61716c]">
                    <span>Region context</span>
                    <select
                      className="min-w-52 rounded-lg border border-[#d3ccbf] bg-white px-3 py-2 text-sm normal-case tracking-normal"
                      value={regionId}
                      onChange={(event) => {
                        setRegionId(event.target.value);
                        setHotelId("all");
                      }}
                    >
                      <option value="all">All authorized regions</option>
                      {dashboard.regions.map((region) => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
                    </select>
                  </label>
                )}
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
                    {contextHotels.map((hotel) => (
                      <option value={hotel.id} key={hotel.id}>
                        {hotel.name} · {hotel.propertyCode}
                      </option>
                    ))}
                  </select>
                </label>
                </div>
              </div>
              {tab === "overview" && (
                <>
                  <section className="mb-6 rounded-2xl border border-[#d8d1c4] bg-[#153f38] p-5 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Quick access</h2>
                        <p className="mt-1 text-sm text-white/70">
                          Open the authorized property tools you use most often.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {quickAccessItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => activateNavigationItem(item)}
                              className="flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <Icon size={16} aria-hidden="true" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
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
              {tab === "property" && (
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {dashboard.hotels.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-[#cfc5b2] bg-white p-10 text-center">
                      <Hotel className="mx-auto text-[#98763c]" />
                      <h2 className="mt-3 font-semibold">No authorized properties</h2>
                      <p className="mt-1 text-sm text-[#6c7975]">
                        Contact your organization administrator if a property assignment is missing.
                      </p>
                    </div>
                  ) : (
                    dashboard.hotels.map((hotel) => (
                      <article
                        key={hotel.id}
                        className={`rounded-2xl border bg-white p-5 ${hotel.id === dashboard.selectedHotelId ? "border-[#9b783b] shadow-sm" : "border-[#ddd7cb]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="font-semibold">{hotel.name}</h2>
                            <p className="mt-1 text-sm text-[#687671]">
                              {hotel.propertyIdentifier} · {hotel.city}, {hotel.state}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${hotel.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-[#eee9df] text-[#766b58]"}`}>
                            {hotel.status}
                          </span>
                        </div>
                        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#ece7dd] pt-4 text-sm">
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-[#78847f]">Brand</dt>
                            <dd className="mt-1 font-medium">{hotel.brand || "Independent / unassigned"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-[#78847f]">Rooms</dt>
                            <dd className="mt-1 font-medium">{hotel.roomCount || "Pending"}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-xs uppercase tracking-wide text-[#78847f]">Onboarding</dt>
                            <dd className="mt-1 font-medium capitalize">{hotel.onboardingStatus.replaceAll("_", " ")}</dd>
                          </div>
                        </dl>
                        {hotel.id !== dashboard.selectedHotelId && (
                          <button
                            type="button"
                            onClick={() => setHotelId(hotel.id)}
                            className="mt-4 text-sm font-semibold text-[#176253] underline-offset-4 hover:underline"
                          >
                            Use this property context
                          </button>
                        )}
                      </article>
                    ))
                  )}
                </section>
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
                              {hotel.propertyIdentifier} · {hotel.propertyCode} · {hotel.city}, {hotel.state}{" "}
                              · {hotel.onboardingStatus.replaceAll("_", " ")}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {hotel.onboardingStatus === "gm_accepted" &&
                              canRegionalAudit && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void markHotelOperational(hotel)}
                                >
                                  Mark operational
                                </Button>
                              )}
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
                        </div>
                      ))}
                    </div>
                  )}
                  {dashboard.role === "regional_admin" && (
                    <RegionalPropertyOnboarding
                      organizationId={organizationId}
                      hotels={dashboard.hotels}
                      onChanged={() => void load()}
                    />
                  )}
                  {canPortfolioAdmin && (
                    <>
                      <RegionManagement
                        organizationId={organizationId}
                        hotels={dashboard.hotels}
                        onChanged={() => void load()}
                      />
                      <HotelForm
                        organizationId={organizationId}
                        regions={dashboard.regions}
                        onCreated={() => void load()}
                      />
                    </>
                  )}
                </div>
              )}
              {tab === "team" &&
                (canTeamAdmin ? (
                  <TeamPanel
                    organizationId={organizationId}
                    hotels={dashboard.hotels}
                    regions={dashboard.regions}
                    actorRole={dashboard.role}
                  />
                ) : (
                  <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#697671]">
                    Team administration is managed by your authorized property
                    or portfolio administrator.
                  </div>
                ))}
              {tab === "audit" && canRegionalAudit && (
                <AuditPanel organizationId={organizationId} />
              )}
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
      let result: any;
      if (mode === "invite")
        result = await portalFetch(`/invitations/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          body: JSON.stringify({ displayName, password, passwordConfirmation }),
        });
      else if (mode === "support")
        result = await portalFetch(
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
        result = await portalFetch(`/password-reset/${encodeURIComponent(token)}`, {
          method: "POST",
          body: JSON.stringify({ password, passwordConfirmation }),
        });
      navigate(
        mode === "support"
          ? "/hoteloperations/admin/support"
          : mode === "invite"
            ? result?.returnTo || "/hoteloperations/dashboard"
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
              : `Join ${meta.organizationName}${meta.organizationNumber ? ` (INNTRIX Organization ${meta.organizationNumber})` : ""}${meta.regionNames?.length ? ` for ${meta.regionNames.join(", ")}` : ""}${meta.hotelName ? ` at ${meta.hotelName}` : ""} as ${ROLE_NAMES[meta.role] || meta.role}.`}
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
