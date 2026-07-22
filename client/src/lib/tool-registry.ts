export type ToolGroupId = "plan" | "calculate" | "train" | "track" | "advanced";

export type ToolStatus = "live" | "pro" | "coming_soon" | "beta";

export type ToolRegistryItem = {
  id: string;
  title: string;
  description: string;
  path: string;
  group: ToolGroupId;
  status?: ToolStatus;
  keywords: string[];
};

export const TOOL_GROUP_LABELS: Record<ToolGroupId, { title: string; description: string }> = {
  plan: {
    title: "Plan",
    description: "Route building, weather awareness, restrictions, and briefing context.",
  },
  calculate: {
    title: "Calculate",
    description: "Performance, fuel, cost, and flight math tools.",
  },
  train: {
    title: "Train",
    description: "Practice workflows, IFR prep, and student progression tools.",
  },
  track: {
    title: "Track",
    description: "Flight history, records, and progression tracking.",
  },
  advanced: {
    title: "Advanced",
    description: "Power-user and in-progress capability modules.",
  },
};

export const RSF_TOOLS: ToolRegistryItem[] = [
  {
    id: "flight-planner",
    title: "Flight Planner",
    description: "Build routes, fuel, timing, alternates, and filing prep.",
    path: "/flight-planner",
    group: "plan",
    keywords: ["flight planner", "route", "fuel plan", "planning", "alternates"],
  },
  {
    id: "airport-conditions",
    title: "Airport Conditions",
    description: "Live METAR/TAF, runway advisory, and NOTAM context.",
    path: "/pilot-tools#airport-weather",
    group: "plan",
    keywords: ["airport conditions", "metar", "taf", "runway advisory", "notams"],
  },
  {
    id: "tfr-map",
    title: "TFR + NOTAM Map",
    description: "Restriction map with TFR and special-use airspace context.",
    path: "/tfr-map",
    group: "plan",
    keywords: ["tfr", "notam map", "airspace", "sua", "moa"],
  },
  {
    id: "approach-plates",
    title: "Approach Plates",
    description: "Search and review current FAA instrument approach plates.",
    path: "/approach-plates",
    group: "plan",
    keywords: ["approach plates", "ifr charts", "procedures", "plates"],
  },
  {
    id: "aviation-weather",
    title: "Aviation Weather Hub",
    description: "Expanded weather deck for hazards, winds, and forecast context.",
    path: "/aviation-weather",
    group: "plan",
    status: "beta",
    keywords: ["aviation weather", "winds aloft", "icing", "turbulence", "hazards"],
  },
  {
    id: "cabin-brief",
    title: "Cabin Brief",
    description: "Plain-English flight weather briefing for passengers and non-pilots.",
    path: "/cabin-brief",
    group: "plan",
    keywords: ["cabin brief", "passenger briefing", "non-pilot", "plain english weather", "cabin weather"],
  },
  {
    id: "e6b",
    title: "E6B Advanced",
    description: "Digital E6B calculations for nav, fuel, and wind correction.",
    path: "/tools/e6b",
    group: "calculate",
    keywords: ["e6b", "flight computer", "wind triangle", "groundspeed"],
  },
  {
    id: "pilot-calculators",
    title: "Crosswind Calculator",
    description: "Quick headwind, tailwind, and crosswind component planning.",
    path: "/crosswind-calculator",
    group: "calculate",
    keywords: ["crosswind", "headwind", "tailwind", "calculator"],
  },
  {
    id: "density-altitude",
    title: "Density Altitude Calculator",
    description: "Pressure altitude, ISA deviation, and density altitude planning.",
    path: "/density-altitude",
    group: "calculate",
    keywords: ["density altitude", "density calculator", "pressure altitude", "isa deviation", "performance calculator"],
  },
  {
    id: "weight-balance",
    title: "Weight & Balance",
    description: "Load planning with CG and envelope checks.",
    path: "/weight-balance",
    group: "calculate",
    keywords: ["weight and balance", "cg", "loading", "aircraft weight"],
  },
  {
    id: "ownership-cost",
    title: "Ownership Cost Calculator",
    description: "Estimate annual and hourly ownership economics.",
    path: "/ownership-cost-calculator",
    group: "calculate",
    keywords: ["ownership cost", "aircraft cost", "dry rate", "wet rate"],
  },
  {
    id: "radio-comms",
    title: "Radio Comms Trainer",
    description: "ATC phraseology scenarios with scoring and history.",
    path: "/radio-comms-trainer",
    group: "train",
    keywords: ["radio comms", "atc", "phraseology", "trainer"],
  },
  {
    id: "ifr-tools",
    title: "IFR Tools",
    description: "Instrument-focused planning and procedure tools.",
    path: "/ifr-tools",
    group: "train",
    keywords: ["ifr", "instrument", "ifr planning", "procedures"],
  },
  {
    id: "student-hub",
    title: "Student Hub",
    description: "Roadmaps, study tools, and checklists for new pilots.",
    path: "/student",
    group: "train",
    keywords: ["student", "training", "roadmap", "written prep"],
  },
  {
    id: "logbook",
    title: "Digital Logbook",
    description: "Track flights, endorsements, and records.",
    path: "/logbook",
    group: "track",
    keywords: ["logbook", "flight log", "endorsements", "records"],
  },
  {
    id: "live-traffic",
    title: "Live Traffic",
    description: "Live traffic overlay and ADS-B data view.",
    path: "/live-traffic",
    group: "advanced",
    status: "coming_soon",
    keywords: ["live traffic", "adsb", "traffic view"],
  },
  {
    id: "synthetic-vision",
    title: "Synthetic Vision",
    description: "Web preview of the mobile FlightDeck map/vision simulation.",
    path: "/synthetic-vision",
    group: "advanced",
    status: "beta",
    keywords: ["synthetic vision", "svt", "terrain view", "pfd", "flight demo", "flightdeck"],
  },
  {
    id: "gps-sims",
    title: "GPS Trainers",
    description: "Interactive GPS workflow trainers.",
    path: "/gps-sims",
    group: "advanced",
    status: "coming_soon",
    keywords: ["gps trainer", "g1000", "gtn", "gps sim"],
  },
];

export const getToolByPath = (path: string) => {
  return RSF_TOOLS.find((tool) => tool.path === path);
};
