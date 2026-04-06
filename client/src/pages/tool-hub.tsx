import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BookOpen, Calculator, CloudSun, FileText, Navigation, Plane, Radio, Route, Search, Signal } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { canUseInternalPreview } from "@/lib/internal-preview";
import { getCurrentReturnTo, withReturnTo, withSourceParam } from "@/lib/returnTo";
import { RSF_TOOLS, TOOL_GROUP_LABELS, type ToolGroupId, type ToolRegistryItem } from "@/lib/tool-registry";

const RECENT_TOOLS_KEY = "rsf.toolHub.recent";
const PINNED_TOOLS_KEY = "rsf.toolHub.pinned";

const GROUP_ORDER: ToolGroupId[] = ["plan", "calculate", "train", "track", "advanced"];

const statusLabelMap: Record<string, string> = {
  coming_soon: "Coming soon",
  beta: "Beta",
  pro: "Pro",
};

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  "flight-planner": Plane,
  "airport-conditions": CloudSun,
  "tfr-map": AlertTriangle,
  "approach-plates": FileText,
  "aviation-weather": CloudSun,
  e6b: Calculator,
  "pilot-calculators": Calculator,
  "weight-balance": Calculator,
  "ownership-cost": Calculator,
  "radio-comms": Signal,
  "ifr-tools": Radio,
  "student-hub": BookOpen,
  logbook: FileText,
  "live-traffic": Plane,
  "synthetic-vision": Navigation,
  "gps-sims": Route,
};

type PathEntry = {
  path: string;
  label: string;
  desc: string;
  Icon: ComponentType<{ className?: string }>;
};

const MARKETPLACE_PATHS: PathEntry[] = [
  { path: "/marketplace", label: "Marketplace", desc: "Aircraft listings, aviation services, and classifieds", Icon: Plane },
  { path: "/rentals", label: "Rentals", desc: "Rent aircraft by the hour from local operators", Icon: Route },
  { path: "/cfi", label: "CFI Directory", desc: "Find certified flight instructors near you", Icon: BookOpen },
  { path: "/flying-clubs", label: "Flying Clubs", desc: "Club memberships, scheduling, and shared access", Icon: Signal },
];

const PILOT_TOOL_PATHS: PathEntry[] = [
  { path: "/pilot-tools", label: "Pilot Tools", desc: "Full suite of aviation calculators and references", Icon: Calculator },
  { path: "/weight-balance", label: "Weight & Balance", desc: "Load calculations and CG envelope checks", Icon: Calculator },
  { path: "/e6b", label: "E6B Calculator", desc: "Flight computer for time, speed, distance, and fuel", Icon: Calculator },
  { path: "/ifr-tools", label: "IFR Tools", desc: "Approach, hold, and instrument procedure references", Icon: Radio },
];

const PLAN_TRACK_PATHS: PathEntry[] = [
  { path: "/flight-planner", label: "Flight Planner", desc: "End-to-end route planning with weather and NOTAMs", Icon: Plane },
  { path: "/logbook", label: "Pilot Logbook", desc: "Digital logbook with currency tracking and history", Icon: FileText },
  { path: "/tfr-map", label: "TFR Map", desc: "Live temporary flight restrictions across the US", Icon: AlertTriangle },
  { path: "/aviation-weather", label: "Aviation Weather", desc: "METARs, TAFs, AIRMETs, and weather products", Icon: CloudSun },
];

const CABIN_BRIEF_PATHS: PathEntry[] = [
  { path: "/cabin-brief", label: "Cabin Brief", desc: "Passenger-facing AI weather briefing for non-pilots", Icon: CloudSun },
];

function readStringArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    return;
  }
}

export default function ToolHub() {
  const { isAuthenticated, user } = useAuth();
  const canPreviewInternal = canUseInternalPreview(user);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    trackEvent("tool_hub_view");
    setRecentIds(readStringArray(RECENT_TOOLS_KEY));
    setPinnedIds(readStringArray(PINNED_TOOLS_KEY));
  }, []);

  const toolsByGroup = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      label: TOOL_GROUP_LABELS[group],
      tools: RSF_TOOLS.filter((tool) => tool.group === group),
    }));
  }, []);

  const recentTools = useMemo(() => {
    const byId = new Map(RSF_TOOLS.map((tool) => [tool.id, tool]));
    return recentIds.map((id) => byId.get(id)).filter((tool): tool is ToolRegistryItem => Boolean(tool));
  }, [recentIds]);

  const pinnedTools = useMemo(() => {
    const byId = new Map(RSF_TOOLS.map((tool) => [tool.id, tool]));
    return pinnedIds.map((id) => byId.get(id)).filter((tool): tool is ToolRegistryItem => Boolean(tool));
  }, [pinnedIds]);

  const quickMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return RSF_TOOLS.filter((tool) => {
      if (tool.title.toLowerCase().includes(term)) return true;
      return tool.keywords.some((keyword) => keyword.includes(term));
    }).slice(0, 8);
  }, [query]);

  const recordToolOpen = (tool: ToolRegistryItem) => {
    trackEvent("tool_hub_click", { target: tool.path, tool: tool.id });
    const next = [tool.id, ...recentIds.filter((id) => id !== tool.id)].slice(0, 8);
    setRecentIds(next);
    writeStringArray(RECENT_TOOLS_KEY, next);
  };

  const togglePinned = (toolId: string) => {
    const isPinned = pinnedIds.includes(toolId);
    const next = isPinned ? pinnedIds.filter((id) => id !== toolId) : [toolId, ...pinnedIds].slice(0, 12);
    setPinnedIds(next);
    writeStringArray(PINNED_TOOLS_KEY, next);
  };

  return (
    <div className="min-h-screen bg-[#0A0E14]">
      {/* Hero */}
      <section className="border-b border-[#1c3147] bg-[linear-gradient(135deg,#0d1622,#0f2236)] py-10 text-[#E8EDF4] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <div className="container mx-auto px-4 space-y-4">
          <span className="rsf-kicker border-[#29415e] bg-[#0d1622] text-[#7A9BB8]">PILOT TOOL HUB</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F1F5FA]">Aviation tools for every phase of flight.</h1>
          <p className="max-w-3xl text-[#7A9BB8]">
            Start free with planning, weather, and calculators. Upgrade later when saved workflow, repeat-use speed, and cleaner records start to matter.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6D88A6]">
            <span className="rounded-full border border-[#29415e] bg-[#0d1622] px-3 py-1">FLIGHT PLANNING</span>
            <span className="rounded-full border border-[#29415e] bg-[#0d1622] px-3 py-1">WEATHER & WEATHER TOOLS</span>
            <span className="rounded-full border border-[#29415e] bg-[#0d1622] px-3 py-1">TRAINING & CALCULATORS</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild onClick={() => trackEvent("tool_hub_click", { target: "/marketplace" })}>
              <Link href="/marketplace">Open Marketplace</Link>
            </Button>
            <Button variant="outline" asChild className="border-[#29415e] bg-[#0d1622] text-[#E8EDF4] hover:bg-[#15304b]">
              <Link href="/rentals">Browse Rentals</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 sm:py-10 space-y-8">

        {/* Quick Open */}
        <div className="rounded-xl border border-[#203249] bg-[#0d1622] p-5 shadow-sm">
          <div className="mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Quick Open</div>
            <p className="mt-1 text-xs text-[#7A9BB8]">Type a tool name and jump directly.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6480]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools (e.g., weight, notam, e6b, logbook)"
              className="h-10 w-full rounded-md border border-[#29415e] bg-[#0A0E14] pl-9 pr-3 text-sm text-[#F1F5FA] placeholder:text-[#4a6480] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#29415e]"
            />
          </div>
          {query.trim() ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {quickMatches.length === 0 ? (
                <div className="text-sm text-[#7A9BB8]">No matching tools found.</div>
              ) : (
                quickMatches.map((tool) => (
                  <Button
                    key={tool.id}
                    asChild
                    variant="outline"
                    className="justify-start border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]"
                    onClick={() => recordToolOpen(tool)}
                  >
                    <Link href={tool.path}>{tool.title}</Link>
                  </Button>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Pro value panel */}
        <div className="rounded-xl border border-[#203249] bg-[#0d1622] shadow-sm">
          <div className="grid gap-4 p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D9A441]">Why RSF Pro Exists</div>
              <h2 className="text-2xl font-semibold text-[#F1F5FA]">Pilots do not pay for "advanced features." They pay to stop redoing work.</h2>
              <p className="max-w-3xl text-sm leading-6 text-[#7A9BB8]">
                RSF Pro becomes useful when you want saved plans, saved aircraft assumptions, practice history, logbook continuity, and reminders that keep repeat flying easier.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#203249] bg-[#0f1a28] px-4 py-3">
                  <div className="text-sm font-semibold text-[#F1F5FA]">Free</div>
                  <div className="mt-1 text-xs text-[#7A9BB8]">Explore tools, plan one-offs, browse marketplace value.</div>
                </div>
                <div className="rounded-xl border border-[#203249] bg-[#0f1a28] px-4 py-3">
                  <div className="text-sm font-semibold text-[#F1F5FA]">Pro</div>
                  <div className="mt-1 text-xs text-[#7A9BB8]">Save repeat workflows, keep history, and reduce planning/admin friction.</div>
                </div>
                <div className="rounded-xl border border-[#203249] bg-[#0f1a28] px-4 py-3">
                  <div className="text-sm font-semibold text-[#F1F5FA]">Pro+</div>
                  <div className="mt-1 text-xs text-[#7A9BB8]">Layer on deeper planning context and power-user tools as they ship.</div>
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-[#203249] bg-[#0f1a28] p-4">
              <div className="text-sm font-semibold text-[#F1F5FA]">Best next step</div>
              <div className="text-sm text-[#7A9BB8]">
                Use the free tools first. If you keep coming back to the same workflows, that is your upgrade moment.
              </div>
              <div className="flex flex-wrap gap-2">
                {!isAuthenticated ? (
                  <Button asChild>
                    <Link href={withReturnTo("/register", getCurrentReturnTo())}>Create free account</Link>
                  </Button>
                ) : null}
                <Button
                  asChild
                  variant="outline"
                  className="border-[#29415e] bg-[#0d1622] text-[#E8EDF4] hover:bg-[#15304b]"
                  onClick={() => trackEvent("subscription_cta_click", { source_page: "/tool-hub", target: "/logbook/pro", context: "tool_hub_value_panel" })}
                >
                  <Link href={withSourceParam("/logbook/pro", "/tool-hub")}>See Pro plans</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Pinned + Recent */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#203249] bg-[#0d1622] p-4 shadow-sm">
            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Pinned Tools</div>
              <p className="mt-0.5 text-xs text-[#7A9BB8]">Tools you want at the top every session.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pinnedTools.length === 0 ? (
                <span className="text-sm text-[#7A9BB8]">No pinned tools yet.</span>
              ) : (
                pinnedTools.map((tool) => (
                  <Button key={tool.id} asChild variant="outline" size="sm"
                    className="border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]"
                    onClick={() => recordToolOpen(tool)}>
                    <Link href={tool.path}>{tool.title}</Link>
                  </Button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#203249] bg-[#0d1622] p-4 shadow-sm">
            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Recent Tools</div>
              <p className="mt-0.5 text-xs text-[#7A9BB8]">Last tools opened from this hub.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentTools.length === 0 ? (
                <span className="text-sm text-[#7A9BB8]">No recent tools yet.</span>
              ) : (
                recentTools.map((tool) => (
                  <Button key={tool.id} asChild variant="outline" size="sm"
                    className="border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]"
                    onClick={() => recordToolOpen(tool)}>
                    <Link href={tool.path}>{tool.title}</Link>
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Section 1 — MARKETPLACE */}
        <div className="space-y-3">
          <div className="border-l-2 border-[#D9A441] pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Marketplace</div>
            <p className="mt-0.5 text-xs text-[#7A9BB8]">Aircraft rentals, listings, CFI directory, and services</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MARKETPLACE_PATHS.map(({ path, label, desc, Icon }) => (
              <Link key={path} href={path} onClick={() => trackEvent("tool_hub_click", { target: path })}>
                <div className="rounded-xl border border-[#29415e] bg-[#0f1a28] p-4 hover:bg-[#15304b] transition cursor-pointer h-full">
                  <Icon className="h-5 w-5 text-[#D9A441] mb-2" />
                  <div className="text-sm font-semibold text-[#F1F5FA]">{label}</div>
                  <div className="mt-1 text-xs text-[#7A9BB8]">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2 — PILOT TOOLS */}
        <div className="space-y-3">
          <div className="border-l-2 border-[#D9A441] pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Pilot Tools</div>
            <p className="mt-0.5 text-xs text-[#7A9BB8]">Calculators, trainers, and aviation references</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PILOT_TOOL_PATHS.map(({ path, label, desc, Icon }) => (
              <Link key={path} href={path} onClick={() => trackEvent("tool_hub_click", { target: path })}>
                <div className="rounded-xl border border-[#29415e] bg-[#0f1a28] p-4 hover:bg-[#15304b] transition cursor-pointer h-full">
                  <Icon className="h-5 w-5 text-[#D9A441] mb-2" />
                  <div className="text-sm font-semibold text-[#F1F5FA]">{label}</div>
                  <div className="mt-1 text-xs text-[#7A9BB8]">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 3 — PLAN & TRACK */}
        <div className="space-y-3">
          <div className="border-l-2 border-[#D9A441] pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Plan & Track</div>
            <p className="mt-0.5 text-xs text-[#7A9BB8]">Flight planning, logbook, airspace, and route tools</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_TRACK_PATHS.map(({ path, label, desc, Icon }) => (
              <Link key={path} href={path} onClick={() => trackEvent("tool_hub_click", { target: path })}>
                <div className="rounded-xl border border-[#29415e] bg-[#0f1a28] p-4 hover:bg-[#15304b] transition cursor-pointer h-full">
                  <Icon className="h-5 w-5 text-[#D9A441] mb-2" />
                  <div className="text-sm font-semibold text-[#F1F5FA]">{label}</div>
                  <div className="mt-1 text-xs text-[#7A9BB8]">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 4 — CABIN BRIEF (gold tint) */}
        <div className="space-y-3">
          <div className="border-l-2 border-[#D9A441] pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6D88A6]">Cabin Brief</div>
            <p className="mt-0.5 text-xs text-[#7A9BB8]">Passenger-facing AI weather briefing for non-pilots</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CABIN_BRIEF_PATHS.map(({ path, label, desc, Icon }) => (
              <Link key={path} href={path} onClick={() => trackEvent("tool_hub_click", { target: path })}>
                <div className="rounded-xl border border-[#5b4520] bg-[#1a1208] p-4 hover:bg-[#231a0c] transition cursor-pointer h-full">
                  <Icon className="h-5 w-5 text-[#D9A441] mb-2" />
                  <div className="text-sm font-semibold text-[#F5C86A]">{label}</div>
                  <div className="mt-1 text-xs text-[#a88a4a]">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-xl border border-[#203249] bg-[#0d1622] shadow-sm">
          <div className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[#F1F5FA]">Need access before tools?</div>
                <div className="text-xs text-[#7A9BB8]">
                  Start in Marketplace or Rentals, then return here for planning and training tools.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline"
                  className="border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]"
                  onClick={() => trackEvent("tool_hub_click", { target: "/marketplace" })}>
                  <Link href="/marketplace">Marketplace</Link>
                </Button>
                <Button asChild variant="outline"
                  className="border-[#29415e] bg-[#0f1a28] text-[#E8EDF4] hover:bg-[#15304b]"
                  onClick={() => trackEvent("tool_hub_click", { target: "/rentals" })}>
                  <Link href="/rentals">Rentals</Link>
                </Button>
                {!isAuthenticated ? (
                  <Button asChild>
                    <Link href={withReturnTo("/register", getCurrentReturnTo())}>Create free account</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
