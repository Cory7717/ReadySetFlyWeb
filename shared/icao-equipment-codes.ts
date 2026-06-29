export type IcaoEquipmentCode = {
  code: string;
  label: string;
};

export const ICAO_EQUIPMENT_CODES: IcaoEquipmentCode[] = [
  { code: "N", label: "N - No COM/NAV/approach equipment" },
  { code: "A", label: "A - GBAS landing system" },
  { code: "B", label: "B - LPV approach capability" },
  { code: "C", label: "C - LORAN C" },
  { code: "S", label: "S - Standard VHF, VOR, ILS" },
  { code: "D", label: "D - DME" },
  { code: "E", label: "E - FMC WPR ACARS" },
  { code: "F", label: "F - ADF" },
  { code: "G", label: "G - GNSS" },
  { code: "H", label: "H - HF RTF" },
  { code: "I", label: "I - Inertial navigation" },
  { code: "J", label: "J - CPDLC ATN VDL Mode 2" },
  { code: "K", label: "K - MLS" },
  { code: "L", label: "L - ILS" },
  { code: "M", label: "M - ATC RTF SATCOM" },
  { code: "O", label: "O - VOR" },
  { code: "P", label: "P - CPDLC RCP" },
  { code: "R", label: "R - PBN approved" },
  { code: "T", label: "T - TACAN" },
  { code: "U", label: "U - UHF RTF" },
  { code: "V", label: "V - VHF RTF" },
  { code: "W", label: "W - RVSM approved" },
  { code: "X", label: "X - MNPS approved" },
  { code: "Y", label: "Y - VHF 8.33 kHz" },
  { code: "Z", label: "Z - Other equipment in Other ICAO" },
];

export const ICAO_EQUIPMENT_CODE_SET = new Set(ICAO_EQUIPMENT_CODES.map((entry) => entry.code));

const FLIGHT_SERVICE_UNSUPPORTED_EQUIPMENT_CODES = new Set([
  // Flight Service rejected aircraftEquipment=SCE during live testing. Keep
  // ACARS details out of Field 10a unless/until Flight Service confirms support.
  "E",
]);

export const parseIcaoEquipmentCodes = (value?: string | null) =>
  String(value || "")
    .toUpperCase()
    .split(/[\s,;/+]+|(?=[A-Z0-9])/g)
    .map((part) => part.trim().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

export const normalizeIcaoEquipmentCodes = (value?: string | null) => {
  const codes = parseIcaoEquipmentCodes(value);
  const uniqueCodes = Array.from(new Set(codes));
  return uniqueCodes.join("") || null;
};

export const hasOnlyKnownIcaoEquipmentCodes = (value?: string | null) => {
  const codes = parseIcaoEquipmentCodes(value);
  return codes.length > 0 && codes.every((code) => ICAO_EQUIPMENT_CODE_SET.has(code));
};

export type FlightServiceAircraftEquipmentValidation = {
  originalAircraftEquipment: string;
  normalizedAircraftEquipment: string | null;
  surveillanceEquipment: string | null;
  invalidEquipmentCodes: string[];
  duplicateEquipmentCodes: string[];
  validationResult: "valid" | "invalid";
  blockedBeforeLeidos: boolean;
};

export const validateFlightServiceAircraftEquipmentCodes = (
  aircraftEquipment?: string | null,
  surveillanceEquipment?: string | null,
): FlightServiceAircraftEquipmentValidation => {
  const originalAircraftEquipment = String(aircraftEquipment || "").trim();
  const codes = parseIcaoEquipmentCodes(originalAircraftEquipment);
  const normalizedAircraftEquipment = normalizeIcaoEquipmentCodes(originalAircraftEquipment);
  const seenCodes = new Set<string>();
  const duplicateEquipmentCodes: string[] = [];

  for (const code of codes) {
    if (seenCodes.has(code) && !duplicateEquipmentCodes.includes(code)) {
      duplicateEquipmentCodes.push(code);
    }
    seenCodes.add(code);
  }

  const invalidEquipmentCodes = Array.from(new Set([
    ...codes.filter((code) => !ICAO_EQUIPMENT_CODE_SET.has(code)),
    ...codes.filter((code) => FLIGHT_SERVICE_UNSUPPORTED_EQUIPMENT_CODES.has(code)),
    ...(codes.includes("N") && codes.length > 1 ? ["N"] : []),
    ...duplicateEquipmentCodes,
  ]));
  const validationResult = codes.length > 0 && invalidEquipmentCodes.length === 0 ? "valid" : "invalid";

  return {
    originalAircraftEquipment,
    normalizedAircraftEquipment,
    surveillanceEquipment: String(surveillanceEquipment || "").trim().toUpperCase() || null,
    invalidEquipmentCodes,
    duplicateEquipmentCodes,
    validationResult,
    blockedBeforeLeidos: validationResult === "invalid",
  };
};
