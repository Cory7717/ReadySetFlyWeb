import { parseIcaoEquipmentCodes, validateFlightServiceAircraftEquipmentCodes } from "./icao-equipment-codes";
import { getIcaoOtherInfoEquipmentWarnings, parseIcaoOtherInfoEntries, parseIcaoSurveillanceCodes } from "./icao-filing";

export type IcaoReadinessIssueSeverity = "critical" | "warning";

export type IcaoReadinessIssue = {
  id: string;
  severity: IcaoReadinessIssueSeverity;
  field: "equipment" | "surveillance" | "pbn" | "otherInfo" | "profile";
  message: string;
  suggestion?: string;
};

export type IcaoReadinessInput = {
  aircraftEquipment?: string | null;
  surveillanceEquipment?: string | null;
  otherInfo?: string | null;
  flightRules?: string | null;
  aircraftProfileEquipment?: string | null;
  aircraftProfileSurveillanceEquipment?: string | null;
};

const PBN_SENSOR_REQUIREMENTS: Record<string, { anyOf: string[]; label: string }> = {
  B2: { anyOf: ["G"], label: "GNSS" },
  C2: { anyOf: ["G"], label: "GNSS" },
  D2: { anyOf: ["G"], label: "GNSS" },
  O2: { anyOf: ["G"], label: "GNSS" },
  B3: { anyOf: ["D"], label: "DME/DME" },
  C3: { anyOf: ["D"], label: "DME/DME" },
  D3: { anyOf: ["D"], label: "DME/DME" },
  O3: { anyOf: ["D"], label: "DME/DME" },
  B4: { anyOf: ["D"], label: "VOR/DME" },
  C4: { anyOf: ["D", "I"], label: "DME/DME/IRU" },
  D4: { anyOf: ["D", "I"], label: "DME/DME/IRU" },
  O4: { anyOf: ["D", "I"], label: "DME/DME/IRU" },
  B5: { anyOf: ["I"], label: "INS/IRS" },
  B6: { anyOf: ["C"], label: "LORAN C" },
};

const PBN_CODE_PATTERN = /^[A-Z][1-6]$/;
const ADVANCED_EQUIPMENT_CODES = new Set(["B", "G", "I", "J", "P", "R", "W", "X", "Y", "Z"]);
const ADSB_SURVEILLANCE_CODES = new Set(["B1", "B2", "U1", "U2", "V1", "V2"]);

const splitPbnCodes = (otherInfo?: string | null) =>
  parseIcaoOtherInfoEntries(otherInfo)
    .filter((entry) => entry.prefix === "PBN/")
    .flatMap((entry) => entry.value.toUpperCase().match(/[A-Z][0-9]/g) || []);

const hasOtherInfoToken = (otherInfo: string | null | undefined, pattern: RegExp) => pattern.test(String(otherInfo || "").toUpperCase());

export const validateIcaoEquipmentReadiness = (input: IcaoReadinessInput) => {
  const issues: IcaoReadinessIssue[] = [];
  const equipmentCodes = new Set(parseIcaoEquipmentCodes(input.aircraftEquipment));
  const profileEquipmentCodes = new Set(parseIcaoEquipmentCodes(input.aircraftProfileEquipment));
  const surveillanceCodes = new Set(parseIcaoSurveillanceCodes(input.surveillanceEquipment));
  const profileSurveillanceCodes = new Set(parseIcaoSurveillanceCodes(input.aircraftProfileSurveillanceEquipment));
  const pbnCodes = splitPbnCodes(input.otherInfo);
  const otherInfoWarnings = getIcaoOtherInfoEquipmentWarnings(input.otherInfo, input.aircraftEquipment);
  const flightRules = String(input.flightRules || "VFR").toUpperCase();
  const equipmentValidation = validateFlightServiceAircraftEquipmentCodes(input.aircraftEquipment, input.surveillanceEquipment);

  if (equipmentValidation.validationResult === "invalid") {
    issues.push({
      id: "equipment-invalid-code",
      severity: "critical",
      field: "equipment",
      message: "Aircraft equipment contains an invalid or unsupported ICAO code.",
      suggestion: "Review Aircraft Equipment and remove unsupported or duplicate codes before filing.",
    });
  }

  if (otherInfoWarnings.missingPbn) {
    issues.push({
      id: "equipment-r-missing-pbn",
      severity: "critical",
      field: "pbn",
      message: "Aircraft equipment includes R, which means PBN approved, but Other ICAO Information does not include PBN/.",
      suggestion: "Add the correct PBN/ capabilities or remove R if the aircraft is not PBN approved.",
    });
  }

  if (otherInfoWarnings.missingR) {
    issues.push({
      id: "pbn-missing-equipment-r",
      severity: "critical",
      field: "equipment",
      message: "Other ICAO Information includes PBN/, but Aircraft Equipment does not include R.",
      suggestion: "Add R only if the aircraft profile is PBN approved, otherwise remove PBN/.",
    });
  }

  if (otherInfoWarnings.missingZ) {
    issues.push({
      id: "other-info-missing-equipment-z",
      severity: "warning",
      field: "equipment",
      message: "NAV/, COM/, or DAT/ details usually require Z in Aircraft Equipment.",
      suggestion: "Confirm the aircraft profile supports the listed capability, then add Z if appropriate.",
    });
  }

  for (const code of pbnCodes) {
    if (!PBN_CODE_PATTERN.test(code)) {
      issues.push({
        id: `pbn-invalid-${code}`,
        severity: "critical",
        field: "pbn",
        message: `PBN/${code} is not a recognized ICAO PBN capability format.`,
        suggestion: "Select a valid PBN capability such as A1, B2, D2, O2, S1, or S2.",
      });
      continue;
    }
    const requirement = PBN_SENSOR_REQUIREMENTS[code];
    if (requirement && !requirement.anyOf.every((required) => equipmentCodes.has(required))) {
      issues.push({
        id: `pbn-sensor-${code}`,
        severity: "critical",
        field: "pbn",
        message: `PBN/${code} claims ${requirement.label} capability, but Aircraft Equipment does not include the supporting equipment code(s): ${requirement.anyOf.join(", ")}.`,
        suggestion: "Correct the PBN capability or update the aircraft equipment only if the aircraft profile actually supports it.",
      });
    }
  }

  if (flightRules === "IFR" && (equipmentCodes.has("N") || equipmentCodes.size === 0)) {
    issues.push({
      id: "ifr-missing-equipment",
      severity: "critical",
      field: "equipment",
      message: "IFR flight plans require usable COM/NAV equipment. Item 10a cannot be N or blank for IFR.",
      suggestion: "Select the installed IFR-capable aircraft equipment before filing IFR.",
    });
  }

  const directAdsbCodes = Array.from(surveillanceCodes).filter((code) => ADSB_SURVEILLANCE_CODES.has(code));
  if (directAdsbCodes.length > 0) {
    issues.push({
      id: "surveillance-direct-adsb",
      severity: "critical",
      field: "surveillance",
      message: `ADS-B code ${directAdsbCodes.join(", ")} was selected in Surveillance Equipment, but Flight Service direct filing currently accepts N, A, C, or S there.`,
      suggestion: "Use S, A, C, or N in Surveillance Equipment and place ADS-B details in Other ICAO Information as SUR/ if needed.",
    });
  }

  if (hasOtherInfoToken(input.otherInfo, /\bSUR\/(?:ADSB|DO260|DO282|UAT|1090)/) && !surveillanceCodes.has("S") && !surveillanceCodes.has("C")) {
    issues.push({
      id: "surveillance-sur-mismatch",
      severity: "critical",
      field: "surveillance",
      message: "Other ICAO Information includes ADS-B surveillance details, but Surveillance Equipment does not declare transponder/surveillance capability.",
      suggestion: "Confirm the aircraft surveillance equipment and select S or C if appropriate.",
    });
  }

  if (input.aircraftProfileEquipment && profileEquipmentCodes.size > 0) {
    for (const code of Array.from(equipmentCodes)) {
      if (ADVANCED_EQUIPMENT_CODES.has(code) && !profileEquipmentCodes.has(code)) {
        issues.push({
          id: `profile-equipment-${code}`,
          severity: "warning",
          field: "profile",
          message: `Aircraft Equipment includes advanced code ${code}, but the selected aircraft profile default does not include it.`,
          suggestion: "Review Aircraft Profile before filing. Do not file advanced equipment unless the aircraft is actually equipped and approved.",
        });
      }
    }
  }

  if (input.aircraftProfileSurveillanceEquipment && profileSurveillanceCodes.size > 0) {
    for (const code of Array.from(surveillanceCodes)) {
      if (!profileSurveillanceCodes.has(code)) {
        issues.push({
          id: `profile-surveillance-${code}`,
          severity: "warning",
          field: "profile",
          message: `Surveillance Equipment includes ${code}, but the selected aircraft profile default does not include it.`,
          suggestion: "Review Aircraft Profile before filing.",
        });
      }
    }
  }

  const critical = issues.filter((issue) => issue.severity === "critical");
  return {
    ready: critical.length === 0,
    issues,
    errors: critical.map((issue) => issue.message),
    warnings: issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
  };
};
