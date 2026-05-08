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
