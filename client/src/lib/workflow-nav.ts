export type WorkflowNavGroupId = "plan" | "efb" | "fly" | "train" | "manage" | "marketplace" | "schools";

export type WorkflowNavItem = {
  label: string;
  href: string;
  description: string;
};

export type WorkflowNavGroup = {
  id: WorkflowNavGroupId;
  label: string;
  description: string;
  items: WorkflowNavItem[];
};

export const WORKFLOW_NAV_GROUPS: WorkflowNavGroup[] = [
  {
    id: "plan",
    label: "Plan",
    description: "Route, weather, airspace, and preflight planning.",
    items: [
      { label: "Flight Planner", href: "/flight-planner", description: "Create, review, save, and file flight plans." },
      { label: "Weather", href: "/aviation-weather", description: "METAR, TAF, hazards, and briefing context." },
      { label: "NOTAMs", href: "/pilot-tools", description: "Airport NOTAM context inside pilot tools." },
      { label: "TFRs", href: "/tfr-map", description: "Temporary flight restrictions map." },
      { label: "Approach Plates", href: "/approach-plates", description: "Procedure and airport plate lookup." },
      { label: "Route Builder Assist", href: "/flight-planner", description: "Build and review route suggestions." },
      { label: "Runway Briefings", href: "/pilot-tools", description: "Runway, airport, and conditions tools." },
      { label: "Cabin Brief", href: "/cabin-brief", description: "Passenger-friendly weather briefings." },
    ],
  },
  {
    id: "efb",
    label: "EFB",
    description: "Pilot calculators, records, and electronic flight bag tools.",
    items: [
      { label: "EFB Tool Hub", href: "/tool-hub", description: "All RSF pilot tools in one place." },
      { label: "Density Altitude", href: "/density-altitude", description: "Pressure altitude, ISA deviation, and density altitude." },
      { label: "Crosswind Calculator", href: "/crosswind-calculator", description: "Headwind, tailwind, and crosswind component planning." },
      { label: "Weight & Balance", href: "/weight-balance", description: "Weight, CG, and envelope planning." },
      { label: "E6B Flight Computer", href: "/tools/e6b", description: "Wind, fuel, speed, time, and altitude math." },
      { label: "Logbook", href: "/logbook", description: "Digital flight records and currency tracking." },
      { label: "Ownership Cost Calculator", href: "/ownership-cost-calculator", description: "Estimate aircraft ownership costs." },
      { label: "Pilot Tools", href: "/pilot-tools", description: "Airport conditions, crosswind, and briefing tools." },
    ],
  },
  {
    id: "fly",
    label: "Fly",
    description: "In-flight awareness, traffic, and simulator tools.",
    items: [
      { label: "Flight Deck", href: "/live-traffic", description: "Live map and cockpit-style awareness tools." },
      { label: "Synthetic Vision", href: "/synthetic-vision", description: "Terrain and synthetic vision view." },
      { label: "ADS-B Live", href: "/live-traffic", description: "ADS-B receiver and live traffic view." },
      { label: "Traffic", href: "/live-traffic", description: "Traffic display and route context." },
      { label: "GPS Sims", href: "/gps-sims", description: "GPS trainer simulations." },
      { label: "IFR Tools", href: "/ifr-tools", description: "Instrument procedures and IFR references." },
    ],
  },
  {
    id: "train",
    label: "Train",
    description: "Student, proficiency, and ground-school tools.",
    items: [
      { label: "Student Hub", href: "/student", description: "Student pilot dashboard and next steps." },
      { label: "Roadmap", href: "/student/roadmap", description: "Training roadmap and progress." },
      { label: "Syllabi", href: "/student/syllabi", description: "Training syllabi and lesson structure." },
      { label: "VOR Trainer", href: "/student/vor-trainer", description: "Practice VOR orientation." },
      { label: "Six Pack Trainer", href: "/student/six-pack-trainer", description: "Instrument scan trainer." },
      { label: "Written Test", href: "/student/written", description: "FAA written preparation." },
      { label: "Checklists", href: "/student/checklists", description: "Training and flight checklists." },
      { label: "Student Weather", href: "/student/weather", description: "Weather learning tools." },
      { label: "Aviation Briefings", href: "/aviation-briefings", description: "Practical aviation articles, walkthroughs, and expert perspectives." },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    description: "Records, aircraft, ownership, and account operations.",
    items: [
      { label: "Dashboard", href: "/dashboard", description: "Account overview and quick actions." },
      { label: "My Aircraft", href: "/my-aircraft", description: "Saved aircraft profiles." },
      { label: "Aircraft Profiles", href: "/my-aircraft", description: "Performance and filing defaults." },
      { label: "Notifications", href: "/notifications", description: "Provider and account notifications." },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Rentals, listings, and aircraft access.",
    items: [
      { label: "Aircraft Rentals", href: "/rentals", description: "Browse aircraft for rent." },
      { label: "Marketplace Listings", href: "/marketplace", description: "Aircraft, services, and aviation listings." },
      { label: "List Aircraft", href: "/list-aircraft", description: "Create an aircraft rental listing." },
      { label: "My Listings", href: "/my-listings", description: "Manage your listings." },
      { label: "Flying Clubs", href: "/flying-clubs", description: "Clubs and shared aircraft access." },
    ],
  },
  {
    id: "schools",
    label: "Schools & CFIs",
    description: "Instructor, school, and training-center tools.",
    items: [
      { label: "CFI Directory", href: "/cfi", description: "Find flight instructors." },
      { label: "CFI Profiles", href: "/cfi", description: "Instructor profile directory." },
      { label: "CFI Dashboard", href: "/dashboard/cfi", description: "Instructor dashboard." },
      { label: "CFI School Dashboard", href: "/dashboard/cfi-school", description: "School operations dashboard." },
      { label: "CFI Training Center", href: "/dashboard/cfi-training", description: "Training center tools." },
      { label: "CFI Requests", href: "/cfi", description: "Start from a CFI profile to request training." },
    ],
  },
];

export const findWorkflowGroupForPath = (path: string) =>
  WORKFLOW_NAV_GROUPS.find((group) => group.items.some((item) => path.startsWith(item.href) && item.href !== "/")) || null;
