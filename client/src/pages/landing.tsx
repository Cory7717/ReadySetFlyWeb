import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BannerAdRotation } from "@/components/banners/BannerAdRotation";
import { BookOpen, ClipboardList, CalendarDays, Navigation2, Shield, ChevronLeft, ChevronRight, Plane, Smartphone, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";

export default function Landing() {
  const { data: eventsData } = useQuery({
    queryKey: ["aviation-events", "feed"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/events"));
      if (!response.ok) {
        return { events: [] };
      }
      return response.json();
    },
  });
  const events = eventsData?.events ?? [];
  const feedEvents = events.slice(0, 10);
  const formatEventRange = (start: string, end: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";
    if (startDate.toDateString() === endDate.toDateString()) {
      return formatter.format(startDate);
    }
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
  };
  const eventsScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollActiveRef = useRef(false);
  const [eventsHovering, setEventsHovering] = useState(false);
  const [autoPauseUntil, setAutoPauseUntil] = useState(0);

  const pauseAutoScroll = (ms = 8000) => {
    setAutoPauseUntil(Date.now() + ms);
  };

  const scrollEvents = (direction: "left" | "right") => {
    const container = eventsScrollRef.current;
    if (!container) return;
    const delta = container.clientWidth * 0.75;
    pauseAutoScroll();
    container.scrollBy({ left: direction === "left" ? -delta : delta, behavior: "smooth" });
  };

  useEffect(() => {
    const container = eventsScrollRef.current;
    if (!container || feedEvents.length <= 1) return;
    let rafId = 0;
    let lastTime = 0;
    const speedPxPerSec = 26;
    const setAutoScrollState = (active: boolean) => {
      if (autoScrollActiveRef.current === active) return;
      autoScrollActiveRef.current = active;
      container.style.scrollSnapType = active ? "none" : "x mandatory";
      container.style.scrollBehavior = active ? "auto" : "smooth";
    };

    const tick = (time: number) => {
      if (!container) return;
      const shouldScroll = !eventsHovering && Date.now() >= autoPauseUntil;
      if (!shouldScroll) {
        setAutoScrollState(false);
        lastTime = time;
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      setAutoScrollState(true);
      if (!lastTime) lastTime = time;
      const deltaSec = (time - lastTime) / 1000;
      lastTime = time;
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll > 0) {
        let next = container.scrollLeft + speedPxPerSec * deltaSec;
        if (next >= maxScroll - 4) {
          next = 0;
        }
        container.scrollLeft = next;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      container.style.scrollSnapType = "";
      container.style.scrollBehavior = "";
    };
  }, [feedEvents.length, eventsHovering, autoPauseUntil]);
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="container mx-auto px-4 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
              Ready Set Fly
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground px-4">
              Plan a flight. Get a safety briefing. Learn and log with confidence.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Ready Set Fly is a planning-first, safety-oriented pilot tool. Training and logging are embedded into the planning flow so risk surfaces earlier and decisions stay sharper.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto px-4">
              RSF is built for pilots who want clearer briefings, smarter route decisions, and post-flight reflection -- before any transactions ever enter the picture.
            </p>
            <Badge variant="outline" className="mx-auto text-xs px-3 py-1">
              Available for US Residents Only
            </Badge>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                asChild
                data-testid="button-plan-flight"
              >
                <Link
                  href="/flight-planner"
                  onClick={() => trackEvent("cta_click", { label: "plan_flight", target: "/flight-planner" })}
                >
                  Plan a flight -> Get a safety briefing
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                asChild
                data-testid="button-training"
              >
                <Link
                  href="/student"
                  onClick={() => trackEvent("cta_click", { label: "training", target: "/student" })}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Training tools
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Planning-first flow */}
      <div className="py-10 sm:py-14">
        <div className="container mx-auto px-4 space-y-8">
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">Planning-first flow</div>
            <h2 className="text-2xl sm:text-3xl font-semibold">RSF quietly watches the whole flight</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Before, during, and after -- planning is the spine. Tools appear when they matter, not as a menu.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                title: "Plan",
                description: "Enter route, altitude, and aircraft details.",
                icon: Navigation2,
              },
              {
                title: "Brief",
                description: "Get a safety-focused briefing that surfaces risk early.",
                icon: Shield,
              },
              {
                title: "Train",
                description: "Contextual trainers appear based on your flight.",
                icon: BookOpen,
              },
              {
                title: "Log",
                description: "Capture the flight and reflect while it's fresh.",
                icon: ClipboardList,
              },
            ].map((item) => (
              <Card key={item.title} className="border-muted-foreground/20">
                <CardContent className="pt-6 space-y-2 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="text-base font-semibold">{item.title}</div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Safety-first intent */}
      <div className="py-10 sm:py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Safety-first decision support</div>
              <h2 className="text-2xl sm:text-3xl font-semibold">Risk is surfaced early, not after the fact</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                RSF is a safety-first decision-support tool. Planning drives what you see, and each alert feels like a
                quiet copilot -- not a loud warning.
              </p>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Shield className="mt-1 h-4 w-4 text-primary" />
                <span>Weather, altitude, and route risks are summarized in one briefing.</span>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="mt-1 h-4 w-4 text-primary" />
                <span>Training tools appear only when they support the plan you're building.</span>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="mt-1 h-4 w-4 text-primary" />
                <span>Logging happens after the plan -- so reflection stays tied to real decisions.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviation Events Feed */}
      <div className="py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Community Calendar
              </div>
              <h2 className="text-2xl font-semibold">Upcoming Aviation Events</h2>
              <p className="text-sm text-muted-foreground">
                Share fly-ins, safety seminars, and airshows with the RSF community.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/events">View all events</Link>
            </Button>
          </div>

          {feedEvents.length ? (
            <div className="relative mt-6 rounded-2xl border bg-background/70">
              <div className="absolute -left-4 top-1/2 z-10 hidden -translate-y-1/2 sm:flex">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Scroll events left"
                  onClick={() => scrollEvents("left")}
                  className="h-10 w-10 rounded-full shadow-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 sm:flex">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Scroll events right"
                  onClick={() => scrollEvents("right")}
                  className="h-10 w-10 rounded-full shadow-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div
                ref={eventsScrollRef}
                onMouseEnter={() => setEventsHovering(true)}
                onMouseLeave={() => setEventsHovering(false)}
                onPointerDown={() => pauseAutoScroll()}
                onTouchStart={() => pauseAutoScroll()}
                className="events-scroll flex gap-4 overflow-x-auto px-4 py-4 scroll-smooth snap-x snap-mandatory"
              >
                {feedEvents.map((event) => (
                  <Link
                    key={event.id}
                    href="/events"
                    onClick={() => trackEvent("cta_click", { label: "events_feed", target: "/events" })}
                  >
                    <div className="min-w-[260px] snap-start overflow-hidden rounded-xl border bg-background shadow-sm hover:shadow-md transition-shadow">
                      {event.imageUrl && (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{event.category}</Badge>
                          {event.isSample && (
                            <Badge variant="secondary" className="text-[10px]">
                              SAMPLE
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 font-semibold">{event.title}</div>
                        <div className="text-xs text-muted-foreground">{formatEventRange(event.startDate, event.endDate)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{event.location}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No events posted yet. Add a fly-in or safety seminar to kick things off.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <BannerAdRotation 
        placement="home" 
        className="container mx-auto px-4 py-8 max-w-7xl"
      />

      {/* Student Pilot Hub Section */}
      <div className="bg-primary/5 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <Card className="border-primary/20">
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-center">
                  <div className="space-y-4">
                    <Badge variant="outline" className="text-xs w-fit">Student Pilot Hub</Badge>
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      New to flying? Start here.
                    </h2>
                    <p className="text-muted-foreground">
                      Use our Student Pilot tools to map out your journey, estimate training costs, and
                      connect with trusted flight schools near you.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button asChild>
                        <Link
                          href="/student"
                          onClick={() => trackEvent("cta_click", { label: "student_hub", target: "/student" })}
                        >
                          Open Student Pilot Hub
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-semibold">Can I Become a Pilot?</div>
                      <div className="text-sm text-muted-foreground">
                        Quick wizard with timeline, cost range, and next steps.
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-semibold">Training Roadmap</div>
                      <div className="text-sm text-muted-foreground">
                        Step-by-step milestones with local recommendations.
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-semibold">Cost & Progress Trackers</div>
                      <div className="text-sm text-muted-foreground">
                        Estimate costs and track your progress in one place.
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

            {/* Safety Tools In Context */}
      <div className="bg-gradient-to-br from-blue-50 to-background dark:from-blue-950/20 dark:to-background py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-primary/20">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold">Safety tools, surfaced at the right time</h2>
                <p className="text-base sm:text-lg text-muted-foreground">
                  RSF keeps the focus on the plan. As you build a route, the right calculators and trainers appear automatically.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <div className="rounded-lg border p-4">
                  <div className="font-semibold">Performance</div>
                  <p className="text-muted-foreground">
                    Density altitude and crosswind checks surface when conditions warrant.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="font-semibold">Training</div>
                  <p className="text-muted-foreground">
                    VOR, comms, and six-pack trainers appear when the route needs them.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="font-semibold">Post-flight</div>
                  <p className="text-muted-foreground">
                    Log the flight, update currency, and reflect once you are done.
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <Button asChild>
                  <Link
                    href="/flight-planner"
                    onClick={() => trackEvent("cta_click", { label: "plan_flight_secondary", target: "/flight-planner" })}
                  >
                    Plan a flight
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
{/* Features Section */}
      <div id="features" className="container mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
          Plan. Brief. Train. Reflect.
        </h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-12">
          Ready Set Fly keeps the focus on planning-first safety. Tools appear when your flight needs them.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <Card data-testid="card-feature-planning">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plane className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Flight Planning</h3>
                <p className="text-muted-foreground">
                  Build a route, choose altitude, and get a briefing tailored to your flight.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-briefing">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Safety Briefing</h3>
                <p className="text-muted-foreground">
                  Surface weather, crosswinds, and route risks early without alarmist noise.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-feature-training">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Training + Logbook</h3>
                <p className="text-muted-foreground">
                  Reinforce skills during planning and log your flight once it's complete.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-muted/50 py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Plan a Flight?
          </h2>
          <p className="text-base sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            Build a route and get a safety-focused briefing in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" data-testid="button-cta-plan-flight">
              <Link
                href="/flight-planner"
                onClick={() => trackEvent("cta_click", { label: "plan_flight_cta", target: "/flight-planner" })}
              >
                Plan a Flight
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" data-testid="button-cta-student-hub">
              <Link
                href="/student"
                onClick={() => trackEvent("cta_click", { label: "student_hub_cta", target: "/student" })}
              >
                Training Tools
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile App Section */}
      <div className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  {/* Content Side */}
                  <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Coming Soon
                      </Badge>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                      Take Ready Set Fly Anywhere
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Our mobile app is coming soon to iOS and Android. Plan flights, review safety briefings,
                      and keep training tools handy on the go.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Build and review flight plans anywhere</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Run briefings and training tools on the go</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">Log flights and track currency after landing</span>
                      </div>
                    </div>
                  </div>

                  {/* App Store Badges Side */}
                  <div className="bg-muted/30 p-6 sm:p-8 lg:p-12 flex flex-col justify-center items-center gap-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Download on
                    </p>
                    
                    {/* App Store Badge - Placeholder */}
                    <div 
                      className="w-full max-w-[200px] h-[60px] rounded-lg border-2 border-muted flex items-center justify-center bg-background/50 cursor-not-allowed opacity-60"
                      data-testid="badge-app-store"
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Available Soon</div>
                        <div className="font-semibold">App Store</div>
                      </div>
                    </div>

                    {/* Play Store Badge - Placeholder */}
                    <div 
                      className="w-full max-w-[200px] h-[60px] rounded-lg border-2 border-muted flex items-center justify-center bg-background/50 cursor-not-allowed opacity-60"
                      data-testid="badge-play-store"
                    >
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Available Soon</div>
                        <div className="font-semibold">Google Play</div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center mt-4 max-w-[250px]">
                      Sign up now to be notified when our mobile apps launch
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Admin Login */}
      <div className="py-8">
        <div className="container mx-auto px-4 text-center">
          <Button 
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = apiUrl('/api/auth/google')}
            data-testid="button-admin-login"
            className="text-muted-foreground hover:text-foreground"
          >
            Admin Login
          </Button>
        </div>
      </div>
    </div>
  );
}

