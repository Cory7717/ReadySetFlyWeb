export type GpsTrainerTask = {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  tips?: string[];
};

export type GpsTrainerScenario = {
  id: string;
  title: string;
  summary: string;
  tasks: string[];
  notes?: string[];
};

export type GpsTrainerHotspot = {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GpsTrainerPanel = {
  image: string;
  imageKey: string;
  alt: string;
  hotspots: GpsTrainerHotspot[];
};

export type GpsTrainerUnit = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  highlights: string[];
  panel: GpsTrainerPanel;
  tasks: GpsTrainerTask[];
  scenarios: GpsTrainerScenario[];
};

export const gpsTrainerDisclaimer = [
  "RSF simulators are training aids only and are not FAA-approved devices.",
  "Always verify procedures with your instructor and current charts.",
  "US-only training data is used while RSF completes data licensing.",
];

const buildPanelImage = (label: string, accent: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650">
      <defs>
        <linearGradient id="panelGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
      </defs>
      <rect width="1200" height="650" rx="40" fill="url(#panelGradient)" />
      <rect x="40" y="40" width="1120" height="570" rx="28" fill="#0b1220" stroke="#1f2937" stroke-width="4" />
      <rect x="90" y="95" width="700" height="430" rx="16" fill="#0a1d3a" stroke="${accent}" stroke-width="6" />
      <rect x="830" y="95" width="280" height="430" rx="16" fill="#0b1323" stroke="#1f2937" stroke-width="4" />
      <rect x="90" y="545" width="1020" height="45" rx="12" fill="#0f172a" stroke="#1f2937" stroke-width="2" />
      <text x="90" y="70" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="26" font-weight="600">${label}</text>
      <text x="930" y="560" fill="#94a3b8" font-family="Arial, sans-serif" font-size="16">RSF Training Panel</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const gpsTrainerUnits: GpsTrainerUnit[] = [
  {
    id: "rsf-glass-nxi",
    title: "RSF Glass NXi",
    subtitle: "NXi-style integrated flight deck workflows.",
    summary:
      "High-fidelity trainer for glass cockpit flows: flight plan building, procedures, and IFR automation discipline.",
    highlights: [
      "Softkey + knob workflows",
      "IFR procedures and holds",
      "Approach sequencing and CDI control",
    ],
    panel: {
      imageKey: "rsf-glass-nxi",
      image: buildPanelImage("RSF Glass NXi", "#38bdf8"),
      alt: "RSF Glass NXi trainer panel",
      hotspots: [
        {
          id: "direct-to",
          label: "Direct-To",
          description: "Activate direct-to navigation and verify the active leg.",
          x: 72,
          y: 20,
          width: 10,
          height: 10,
        },
        {
          id: "flight-plan",
          label: "FPL",
          description: "Open and edit the flight plan list.",
          x: 72,
          y: 34,
          width: 10,
          height: 10,
        },
        {
          id: "procedures",
          label: "PROC",
          description: "Load and activate procedures, holds, and vectors-to-final.",
          x: 72,
          y: 48,
          width: 10,
          height: 10,
        },
        {
          id: "cdi-softkey",
          label: "CDI",
          description: "Toggle GPS/VLOC and confirm annunciations.",
          x: 22,
          y: 84,
          width: 10,
          height: 6,
        },
        {
          id: "altitude-select",
          label: "ALT SEL",
          description: "Adjust altitude preselect and confirm capture.",
          x: 76,
          y: 70,
          width: 12,
          height: 12,
        },
      ],
    },
    tasks: [
      {
        id: "direct-to",
        title: "Direct-To",
        goal: "Activate a direct-to leg and verify guidance.",
        steps: [
          "Press Direct-To and enter the waypoint identifier.",
          "Confirm the waypoint and press Activate.",
          "Verify the magenta course and active leg on the map.",
          "Set CDI to GPS and confirm annunciations.",
        ],
        tips: [
          "Verify the correct waypoint and distance before activating.",
          "Check the flight director/source for GPS.",
        ],
      },
      {
        id: "build-flight-plan",
        title: "Build a Flight Plan",
        goal: "Create a route with a destination and enroute fix.",
        steps: [
          "Open the Flight Plan page.",
          "Enter the destination airport on the first empty line.",
          "Insert one enroute fix between departure and destination.",
          "Activate the first leg and verify the sequence.",
        ],
      },
      {
        id: "load-approach",
        title: "Load an Approach",
        goal: "Load (not activate) an RNAV approach into the flight plan.",
        steps: [
          "Open Procedures and select Approach.",
          "Choose the approach, runway, and transition.",
          "Select Load (not Activate) to keep enroute guidance.",
          "Review the approach fixes in the flight plan.",
        ],
      },
      {
        id: "activate-approach",
        title: "Activate Vectors-to-Final",
        goal: "Activate vectors-to-final when cleared.",
        steps: [
          "Open Procedures and choose Vectors-to-Final.",
          "Verify the final approach course and fix.",
          "Confirm activation and monitor CDI scaling.",
          "Brief the missed approach before the final approach fix.",
        ],
      },
      {
        id: "cdi-obs",
        title: "CDI / OBS Management",
        goal: "Switch between GPS and VLOC and set OBS.",
        steps: [
          "Press CDI to toggle between GPS and VLOC.",
          "Verify the source annunciation on the PFD.",
          "Set the course or OBS as briefed.",
          "Cross-check with the approach plate.",
        ],
      },
      {
        id: "holds",
        title: "Hold Entry",
        goal: "Create and activate a hold at a fix.",
        steps: [
          "Open the Hold menu from the flight plan fix.",
          "Set inbound course, turn direction, and leg length.",
          "Activate the hold and verify the entry.",
          "Monitor timing and wind corrections.",
        ],
      },
    ],
    scenarios: [
      {
        id: "kaus-khyi-rnav",
        title: "KAUS to KHYI RNAV 13",
        summary: "IFR scenario with a short route and RNAV approach.",
        tasks: ["build-flight-plan", "load-approach", "activate-approach", "cdi-obs"],
        notes: [
          "Brief the approach and missed before the IAF.",
          "Monitor CDI scaling and transition to LPV if available.",
        ],
      },
      {
        id: "kdal-kact-ils",
        title: "KDAL to KACT ILS 19",
        summary: "Vectors-to-final workflow with VLOC switch.",
        tasks: ["direct-to", "load-approach", "activate-approach", "cdi-obs"],
      },
    ],
  },
  {
    id: "rsf-glass-classic",
    title: "RSF Glass Classic",
    subtitle: "Legacy glass cockpit workflows.",
    summary:
      "Classic glass workflows with softkeys and dedicated PROC/FPL pages.",
    highlights: [
      "Legacy button flow",
      "Procedures page discipline",
      "Approach brief and activation",
    ],
    panel: {
      imageKey: "rsf-glass-classic",
      image: buildPanelImage("RSF Glass Classic", "#22c55e"),
      alt: "RSF Glass Classic trainer panel",
      hotspots: [
        {
          id: "direct-to",
          label: "Direct-To",
          description: "Activate a direct-to leg using the legacy workflow.",
          x: 72,
          y: 20,
          width: 10,
          height: 10,
        },
        {
          id: "fpl",
          label: "FPL",
          description: "Open the flight plan page and insert fixes.",
          x: 72,
          y: 34,
          width: 10,
          height: 10,
        },
        {
          id: "proc",
          label: "PROC",
          description: "Load approaches and vectors-to-final.",
          x: 72,
          y: 48,
          width: 10,
          height: 10,
        },
        {
          id: "cdi",
          label: "CDI",
          description: "Switch nav source between GPS and VLOC.",
          x: 22,
          y: 84,
          width: 10,
          height: 6,
        },
        {
          id: "obs",
          label: "CRS/OBS",
          description: "Set course/OBS for VOR or localizer tracking.",
          x: 76,
          y: 70,
          width: 12,
          height: 12,
        },
      ],
    },
    tasks: [
      {
        id: "direct-to",
        title: "Direct-To",
        goal: "Activate a direct-to leg and verify guidance.",
        steps: [
          "Press Direct-To and enter the waypoint identifier.",
          "Confirm the waypoint and press Activate.",
          "Verify the magenta course and active leg on the map.",
          "Confirm GPS is selected as the CDI source.",
        ],
      },
      {
        id: "build-flight-plan",
        title: "Build a Flight Plan",
        goal: "Create a route with a destination and enroute fix.",
        steps: [
          "Open FPL and select the empty line.",
          "Enter the destination airport.",
          "Insert one enroute fix.",
          "Activate the first leg.",
        ],
      },
      {
        id: "load-approach",
        title: "Load an Approach",
        goal: "Load an approach without activating it.",
        steps: [
          "Press PROC and select Approach.",
          "Choose the runway and transition.",
          "Select Load.",
          "Review fixes on the FPL page.",
        ],
      },
      {
        id: "activate-approach",
        title: "Activate Vectors-to-Final",
        goal: "Activate vectors-to-final when cleared.",
        steps: [
          "Press PROC and select Vectors-to-Final.",
          "Confirm the inbound course.",
          "Activate and monitor CDI scaling.",
        ],
      },
      {
        id: "cdi-obs",
        title: "CDI / OBS Management",
        goal: "Switch nav sources and verify annunciations.",
        steps: [
          "Press CDI to toggle GPS/VLOC.",
          "Verify source annunciation.",
          "Set course or OBS as briefed.",
        ],
      },
      {
        id: "holds",
        title: "Hold Entry",
        goal: "Create a hold at a fix using the FPL menu.",
        steps: [
          "Select the fix in FPL and open the hold menu.",
          "Set inbound course and leg length.",
          "Activate hold and verify the entry.",
        ],
      },
    ],
    scenarios: [
      {
        id: "kaus-kgtu-rnav",
        title: "KAUS to KGTU RNAV 16",
        summary: "Short IFR scenario with an RNAV approach.",
        tasks: ["build-flight-plan", "load-approach", "activate-approach"],
      },
    ],
  },
  {
    id: "rsf-navstack-530",
    title: "RSF NavStack 530",
    subtitle: "Panel-mounted GPS navigation stack.",
    summary:
      "Classic knob-and-button trainer for direct-to, flight plans, and procedures.",
    highlights: [
      "Knob-centric workflow",
      "PROC page discipline",
      "Hold and OBS management",
    ],
    panel: {
      imageKey: "rsf-navstack-530",
      image: buildPanelImage("RSF NavStack 530", "#f97316"),
      alt: "RSF NavStack 530 trainer panel",
      hotspots: [
        {
          id: "direct-to",
          label: "Direct-To",
          description: "Enter and activate a direct-to waypoint.",
          x: 72,
          y: 20,
          width: 10,
          height: 10,
        },
        {
          id: "fpl",
          label: "FPL",
          description: "Build and edit the flight plan list.",
          x: 72,
          y: 34,
          width: 10,
          height: 10,
        },
        {
          id: "proc",
          label: "PROC",
          description: "Access approaches, holds, and activates.",
          x: 72,
          y: 48,
          width: 10,
          height: 10,
        },
        {
          id: "obs",
          label: "OBS",
          description: "Set and confirm OBS/course for VOR tracking.",
          x: 22,
          y: 84,
          width: 10,
          height: 6,
        },
        {
          id: "knob",
          label: "Inner/Outer Knob",
          description: "Twist to select characters and scroll lists.",
          x: 76,
          y: 70,
          width: 12,
          height: 12,
        },
      ],
    },
    tasks: [
      {
        id: "direct-to",
        title: "Direct-To",
        goal: "Activate a direct-to using the keypad and ENT.",
        steps: [
          "Press Direct-To and enter the identifier.",
          "Press ENT twice to activate.",
          "Verify the active leg and distance.",
        ],
      },
      {
        id: "build-flight-plan",
        title: "Build a Flight Plan",
        goal: "Build a basic flight plan using the FPL key.",
        steps: [
          "Press FPL to open the flight plan.",
          "Enter the destination on the next empty line.",
          "Insert one enroute fix.",
          "Activate the leg from the FPL menu.",
        ],
      },
      {
        id: "load-approach",
        title: "Load an Approach",
        goal: "Load an approach using the PROC key.",
        steps: [
          "Press PROC and select Approach.",
          "Choose the runway and transition.",
          "Select Load and press ENT.",
          "Review the approach fixes.",
        ],
      },
      {
        id: "activate-approach",
        title: "Activate Approach",
        goal: "Activate the approach when cleared.",
        steps: [
          "Press PROC and select Activate Approach.",
          "Confirm and press ENT.",
          "Monitor CDI scaling and course guidance.",
        ],
      },
      {
        id: "cdi-obs",
        title: "CDI / OBS",
        goal: "Switch from GPS to VLOC and set OBS.",
        steps: [
          "Press CDI to toggle to VLOC.",
          "Set the inbound course with the OBS knob.",
          "Verify the CDI source annunciation.",
        ],
      },
      {
        id: "holds",
        title: "Hold Entry",
        goal: "Build a hold at a fix from the FPL menu.",
        steps: [
          "Highlight the fix and open the hold menu.",
          "Set inbound course and leg length.",
          "Activate and verify hold entry.",
        ],
      },
    ],
    scenarios: [
      {
        id: "khou-kcll-vor",
        title: "KHOU to KCLL VOR-A",
        summary: "Classic VOR approach with CDI management.",
        tasks: ["build-flight-plan", "load-approach", "cdi-obs"],
      },
    ],
  },
  {
    id: "rsf-touch-750",
    title: "RSF Touch 750",
    subtitle: "Touchscreen GPS workflow trainer.",
    summary:
      "Modern touchscreen flows for flight planning, procedures, and automation control.",
    highlights: [
      "Touch-driven procedures",
      "Flight plan editing",
      "IFR workflow discipline",
    ],
    panel: {
      imageKey: "rsf-touch-750",
      image: buildPanelImage("RSF Touch 750", "#a855f7"),
      alt: "RSF Touch 750 trainer panel",
      hotspots: [
        {
          id: "direct-to",
          label: "Direct-To",
          description: "Tap to enter and activate a direct-to waypoint.",
          x: 72,
          y: 20,
          width: 10,
          height: 10,
        },
        {
          id: "fpl",
          label: "Flight Plan",
          description: "Open the flight plan page for route edits.",
          x: 72,
          y: 34,
          width: 10,
          height: 10,
        },
        {
          id: "proc",
          label: "Procedures",
          description: "Load and activate approaches or holds.",
          x: 72,
          y: 48,
          width: 10,
          height: 10,
        },
        {
          id: "cdi",
          label: "CDI",
          description: "Toggle GPS/VLOC and verify annunciations.",
          x: 22,
          y: 84,
          width: 10,
          height: 6,
        },
        {
          id: "alt-sel",
          label: "ALT SEL",
          description: "Adjust altitude preselect and capture.",
          x: 76,
          y: 70,
          width: 12,
          height: 12,
        },
      ],
    },
    tasks: [
      {
        id: "direct-to",
        title: "Direct-To",
        goal: "Activate a direct-to using the touch interface.",
        steps: [
          "Tap Direct-To and enter the identifier.",
          "Confirm the waypoint and tap Activate.",
          "Verify the active leg on the map.",
        ],
      },
      {
        id: "build-flight-plan",
        title: "Build a Flight Plan",
        goal: "Create a route in the flight plan view.",
        steps: [
          "Open Flight Plan from the home page.",
          "Insert the destination airport.",
          "Add an enroute fix.",
          "Activate the leg.",
        ],
      },
      {
        id: "load-approach",
        title: "Load an Approach",
        goal: "Load an approach without activating it.",
        steps: [
          "Tap Procedures and select Approach.",
          "Choose runway and transition.",
          "Select Load.",
          "Review fixes on the flight plan.",
        ],
      },
      {
        id: "activate-approach",
        title: "Activate Vectors-to-Final",
        goal: "Activate vectors-to-final using the procedures menu.",
        steps: [
          "Tap Procedures and select Vectors-to-Final.",
          "Confirm the inbound course.",
          "Activate and monitor CDI scaling.",
        ],
      },
      {
        id: "cdi-obs",
        title: "CDI / OBS",
        goal: "Manage GPS/VLOC and OBS with touch controls.",
        steps: [
          "Tap CDI to switch nav source.",
          "Verify annunciations on the PFD.",
          "Set OBS/course as briefed.",
        ],
      },
      {
        id: "holds",
        title: "Hold Entry",
        goal: "Insert a hold using the hold tool.",
        steps: [
          "Select the fix in the flight plan.",
          "Tap Hold and set inbound course.",
          "Activate and verify the entry.",
        ],
      },
    ],
    scenarios: [
      {
        id: "kmci-kmkc-rnav",
        title: "KMCI to KMKC RNAV 19",
        summary: "Touchscreen approach workflow with vectors-to-final.",
        tasks: ["build-flight-plan", "load-approach", "activate-approach"],
      },
    ],
  },
  {
    id: "rsf-ifd-style",
    title: "RSF IFD-Style",
    subtitle: "Hybrid keypad + touchscreen workflow.",
    summary:
      "IFD-style workflow trainer with hybrid controls and procedure management.",
    highlights: [
      "Hybrid input flow",
      "IFR procedure setup",
      "Hold and OBS drills",
    ],
    panel: {
      imageKey: "rsf-ifd-style",
      image: buildPanelImage("RSF IFD-Style", "#0ea5e9"),
      alt: "RSF IFD-Style trainer panel",
      hotspots: [
        {
          id: "direct-to",
          label: "Direct-To",
          description: "Enter and activate a direct-to waypoint.",
          x: 72,
          y: 20,
          width: 10,
          height: 10,
        },
        {
          id: "fpl",
          label: "FPL",
          description: "Open the flight plan list for edits.",
          x: 72,
          y: 34,
          width: 10,
          height: 10,
        },
        {
          id: "proc",
          label: "Procedures",
          description: "Select and activate approaches or holds.",
          x: 72,
          y: 48,
          width: 10,
          height: 10,
        },
        {
          id: "cdi",
          label: "CDI",
          description: "Toggle GPS/VLOC and confirm source.",
          x: 22,
          y: 84,
          width: 10,
          height: 6,
        },
        {
          id: "fms-knob",
          label: "FMS Knob",
          description: "Rotate to enter data and scroll menus.",
          x: 76,
          y: 70,
          width: 12,
          height: 12,
        },
      ],
    },
    tasks: [
      {
        id: "direct-to",
        title: "Direct-To",
        goal: "Activate a direct-to using hybrid controls.",
        steps: [
          "Open Direct-To and enter the identifier.",
          "Confirm the waypoint and activate.",
          "Verify the active leg on the map.",
        ],
      },
      {
        id: "build-flight-plan",
        title: "Build a Flight Plan",
        goal: "Create a basic route with keypad input.",
        steps: [
          "Open Flight Plan and select the empty line.",
          "Enter destination and enroute fix.",
          "Activate the leg.",
        ],
      },
      {
        id: "load-approach",
        title: "Load an Approach",
        goal: "Load an approach using the Procedures menu.",
        steps: [
          "Open Procedures and select Approach.",
          "Choose runway and transition.",
          "Select Load and review fixes.",
        ],
      },
      {
        id: "activate-approach",
        title: "Activate Approach",
        goal: "Activate the approach when cleared.",
        steps: [
          "Open Procedures and choose Activate.",
          "Confirm and monitor CDI scaling.",
        ],
      },
      {
        id: "cdi-obs",
        title: "CDI / OBS",
        goal: "Manage nav source and course.",
        steps: [
          "Toggle CDI between GPS and VLOC.",
          "Set OBS/course and verify annunciations.",
        ],
      },
      {
        id: "holds",
        title: "Hold Entry",
        goal: "Insert a hold at a fix.",
        steps: [
          "Select fix and open hold options.",
          "Set inbound course and leg length.",
          "Activate and verify the hold entry.",
        ],
      },
    ],
    scenarios: [
      {
        id: "kpao-kmoff-vor",
        title: "KPAO to KMOFF VOR-A",
        summary: "Classic procedure and CDI discipline.",
        tasks: ["build-flight-plan", "load-approach", "cdi-obs"],
      },
    ],
  },
];
