import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { RSF_TOOLS } from "@/lib/tool-registry";
import { WORKFLOW_NAV_GROUPS, findWorkflowGroupForPath, type WorkflowNavItem } from "@/lib/workflow-nav";
import logoImage from "@assets/RSFOpaqueLogo_1761494760586.png";

type ToolSearchItem = {
  label: string;
  path: string;
  keywords: string[];
};

const CORE_SEARCH_ITEMS: ToolSearchItem[] = [
  ...WORKFLOW_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      label: item.label,
      path: item.href,
      keywords: [group.label.toLowerCase(), item.label.toLowerCase(), item.description.toLowerCase()],
    })),
  ),
  { label: "Tool Hub", path: "/tool-hub", keywords: ["tools", "pilot tools", "hub"] },
  { label: "FAQ", path: "/faq", keywords: ["faq", "help", "questions"] },
];

const TOOL_SEARCH_ITEMS: ToolSearchItem[] = [
  ...CORE_SEARCH_ITEMS,
  ...RSF_TOOLS.map((tool) => ({
    label: tool.status === "coming_soon" ? `${tool.title} (Coming Soon)` : tool.title,
    path: tool.path,
    keywords: tool.keywords,
  })),
];

function WorkflowItemLink({ item, onClick }: { item: WorkflowNavItem; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      className="block rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      onClick={() => {
        trackEvent("nav_click", { label: item.label, target: item.href });
        onClick?.();
      }}
    >
      <span className="font-semibold">{item.label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
    </Link>
  );
}

export function Header() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: unreadNotifications } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread"],
    enabled: !!user,
  });
  const unreadCount = unreadNotifications?.count ?? 0;
  const activeGroup = findWorkflowGroupForPath(location);

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";
  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0].toUpperCase() || "U";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolQuery, setToolQuery] = useState("");
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchRef = useRef<HTMLFormElement | null>(null);

  const toolMatches = useMemo(() => {
    const query = toolQuery.trim().toLowerCase();
    if (!query) return [];
    return TOOL_SEARCH_ITEMS.map((item) => {
      const label = item.label.toLowerCase();
      const keywords = item.keywords.map((keyword) => keyword.toLowerCase());
      let score = 0;
      if (label.startsWith(query)) score = 3;
      else if (label.includes(query)) score = 2;
      else if (keywords.some((keyword) => keyword.includes(query))) score = 1;
      return { item, score };
    })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map((entry) => entry.item)
      .slice(0, 7);
  }, [toolQuery]);

  useEffect(() => {
    setHighlightIndex((index) => Math.min(index, Math.max(0, toolMatches.length - 1)));
  }, [toolMatches]);

  useEffect(() => {
    setToolQuery("");
    setToolMenuOpen(false);
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchRef.current || searchRef.current.contains(event.target as Node)) return;
      setToolMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleToolSelect = (item: ToolSearchItem) => {
    trackEvent("tool_search_select", { label: item.label, target: item.path, query: toolQuery });
    setToolQuery("");
    setToolMenuOpen(false);
    setLocation(item.path);
  };

  const handleToolSubmit = () => {
    if (!toolQuery.trim()) return;
    if (toolMatches.length > 0) handleToolSelect(toolMatches[highlightIndex] || toolMatches[0]);
    else {
      trackEvent("tool_search_no_match", { query: toolQuery.trim() });
      setToolMenuOpen(false);
    }
  };

  const logoutHref = useMemo(() => {
    const base = apiUrl("/api/logout");
    if (typeof window === "undefined") return base;
    return `${base}?redirect=${encodeURIComponent(window.location.origin)}`;
  }, []);

  return (
    <header className="sticky top-0 z-[80] w-full border-b border-border bg-background/95 text-foreground shadow-sm backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex min-h-[4.25rem] items-center gap-2">
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-accent" data-testid="link-home">
            <img src={logoImage} alt="Ready Set Fly" className="h-9 w-9 sm:h-11 sm:w-11" />
            <span className="hidden font-display text-lg font-bold sm:inline">Ready Set Fly</span>
          </Link>

          <nav className="ml-2 hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary navigation">
            {WORKFLOW_NAV_GROUPS.map((group) => (
              <DropdownMenu key={group.id}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={activeGroup?.id === group.id ? "bg-accent text-accent-foreground" : ""}
                  >
                    {group.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[34rem] max-w-[calc(100vw-2rem)] p-3">
                  <DropdownMenuLabel>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">{group.label}</div>
                      <div className="text-xs font-normal text-muted-foreground">{group.description}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="grid gap-1 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <DropdownMenuItem key={`${group.id}-${item.label}`} asChild className="p-0">
                        <WorkflowItemLink item={item} />
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </nav>

          <form
            ref={searchRef}
            className="relative ml-auto hidden w-44 shrink-0 xl:block"
            onSubmit={(event) => {
              event.preventDefault();
              handleToolSubmit();
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search RSF"
              value={toolQuery}
              onChange={(event) => {
                setToolQuery(event.target.value);
                setToolMenuOpen(true);
              }}
              onFocus={() => setToolMenuOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && toolMatches.length) {
                  event.preventDefault();
                  setHighlightIndex((index) => Math.min(index + 1, toolMatches.length - 1));
                } else if (event.key === "ArrowUp" && toolMatches.length) {
                  event.preventDefault();
                  setHighlightIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  handleToolSubmit();
                } else if (event.key === "Escape") {
                  setToolMenuOpen(false);
                }
              }}
              className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Search tools and features"
              autoComplete="off"
            />
            {toolMenuOpen && toolQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
                {toolMatches.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches found.</div>
                ) : (
                  toolMatches.map((item, index) => (
                    <button
                      key={`${item.path}-${item.label}`}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleToolSelect(item);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${index === highlightIndex ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{item.path}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </form>

          <Button asChild className="hidden shrink-0 sm:inline-flex" data-testid="button-start-flight-plan">
            <Link href="/flight-planner" onClick={() => trackEvent("nav_click", { label: "start_flight_plan", target: "/flight-planner" })}>
              Start Flight Plan
            </Link>
          </Button>

          <div className="flex shrink-0 items-center gap-1">
            {user && (
              <Link href="/notifications" className="flex" data-testid="link-notifications">
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {!user ? (
              <Link href="/login">
                <Button variant="outline" data-testid="button-login">Sign In</Button>
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="button-profile-menu" aria-label="User menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/dashboard">Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/profile">Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/my-listings">My Listings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/messages">Messages</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/logbook">Pilot Logbook</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/my-aircraft">My Aircraft</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/tool-hub">Tool Hub</Link></DropdownMenuItem>
                  {user?.isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link href="/admin">Admin Dashboard</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href="/admin/aircraft-library">Aircraft Library</Link></DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={logoutHref} data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border pb-4 pt-3 lg:hidden">
            <Button asChild className="mb-3 w-full" data-testid="button-mobile-start-flight-plan">
              <Link href="/flight-planner" onClick={() => trackEvent("nav_click", { label: "mobile_start_flight_plan", target: "/flight-planner" })}>
                Start Flight Plan
              </Link>
            </Button>
            <div className="grid gap-2">
              {WORKFLOW_NAV_GROUPS.map((group) => (
                <details key={group.id} className="rounded-lg border border-border bg-card">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold text-card-foreground">
                    {group.label}
                    <ChevronDown className="h-4 w-4" />
                  </summary>
                  <div className="grid gap-1 border-t border-border p-2">
                    {group.items.map((item) => (
                      <WorkflowItemLink key={`${group.id}-mobile-${item.label}`} item={item} onClick={() => setMobileOpen(false)} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
