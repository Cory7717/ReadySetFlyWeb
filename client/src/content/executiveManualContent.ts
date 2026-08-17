export type ExecutiveManualMetric = {
  value: string;
  label: string;
};

export type ExecutiveManualGlossaryEntry = {
  term: string;
  definition: string;
};

export type ExecutiveManualPage = {
  id: string;
  part: string;
  section: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: string;
  keyTakeaways?: string[];
  metrics?: ExecutiveManualMetric[];
  glossary?: ExecutiveManualGlossaryEntry[];
  variant?: "cover" | "standard" | "flywheel" | "glossary";
};

export const executiveManualPages: ExecutiveManualPage[] = [
  {
    id: "cover",
    part: "Cover",
    section: "Ready Set Fly",
    title: "Executive Training Manual",
    subtitle: "Understanding the Platform, Business Model, Strategy and Long-Term Vision",
    callout: "Internal Use",
    variant: "cover",
  },
  {
    id: "five-minutes",
    part: "Part I",
    section: "Understanding Ready Set Fly",
    title: "Ready Set Fly in Five Minutes",
    paragraphs: [
      "Ready Set Fly is a web and mobile aviation platform designed to reduce friction across general aviation. The original concept centered on helping private aircraft owners make aircraft available for rent while giving pilots more aircraft-access options.",
      "As development progressed and feedback was gathered from pilots, instructors, aircraft owners and aviation businesses, a larger problem became clear: general aviation has many useful products, but pilots often move between several disconnected platforms to complete one flying workflow.",
      "RSF evolved from an aircraft-rental concept into a connected ecosystem spanning aircraft access, the aviation marketplace, flight planning, weather and operational information, Flight Service functionality, training resources, pilot tools, digital records and mobile flight-related capabilities.",
    ],
    callout: "RSF is not simply another aviation app. The strategy is to reduce friction between the services and tools pilots already need.",
  },
  {
    id: "problem",
    part: "Part I",
    section: "Understanding Ready Set Fly",
    title: "The Problem RSF Solves",
    paragraphs: [
      "A pilot may rent an aircraft in one system, build a route in another, review weather and NOTAMs elsewhere, manage a flight plan through Flight Service, complete training in a separate environment and record the flight in another logbook.",
      "The individual products are not necessarily poor. The strategic problem is that the workflow between them is disconnected. Information is re-entered, context is lost and the user repeatedly changes tools during a process that should feel continuous.",
      "RSF attempts to reduce those seams by connecting discovery, planning, flying, training and records within one recognizable environment.",
    ],
    callout: "Routine should not automatically be mistaken for efficiency.",
  },
  {
    id: "audiences",
    part: "Part I",
    section: "Understanding Ready Set Fly",
    title: "Who RSF Serves",
    paragraphs: [
      "RSF serves participants across the general-aviation ecosystem. Each audience enters for a different reason, but their activity can reinforce the value available to the others.",
    ],
    bullets: [
      "Pilots — private, instrument and other GA pilots using aircraft access, planning, records, services and tools.",
      "Student pilots — people entering aviation who need education, instructors, planning resources and a path through training.",
      "CFIs — Certified Flight Instructors seeking visibility, student relationships and training-management tools.",
      "Aircraft owners — owners seeking to offset costs by making underused aircraft available where appropriate.",
      "Flight schools and aviation businesses — organizations reaching pilots inside a relevant aviation workflow.",
      "Advertisers and partners — aviation brands seeking a concentrated, contextual GA audience.",
    ],
  },
  {
    id: "rental-marketplace",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Aircraft Rental Marketplace",
    paragraphs: [
      "Aircraft rentals were the original RSF concept. Owners can list aircraft, pilots can discover additional access options and RSF facilitates the marketplace relationship without owning the aircraft itself.",
      "For owners, appropriate rental activity may help offset aircraft ownership costs. For pilots, marketplace inventory can supplement traditional flight-school fleets and local rental options.",
      "RSF earns a 7.5% owner-side commission and a 7.5% renter booking fee for a total platform take rate of 15% per completed rental transaction. This is transaction revenue; it is not aircraft ownership or rental gross merchandise value.",
    ],
    metrics: [
      { value: "7.5%", label: "Owner-side commission" },
      { value: "7.5%", label: "Renter booking fee" },
      { value: "15%", label: "Total platform take rate" },
    ],
  },
  {
    id: "traditional-marketplace",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Traditional Aviation Marketplace",
    paragraphs: [
      "RSF also supports a traditional aviation marketplace where relevant products and services can be presented to an aviation audience. Categories may include aircraft for sale, avionics, parts, aviation services, hangars, aviation real estate and other appropriate listings.",
      "The commercial model can include paid listings, featured placement, category visibility and business or dealer packages as inventory and participation mature. The marketplace provides another reason for pilots and businesses to remain inside the broader ecosystem.",
    ],
    callout: "Marketplace opportunity should be measured by verified listings, engagement and completed commercial activity—not invented transaction volume.",
  },
  {
    id: "flight-planner",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Flight Planner",
    paragraphs: [
      "The Flight Planner brings departure and destination planning, routes, aircraft profiles, airport information, weather, NOTAM information, TFR awareness, runway context, approach plates and Flight Service functionality into a connected preflight workflow.",
      "Strategically, it has become one of the most important parts of RSF because it places the platform inside a pilot's recurring operational routine. A planning tool is useful before a commercial transaction, during ordinary flying and alongside other RSF services.",
      "The executive objective is not to expose technical implementation. It is to provide a reliable workflow in which the pilot can understand the route, environment, aircraft and required actions without unnecessary platform switching.",
    ],
  },
  {
    id: "flight-service",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Flight Service",
    paragraphs: [
      "RSF is developing supported FAA Flight Service functionality directly within the Flight Planner. Conceptually, the lifecycle includes filing, retrieving, amending, activating, cancelling and closing a flight plan.",
      "The Flight Planner exchanges information with an external operational Flight Service system. Accuracy, reliability, lifecycle control and traceability therefore matter. RSF must know what was sent, what was received and how the application represented the provider response.",
      "This capability is progressing through independent Verification and Validation. It should not be described as FAA certification or government endorsement, and unfinished operational work should not be presented as production-ready.",
    ],
    keyTakeaways: ["File", "Retrieve", "Amend", "Activate", "Cancel", "Close"],
  },
  {
    id: "verification-validation",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Independent Verification & Validation",
    paragraphs: [
      "Verification and Validation, or V&V, is an independent evaluation of whether applicable Flight Planner functions perform as intended and behave consistently.",
      "The review considers whether aviation information is handled correctly, intended flight information is transmitted, provider responses are received and represented accurately, and failures remain predictable when external systems or data are unavailable.",
      "This matters because operational aviation information may affect pilot decision-making. V&V applies to the Flight Planner and applicable operational functionality; it does not certify the entire RSF platform.",
    ],
  },
  {
    id: "swim-data",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "FAA SWIM and Aviation Data",
    paragraphs: [
      "FAA SWIM is part of the infrastructure through which aviation information can be distributed electronically. RSF has built infrastructure capable of receiving and processing live aviation information rather than relying only on static content.",
      "Depending on the applicable source and workflow, this can support weather, NOTAM-related information and other aviation data used throughout RSF tools.",
      "The executive significance is infrastructure maturity: live data must be ingested, interpreted, monitored and presented reliably. Detailed transport configuration is an engineering concern, not the core executive narrative.",
    ],
  },
  {
    id: "weather-notams",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Weather and NOTAM Intelligence",
    paragraphs: [
      "Aviation weather and operational notices can be difficult to digest quickly. METARs summarize observed airport weather, while TAFs describe forecast conditions. NOTAMs communicate temporary or operationally important information that may affect an airport, route or procedure.",
      "RSF brings source information into the pilot workflow and can supplement it with human-readable organization or interpretation. The source information and an RSF-generated advisory are not the same thing, and the product should preserve that distinction clearly.",
      "The goal is to make complex information easier to understand without concealing the authoritative material on which the presentation is based.",
    ],
  },
  {
    id: "route-awareness",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Route Analysis and Situational Awareness",
    paragraphs: [
      "RSF provides additional context around a planned route, including applicable weather, hazards, risk indicators and operational considerations where supported.",
      "These are RSF advisory and situational-awareness tools. They are distinct from authoritative Flight Service information and should be presented as decision support rather than a substitute for pilot judgment or required official sources.",
      "Strategically, the feature helps a pilot evaluate the flight as an operating environment rather than seeing only a line between two airports.",
    ],
  },
  {
    id: "plates-airports",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Approach Plates and Airport Information",
    paragraphs: [
      "Instrument procedures, approach plates, airport data and runway information provide essential operational context. Procedure publications also follow defined update cycles.",
      "Correctly associating an airport, procedure and publication cycle is important to reliability. The executive concern is disciplined data handling: current information must be connected to the correct airport and represented without ambiguity.",
    ],
  },
  {
    id: "pilot-tools",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Pilot Tools",
    paragraphs: [
      "The broader tool ecosystem includes capabilities such as the E6B flight computer, wind calculations, VOR and instrument training, GPS and glass-panel learning tools, runway briefings, airport information, weather, NOTAM context and fuel information.",
      "These tools are not random additions. They create useful entry points into RSF and give pilots reasons to return even when they are not renting an aircraft or filing a flight plan.",
    ],
    callout: "Frequent utility builds habit. Habit creates opportunities for deeper platform engagement.",
  },
  {
    id: "training-ecosystem",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Training Ecosystem",
    paragraphs: [
      "RSF supports the pilot-training journey through student resources, CFI discovery, instructor and student relationships, training management, applicable syllabi and communication tools.",
      "Reaching pilots early is strategically valuable. A student who begins with educational tools may later need an instructor, aircraft access, flight planning, marketplace services and a digital record of completed flights.",
      "Training also connects several sides of the ecosystem: students, instructors, schools, aircraft and operational tools.",
    ],
  },
  {
    id: "digital-logbook",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Digital Logbook",
    paragraphs: [
      "The digital logbook extends RSF beyond preflight and flight execution into records, pilot history, currency awareness, compliance tracking and analytics.",
      "That post-flight connection matters strategically. A completed flight becomes part of the pilot's continuing history and creates a natural reason to return to the platform.",
    ],
    callout: "Discover → Plan → Fly → Record → Return",
  },
  {
    id: "mobile-flight-deck",
    part: "Part II",
    section: "The RSF Ecosystem",
    title: "Mobile Platform and Flight Deck",
    paragraphs: [
      "RSF has a mobile application and active-flight architecture that extend portions of the ecosystem beyond the desktop experience. Current capabilities should always be described separately from work still in development.",
      "Flight Deck development, ADS-B connectivity, synthetic-vision direction and flight-session architecture represent the longer-term mobile operating vision. Roadmap capabilities are strategic direction, not a claim that every feature is presently production-ready.",
    ],
    keyTakeaways: [
      "Current: mobile platform and supported active-flight workflows.",
      "Roadmap: expanded Flight Deck, connectivity and situational-awareness capabilities.",
    ],
  },
  {
    id: "business-model",
    part: "Part III",
    section: "How RSF Makes Money",
    title: "Business Model",
    paragraphs: [
      "A substantial portion of RSF remains free to reduce adoption barriers and bring pilots into the ecosystem. RSF Premium is the paid tier, currently priced at $4.99/month, and provides access to enhanced functionality appropriate to that tier.",
      "Aircraft rentals can generate transaction revenue through a 7.5% owner commission and 7.5% renter booking fee. Traditional marketplace listings range from $25 to $250 per month based on the selected category and, for aircraft-for-sale listings, the selected visibility tier.",
      "Current base marketplace pricing is $25, $40 or $100 per month for aircraft-for-sale tiers; $30 per month for CFI listings; $40 per month for mechanic and aviation-job listings; and $250 per month for flight-school and charter listings. Applicable taxes, promotions and Premium discounts are calculated separately.",
      "Advertising and partnerships can include relevant display placements, featured partners and sponsorships. Multiple revenue streams reduce dependence on any single user action and allow free utility to support commercial opportunities elsewhere in the ecosystem.",
    ],
    metrics: [
      { value: "$4.99", label: "Premium per month" },
      { value: "15%", label: "Completed rental take rate" },
      { value: "$25–$250", label: "Marketplace base price per month" },
    ],
  },
  {
    id: "flywheel",
    part: "Part III",
    section: "How RSF Makes Money",
    title: "The RSF Flywheel",
    paragraphs: [
      "Free and useful pilot tools help address the classic marketplace cold-start problem. RSF can attract and serve users before those users need to complete a commercial transaction.",
      "As participation grows, more pilots can attract aircraft, instructors and aviation businesses. Greater inventory and service availability can create more engagement and commercial activity, which can support continued platform investment.",
    ],
    bullets: [
      "Useful Pilot Tools",
      "More Pilots",
      "More Aircraft, CFIs and Aviation Businesses",
      "More Marketplace Inventory and Services",
      "More Transactions and Engagement",
      "More Revenue",
      "More Platform Investment",
    ],
    variant: "flywheel",
  },
  {
    id: "status-today",
    part: "Part IV",
    section: "The Company",
    title: "Where RSF Stands Today",
    paragraphs: [
      "The RSF web platform is live. The mobile platform exists and continues development. Aviation marketplace functionality is present, the Flight Planner is operational and Flight Service capability is progressing toward production readiness through focused validation work.",
      "The figures below are verified GA4 analytics for Jan. 1–Aug. 10, 2026. They describe measured activity and should not be confused with registered users, paying subscribers or completed transactions.",
    ],
    metrics: [
      { value: "2.6K", label: "Active users YTD" },
      { value: "~79K", label: "User events YTD" },
      { value: "3m 15s", label: "Average engagement per active user" },
      { value: "24K", label: "Core Pilot Hub views" },
    ],
    callout: "Analytics period: Jan. 1–Aug. 10, 2026. BarLink and BarPulse metrics are not included as RSF traction.",
  },
  {
    id: "competition",
    part: "Part V",
    section: "Competition and Strategy",
    title: "Competitive Landscape",
    paragraphs: [
      "RSF operates in a market with established competitors. ForeFlight and Garmin Pilot are prominent in flight planning and electronic flight-bag workflows. FlightAware, CloudAhoy, Flight Schedule Pro and a range of marketplace and training products compete in other portions of the ecosystem.",
      "The appropriate executive position is not that RSF has no competition. It is that competition is often organized around individual workflow segments, while RSF is pursuing a broader connection between aircraft access, planning, training, records, tools and aviation services.",
    ],
  },
  {
    id: "differentiation",
    part: "Part V",
    section: "Competition and Strategy",
    title: "What Makes RSF Different",
    paragraphs: [
      "RSF combines marketplace participation with practical pilot tools, aircraft access, training, flight planning, records and aviation services. This creates multiple entry points and multiple reasons to return.",
      "The differentiation is not that every individual feature is unique in isolation. It is the effort to reduce the seams between them and allow activity in one area to strengthen another.",
    ],
    callout: "The ecosystem is the product.",
  },
  {
    id: "major-risks",
    part: "Part VI",
    section: "Risks and Executive Awareness",
    title: "Major Risks",
    paragraphs: [
      "Executive leadership should discuss risk candidly. RSF's opportunity is tied to its breadth, but breadth also creates execution, reliability and prioritization demands.",
    ],
    bullets: [
      "Founder concentration — much of the product and institutional knowledge remains founder-led. Mitigation requires documentation, specialized hires and distributed ownership.",
      "Operational reliability — aviation workflows require disciplined validation, monitoring and predictable failure behavior.",
      "Marketplace liquidity — aircraft, pilots and businesses must reach useful local density. Free tools help build an audience before transactions mature.",
      "Competitive pressure — established products possess brand recognition, resources and entrenched user behavior.",
      "Capital constraints — bootstrapped development limits the speed of validation, commercialization and specialist recruitment.",
      "Scope control — the connected ecosystem must grow incrementally so new work does not destabilize completed functionality.",
    ],
  },
  {
    id: "architecture-overview",
    part: "Part VII",
    section: "Platform Architecture",
    title: "How RSF Is Built",
    paragraphs: [
      "RSF is a TypeScript-based web platform organized as a responsive React client, an Express application and worker layer, shared schemas and business rules, and a PostgreSQL persistence layer. The architecture supports public content, authenticated pilot workflows, marketplace activity, administration, background aviation-data ingestion and mobile-facing services from one coordinated codebase.",
      "The client uses React, Vite, Tailwind CSS, Radix UI, TanStack Query and Wouter. The server runs on Node.js and Express, with Zod validation, Drizzle ORM and Neon-hosted PostgreSQL. AWS S3 supports durable media and document storage, while Render hosts application services and workers.",
      "Specialized mapping and flight interfaces use Leaflet and Cesium. Shared TypeScript models help keep client forms, server validation and persistence contracts aligned while isolated services contain external-provider logic.",
    ],
    metrics: [
      { value: "4", label: "Primary architecture layers" },
      { value: "21", label: "Server modules registering routes" },
      { value: "TypeScript", label: "Shared application language" },
    ],
    bullets: [
      "Experience layer: responsive React web application and mobile-facing workflows.",
      "Application layer: Express APIs, authentication, administration and business services.",
      "Data layer: PostgreSQL through Drizzle ORM, plus durable S3 object storage.",
      "Integration layer: isolated connectors, webhooks and background workers for outside services and aviation data.",
    ],
    callout: "Architecture snapshot verified from the repository on Aug. 17, 2026; implementation counts will evolve as RSF grows.",
  },
  {
    id: "architecture-integrations",
    part: "Part VII",
    section: "Platform Architecture",
    title: "APIs, Integrations and Data Flow",
    paragraphs: [
      "A static inventory of the current server implementation found 717 literal HTTP route registrations: 307 GET, 280 POST, 72 PATCH, 42 DELETE and 16 PUT registrations. After duplicate method/path combinations are consolidated, the codebase contains 699 unique method-and-path pairs covering public, authenticated, administrative, webhook and internal operational workflows.",
      "RSF currently implements 19 external service or data-integration families. These include Flight Services validation, FAA SWIM and NMS data, FAA chart and airspace sources, Aviation Weather Center data, ADS-B Exchange, RainViewer, NASA imagery, USGS elevation, PayPal, AWS S3, Brevo email, Google authentication, Google Places, Google Analytics, OpenAI-assisted tools, Neon PostgreSQL, Expo notifications and partner referral connectivity.",
      "An implemented connector is not a claim that every integration is enabled in every environment. Availability depends on configuration, authorization and operational readiness. Flight Services functionality, in particular, must continue to be described as operating in a non-operational validation environment unless and until operational authorization is received.",
    ],
    metrics: [
      { value: "19", label: "Implemented integration families" },
      { value: "717", label: "Literal HTTP route registrations" },
      { value: "699", label: "Unique method/path pairs" },
    ],
    keyTakeaways: [
      "External services are reached through dedicated server-side connectors rather than exposing credentials to the browser.",
      "Webhooks and workers support event-driven updates and scheduled ingestion where appropriate.",
      "Shared validation and typed contracts reduce differences between user input, stored data and outbound requests.",
      "The endpoint inventory is an engineering snapshot, not a count of separate customer-facing products.",
    ],
  },
  {
    id: "executive-cheat-sheet",
    part: "Part VIII",
    section: "Executive Cheat Sheet",
    title: "Know These Answers",
    bullets: [
      "What is RSF? A connected general-aviation platform designed to reduce friction across aircraft access, planning, training, tools, records and aviation services.",
      "Who uses it? Pilots, student pilots, instructors, aircraft owners, schools and aviation businesses.",
      "How does it make money? Premium subscriptions, rental transaction fees, marketplace listings and relevant aviation advertising.",
      "What is Premium? RSF's paid tier, currently $4.99/month.",
      "How does a rental generate revenue? 7.5% owner commission plus a 7.5% renter booking fee.",
      "What is Flight Service? Operational aviation functionality supporting flight-plan actions such as filing and lifecycle management.",
      "Why does V&V matter? It independently evaluates whether applicable Flight Planner functions behave accurately and consistently.",
      "Who competes with RSF? Established flight-planning, marketplace, scheduling and training products compete with portions of the ecosystem.",
      "What makes RSF different? RSF focuses on connecting multiple portions of the GA workflow in one ecosystem.",
    ],
  },
  {
    id: "glossary-a",
    part: "Glossary",
    section: "Executive Reference",
    title: "Aviation and Platform Terms",
    variant: "glossary",
    glossary: [
      { term: "GA", definition: "General aviation: civilian flying outside scheduled airlines and most military operations." },
      { term: "CFI", definition: "Certified Flight Instructor." },
      { term: "VFR", definition: "Visual Flight Rules, used when a pilot primarily navigates by visual reference under applicable conditions." },
      { term: "IFR", definition: "Instrument Flight Rules, used for flight conducted under instrument procedures and clearances." },
      { term: "FAA", definition: "The United States Federal Aviation Administration." },
      { term: "ICAO", definition: "The International Civil Aviation Organization, which establishes international aviation standards and conventions." },
      { term: "SWIM", definition: "System Wide Information Management, infrastructure for electronic distribution of aviation information." },
      { term: "NOTAM", definition: "A notice communicating temporary or operationally important aviation information." },
      { term: "TFR", definition: "Temporary Flight Restriction." },
      { term: "METAR", definition: "A standardized aviation weather observation for an airport or reporting station." },
      { term: "TAF", definition: "A standardized aviation weather forecast for an airport area." },
      { term: "EFB", definition: "Electronic Flight Bag: a digital system used for charts, planning and other pilot information." },
      { term: "Flight Service", definition: "Operational aviation services supporting flight planning, briefings and flight-plan lifecycle actions." },
      { term: "V&V", definition: "Verification and Validation: independent evaluation that applicable functions perform as intended." },
      { term: "API", definition: "A defined way for software systems to exchange information and actions." },
    ],
  },
  {
    id: "glossary-b",
    part: "Glossary",
    section: "Executive Reference",
    title: "Business and Investment Terms",
    variant: "glossary",
    glossary: [
      { term: "SaaS", definition: "Software delivered as an ongoing online service, often through a subscription." },
      { term: "MRR", definition: "Monthly Recurring Revenue." },
      { term: "CAC", definition: "Customer Acquisition Cost: the cost required to acquire a customer." },
      { term: "LTV", definition: "Lifetime Value: the expected economic value of a customer relationship." },
      { term: "SAFE", definition: "Simple Agreement for Future Equity, an investment instrument that can convert into equity under defined terms." },
      { term: "Valuation Cap", definition: "A maximum valuation used when calculating SAFE conversion under applicable terms." },
      { term: "Dilution", definition: "The reduction in an existing owner's percentage as additional equity is issued." },
      { term: "Burn Rate", definition: "The rate at which a company spends available cash." },
      { term: "Runway", definition: "The estimated time a company can operate before requiring additional cash." },
      { term: "Seed Round", definition: "An early financing round used to develop and commercialize a company." },
      { term: "Marketplace GMV", definition: "The total value of transactions facilitated through a marketplace, before platform revenue is separated." },
      { term: "Take Rate", definition: "The percentage of marketplace transaction value retained by the platform as revenue." },
    ],
    callout: "End of manual — return to Contents at any time to revisit a chapter.",
  },
];

export const executiveManualSections = Array.from(
  executiveManualPages.reduce((sections, page, index) => {
    const existing = sections.get(page.part) || [];
    existing.push({ id: page.id, title: page.title, index });
    sections.set(page.part, existing);
    return sections;
  }, new Map<string, Array<{ id: string; title: string; index: number }>>()),
).map(([part, pages]) => ({ part, pages }));
