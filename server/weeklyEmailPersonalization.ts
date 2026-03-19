import type { AnalyticsEvent, User } from "@shared/schema";

export type WeeklyDigestSegment =
  | "flight_planning"
  | "marketplace"
  | "training"
  | "logbook"
  | "new_user"
  | "platform_overview";

export type WeeklyDigestModule = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type WeeklyDigestProfile = {
  segment: WeeklyDigestSegment;
  subject: string;
  headline: string;
  intro: string;
  reasonLine: string;
  modules: WeeklyDigestModule[];
};

type WeeklyDigestInput = {
  user: Pick<User, "createdAt" | "firstName" | "email">;
  events: Array<Pick<AnalyticsEvent, "event" | "page" | "createdAt">>;
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function getSegmentScores(events: WeeklyDigestInput["events"]) {
  const scores = {
    flight_planning: 0,
    marketplace: 0,
    training: 0,
    logbook: 0,
  };

  for (const event of events) {
    const page = normalize(event.page);
    const eventName = normalize(event.event);

    if (
      page.startsWith("/flight-planner") ||
      page.startsWith("/aviation-weather") ||
      page.startsWith("/pilot-tools") ||
      page.startsWith("/tool-hub") ||
      page.startsWith("/tools/") ||
      page.startsWith("/ifr-tools") ||
      page.startsWith("/tfr-map") ||
      page.startsWith("/cabin-brief") ||
      includesAny(eventName, ["weather", "tfms", "tool_hub", "flight_planner", "cabin_brief", "tfr_"])
    ) {
      scores.flight_planning += 1;
    }

    if (
      page.startsWith("/marketplace") ||
      page.startsWith("/rentals") ||
      page.startsWith("/cfi") ||
      includesAny(eventName, ["marketplace", "rental", "booking_request", "view_item", "cfi_directory", "cfi_profile"])
    ) {
      scores.marketplace += 1;
    }

    if (
      page.startsWith("/student") ||
      page.startsWith("/gps-sims") ||
      includesAny(eventName, ["student_", "gps", "vor_trainer", "six_pack", "written", "training_view", "cfi_request"])
    ) {
      scores.training += 1;
    }

    if (
      page.startsWith("/logbook") ||
      includesAny(eventName, ["logbook", "currency", "endorsement", "subscription_checkout"])
    ) {
      scores.logbook += 1;
    }
  }

  return scores;
}

function getTopSegment(scores: ReturnType<typeof getSegmentScores>): WeeklyDigestSegment {
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topSegment, topScore] = ordered[0] || ["platform_overview", 0];
  if (topScore < 2) return "platform_overview";
  return topSegment as WeeklyDigestSegment;
}

function buildModules(segment: WeeklyDigestSegment): Omit<WeeklyDigestProfile, "segment"> {
  switch (segment) {
    case "flight_planning":
      return {
        subject: "Your weekly flight planning and weather rundown",
        headline: "Keep your next flight sharper with RSF planning tools",
        intro:
          "You have been spending time in planning and weather tools, so this week’s digest focuses on the parts of Ready Set Fly that help you brief faster and make better go / no-go decisions.",
        reasonLine: "Built around your recent flight-planning and weather activity.",
        modules: [
          {
            id: "planner",
            title: "Flight Planner",
            description: "Build routes, review timing, fuel, and operational planning in one place.",
            ctaLabel: "Open Flight Planner",
            ctaUrl: "/flight-planner",
          },
          {
            id: "weather",
            title: "Weather Hub",
            description: "Check weather layers, airport weather, and briefing surfaces before departure.",
            ctaLabel: "Review Weather",
            ctaUrl: "/aviation-weather",
          },
          {
            id: "tools",
            title: "Pilot Tools",
            description: "Jump back into the broader planning and pilot workflow tools on RSF.",
            ctaLabel: "Browse Pilot Tools",
            ctaUrl: "/tool-hub",
          },
        ],
      };
    case "marketplace":
      return {
        subject: "New marketplace and aviation business tools to explore this week",
        headline: "Keep exploring the RSF marketplace",
        intro:
          "You have been browsing marketplace-style surfaces recently, so this digest focuses on listings, rentals, and aviation-service discovery across Ready Set Fly.",
        reasonLine: "Built around your recent marketplace, rentals, or CFI-directory activity.",
        modules: [
          {
            id: "marketplace",
            title: "Marketplace Listings",
            description: "Browse aircraft, jobs, charter, schools, CFIs, and aviation services in one marketplace.",
            ctaLabel: "Open Marketplace",
            ctaUrl: "/marketplace",
          },
          {
            id: "rentals",
            title: "Rental Marketplace",
            description: "Check available rental aircraft and compare options directly on RSF.",
            ctaLabel: "Browse Rentals",
            ctaUrl: "/rentals",
          },
          {
            id: "cfi",
            title: "CFI Directory",
            description: "Find instructors, training support, and pilot-development resources.",
            ctaLabel: "Find a CFI",
            ctaUrl: "/cfi",
          },
        ],
      };
    case "training":
      return {
        subject: "Keep your training momentum going this week",
        headline: "Training-focused tools to help you keep moving",
        intro:
          "You have been using training-oriented surfaces on RSF, so this digest is centered on tools that help student pilots and developing aviators stay organized and keep progressing.",
        reasonLine: "Built around your recent student, GPS sim, or training activity.",
        modules: [
          {
            id: "student-hub",
            title: "Student Hub",
            description: "Return to the training path, cost, study, and progress tools built for developing pilots.",
            ctaLabel: "Open Student Hub",
            ctaUrl: "/student",
          },
          {
            id: "training-roadmap",
            title: "Training Roadmap",
            description: "Review the next milestones in your training path and stay focused on what matters next.",
            ctaLabel: "View Roadmap",
            ctaUrl: "/student/roadmap",
          },
          {
            id: "planner",
            title: "Practice Flight Planning",
            description: "Use the planner to build routes and reinforce planning habits between lessons.",
            ctaLabel: "Build a Route",
            ctaUrl: "/flight-planner",
          },
        ],
      };
    case "logbook":
      return {
        subject: "Stay on top of your logbook and pilot workflow this week",
        headline: "Keep your records and pilot workflow in sync",
        intro:
          "You have been spending time in logbook-related workflows, so this digest highlights the RSF surfaces that help you keep records current and stay organized between flights.",
        reasonLine: "Built around your recent logbook and pilot-record activity.",
        modules: [
          {
            id: "logbook",
            title: "Digital Logbook",
            description: "Log flights, keep records clean, and stay on top of your recent entries.",
            ctaLabel: "Open Logbook",
            ctaUrl: "/logbook",
          },
          {
            id: "pro",
            title: "Logbook Pro",
            description: "Review Pro features for deeper tracking, currency support, and added workflow tools.",
            ctaLabel: "View Logbook Pro",
            ctaUrl: "/logbook/pro",
          },
          {
            id: "planner",
            title: "Plan the Next Flight",
            description: "Pair your records with your next route and briefing workflow inside RSF.",
            ctaLabel: "Open Flight Planner",
            ctaUrl: "/flight-planner",
          },
        ],
      };
    case "new_user":
      return {
        subject: "Your Ready Set Fly quick start for this week",
        headline: "A better first week on Ready Set Fly",
        intro:
          "You are still early in your RSF usage, so this week’s digest focuses on the best starting points across planning, marketplace, and pilot workflow tools.",
        reasonLine: "Built for newer accounts still getting started on the platform.",
        modules: [
          {
            id: "home",
            title: "Open Ready Set Fly",
            description: "Start from the main platform and jump into the tools and listings that fit you best.",
            ctaLabel: "Open RSF",
            ctaUrl: "/",
          },
          {
            id: "planner",
            title: "Try the Flight Planner",
            description: "One of the fastest ways to see value from RSF is to plan your next route inside the app.",
            ctaLabel: "Try Flight Planner",
            ctaUrl: "/flight-planner",
          },
          {
            id: "marketplace",
            title: "Explore the Marketplace",
            description: "Browse listings, aviation services, schools, charter, rentals, and more.",
            ctaLabel: "Browse Marketplace",
            ctaUrl: "/marketplace",
          },
        ],
      };
    default:
      return {
        subject: "Your weekly Ready Set Fly roundup",
        headline: "A broader look at what Ready Set Fly can help with this week",
        intro:
          "Your recent activity spans a few different parts of RSF, so this digest gives you a broader platform-wide mix of planning, marketplace, and pilot workflow tools.",
        reasonLine: "Built from your recent overall activity across the platform.",
        modules: [
          {
            id: "planner",
            title: "Flight Planner",
            description: "Build routes, review timing, weather, and planning factors from one workflow.",
            ctaLabel: "Open Flight Planner",
            ctaUrl: "/flight-planner",
          },
          {
            id: "marketplace",
            title: "Marketplace",
            description: "Browse aviation listings, services, opportunities, and business visibility options.",
            ctaLabel: "Open Marketplace",
            ctaUrl: "/marketplace",
          },
          {
            id: "tools",
            title: "Pilot Tools",
            description: "Jump across RSF tools built for planning, training, and staying organized.",
            ctaLabel: "Browse Tools",
            ctaUrl: "/tool-hub",
          },
        ],
      };
  }
}

export function buildWeeklyDigestProfile(input: WeeklyDigestInput): WeeklyDigestProfile {
  const recentEvents = input.events || [];
  const accountAgeDays = input.user.createdAt
    ? Math.floor((Date.now() - new Date(input.user.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  if (accountAgeDays <= 14 && recentEvents.length < 5) {
    return {
      segment: "new_user",
      ...buildModules("new_user"),
    };
  }

  const scores = getSegmentScores(recentEvents);
  const segment = getTopSegment(scores);

  return {
    segment,
    ...buildModules(segment),
  };
}
