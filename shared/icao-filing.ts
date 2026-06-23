export const ICAO_SURVEILLANCE_OPTIONS = [
  { code: "N", label: "N - No surveillance equipment" },
  { code: "A", label: "A - Mode A transponder" },
  { code: "C", label: "C - Mode A/C transponder" },
  { code: "S", label: "S - Mode S transponder" },
  { code: "B1", label: "B1 - ADS-B Out (1090ES)" },
  { code: "B2", label: "B2 - ADS-B Out/In (1090ES)" },
  { code: "U1", label: "U1 - ADS-B Out (UAT)" },
  { code: "U2", label: "U2 - ADS-B Out/In (UAT)" },
  { code: "V1", label: "V1 - ADS-B Out (VDL Mode 4)" },
  { code: "V2", label: "V2 - ADS-B Out/In (VDL Mode 4)" },
  { code: "D1", label: "D1 - ADS-C FANS 1/A" },
  { code: "G1", label: "G1 - ADS-C ATN" },
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
  "ALTN/",
  "RALT/",
  "TALT/",
  "RIF/",
  "RMK/",
] as const;

export type IcaoOtherInfoPrefix = typeof ICAO_OTHER_INFO_PREFIXES[number];

export type IcaoOtherInfoEntry = {
  prefix: IcaoOtherInfoPrefix;
  value: string;
};

const SURVEILLANCE_CODES = ICAO_SURVEILLANCE_OPTIONS.map((option) => option.code).sort((a, b) => b.length - a.length);
const SURVEILLANCE_CODE_SET = new Set<string>(ICAO_SURVEILLANCE_OPTIONS.map((option) => option.code));
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
  return {
    requiresR,
    requiresZ,
    missingR: requiresR && !equipmentCodes.has("R"),
    missingZ: requiresZ && !equipmentCodes.has("Z"),
  };
};
