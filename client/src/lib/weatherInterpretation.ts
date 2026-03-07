export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN";

export type FlightCategoryInfo = {
  category: FlightCategory;
  color: "green" | "blue" | "red" | "purple" | "gray";
};

export type WeatherHazard = {
  id: string;
  label: string;
  detail: string;
  tone: "amber" | "red" | "blue";
};

type MetarLike = {
  rawOb?: string | null;
  fltCat?: string | null;
  flightCategory?: string | null;
};

type TafLike = {
  rawTAF?: string | null;
};

type NotamLike = {
  text?: string | null;
};

export function parseFlightCategory(metar: MetarLike | null | undefined): FlightCategoryInfo {
  const declared = String(metar?.fltCat || metar?.flightCategory || "").toUpperCase() as FlightCategory;
  if (declared === "VFR") return { category: "VFR", color: "green" };
  if (declared === "MVFR") return { category: "MVFR", color: "blue" };
  if (declared === "IFR") return { category: "IFR", color: "red" };
  if (declared === "LIFR") return { category: "LIFR", color: "purple" };
  if (!metar?.rawOb) return { category: "UNKNOWN", color: "gray" };

  const raw = metar.rawOb;
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) return { category: "VFR", color: "green" };
  if (ceiling >= 1000 && visibility >= 3) return { category: "MVFR", color: "blue" };
  if (ceiling >= 500 && visibility >= 1) return { category: "IFR", color: "red" };
  return { category: "LIFR", color: "purple" };
}

export function extractAtisIdentifier(metar: MetarLike | null | undefined): string | null {
  if (!metar?.rawOb) return null;
  const raw = metar.rawOb;
  const infoMatch = raw.match(/\bINFO\s+([A-Z])\b/i);
  if (infoMatch) return `Information ${infoMatch[1].toUpperCase()}`;
  const atisMatch = raw.match(/\bATIS\s+([A-Z])\b/i);
  if (atisMatch) return `Information ${atisMatch[1].toUpperCase()}`;
  const rmkIndex = raw.indexOf("RMK");
  if (rmkIndex !== -1) {
    const afterRmk = raw.substring(rmkIndex);
    const endMatch = afterRmk.match(/\s([A-Z])\s*$/);
    if (endMatch) return `Information ${endMatch[1]}`;
  }
  return null;
}

export function extractRunwayInUse(metar: MetarLike | null | undefined): string | null {
  if (!metar?.rawOb) return null;
  const raw = metar.rawOb;
  const rwyMatch = raw.match(/\b(?:RWY|RUNWAY)\s+(\d{2}[LCR]?(?:\s*(?:AND|\/|&)\s*\d{2}[LCR]?)*)/i);
  if (rwyMatch) return rwyMatch[1].replace(/\s+/g, " ").trim();
  const arrRwyMatch = raw.match(/\bARR\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  const depRwyMatch = raw.match(/\bDEP\s+(?:RWY|RUNWAY)\s+(\d{2}[LCR]?)/i);
  if (arrRwyMatch || depRwyMatch) {
    const runways: string[] = [];
    if (arrRwyMatch) runways.push(`${arrRwyMatch[1]} (arr)`);
    if (depRwyMatch) runways.push(`${depRwyMatch[1]} (dep)`);
    return runways.join(", ");
  }
  return null;
}

export function parseWeatherHazards(
  metar: MetarLike | null | undefined,
  taf: TafLike | null | undefined,
  notamItems: NotamLike[] = []
): WeatherHazard[] {
  const metarRaw = String(metar?.rawOb || "").toUpperCase();
  const tafRaw = String(taf?.rawTAF || "").toUpperCase();
  const hazards: WeatherHazard[] = [];

  if (/\b(\+|-)?(RA|DZ|SN|SG|PL|GR|GS|SHRA|SHSN)\b/.test(metarRaw)) {
    hazards.push({
      id: "precip",
      label: "Precipitation",
      detail: "Current METAR reports active precipitation at the airport.",
      tone: "blue",
    });
  }

  if (/\b(TS|TSRA|VCTS|LTG|CB)\b/.test(metarRaw) || /\b(TS|TSRA|VCTS|CB)\b/.test(tafRaw)) {
    hazards.push({
      id: "convective",
      label: "Convective risk",
      detail: "Thunderstorms, lightning, or cumulonimbus are present or forecast nearby.",
      tone: "red",
    });
  }

  if (/\bG\d{2,3}KT\b/.test(metarRaw) || /\bG\d{2,3}KT\b/.test(tafRaw)) {
    hazards.push({
      id: "gusts",
      label: "Gusty winds",
      detail: "Wind gusts are reported or forecast. Recheck crosswind and runway alignment.",
      tone: "amber",
    });
  }

  if (notamItems.some((item) => /\b(WET|SLIPPERY|BRAKING|FICON|POOR|NIL)\b/i.test(item.text ?? ""))) {
    hazards.push({
      id: "runway",
      label: "Runway condition",
      detail: "NOTAMs indicate runway surface or braking action concerns.",
      tone: "amber",
    });
  }

  return hazards;
}
