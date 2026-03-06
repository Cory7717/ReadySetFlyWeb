import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiUrl } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoImage from "@assets/RSFOpaqueLogo_1761494760586.png";
import { trackEvent } from "@/lib/analytics";
import { RSF_TOOLS } from "@/lib/tool-registry";

type ToolSearchItem = {
  label: string;
  path: string;
  keywords: string[];
};

const CORE_SEARCH_ITEMS: ToolSearchItem[] = [
  {
    label: "Marketplace",
    path: "/marketplace",
    keywords: ["marketplace", "listings", "aviation services", "flight schools"],
  },
  {
    label: "Rentals",
    path: "/rentals",
    keywords: ["rentals", "aircraft rental", "rent airplane"],
  },
  {
    label: "FAQ",
    path: "/faq",
    keywords: ["faq", "help", "questions"],
  },
  {
    label: "CFI Directory",
    path: "/cfi",
    keywords: ["cfi", "instructor", "flight instructor"],
  },
  {
    label: "Tool Hub",
    path: "/tool-hub",
    keywords: ["tool hub", "all tools", "pilot tools"],
  },
];

const TOOL_SEARCH_ITEMS: ToolSearchItem[] = [
  ...CORE_SEARCH_ITEMS,
  ...RSF_TOOLS.map((tool) => ({
    label: tool.status === "coming_soon" ? `${tool.title} (Coming Soon)` : tool.title,
    path: tool.path,
    keywords: tool.keywords,
  })),
];

export function Header() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: unreadNotifications } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread"],
    enabled: !!user,
  });
  const unreadCount = unreadNotifications?.count ?? 0;

  const isPlanner = location.startsWith("/flight-planner");
  const isTraining = location.startsWith("/student") || location.startsWith("/start-flying");
  const isTools = location.startsWith("/tool-hub") || location.startsWith("/pilot-tools") || location.startsWith("/ifr-tools");
  const isFaq = location === "/faq";
  const isCfi = location.startsWith("/cfi") || location.startsWith("/dashboard/cfi");
  const isMarketplace = location.startsWith("/marketplace");
  const isRentals = location.startsWith("/rentals");

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0].toUpperCase() || "U";

  const [toolQuery, setToolQuery] = useState("");
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchRef = useRef<HTMLFormElement | null>(null);

  const toolMatches = useMemo(() => {
    const query = toolQuery.trim().toLowerCase();
    if (!query) return [];
    const scored = TOOL_SEARCH_ITEMS.map((item) => {
      const label = item.label.toLowerCase();
      const keywords = item.keywords.map((keyword) => keyword.toLowerCase());
      let score = 0;
      if (label.startsWith(query)) score = 3;
      else if (label.includes(query)) score = 2;
      else if (keywords.some((keyword) => keyword.includes(query))) score = 1;
      return { item, score };
    }).filter((entry) => entry.score > 0);

    return scored
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map((entry) => entry.item)
      .slice(0, 6);
  }, [toolQuery]);

  useEffect(() => {
    if (toolMatches.length === 0) {
      setHighlightIndex(0);
      return;
    }
    setHighlightIndex((index) => Math.min(index, toolMatches.length - 1));
  }, [toolMatches]);

  useEffect(() => {
    setToolQuery("");
    setToolMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchRef.current) return;
      if (searchRef.current.contains(event.target as Node)) return;
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
    if (toolMatches.length > 0) {
      handleToolSelect(toolMatches[highlightIndex] || toolMatches[0]);
      return;
    }
    trackEvent("tool_search_no_match", { query: toolQuery.trim() });
    setToolMenuOpen(false);
  };

  const logoutHref = useMemo(() => {
    const base = apiUrl("/api/logout");
    if (typeof window === "undefined") return base;
    const redirect = window.location.origin;
    return `${base}?redirect=${encodeURIComponent(redirect)}`;
  }, []);

  return (
    <header className="sticky top-0 z-[80] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-visible">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8 min-w-0">
        <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-4 py-2 sm:py-0 min-w-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 sm:gap-2 hover-elevate active-elevate-2 rounded-md px-1 sm:px-2 py-1 flex-shrink-0 order-1" data-testid="link-home">
            <img src={logoImage} alt="Ready Set Fly" className="h-8 w-8 sm:h-[2.6rem] sm:w-[2.6rem]" />
            <span className="font-display text-sm sm:text-xl font-bold hidden min-[400px]:inline">Ready Set Fly</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full order-3 sm:order-2 sm:flex-1">
            {/* Main Navigation Tabs - Compact on mobile */}
            <nav className="flex w-full sm:flex-1 items-center justify-start gap-0.5 sm:gap-1 rounded-full bg-muted p-0.5 sm:p-1 min-w-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="navigation" aria-label="Main navigation">
              <Link href="/marketplace" data-testid="link-marketplace">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isMarketplace ? "bg-background shadow-sm" : ""}`}
                  onClick={() => trackEvent("nav_click", { label: "marketplace", target: "/marketplace" })}
                >
                  Marketplace
                </Button>
              </Link>
              <Link href="/rentals" data-testid="link-rentals">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isRentals ? "bg-background shadow-sm" : ""}`}
                  onClick={() => trackEvent("nav_click", { label: "rentals", target: "/rentals" })}
                >
                  Rentals
                </Button>
              </Link>
              <Link href="/faq" data-testid="link-faq">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isFaq ? "bg-background shadow-sm" : ""}`}
                >
                  FAQ
                </Button>
              </Link>
              <Link href="/cfi" data-testid="link-cfi">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isCfi ? "bg-background shadow-sm" : ""}`}
                  onClick={() => trackEvent("nav_click", { label: "cfi", target: "/cfi" })}
                >
                  CFI
                </Button>
              </Link>
              <Link href="/flight-planner" data-testid="link-plan-flight">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isPlanner ? "bg-background shadow-sm" : ""}`}
                  onClick={() => trackEvent("nav_click", { label: "plan_flight", target: "/flight-planner" })}
                >
                  Plan Flight
                </Button>
              </Link>
              <Link href="/student" data-testid="link-training">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isTraining ? "bg-background shadow-sm" : ""}`}
                >
                  Training
                </Button>
              </Link>
              <Link href="/tool-hub" data-testid="link-tools">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-3 ${isTools ? "bg-background shadow-sm" : ""}`}
                  onClick={() => trackEvent("nav_click", { label: "tools", target: "/tool-hub" })}
                >
                  Tools
                </Button>
              </Link>
            </nav>

            {/* Tool Search */}
            <form
              ref={searchRef}
              className="relative w-full sm:w-[135px] md:w-[165px] lg:w-[195px] flex-shrink-0 overflow-visible z-[90] sm:order-none mt-1 sm:mt-0"
              onSubmit={(event) => {
                event.preventDefault();
                handleToolSubmit();
              }}
            >
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  if (event.key === "ArrowDown") {
                    if (toolMatches.length === 0) return;
                    event.preventDefault();
                    setHighlightIndex((index) => Math.min(index + 1, toolMatches.length - 1));
                  } else if (event.key === "ArrowUp") {
                    if (toolMatches.length === 0) return;
                    event.preventDefault();
                    setHighlightIndex((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    handleToolSubmit();
                  } else if (event.key === "Escape") {
                    setToolMenuOpen(false);
                  }
                }}
                className="h-9 w-full rounded-full border border-input bg-background pl-8 pr-3 text-xs sm:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Search tools and features"
                autoComplete="off"
              />
              {toolMenuOpen && toolQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border bg-background shadow-lg z-[100] overflow-hidden pointer-events-auto">
                  {toolMatches.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No matches found.</div>
                  ) : (
                    toolMatches.map((item, index) => (
                      <button
                        key={item.path}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleToolSelect(item);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs sm:text-sm hover:bg-muted ${index === highlightIndex ? "bg-muted" : ""}`}
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="text-[0.65rem] sm:text-xs text-muted-foreground">{item.path}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 relative z-20 order-2 sm:order-3 ml-auto">
            {user && (
              <Link href="/notifications" className="hidden sm:flex" data-testid="link-notifications">
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            <ThemeToggle />

            {/* Show sign in button for anonymous users */}
            {!user ? (
              <Link href="/login">
                <Button 
                  variant="default" 
                  data-testid="button-login"
                >
                  Sign In
                </Button>
              </Link>
            ) : (
              <>
                {/* Super Admin Badge */}
                {user.isSuperAdmin && (
                  <Badge variant="default" className="bg-primary text-primary-foreground" data-testid="badge-super-admin">
                    Super Admin
                  </Badge>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-9 w-9 rounded-full touch-manipulation"
                      data-testid="button-profile-menu"
                      aria-label="User menu"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium leading-none">{displayName}</p>
                          {user?.isSuperAdmin && (
                            <Badge variant="default" className="text-xs h-5 bg-primary text-primary-foreground">
                              Super Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" data-testid="link-dashboard">Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" data-testid="link-profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/my-listings" data-testid="link-my-listings">My Listings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" data-testid="link-messages">Messages</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/logbook" data-testid="link-logbook">Pilot Logbook</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/my-aircraft" data-testid="link-my-aircraft">My Aircraft</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/tool-hub" data-testid="link-pilot-tools">Tool Hub</Link>
                    </DropdownMenuItem>
                    {user?.isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" data-testid="link-admin" className="text-primary font-medium">
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/aircraft-library" data-testid="link-admin-aircraft-library" className="text-primary font-medium">
                            Aircraft Library
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings" data-testid="link-settings">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={logoutHref} data-testid="button-logout">
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
