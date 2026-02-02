export type SyllabusPhase = {
  id: string;
  title: string;
  summary: string;
  ground: string[];
  flight: string[];
  stageCheck?: string;
};

export type TrainingSyllabus = {
  id: string;
  title: string;
  subtitle: string;
  completionStandards: string[];
  phases: SyllabusPhase[];
  simulatorModules: string[];
};

export const trainingSyllabusComplianceNotes = [
  "RSF provides planning templates only and is not an FAA-approved training provider.",
  "Instruction is delivered by independent FAA-certificated instructors who control training records and endorsements.",
  "These templates are ACS-aligned and intended for Part 61 training (not Part 141).",
  "Meeting minimum hours does not guarantee proficiency; CFIs determine readiness for checkrides.",
];

export const trainingSyllabusSimulatorNote =
  "Simulator modules are optional and may only be logged if the device and course meet FAA requirements.";

export const trainingSyllabi: TrainingSyllabus[] = [
  {
    id: "private-pilot-asel",
    title: "Private Pilot (ASEL) - Part 61 Template",
    subtitle: "ACS-aligned syllabus for independent CFIs and student pilots.",
    completionStandards: [
      "Meet Part 61.109 aeronautical experience requirements.",
      "Demonstrate ACS knowledge, risk management, and skill areas.",
      "Complete stage checks and mock checkride with instructor sign-off.",
    ],
    phases: [
      {
        id: "ppl-onboarding",
        title: "Onboarding and Baseline",
        summary: "Set goals, training cadence, and establish a study plan.",
        ground: [
          "Training plan, medical status, and student pilot requirements",
          "ACS overview and checkride flow",
          "Risk management baseline (PAVE, IMSAFE)",
        ],
        flight: [
          "Intro flight, preflight flow, and traffic pattern orientation",
        ],
      },
      {
        id: "ppl-pre-solo",
        title: "Phase 1 - Pre-solo Fundamentals",
        summary: "Core maneuvers, traffic pattern, and emergency basics.",
        ground: [
          "Aerodynamics, aircraft systems, and performance",
          "Airspace, regulations, and airport operations",
          "Weather basics and go/no-go decision making",
        ],
        flight: [
          "Basic maneuvers, slow flight, and stalls",
          "Takeoffs, landings, and pattern work",
          "Emergency procedures and ground reference maneuvers",
        ],
        stageCheck: "Stage Check 1: Pre-solo readiness",
      },
      {
        id: "ppl-solo",
        title: "Phase 2 - Solo and Local Proficiency",
        summary: "Solo prep, endorsements, and consistency in the pattern.",
        ground: [
          "Solo endorsements, limitations, and risk controls",
          "Airport procedures and communications practice",
        ],
        flight: [
          "Supervised solo pattern flights",
          "Local area solo practice",
        ],
        stageCheck: "Stage Check 2: Solo proficiency",
      },
      {
        id: "ppl-xc",
        title: "Phase 3 - Cross-country and Navigation",
        summary: "Cross-country planning, navigation, and real-world scenarios.",
        ground: [
          "Cross-country planning, charts, and performance",
          "Navigation: pilotage, dead reckoning, VOR, GPS basics",
          "Weather interpretation and alternate planning",
        ],
        flight: [
          "Dual cross-country flights with diversions",
          "Solo cross-country requirements",
          "Night flight operations and navigation",
        ],
        stageCheck: "Stage Check 3: Cross-country proficiency",
      },
      {
        id: "ppl-checkride",
        title: "Phase 4 - Checkride Prep",
        summary: "Mock oral, ACS polish, and final endorsements.",
        ground: [
          "Mock oral exam and scenario-based questions",
          "Finalize logbook entries and endorsements",
        ],
        flight: [
          "Mock practical test with ACS tasks",
          "Targeted remediation and final review",
        ],
      },
    ],
    simulatorModules: [
      "VOR navigation basics and intercepts",
      "Hold entries and timing fundamentals",
      "Basic GPS unit flow (direct-to, flight plan)",
    ],
  },
  {
    id: "instrument-rating",
    title: "Instrument Rating (Airplane) - Part 61 Template",
    subtitle: "Structured IFR training aligned to the Instrument ACS.",
    completionStandards: [
      "Meet Part 61.65 aeronautical experience requirements.",
      "Demonstrate ACS instrument tasks to proficiency.",
      "Complete IFR cross-country and mock checkride.",
    ],
    phases: [
      {
        id: "ifr-foundations",
        title: "Phase 1 - IFR Foundations",
        summary: "Instrument scan, attitude flying, and procedures.",
        ground: [
          "IFR regulations, clearances, and procedures",
          "Instrument scan and basic attitude instrument flying",
        ],
        flight: [
          "Basic instrument maneuvers",
          "Unusual attitudes and partial panel",
        ],
        stageCheck: "Stage Check 1: Instrument fundamentals",
      },
      {
        id: "ifr-nav",
        title: "Phase 2 - Navigation and Holds",
        summary: "VOR, GPS, and holding procedures.",
        ground: [
          "VOR, GPS, and DME navigation",
          "Holding entries, timing, and wind correction",
        ],
        flight: [
          "Tracking and intercepting courses",
          "Holding pattern entries and adjustments",
        ],
        stageCheck: "Stage Check 2: Nav and hold proficiency",
      },
      {
        id: "ifr-approaches",
        title: "Phase 3 - Approaches and Missed Procedures",
        summary: "Precision and non-precision approach work.",
        ground: [
          "Approach briefings and plate interpretation",
          "Precision vs non-precision procedures",
        ],
        flight: [
          "ILS/localizer approaches",
          "RNAV (LPV/LP) and VOR approaches",
          "Missed approaches and circling",
        ],
      },
      {
        id: "ifr-checkride",
        title: "Phase 4 - IFR Cross-country and Checkride Prep",
        summary: "Full IFR scenario, mock checkride, and polish.",
        ground: [
          "IFR cross-country planning and alternates",
          "Mock oral and scenario-based risk management",
        ],
        flight: [
          "IFR cross-country flight",
          "Mock checkride flight profile",
        ],
      },
    ],
    simulatorModules: [
      "IFR holds with wind corrections",
      "RNAV approach setup and automation management",
      "Instrument failure scenarios",
    ],
  },
  {
    id: "commercial-pilot",
    title: "Commercial Pilot (ASEL) - Part 61 Template",
    subtitle: "Advanced maneuvers and professional standards.",
    completionStandards: [
      "Meet Part 61.129 aeronautical experience requirements.",
      "Demonstrate Commercial ACS maneuvers to standards.",
      "Complete mock oral and practical test.",
    ],
    phases: [
      {
        id: "cpl-advanced",
        title: "Phase 1 - Advanced Maneuvers",
        summary: "Precision, energy management, and commercial maneuvers.",
        ground: [
          "Commercial standards, risk management, and ADM",
          "Performance planning and energy control",
        ],
        flight: [
          "Chandelles and lazy eights",
          "Steep spirals and eights on pylons",
          "Power-off 180 accuracy landings",
        ],
        stageCheck: "Stage Check 1: Commercial maneuvers",
      },
      {
        id: "cpl-complex",
        title: "Phase 2 - Complex or TAA Operations",
        summary: "Systems management and advanced avionics.",
        ground: [
          "Complex/TAA systems, emergencies, and limitations",
          "Automation management and workload planning",
        ],
        flight: [
          "Complex or TAA flight operations",
          "Emergency and abnormal procedures",
        ],
      },
      {
        id: "cpl-xc",
        title: "Phase 3 - Cross-country and Night",
        summary: "Cross-country proficiency and night operations.",
        ground: [
          "Commercial cross-country planning and regs",
          "Night operations risk management",
        ],
        flight: [
          "Long cross-country (Part 61.129)",
          "Night cross-country and night takeoffs/landings",
        ],
      },
      {
        id: "cpl-checkride",
        title: "Phase 4 - Checkride Prep",
        summary: "Mock oral, polish, and final endorsements.",
        ground: [
          "Mock oral exam and scenario-based questions",
          "Logbook audit and endorsements",
        ],
        flight: [
          "Mock practical test profile",
          "Remediation and final review",
        ],
      },
    ],
    simulatorModules: [
      "Automation management and abnormal procedures",
      "Instrument proficiency refresh",
    ],
  },
  {
    id: "cfi-initial",
    title: "CFI Initial (Airplane) - Part 61 Template",
    subtitle: "FOI mastery, teaching techniques, and right-seat proficiency.",
    completionStandards: [
      "Meet Part 61.183 eligibility and aeronautical experience requirements.",
      "Demonstrate ACS teaching tasks and practical test readiness.",
      "Complete mock oral with teach-back evaluations.",
    ],
    phases: [
      {
        id: "cfi-foi",
        title: "Phase 1 - Fundamentals of Instruction",
        summary: "Teaching and learning fundamentals for CFIs.",
        ground: [
          "Learning process, human behavior, and effective instruction",
          "Lesson planning and evaluation techniques",
        ],
        flight: [
          "Right-seat orientation and safety review",
        ],
      },
      {
        id: "cfi-knowledge",
        title: "Phase 2 - Technical Knowledge and Regulations",
        summary: "CFI responsibilities, endorsements, and risk management.",
        ground: [
          "Part 61 privileges, limitations, and endorsements",
          "Weather, performance, and ADM for instructors",
        ],
        flight: [
          "Right-seat demonstrations of PPL maneuvers",
        ],
      },
      {
        id: "cfi-teaching",
        title: "Phase 3 - Flight Teaching",
        summary: "Teach core maneuvers and correct student errors.",
        ground: [
          "Common student errors and corrective coaching",
          "Scenario-based instruction techniques",
        ],
        flight: [
          "Demonstration and coaching of PPL maneuvers",
          "Emergency procedure instruction",
        ],
      },
      {
        id: "cfi-checkride",
        title: "Phase 4 - Checkride Prep",
        summary: "Mock oral, teach-backs, and final polish.",
        ground: [
          "Mock oral exam and teaching evaluations",
          "Lesson plan review and endorsements",
        ],
        flight: [
          "Mock practical test profile",
          "Targeted remediation and final review",
        ],
      },
    ],
    simulatorModules: [
      "Right-seat instrument scan and unusual attitudes",
      "Scenario-based CRM and ADM teaching drills",
    ],
  },
];
