export type CurriculumModule = {
  id: string;
  title: string;
  summary: string;
  objectives: string[];
  keyPoints: string[];
  pitfalls: string[];
  practice: string;
  acsAreas: string[];
  references: string[];
  quiz: { question: string; options: string[]; answer: string }[];
};

export const faaAlignedCurriculum: CurriculumModule[] = [
  {
    id: "aerodynamics",
    title: "Aerodynamics",
    summary:
      "Master how lift, drag, stability, and energy management drive aircraft performance and safety.",
    objectives: [
      "Explain angle of attack and its relationship to stall.",
      "Describe load factor and its effect on stall speed.",
      "Recognize left-turning tendencies and coordination needs.",
    ],
    keyPoints: [
      "Angle of attack controls stall behavior regardless of airspeed.",
      "Load factor increases stall speed in turns and maneuvers.",
      "Energy management ties pitch, power, and airspeed together.",
    ],
    pitfalls: [
      "Confusing pitch attitude with angle of attack.",
      "Ignoring how weight and load factor change stall speed.",
    ],
    practice: "Explain why a steep turn raises stall speed and how to recover.",
    acsAreas: ["PA.I.B", "PA.I.C"],
    references: [
      "PHAK Chapter 4 (Aerodynamics of Flight)",
      "AFH Chapter 3 (Basic Flight Maneuvers)",
    ],
    quiz: [
      {
        question: "What primarily determines stall speed in a level turn?",
        options: ["Airspeed alone", "Load factor and angle of attack", "Altitude", "Fuel quantity"],
        answer: "Load factor and angle of attack",
      },
      {
        question: "What happens to stall speed as bank angle increases?",
        options: ["It decreases", "It increases", "It stays the same", "It becomes unpredictable"],
        answer: "It increases",
      },
    ],
  },
  {
    id: "airspace",
    title: "Airspace",
    summary:
      "Understand airspace classes, entry requirements, and VFR weather minimums.",
    objectives: [
      "Identify airspace classes and equipment/communication requirements.",
      "Apply VFR cloud clearance and visibility rules by class.",
      "Recognize special use airspace and operating rules.",
    ],
    keyPoints: [
      "Class B/C/D entry requires two-way radio; B requires clearance.",
      "Class E and G VFR minimums vary by altitude.",
      "Restricted and prohibited areas require authorization or avoidance.",
    ],
    pitfalls: [
      "Mixing up Class E and Class G cloud clearances.",
      "Assuming Class C/D requires explicit clearance to enter.",
    ],
    practice: "Describe VFR minimums for Class E below 10,000 MSL.",
    acsAreas: ["PA.I.B", "PA.I.K"],
    references: [
      "PHAK Chapter 15 (Airspace)",
      "AIM 3-2 (Airspace)",
    ],
    quiz: [
      {
        question: "Which airspace requires ATC clearance to enter?",
        options: ["Class B", "Class C", "Class D", "Class E"],
        answer: "Class B",
      },
      {
        question: "VFR cloud clearance for Class G below 1,200 AGL at night is:",
        options: ["1-3-152", "3-5-152", "5-1-2", "Clear of clouds"],
        answer: "3-5-152",
      },
    ],
  },
  {
    id: "weather",
    title: "Weather",
    summary:
      "Interpret METARs/TAFs and recognize hazards like icing, turbulence, and convective activity.",
    objectives: [
      "Decode METARs and TAFs for ceilings, visibility, winds, and trends.",
      "Identify thunderstorm hazards and microburst risk.",
      "Explain how density altitude affects performance.",
    ],
    keyPoints: [
      "Flight categories: VFR, MVFR, IFR, LIFR.",
      "TAFs describe expected changes; look for trends.",
      "Icing can occur above freezing level in visible moisture.",
    ],
    pitfalls: [
      "Relying on a single report instead of trends.",
      "Ignoring freezing level and icing risk.",
    ],
    practice: "Decode a METAR and determine flight category.",
    acsAreas: ["PA.I.F", "PA.I.G"],
    references: [
      "PHAK Chapter 12 (Aviation Weather)",
      "AC 00-45 (Aviation Weather Services)",
    ],
    quiz: [
      {
        question: "What does MVFR indicate?",
        options: ["Marginal VFR", "Minimum VFR", "Moderate VFR", "Meteorological VFR"],
        answer: "Marginal VFR",
      },
      {
        question: "Which report is a forecast?",
        options: ["METAR", "TAF", "PIREP", "AIRMET"],
        answer: "TAF",
      },
    ],
  },
  {
    id: "navigation",
    title: "Navigation",
    summary:
      "Build foundational skills in pilotage, dead reckoning, and radio navigation.",
    objectives: [
      "Explain heading vs course vs track.",
      "Use VORs to intercept and track radials.",
      "Interpret sectional charts for navigation and hazards.",
    ],
    keyPoints: [
      "Course is the intended path; heading accounts for wind.",
      "TO/FROM indicators depend on OBS setting and radial.",
      "Sectionals show airspace, obstacles, and terrain.",
    ],
    pitfalls: [
      "Tuning the wrong VOR frequency or OBS setting.",
      "Confusing magnetic vs true references.",
    ],
    practice: "Explain how to intercept and track a VOR radial.",
    acsAreas: ["PA.I.E", "PA.I.H"],
    references: [
      "PHAK Chapter 16 (Navigation)",
      "AIM 1-2 (Navigation Aids)",
    ],
    quiz: [
      {
        question: "A VOR radial is defined as:",
        options: ["Magnetic course to the station", "Magnetic bearing FROM the station", "True bearing to the station", "True bearing from the station"],
        answer: "Magnetic bearing FROM the station",
      },
      {
        question: "Heading differs from course because of:",
        options: ["Wind correction", "Altitude", "Fuel burn", "Weight and balance"],
        answer: "Wind correction",
      },
    ],
  },
  {
    id: "regulations",
    title: "Regulations",
    summary:
      "Know the rules that define pilot privileges, limitations, and responsibilities.",
    objectives: [
      "List required aircraft and pilot documents (ARROW).",
      "Explain right-of-way rules and VFR cruising altitudes.",
      "Describe currency and flight review requirements.",
    ],
    keyPoints: [
      "ARROW applies to aircraft documents; certificates apply to pilots.",
      "Right-of-way rules are critical in the pattern and en route.",
      "Currency differs from proficiency; both matter.",
    ],
    pitfalls: [
      "Mixing inspection requirements and AD compliance.",
      "Misunderstanding flight review intervals.",
    ],
    practice: "List required inspections for a rental aircraft.",
    acsAreas: ["PA.I.A", "PA.I.B"],
    references: [
      "FAR/AIM Part 61 and 91 (pilot privileges and operating rules)",
      "PHAK Chapter 9 (FAA Regulations)",
    ],
    quiz: [
      {
        question: "ARROW stands for:",
        options: ["Airworthiness, Registration, Radio license, Operating limitations, Weight and balance", "Airworthiness, Registration, Radio license, Operating limitations, Weight and balance, Pilot certificate", "Aircraft, Records, Repairs, Ops, Weight", "Airframe, Rudder, Radio, Ops, Weight"],
        answer: "Airworthiness, Registration, Radio license, Operating limitations, Weight and balance",
      },
      {
        question: "A flight review is required every:",
        options: ["12 months", "24 months", "36 months", "48 months"],
        answer: "24 months",
      },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    summary:
      "Calculate takeoff, landing, and climb performance using POH data.",
    objectives: [
      "Use performance charts for takeoff and landing distance.",
      "Assess density altitude effects on climb and takeoff.",
      "Explain weight and balance impacts on performance.",
    ],
    keyPoints: [
      "Higher density altitude reduces climb and takeoff performance.",
      "Use POH charts with proper corrections.",
      "Weight and CG affect stall speed and controllability.",
    ],
    pitfalls: [
      "Skipping chart corrections for temperature or pressure altitude.",
      "Underestimating takeoff distance on hot days.",
    ],
    practice: "Compute takeoff distance for given pressure altitude and temperature.",
    acsAreas: ["PA.I.C", "PA.I.D"],
    references: [
      "PHAK Chapter 11 (Aircraft Performance)",
      "AFH Chapter 10 (Performance Maneuvers)",
    ],
    quiz: [
      {
        question: "Higher density altitude generally causes:",
        options: ["Shorter takeoff distance", "Longer takeoff distance", "No change", "Improved climb"],
        answer: "Longer takeoff distance",
      },
      {
        question: "Which factor does NOT increase takeoff distance?",
        options: ["Higher temperature", "Higher elevation", "Headwind", "Higher weight"],
        answer: "Headwind",
      },
    ],
  },
  {
    id: "systems",
    title: "Systems",
    summary:
      "Understand engine, fuel, electrical, and flight control systems and their limitations.",
    objectives: [
      "Explain fuel system components and venting.",
      "Recognize electrical failure indications and actions.",
      "Describe mixture use and carb heat operations.",
    ],
    keyPoints: [
      "Fuel system design affects usable fuel and quantity indications.",
      "Electrical system failures have predictable symptoms.",
      "Mixture and carb heat usage vary by phase of flight.",
    ],
    pitfalls: [
      "Using carb heat incorrectly in cruise.",
      "Not recognizing early electrical failure signs.",
    ],
    practice: "Describe the steps for an alternator failure in flight.",
    acsAreas: ["PA.I.B", "PA.I.D"],
    references: [
      "PHAK Chapter 7 (Aircraft Systems)",
      "AFH Chapter 4 (Energy Management)",
    ],
    quiz: [
      {
        question: "An alternator failure is most likely indicated by:",
        options: ["Low oil pressure", "Ammeter showing discharge", "High CHT", "Low RPM"],
        answer: "Ammeter showing discharge",
      },
      {
        question: "Carb heat should be applied when:",
        options: ["Power is increased", "Carb icing is suspected", "Taxiing", "Mixture is leaned"],
        answer: "Carb icing is suspected",
      },
    ],
  },
  {
    id: "human-factors",
    title: "Human Factors",
    summary:
      "Develop risk management and ADM skills based on FAA best practices.",
    objectives: [
      "Apply PAVE and 3P risk frameworks to flight planning.",
      "Identify hazardous attitudes and antidotes.",
      "Recognize physiological limitations (hypoxia, fatigue, dehydration).",
    ],
    keyPoints: [
      "Risk management is continuous, not just preflight.",
      "Hazardous attitudes increase decision-making errors.",
      "Physiological limits degrade judgment and performance.",
    ],
    pitfalls: [
      "Pressing into marginal weather due to schedule pressure.",
      "Ignoring personal minimums.",
    ],
    practice: "Describe how you would use PAVE before a training flight.",
    acsAreas: ["PA.I.A", "PA.I.F"],
    references: [
      "PHAK Chapter 17 (Aeromedical Factors)",
      "FAA Risk Management Handbook",
    ],
    quiz: [
      {
        question: "PAVE stands for:",
        options: ["Pilot, Aircraft, enVironment, External pressures", "Pilot, Altitude, Visibility, Equipment", "Plan, Avoid, Verify, Execute", "Performance, Altitude, Visibility, Enroute"],
        answer: "Pilot, Aircraft, enVironment, External pressures",
      },
      {
        question: "Which is a hazardous attitude?",
        options: ["Impulsivity", "Preparedness", "Patience", "Coordination"],
        answer: "Impulsivity",
      },
    ],
  },
];
