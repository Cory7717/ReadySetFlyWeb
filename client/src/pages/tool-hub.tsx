import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BookOpen, Calculator, CloudSun, FileText, Navigation, Plane, Radio, Route, Search, Signal } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
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
  const { isAuthenticated } = useAuth();
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
    <div className="min-h-screen">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,hsl(221_66%_19%),hsl(221_74%_34%))] py-10 text-slate-100 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="container mx-auto px-4 space-y-4">
          <span className="rsf-kicker border-white/10 bg-white/10 text-slate-100">Tool Center</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">One place for every RSF tool.</h1>
          <p className="max-w-3xl text-slate-300">
            Marketplace remains the front door. When you need tools, open this page and pick from Plan, Calculate, Train, Track, and Advanced.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200/90">
            <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">Marketplace first</span>
            <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">Tools centralized</span>
            <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1">Faster discovery</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild onClick={() => trackEvent("tool_hub_click", { target: "/marketplace" })}>
              <Link href="/marketplace">Open Marketplace</Link>
            </Button>
            <Button variant="outline" asChild className="border-slate-300/20 bg-white/5 text-slate-100 hover:bg-white/10">
              <Link href="/rentals">Browse Rentals</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 sm:py-10 space-y-8">
        <Card className="border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Open</CardTitle>
            <CardDescription>Type a tool name and jump directly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools (e.g., weight, notam, e6b, logbook)"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
            {query.trim() ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {quickMatches.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No matching tools found.</div>
                ) : (
                  quickMatches.map((tool) => (
                    <Button
                      key={tool.id}
                      asChild
                      variant="outline"
                      className="justify-start"
                      onClick={() => recordToolOpen(tool)}
                    >
                      <Link href={tool.path}>{tool.title}</Link>
                    </Button>
                  ))
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white text-slate-900 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pinned tools</CardTitle>
              <CardDescription>Tools you want at the top every session.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {pinnedTools.length === 0 ? (
                <span className="text-sm text-muted-foreground">No pinned tools yet.</span>
              ) : (
                pinnedTools.map((tool) => (
                  <Button key={tool.id} asChild variant="outline" size="sm" onClick={() => recordToolOpen(tool)}>
                    <Link href={tool.path}>{tool.title}</Link>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white text-slate-900 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent tools</CardTitle>
              <CardDescription>Last tools opened from this hub.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {recentTools.length === 0 ? (
                <span className="text-sm text-muted-foreground">No recent tools yet.</span>
              ) : (
                recentTools.map((tool) => (
                  <Button key={tool.id} asChild variant="outline" size="sm" onClick={() => recordToolOpen(tool)}>
                    <Link href={tool.path}>{tool.title}</Link>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {toolsByGroup.map(({ group, label, tools }) => (
          <div key={group} id={`tools-${group}`} className="space-y-4">
            <div className="space-y-1 border-l-4 border-primary pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">RSF Tool Group</div>
              <h2 className="text-2xl font-semibold text-slate-900">{label.title}</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">{label.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool) => {
                const Icon = iconMap[tool.id] ?? Route;
                const isComingSoon = tool.status === "coming_soon";
                const href = tool.path;
                const pinActive = pinnedIds.includes(tool.id);
                return (
                  <Card
                    key={tool.id}
                    className={[
                      "h-full border-white/12 bg-[linear-gradient(180deg,hsl(var(--card)/0.97),rgba(255,255,255,0.58))]",
                      isComingSoon ? "opacity-75" : "",
                    ].join(" ").trim()}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2 text-slate-900">
                            <Icon className="h-5 w-5 text-primary" />
                            {tool.title}
                          </CardTitle>
                          <CardDescription>{tool.description}</CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {tool.status ? (
                            <Badge variant={tool.status === "coming_soon" ? "outline" : "default"}>
                              {statusLabelMap[tool.status]}
                            </Badge>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => togglePinned(tool.id)}
                            className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            {pinActive ? "Pinned" : "Pin"}
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isComingSoon ? (
                        <Button className="w-full" variant="outline" disabled>
                          Coming soon
                        </Button>
                      ) : (
                        <Button className="w-full" asChild onClick={() => recordToolOpen(tool)}>
                          <Link href={href}>Open</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        <Card className="border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Need access before tools?</div>
                <div className="text-xs text-muted-foreground">
                  Start in Marketplace or Rentals, then return here for planning and training tools.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" onClick={() => trackEvent("tool_hub_click", { target: "/marketplace" })}>
                  <Link href="/marketplace">Marketplace</Link>
                </Button>
                <Button asChild variant="outline" onClick={() => trackEvent("tool_hub_click", { target: "/rentals" })}>
                  <Link href="/rentals">Rentals</Link>
                </Button>
                {!isAuthenticated ? (
                  <Button asChild>
                    <Link href="/register">Create free account</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
