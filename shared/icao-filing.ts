export const ICAO_SURVEILLANCE_OPTIONS = [
  { code: "N", label: "N - No surveillance equipment" },
  { code: "I", label: "I - Mode S transponder, no aircraft ID or pressure altitude" },
  { code: "P", label: "P - Mode S transponder with pressure altitude, no aircraft ID" },
  { code: "X", label: "X - Mode S transponder with aircraft ID, no pressure altitude" },
  { code: "A", label: "A - Mode A transponder" },
  { code: "C", label: "C - Mode A/C transponder" },
  { code: "E", label: "E - Mode S transponder with aircraft ID, pressure altitude, extended squitter" },
  { code: "H", label: "H - Mode S transponder with aircraft ID, pressure altitude, enhanced surveillance" },
  { code: "L", label: "L - Mode S transponder with aircraft ID, pressure altitude, extended squitter, enhanced surveillance" },
  { code: "S", label: "S - Mode S transponder" },
] as const;

export const FLIGHT_SERVICE_DIRECT_SURVEILLANCE_CODES = new Set(["N", "A", "C", "S"]);

export const ICAO_EXTENDED_SURVEILLANCE_OPTIONS = [
  { code: "B1", label: "B1 - ADS-B Out (1090ES)" },
  { code: "B2", label: "B2 - ADS-B Out/In (1090ES)" },
  { code: "U1", label: "U1 - ADS-B Out (UAT)" },
  { code: "U2", label: "U2 - ADS-B Out/In (UAT)" },
  { code: "V1", label: "V1 - ADS-B Out (VDL Mode 4)" },
  { code: "V2", label: "V2 - ADS-B Out/In (VDL Mode 4)" },
  { code: "D1", label: "D1 - ADS-C FANS 1/A" },
  { code: "G1", label: "G1 - ADS-C ATN" },
] as const;

export const ICAO_ALL_SURVEILLANCE_OPTIONS = [
  ...ICAO_SURVEILLANCE_OPTIONS,
  ...ICAO_EXTENDED_SURVEILLANCE_OPTIONS,
] as const;

export const ICAO_OTHER_INFO_PREFIXES = [
  "STS/",
  "PBN/",
  "NAV/",
  "COM/",
  "DAT/",
  "SUR/",
  "DEP/",
  "DEST/",
  "DOF/",
  "REG/",
  "EET/",
  "SEL/",
  "OPR/",
  "PER/",
  "TYP/",
  "ALTN/",
  "RALT/",
  "TALT/",
  "RIF/",
  "RMK/",
] as const;

export type IcaoOtherInfoPrefix = typeof ICAO_OTHER_INFO_PREFIXES[number];

export type IcaoOtherInfoPrefixOption = {
  prefix: IcaoOtherInfoPrefix;
  label: string;
  description: string;
};

export const ICAO_OTHER_INFO_PREFIX_OPTIONS: IcaoOtherInfoPrefixOption[] = [
  { prefix: "STS/", label: "STS/ - Special handling", description: "Operational status such as MEDEVAC, SAR, or STATE." },
  { prefix: "PBN/", label: "PBN/ - Performance based navigation", description: "Required when aircraft equipment includes R." },
  { prefix: "NAV/", label: "NAV/ - Navigation details", description: "Navigation capabilities not fully described in equipment codes." },
  { prefix: "COM/", label: "COM/ - Communication details", description: "Communication capabilities or exemptions." },
  { prefix: "DAT/", label: "DAT/ - Datalink details", description: "Datalink capabilities such as CPDLC or FANS." },
  { prefix: "SUR/", label: "SUR/ - Surveillance details", description: "ADS-B, ADS-C, or surveillance details beyond Item 10b." },
  { prefix: "DEP/", label: "DEP/ - Departure details", description: "Departure location details, commonly for ZZZZ." },
  { prefix: "DEST/", label: "DEST/ - Destination details", description: "Destination location details, commonly for ZZZZ." },
  { prefix: "DOF/", label: "DOF/ - Date of flight", description: "Flight date in YYMMDD format." },
  { prefix: "REG/", label: "REG/ - Registration", description: "Aircraft registration if different from aircraft ID." },
  { prefix: "EET/", label: "EET/ - Elapsed time points", description: "Significant point or FIR elapsed times." },
  { prefix: "SEL/", label: "SEL/ - SELCAL", description: "SELCAL code when applicable." },
  { prefix: "OPR/", label: "OPR/ - Operator", description: "Aircraft operator when not obvious from aircraft ID." },
  { prefix: "PER/", label: "PER/ - Performance category", description: "Aircraft performance category." },
  { prefix: "TYP/", label: "TYP/ - Actual aircraft type", description: "Required when Aircraft Type is ZZZZ." },
  { prefix: "ALTN/", label: "ALTN/ - Alternate details", description: "Alternate aerodrome details." },
  { prefix: "RALT/", label: "RALT/ - Enroute alternate", description: "Enroute alternate aerodrome." },
  { prefix: "TALT/", label: "TALT/ - Takeoff alternate", description: "Takeoff alternate aerodrome." },
  { prefix: "RIF/", label: "RIF/ - Reclearance route", description: "Reclearance route and revised destination." },
  { prefix: "RMK/", label: "RMK/ - Remarks", description: "Operational remarks accepted in ICAO Other Info." },
];

export type IcaoOtherInfoEntry = {
  prefix: IcaoOtherInfoPrefix;
  value: string;
};

export type IcaoOtherInfoValueOption = {
  value: string;
  label: string;
  description: string;
};

export const ICAO_OTHER_INFO_VALUE_OPTIONS: Partial<Record<IcaoOtherInfoPrefix, IcaoOtherInfoValueOption[]>> = {
  "STS/": [
    { value: "ALTRV", label: "ALTRV", description: "Altitude reservation" },
    { value: "ATFMX", label: "ATFMX", description: "Exempt from ATFM measures" },
    { value: "FFR", label: "FFR", description: "Fire-fighting flight" },
    { value: "FLTCK", label: "FLTCK", description: "Flight check for navaids" },
    { value: "HAZMAT", label: "HAZMAT", description: "Hazardous materials" },
    { value: "HEAD", label: "HEAD", description: "Head of state status" },
    { value: "HOSP", label: "HOSP", description: "Medical flight declared by authorities" },
    { value: "HUM", label: "HUM", description: "Humanitarian flight" },
    { value: "MARSA", label: "MARSA", description: "Military assumes separation responsibility" },
    { value: "MEDEVAC", label: "MEDEVAC", description: "Life-critical medical evacuation" },
    { value: "NONRVSM", label: "NONRVSM", description: "Non-RVSM capable flight" },
    { value: "SAR", label: "SAR", description: "Search and rescue" },
    { value: "STATE", label: "STATE", description: "Military, customs, or police service" },
  ],
  "PBN/": [
    { value: "A1", label: "A1", description: "RNAV 10 / RNP 10" },
    { value: "B1", label: "B1", description: "RNAV 5 all permitted sensors" },
    { value: "B2", label: "B2", description: "RNAV 5 GNSS" },
    { value: "B3", label: "B3", description: "RNAV 5 DME/DME" },
    { value: "B4", label: "B4", description: "RNAV 5 VOR/DME" },
    { value: "B5", label: "B5", description: "RNAV 5 INS or IRS" },
    { value: "B6", label: "B6", description: "RNAV 5 LORAN C" },
    { value: "C1", label: "C1", description: "RNAV 2 all permitted sensors" },
    { value: "C2", label: "C2", description: "RNAV 2 GNSS" },
    { value: "C3", label: "C3", description: "RNAV 2 DME/DME" },
    { value: "C4", label: "C4", description: "RNAV 2 DME/DME/IRU" },
    { value: "D1", label: "D1", description: "RNAV 1 all permitted sensors" },
    { value: "D2", label: "D2", description: "RNAV 1 GNSS" },
    { value: "D3", label: "D3", description: "RNAV 1 DME/DME" },
    { value: "D4", label: "D4", description: "RNAV 1 DME/DME/IRU" },
    { value: "L1", label: "L1", description: "RNP 4" },
    { value: "O1", label: "O1", description: "Basic RNP 1 all permitted sensors" },
    { value: "O2", label: "O2", description: "Basic RNP 1 GNSS" },
    { value: "O3", label: "O3", description: "Basic RNP 1 DME/DME" },
    { value: "O4", label: "O4", description: "Basic RNP 1 DME/DME/IRU" },
    { value: "S1", label: "S1", description: "RNP APCH" },
    { value: "S2", label: "S2", description: "RNP APCH with BARO-VNAV" },
    { value: "T1", label: "T1", description: "RNP AR APCH with RF" },
    { value: "T2", label: "T2", description: "RNP AR APCH without RF" },
  ],
  "NAV/": [
    { value: "GPS", label: "GPS", description: "GPS navigation capability" },
    { value: "GNSS", label: "GNSS", description: "Global navigation satellite system" },
    { value: "SBAS", label: "SBAS", description: "Satellite-based augmentation" },
    { value: "GBAS", label: "GBAS", description: "Ground-based augmentation" },
    { value: "DME/DME", label: "DME/DME", description: "DME/DME area navigation" },
    { value: "INS", label: "INS", description: "Inertial navigation system" },
    { value: "IRS", label: "IRS", description: "Inertial reference system" },
    { value: "RNAV", label: "RNAV", description: "Area navigation details" },
    { value: "RNP", label: "RNP", description: "Required navigation performance details" },
  ],
  "COM/": [
    { value: "VHF", label: "VHF", description: "VHF communication details" },
    { value: "UHF", label: "UHF", description: "UHF communication details" },
    { value: "HF", label: "HF", description: "HF communication details" },
    { value: "8.33KHZ", label: "8.33KHZ", description: "8.33 kHz channel spacing" },
    { value: "CPDLC", label: "CPDLC", description: "Controller-pilot datalink communications" },
    { value: "SATVOICE", label: "SATVOICE", description: "Satellite voice capability" },
  ],
  "DAT/": [
    { value: "CPDLC", label: "CPDLC", description: "Controller-pilot datalink communications" },
    { value: "FANS1A", label: "FANS 1/A", description: "FANS 1/A datalink" },
    { value: "ATN", label: "ATN", description: "Aeronautical telecommunication network" },
    { value: "VDL2", label: "VDL Mode 2", description: "VDL Mode 2 datalink" },
    { value: "SATCOM", label: "SATCOM", description: "Satellite datalink" },
  ],
  "SUR/": [
    { value: "ADSB", label: "ADS-B", description: "ADS-B surveillance detail" },
    { value: "ADSC", label: "ADS-C", description: "ADS-C surveillance detail" },
    { value: "DO260", label: "DO-260", description: "1090ES ADS-B standard" },
    { value: "DO260A", label: "DO-260A", description: "1090ES ADS-B standard" },
    { value: "DO260B", label: "DO-260B", description: "1090ES ADS-B standard" },
    { value: "DO282B", label: "DO-282B", description: "UAT ADS-B standard" },
  ],
  "PER/": [
    { value: "A", label: "A", description: "Aircraft performance category A" },
    { value: "B", label: "B", description: "Aircraft performance category B" },
    { value: "C", label: "C", description: "Aircraft performance category C" },
    { value: "D", label: "D", description: "Aircraft performance category D" },
    { value: "E", label: "E", description: "Aircraft performance category E" },
    { value: "H", label: "H", description: "Helicopter performance category" },
  ],
  "RMK/": [
    { value: "TRAINING FLIGHT", label: "TRAINING FLIGHT", description: "Training or practice flight" },
    { value: "STUDENT PILOT", label: "STUDENT PILOT", description: "Student pilot operation" },
    { value: "CHECKRIDE", label: "CHECKRIDE", description: "Practical test or evaluation flight" },
    { value: "DEMO FLIGHT", label: "DEMO FLIGHT", description: "Demonstration flight" },
    { value: "PILOT REVIEWED", label: "PILOT REVIEWED", description: "Pilot-reviewed planning note" },
  ],
};

const SURVEILLANCE_CODES = ICAO_ALL_SURVEILLANCE_OPTIONS.map((option) => option.code).sort((a, b) => b.length - a.length);
const SURVEILLANCE_CODE_SET = new Set<string>(ICAO_ALL_SURVEILLANCE_OPTIONS.map((option) => option.code));
const FLIGHT_SERVICE_SURVEILLANCE_CODE_SET = FLIGHT_SERVICE_DIRECT_SURVEILLANCE_CODES;
const OTHER_INFO_PREFIX_SET = new Set<string>(ICAO_OTHER_INFO_PREFIXES);

export const parseIcaoSurveillanceCodes = (input: string | null | undefined) => {
  let remaining = String(input || "").trim().toUpperCase().replace(/[\s,/.-]+/g, "");
  const codes: string[] = [];
  while (remaining) {
    const match = SURVEILLANCE_CODES.find((code) => remaining.startsWith(code));
    if (!match) return [];
    codes.push(match);
    remaining = remaining.slice(match.length);
  }
  return Array.from(new Set(codes));
};

export const normalizeIcaoSurveillanceCodes = (codes: string[]) => {
  const normalized = Array.from(new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => SURVEILLANCE_CODE_SET.has(code))));
  if (normalized.includes("N")) return "N";
  return normalized.join("");
};

export const hasOnlyKnownIcaoSurveillanceCodes = (input: string | null | undefined) => {
  const raw = String(input || "").trim();
  if (!raw) return false;
  return normalizeIcaoSurveillanceCodes(parseIcaoSurveillanceCodes(raw)) === raw.toUpperCase().replace(/[\s,/.-]+/g, "");
};

export const hasOnlyFlightServiceSurveillanceCodes = (input: string | null | undefined) => {
  const codes = parseIcaoSurveillanceCodes(input);
  return codes.length > 0 && codes.every((code) => FLIGHT_SERVICE_SURVEILLANCE_CODE_SET.has(code));
};

export const parseIcaoOtherInfoEntries = (input: string | null | undefined): IcaoOtherInfoEntry[] => {
  const raw = String(input || "").trim();
  if (!raw) return [];
  const prefixPattern = ICAO_OTHER_INFO_PREFIXES.map((prefix) => prefix.replace("/", "\\/")).join("|");
  const regex = new RegExp(`(${prefixPattern})`, "gi");
  const matches = Array.from(raw.matchAll(regex));
  return matches
    .map((match, index) => {
      const prefix = `${match[1].toUpperCase().replace(/\/?$/, "")}/` as IcaoOtherInfoPrefix;
      const start = (match.index || 0) + match[1].length;
      const end = index + 1 < matches.length ? matches[index + 1].index || raw.length : raw.length;
      return { prefix, value: raw.slice(start, end).trim() };
    })
    .filter((entry) => OTHER_INFO_PREFIX_SET.has(entry.prefix) && entry.value);
};

export const buildIcaoOtherInfo = (entries: IcaoOtherInfoEntry[]) =>
  entries
    .map((entry) => {
      const prefix = entry.prefix.toUpperCase() as IcaoOtherInfoPrefix;
      const value = String(entry.value || "").trim().toUpperCase();
      return OTHER_INFO_PREFIX_SET.has(prefix) && value ? `${prefix}${value}` : "";
    })
    .filter(Boolean)
    .join(" ");

export const getIcaoOtherInfoEquipmentWarnings = (otherInfo: string | null | undefined, equipment: string | null | undefined) => {
  const entries = parseIcaoOtherInfoEntries(otherInfo);
  const equipmentCodes = new Set(String(equipment || "").toUpperCase().replace(/[^A-Z0-9]/g, "").split(""));
  const requiresR = entries.some((entry) => entry.prefix === "PBN/");
  const requiresZ = entries.some((entry) => ["NAV/", "COM/", "DAT/"].includes(entry.prefix));
  const equipmentHasR = equipmentCodes.has("R");
  return {
    requiresR,
    requiresZ,
    missingR: requiresR && !equipmentCodes.has("R"),
    missingZ: requiresZ && !equipmentCodes.has("Z"),
    equipmentHasR,
    missingPbn: equipmentHasR && !requiresR,
  };
};
