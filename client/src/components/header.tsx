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

type ToolSearchItem = {
  label: string;
  path: string;
  keywords: string[];
};

const TOOL_SEARCH_ITEMS: ToolSearchItem[] = [
  {
    label: "Logbook",
    path: "/logbook",
    keywords: ["pilot logbook", "logbook pro", "logbook entries", "flight log"],
  },
  {
    label: "Pilot Tools",
    path: "/pilot-tools",
    keywords: ["pilot tools", "aviation tools", "toolbox", "pilot utilities"],
  },
  {
    label: "NOTAMs",
    path: "/pilot-tools",
    keywords: ["notams", "notam", "runway advisory", "airport briefing"],
  },
  {
    label: "Airport Briefing",
    path: "/pilot-tools",
    keywords: ["runway briefing", "airport briefing", "runways", "notams"],
  },
  {
    label: "TFR Map",
    path: "/tfr-map",
    keywords: ["tfr", "temporary flight restriction", "tfrs", "map"],
  },
  {
    label: "IFR Tools",
    path: "/ifr-tools",
    keywords: ["ifr", "instrument", "procedures", "ifr tools"],
  },
  {
    label: "Approach Plates",
    path: "/approach-plates",
    keywords: ["ifr charts", "plates", "approach", "charts"],
  },
  {
    label: "GPS Sims",
    path: "/gps-sims",
    keywords: ["gps simulator", "g1000", "gtn", "gtx", "ifr gps"],
  },
  {
    label: "e6b calculator",
    path: "/tools/e6b",
    keywords: ["e6b", "e6-b", "flight computer", "wind triangle"],
  },
  {
    label: "Weight & Balance",
    path: "/weight-balance",
    keywords: ["weight balance", "weight and balance", "cg", "center of gravity"],
  },
  {
    label: "Ownership Cost Calculator",
    path: "/ownership-cost-calculator",
    keywords: ["ownership cost", "operating cost", "aircraft cost"],
  },
  {
    label: "Crosswind Calculator",
    path: "/pilot-tools",
    keywords: ["crosswind", "headwind", "wind component", "runway wind"],
  },
  {
    label: "Density Altitude Calculator",
    path: "/pilot-tools",
    keywords: ["density altitude", "pressure altitude", "performance", "hot and high"],
  },
  {
    label: "Radio Comms Trainer",
    path: "/radio-comms-trainer",
    keywords: ["radio", "comms", "atc", "phraseology"],
  },
  {
    label: "ADS-B Receiver Help",
    path: "/adsb-receiver-help",
    keywords: ["adsb receiver", "stratux", "sentry", "traffic receiver"],
  },
  {
    label: "Live Traffic",
    path: "/live-traffic",
    keywords: ["live traffic", "adsb", "traffic map", "aircraft tracking"],
  },
  {
    label: "VOR Trainer",
    path: "/student/vor-trainer",
    keywords: ["vor", "navigation", "training", "student"],
  },
  {
    label: "Six-Pack Trainer",
    path: "/student/six-pack-trainer",
    keywords: ["six pack", "flight instruments", "attitude", "instrument scan"],
  },
  {
    label: "Student Hub",
    path: "/student",
    keywords: ["student", "training", "learn to fly", "student hub"],
  },
  {
    label: "Student Roadmap",
    path: "/student/roadmap",
    keywords: ["roadmap", "training plan", "milestones"],
  },
  {
    label: "Student Progress",
    path: "/student/progress",
    keywords: ["progress", "tracking", "stage checks"],
  },
  {
    label: "Student Cost",
    path: "/student/cost",
    keywords: ["training cost", "cost to learn", "student cost"],
  },
  {
    label: "Student Written",
    path: "/student/written",
    keywords: ["written test", "ground school", "knowledge test"],
  },
  {
    label: "Student Syllabi",
    path: "/student/syllabi",
    keywords: ["syllabi", "lesson plan", "training syllabus"],
  },
  {
    label: "Student Checklists",
    path: "/student/checklists",
    keywords: ["checklists", "preflight", "flows"],
  },
  {
    label: "Student Weather",
    path: "/student/weather",
    keywords: ["weather basics", "student weather", "metar lesson"],
  },
  {
    label: "Flight Planner",
    path: "/flight-planner",
    keywords: ["flight plan", "plan flight", "route"],
  },
  {
    label: "Marketplace",
    path: "/marketplace",
    keywords: ["buy", "sell", "listings", "marketplace"],
  },
  {
    label: "Rentals",
    path: "/rentals",
    keywords: ["rent", "aircraft rental", "rentals"],
  },
  {
    label: "Aviation Weather",
    path: "/aviation-weather",
    keywords: ["weather", "metar", "taf", "briefing"],
  },
  {
    label: "CFI Directory",
    path: "/cfi",
    keywords: ["cfi", "instructor", "flight instructor", "flight training"],
  },
  {
    label: "Start Flying",
    path: "/start-flying",
    keywords: ["start flying", "getting started", "learn to fly"],
  },
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
  const isFaq = location === "/faq";

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

  return (
    <header className="sticky top-0 z-[80] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-visible">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8 min-w-0">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 sm:gap-2 hover-elevate active-elevate-2 rounded-md px-1 sm:px-2 py-1 flex-shrink-0" data-testid="link-home">
            <img src={logoImage} alt="Ready Set Fly" className="h-8 w-8 sm:h-[2.6rem] sm:w-[2.6rem]" />
            <span className="font-display text-sm sm:text-xl font-bold hidden min-[400px]:inline">Ready Set Fly</span>
          </Link>

          <div className="flex flex-1 items-center gap-2 min-w-0">
            {/* Main Navigation Tabs - Compact on mobile */}
            <nav className="flex flex-1 items-center gap-0.5 sm:gap-1 rounded-full bg-muted p-0.5 sm:p-1 min-w-0 overflow-x-auto whitespace-nowrap" role="navigation" aria-label="Main navigation">
              <Link href="/flight-planner" data-testid="link-plan-flight">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-4 ${isPlanner ? "bg-background shadow-sm" : ""}`}
                  onClick={() => trackEvent("nav_click", { label: "plan_flight", target: "/flight-planner" })}
                >
                  Plan Flight
                </Button>
              </Link>
              <Link href="/student" data-testid="link-training">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-4 ${isTraining ? "bg-background shadow-sm" : ""}`}
                >
                  Training
                </Button>
              </Link>
              <Link href="/faq" data-testid="link-faq">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full text-xs sm:text-sm px-2 sm:px-4 ${isFaq ? "bg-background shadow-sm" : ""}`}
                >
                  FAQ
                </Button>
              </Link>
              <Link href="/rentals" data-testid="link-rentals">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs sm:text-sm px-2 sm:px-4"
                  onClick={() => trackEvent("nav_click", { label: "rentals", target: "/rentals" })}
                >
                  Rentals
                </Button>
              </Link>
              <Link href="/marketplace" data-testid="link-marketplace">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs sm:text-sm px-2 sm:px-4"
                  onClick={() => trackEvent("nav_click", { label: "marketplace", target: "/marketplace" })}
                >
                  Marketplace
                </Button>
              </Link>
            </nav>

            {/* Tool Search */}
            <form
              ref={searchRef}
              className="relative w-[140px] sm:w-[180px] md:w-[220px] lg:w-[260px] flex-shrink-0 overflow-visible z-[90]"
              onSubmit={(event) => {
                event.preventDefault();
                handleToolSubmit();
              }}
            >
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search tools..."
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
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 relative z-20">
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
                      <Link href="/pilot-tools" data-testid="link-pilot-tools">Pilot Tools</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/ownership-cost-calculator" data-testid="link-ownership-cost">Ownership Cost Calculator</Link>
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
                      <a href={apiUrl('/api/logout')} data-testid="button-logout">
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
