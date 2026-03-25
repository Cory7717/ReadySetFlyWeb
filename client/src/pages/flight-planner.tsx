
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { Link } from "wouter";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { trackEvent } from "@/lib/analytics";
import { getCurrentReturnTo, withReturnTo, withSourceParam } from "@/lib/returnTo";
import { runWithAuth } from "@/utils/authGate";
import { buildLegs, sumDistance, distanceNm, type AirportPoint } from "@/lib/flightPlanner";
import { cn } from "@/lib/utils";
import { parseFlightCategory as getFlightCategory, parseWeatherHazards } from "@/lib/weatherInterpretation";
import type { FlightPlan } from "@shared/schema";
import { UpgradePromptDialog } from "@/components/upgrade/UpgradePromptDialog";
import OperationalIntelligencePanel, { type TfmsTier } from "@/components/flight-planner/OperationalIntelligencePanel";
import { PageShell } from "@/components/layout/PageShell";
import PlannerMap, { type PlannerPoint } from "@/components/flight-planner/PlannerMap";
import NotamTranslator from "@/components/ai/NotamTranslator";

const CesiumGlobe = lazy(() => import("@/components/flight-planner/CesiumGlobe"));

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const CONTROLLED_AIRPORTS = new Set([
  "KATL", "KDFW", "KDEN", "KORD", "KLAX", "KJFK", "KSFO", "KSEA", "KLAS", "KPHX",
  "KCLT", "KIAH", "KMIA", "KBOS", "KMSP", "KDCA", "KIAD", "KEWR", "KLGA", "KPDX",
  "KPHL", "KDTW", "KSTL", "KMDW", "KSAN", "KTPA", "KAUS", "KDAL", "KHOU",
]);

const buildPlannerIcaoCandidates = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return [] as string[];
  const candidates = [normalized];
  if (normalized.length === 3) {
    candidates.push(`K${normalized}`);
  } else if (normalized.length === 4 && normalized.startsWith("K")) {
    candidates.push(normalized.slice(1));
  }
  return Array.from(new Set(candidates.filter(Boolean)));
};

const normalizeDegrees = (value: number) => ((value % 360) + 360) % 360;
const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;
const smallestAngleDiff = (a: number, b: number) => {
  const diff = normalizeDegrees(a - b + 180) - 180;
  return diff;
};
const bearingDeg = (from: AirportPoint, to: AirportPoint) => {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
};

const EPSILON = 1e-9;

const pointInPolygon = (point: { lat: number; lon: number }, ring: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi + EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const segmentCross = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
  const cross = (p1: [number, number], p2: [number, number], p3: [number, number]) =>
    (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
  const onSegment = (p1: [number, number], p2: [number, number], p: [number, number]) =>
    Math.min(p1[0], p2[0]) - EPSILON <= p[0] &&
    p[0] <= Math.max(p1[0], p2[0]) + EPSILON &&
    Math.min(p1[1], p2[1]) - EPSILON <= p[1] &&
    p[1] <= Math.max(p1[1], p2[1]) + EPSILON;

  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);

  if (Math.abs(d1) < EPSILON && onSegment(a, b, c)) return true;
  if (Math.abs(d2) < EPSILON && onSegment(a, b, d)) return true;
  if (Math.abs(d3) < EPSILON && onSegment(c, d, a)) return true;
  if (Math.abs(d4) < EPSILON && onSegment(c, d, b)) return true;

  return d1 * d2 < 0 && d3 * d4 < 0;
};

const extractPolygonRings = (geometry: any): [number, number][][] => {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates?.[0];
    return Array.isArray(ring) ? [ring] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || [])
      .map((poly: any) => poly?.[0])
      .filter((ring: any) => Array.isArray(ring));
  }
  return [];
};

const buildPolygonBounds = (ring: [number, number][]) => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  ring.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  return { minLon, maxLon, minLat, maxLat };
};

const bboxIntersects = (
  a: { west: number; east: number; south: number; north: number },
  b: { minLon: number; maxLon: number; minLat: number; maxLat: number }
) => {
  return !(a.east < b.minLon || a.west > b.maxLon || a.north < b.minLat || a.south > b.maxLat);
};

const routeIntersectsRing = (
  route: AirportPoint[],
  ring: [number, number][],
  routeBbox: { west: number; east: number; south: number; north: number }
) => {
  if (ring.length < 3 || route.length < 2) return false;
  const bounds = buildPolygonBounds(ring);
  if (!bounds || !bboxIntersects(routeBbox, bounds)) return false;

  for (const point of route) {
    if (pointInPolygon({ lat: point.lat, lon: point.lon }, ring)) return true;
  }

  for (let i = 0; i < route.length - 1; i += 1) {
    const start: [number, number] = [route[i].lon, route[i].lat];
    const end: [number, number] = [route[i + 1].lon, route[i + 1].lat];
    for (let j = 0; j < ring.length; j += 1) {
      const a = ring[j];
      const b = ring[(j + 1) % ring.length];
      if (segmentCross(start, end, a, b)) return true;
    }
  }

  return false;
};

type AircraftProfile = {
  id: string;
  name: string;
  tailNumber?: string | null;
  typeId?: string | null;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
  fuelBurnOverrideGph?: number | null;
  filingEquipmentDefault?: string | null;
  filingSoulsOnBoardDefault?: string | null;
  filingAircraftColorDefault?: string | null;
  filingPilotNameDefault?: string | null;
  filingRemarksDefault?: string | null;
  filingWakeTurbulenceDefault?: string | null;
  filingTypeOfFlightDefault?: string | null;
  filingSurveillanceEquipmentDefault?: string | null;
  filingOtherInfoDefault?: string | null;
};

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  category: string;
  engineType: string;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  fuel_burn_economy_gph_effective?: number | null;
  fuel_burn_performance_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
  isVerified?: boolean | null;
  sourceNote?: string | null;
  verificationSource?: string | null;
  verificationUrl?: string | null;
  lastVerifiedAt?: string | null;
};

type AirportSearchResult = {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

const FALLBACK_TYPE: AircraftType = {
  id: "fallback",
  make: "Generic",
  model: "Trainer",
  category: "trainer",
  engineType: "piston",
  cruise_ktas_effective: 110,
  fuel_burn_gph_effective: 8,
  usable_fuel_gal_effective: 40,
  max_gross_weight_lb_effective: 2400,
};
const CUSTOM_TYPE_ID = "custom";

const formatMinutesLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "-";
  const rounded = Math.max(1, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const formatFrequencyTypeLabel = (value?: string | null) => {
  const key = String(value || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    "clr": "Clearance",
    "clearance": "Clearance",
    "clearance delivery": "Clearance",
    "gnd": "Ground",
    "ground": "Ground",
    "twr": "Tower",
    "tower": "Tower",
    "app": "Approach",
    "approach": "Approach",
    "dep": "Departure",
    "departure": "Departure",
    "atis": "ATIS",
    "awos": "AWOS",
    "asos": "ASOS",
    "unicom": "UNICOM",
    "ctaf": "CTAF",
    "fss": "Flight Service",
  };
  return labels[key] || (value ? String(value).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Other");
};

const frequencyTypePriority = (value?: string | null) => {
  const key = String(value || "").trim().toLowerCase();
  const priorities: Record<string, number> = {
    "clearance delivery": 1,
    "clearance": 1,
    "clr": 1,
    "ground": 2,
    "gnd": 2,
    "tower": 3,
    "twr": 3,
    "departure": 4,
    "dep": 4,
    "approach": 5,
    "app": 5,
    "ctaf": 6,
    "unicom": 7,
    "atis": 8,
    "awos": 9,
    "asos": 10,
    "fss": 11,
  };
  return priorities[key] || 99;
};

type FilingPreviewResponse = {
  live: boolean;
  provider: string;
  routeType: string;
  readyToFile: boolean;
  providerUrl: string;
  liveAvailable?: boolean;
  errors: string[];
  warnings: string[];
  nextSteps: string[];
  packet: Record<string, unknown>;
};

type ScratchPadFields = {
  clearanceLimit: string;
  departure: string;
  route: string;
  altitude: string;
  frequency: string;
  squawk: string;
  void: string;
  notes: string;
};

type ScratchInkPoint = {
  x: number;
  y: number;
};

type ScratchInkStroke = {
  points: ScratchInkPoint[];
};

type ScratchPadInkLayout = "ruled" | "blank" | "craft";

const SCRATCH_PAD_DEFAULT: ScratchPadFields = {
  clearanceLimit: "",
  departure: "",
  route: "",
  altitude: "",
  frequency: "",
  squawk: "",
  void: "",
  notes: "",
};

const FLIGHT_PLANNER_DRAFT_KEY = "rsf_flight_planner_draft_v1";
const FLIGHT_PLANNER_ACTIVE_TAB_KEY = "rsf_planner_active_tab";
type FuelBurnMode = "standard" | "economy" | "performance";
const SCRATCH_PAD_KEY = "rsf.scratchPad";
const SCRATCH_PAD_INK_KEY = "rsf.scratchPadInk";
const SCRATCH_PAD_INK_LAYOUT_KEY = "rsf.scratchPadInkLayout";
const FLIGHT_PLANNER_TABS = ["route", "weather", "navlog", "analysis", "file"] as const;
type FlightPlannerTab = typeof FLIGHT_PLANNER_TABS[number];

const MAP_STYLE_OPTIONS: Array<{
  value: "standard" | "sectional" | "radar" | "winds" | "clouds" | "globe";
  label: string;
}> = [
  { value: "standard", label: "Standard" },
  { value: "sectional", label: "Sectional" },
  { value: "radar", label: "Radar" },
  { value: "clouds", label: "Clouds" },
  { value: "globe", label: "3D Globe" },
  { value: "winds", label: "Winds" },
];

const filingStatusLabel = (status?: string | null) => {
  switch ((status || "draft").toLowerCase()) {
    case "staged":
      return "Staged";
    case "filed":
      return "Filed";
    case "activated":
      return "Activated";
    case "cancelled":
      return "Cancelled";
    case "closed":
      return "Closed";
    default:
      return "Draft";
  }
};

type WeatherResponse = {
  icao: string;
  metar: any;
  taf: any;
};

type RouteSuggestionMeta = {
  routeDistanceNm: number;
  maxLegNm: number;
  cruiseKtas: number;
  fuelBurnGph: number;
  fuelGallons: number;
  reserveMinutes: number;
};

type RouteSuggestionResponse = {
  departure: string;
  destination: string;
  waypoints: string[];
  plannedStops: string[];
  meta: RouteSuggestionMeta;
};

type AirportFrequency = {
  airportIdent: string;
  type?: string | null;
  description?: string | null;
  frequencyMhz?: number | null;
};

type AirportFrequencyResponse = {
  icao: string;
  frequencies: AirportFrequency[];
};

type FiledRouteTokenKind =
  | "airport"
  | "fix"
  | "navaid"
  | "airway"
  | "procedure"
  | "direct"
  | "coordinate"
  | "unknown";

type FiledRouteToken = {
  token: string;
  kind: FiledRouteTokenKind;
};

type LeidosRouteSearchResponse = {
  provider: string;
  environment: "lab" | "production";
  departure: string;
  destination: string;
  route: string | null;
  atcRecentIFRRoutes: string[];
  codedDepartureRoutes: string[];
  faaPreferredRoutes: string[];
  warnings: string[];
  available?: boolean;
  message?: string | null;
};

type ContextualTool = {
  id: string;
  title: string;
  description: string;
  cta: string;
  href: string;
};

type LegRiskLevel = "normal" | "caution" | "alert";

type LegRiskSummary = {
  level: LegRiskLevel;
  hasTfrConflict: boolean;
  hasIfrRisk: boolean;
  hasThunderRisk: boolean;
  hasFuelReserveRisk: boolean;
  hasFuelDeficit: boolean;
  remainingFuelGallons: number;
};

type HazardSummaryItem = {
  source: "airsigmet" | "gairmet" | "airmet";
  hazard: string;
  dueTo?: string;
  validFrom?: string;
  validTo?: string;
};

const pickHazardValue = (value: any) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const buildHazardSummary = (payload: any) => {
  const items: HazardSummaryItem[] = [];
  const pushItem = (source: HazardSummaryItem["source"], entry: any, fallback: string) => {
    if (!entry) return;
    const hazard = pickHazardValue(entry.hazard || entry.hazard_type || entry.rawAirSigmet || entry.rawAirmet || fallback);
    const dueTo = pickHazardValue(entry.dueTo || entry.due_to || entry.due_to_desc || "");
    const validFrom = pickHazardValue(entry.validTimeFrom || entry.valid_time_from || entry.validFrom || "");
    const validTo = pickHazardValue(entry.validTimeTo || entry.valid_time_to || entry.validTo || "");
    items.push({ source, hazard, dueTo: dueTo || undefined, validFrom: validFrom || undefined, validTo: validTo || undefined });
  };

  if (Array.isArray(payload?.airsigmet)) {
    payload.airsigmet.forEach((entry: any) => pushItem("airsigmet", entry, "SIGMET"));
  }
  if (Array.isArray(payload?.gairmet)) {
    payload.gairmet.forEach((entry: any) => pushItem("gairmet", entry, "G-AIRMET"));
  }
  if (Array.isArray(payload?.airmet)) {
    payload.airmet.forEach((entry: any) => pushItem("airmet", entry, "AIRMET"));
  }

  const tcfCount = Array.isArray(payload?.tcf?.features) ? payload.tcf.features.length : 0;
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];

  return { items, warnings, tcfCount };
};

function parseFlightCategory(metar: any): "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN" {
  return getFlightCategory(metar).category;
}

function hasThunder(taf: any) {
  const raw = taf?.rawTAF || "";
  return raw.includes("TS");
}

function parseMetarTempC(metar: any) {
  const raw = metar?.rawOb || "";
  const match = raw.match(/\s(M?\d{2})\/M?\d{2}\s/);
  if (!match) return null;
  const value = match[1];
  const temp = value.startsWith("M") ? -Number(value.slice(1)) : Number(value);
  return Number.isFinite(temp) ? temp : null;
}

function parseMetarWind(metar: any) {
  const raw = metar?.rawOb || "";
  const match = raw.match(/\s(\d{3}|VRB)(\d{2,3})KT/);
  if (!match) return null;
  if (match[1] === "VRB") return null;
  const direction = Number(match[1]);
  const speed = Number(match[2]);
  if (!Number.isFinite(direction) || !Number.isFinite(speed)) return null;
  return { direction, speed };
}

function parseRunwayHeading(runway: string) {
  const match = runway.trim().toUpperCase().match(/^(\d{1,2})/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return (value % 36) * 10;
}

function parseWaypoints(input: string) {
  return input
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .filter((item) => ICAO_REGEX.test(item));
}

function classifyFiledRouteToken(token: string): FiledRouteTokenKind {
  const normalized = token.trim().toUpperCase();
  if (!normalized) return "unknown";
  if (normalized === "DCT") return "direct";
  if (/^(V|J|Q|T)\d+[A-Z]?$/.test(normalized)) return "airway";
  if (/^\d{2,4}[NS]\d{3,5}[EW]$/.test(normalized) || /^\d{2,4}[NS]\/\d{3,5}[EW]$/.test(normalized)) {
    return "coordinate";
  }
  if (/^[A-Z]{5}$/.test(normalized)) return "fix";
  if (/^[A-Z]{3,6}\d[A-Z]?$/.test(normalized)) return "procedure";
  if (/^[A-Z]{2,3}$/.test(normalized)) return "navaid";
  if (/^[A-Z]{4}$/.test(normalized)) return "airport";
  return "unknown";
}

function parseFiledRouteTokens(input: string): FiledRouteToken[] {
  const normalized = normalizeRouteText(input);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .map((token) => ({
      token,
      kind: classifyFiledRouteToken(token),
    }));
}

function extractAirportTokensFromFiledRoute(tokens: FiledRouteToken[]) {
  return tokens
    .filter((token) => token.kind === "airport")
    .map((token) => token.token);
}

function filedRouteTokenKindLabel(kind: FiledRouteTokenKind) {
  switch (kind) {
    case "airport":
      return "Airport";
    case "fix":
      return "Fix";
    case "navaid":
      return "Navaid";
    case "airway":
      return "Airway";
    case "procedure":
      return "SID/STAR";
    case "direct":
      return "Direct";
    case "coordinate":
      return "Lat/Lon";
    default:
      return "Route token";
  }
}

function normalizeRouteText(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function buildRoutePreview(departure: string, route: string, destination: string) {
  return [departure, route, destination]
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .join(" ");
}

function parseDateTimeLocal(value: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { year, month, day, hour, minute };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

function normalizeTimeZone(value?: string | null) {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!value) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return fallback;
  }
}

function zonedDateTimeToUtc(value: string, timeZone: string) {
  const parts = parseDateTimeLocal(value);
  if (!parts) return null;
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0));
  const offset = getTimeZoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

function formatDateTimeLocal(date: Date, timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map: Record<string, string> = {};
    parts.forEach((part) => {
      if (part.type !== "literal") {
        map[part.type] = part.value;
      }
    });
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  } catch {
    return date.toISOString().slice(0, 16);
  }
}

function toUtcIso(value: string, timeZone: string) {
  const utcDate = zonedDateTimeToUtc(value, timeZone);
  if (utcDate) return utcDate.toISOString();
  return new Date(value).toISOString();
}

const checklistDefaults = {
  weather: false,
  fuel: false,
  currency: false,
  notams: false,
  tfr: false,
  fuelSufficient: false,
};

function flightCategoryClassName(cat: string): string {
  switch (cat) {
    case "VFR": return "bg-green-100 text-green-800 border-green-300";
    case "MVFR": return "bg-blue-100 text-blue-800 border-blue-300";
    case "IFR": return "bg-red-100 text-red-800 border-red-300";
    case "LIFR": return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300";
    default: return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

type ScratchFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  tall?: boolean;
};

function ScratchField({
  label,
  hint,
  value,
  onChange,
  multiline = false,
  tall = false,
}: ScratchFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-semibold text-white">
          {label}
        </label>
        {hint && (
          <span className="text-xs text-zinc-500">{hint}</span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={tall ? 4 : 2}
          className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
          spellCheck={false}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          spellCheck={false}
        />
      )}
    </div>
  );
}

type ScratchPadInkBoardProps = {
  strokes: ScratchInkStroke[];
  layout: ScratchPadInkLayout;
  onChange: (strokes: ScratchInkStroke[]) => void;
};

function ScratchPadInkBoard({ strokes, layout, onChange }: ScratchPadInkBoardProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draftStroke, setDraftStroke] = useState<ScratchInkStroke | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const activePointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const updateSize = () => {
      const nextWidth = wrapperRef.current?.clientWidth ?? 0;
      const nextHeight = wrapperRef.current?.clientHeight ?? 0;
      setBoardSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined" && wrapperRef.current) {
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(wrapperRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || boardSize.width === 0 || boardSize.height === 0) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(boardSize.width * ratio);
    canvas.height = Math.round(boardSize.height * ratio);
    canvas.style.width = `${boardSize.width}px`;
    canvas.style.height = `${boardSize.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, boardSize.width, boardSize.height);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, boardSize.width, boardSize.height);

    if (layout === "ruled") {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      for (let line = 1; line < 4; line += 1) {
        const y = (boardSize.height / 4) * line;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(boardSize.width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (layout === "craft") {
      const sections = [
        { key: "C", label: "CLEARANCE", width: 0.18 },
        { key: "R", label: "ROUTE", width: 0.28 },
        { key: "A", label: "ALTITUDE", width: 0.18 },
        { key: "F", label: "FREQ", width: 0.18 },
        { key: "T", label: "SQUAWK", width: 0.18 },
      ];
      let x = 0;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
      ctx.lineWidth = 1;
      sections.forEach((section, index) => {
        const width = index === sections.length - 1
          ? boardSize.width - x
          : Math.round(boardSize.width * section.width);
        ctx.fillRect(x, 0, width, 32);
        ctx.strokeRect(x, 0, width, boardSize.height);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(`${section.key} ${section.label}`, x + 10, 20);
        ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
        x += width;
      });
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.setLineDash([4, 8]);
      for (let line = 1; line < 6; line += 1) {
        const y = 32 + ((boardSize.height - 32) / 6) * line;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(boardSize.width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    const drawStroke = (stroke: ScratchInkStroke) => {
      if (stroke.points.length === 0) return;
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      if (stroke.points.length === 1) {
        ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
      }
      ctx.stroke();
    };

    strokes.forEach(drawStroke);
    if (draftStroke) drawStroke(draftStroke);
  }, [boardSize, draftStroke, layout, strokes]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const finishStroke = () => {
    if (!draftStroke || draftStroke.points.length === 0) {
      setDraftStroke(null);
      activePointerIdRef.current = null;
      return;
    }
    onChange([...strokes, draftStroke]);
    setDraftStroke(null);
    activePointerIdRef.current = null;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div>Finger, mouse, or stylus. Write the clearance first, organize later.</div>
        <div className="font-mono">{strokes.length} stroke{strokes.length === 1 ? "" : "s"} saved</div>
      </div>
      <div
        ref={wrapperRef}
        className="relative h-[60vh] min-h-[360px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-zinc-500">
          <span>Ink Pad</span>
          <span>Auto-saved</span>
        </div>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 mt-8 h-[calc(100%-2rem)] w-full touch-none"
          onPointerDown={(event) => {
            const point = pointFromEvent(event);
            activePointerIdRef.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraftStroke({ points: [point] });
          }}
          onPointerMove={(event) => {
            if (activePointerIdRef.current !== event.pointerId) return;
            const point = pointFromEvent(event);
            setDraftStroke((current) => {
              if (!current) return current;
              return { points: [...current.points, point] };
            });
          }}
          onPointerUp={(event) => {
            if (activePointerIdRef.current !== event.pointerId) return;
            finishStroke();
          }}
          onPointerCancel={(event) => {
            if (activePointerIdRef.current !== event.pointerId) return;
            finishStroke();
          }}
        />
      </div>
    </div>
  );
}

export default function FlightPlanner() {
  const { user, isAuthenticated } = useAuth();
  const { profile: studentProfile } = useStudentProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canPersist ?? (user?.logbookProStatus === "active");
  const tfmsTier: TfmsTier = entitlements?.tier === "pro_plus"
    ? "pro_plus"
    : entitlements?.tier === "pro"
      ? "pro_core"
      : "free";
  const isGuest = !isAuthenticated;
  const isFree = isAuthenticated && !isPro;
  const isStudent = Boolean(
    studentProfile?.wizardJson || studentProfile?.roadmapJson || studentProfile?.progressJson
  );
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<FlightPlannerTab>("route");
  const [showFilingPayload, setShowFilingPayload] = useState(false);
  const [filingPreview, setFilingPreview] = useState<FilingPreviewResponse | null>(null);
  const [pendingSectionJump, setPendingSectionJump] = useState<{ id: string; eventName: string } | null>(null);
  const [scratchPadOpen, setScratchPadOpen] = useState(false);
  const [scratchPadMode, setScratchPadMode] = useState<"ink" | "craft">("ink");
  const [scratchPad, setScratchPad] = useState<ScratchPadFields>(() => {
    if (typeof window === "undefined") return SCRATCH_PAD_DEFAULT;
    try {
      const raw = localStorage.getItem(SCRATCH_PAD_KEY);
      if (raw) return { ...SCRATCH_PAD_DEFAULT, ...JSON.parse(raw) };
    } catch {}
    return SCRATCH_PAD_DEFAULT;
  });
  const [scratchInk, setScratchInk] = useState<ScratchInkStroke[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(SCRATCH_PAD_INK_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [scratchInkLayout, setScratchInkLayout] = useState<ScratchPadInkLayout>(() => {
    if (typeof window === "undefined") return "ruled";
    try {
      const raw = localStorage.getItem(SCRATCH_PAD_INK_LAYOUT_KEY);
      return raw === "blank" || raw === "craft" || raw === "ruled" ? raw : "ruled";
    } catch {
      return "ruled";
    }
  });

  useEffect(() => {
    trackEvent("planner_page_view", { page: "flight-planner" });
  }, []);

  useEffect(() => {
    if (isPro) return;
    if (typeof window === "undefined") return;
    const key = "rsf_upgrade_prompt_flight_planner";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setShowUpgradePrompt(true);
  }, [isPro]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(FLIGHT_PLANNER_ACTIVE_TAB_KEY);
    if (stored && stored !== "file" && (FLIGHT_PLANNER_TABS as readonly string[]).includes(stored)) {
      setActiveTab(stored as FlightPlannerTab);
    } else {
      setActiveTab("route");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(FLIGHT_PLANNER_TABS as readonly string[]).includes(activeTab)) return;
    window.localStorage.setItem(FLIGHT_PLANNER_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!pendingSectionJump) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(pendingSectionJump.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        trackEvent(pendingSectionJump.eventName, { target: pendingSectionJump.id });
      }
      setPendingSectionJump(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeTab, pendingSectionJump]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SCRATCH_PAD_KEY, JSON.stringify(scratchPad));
    } catch {}
  }, [scratchPad]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SCRATCH_PAD_INK_KEY, JSON.stringify(scratchInk));
    } catch {}
  }, [scratchInk]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SCRATCH_PAD_INK_LAYOUT_KEY, scratchInkLayout);
    } catch {}
  }, [scratchInkLayout]);

  useEffect(() => {
    if (!scratchPadOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScratchPadOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [scratchPadOpen]);

  const [editingPlan, setEditingPlan] = useState<FlightPlan | null>(null);
  const [form, setForm] = useState({
    title: "",
    departure: "",
    destination: "",
    route: "",
    alternate: "",
    plannedDepartureAt: "",
    plannedArrivalAt: "",
    aircraftType: "",
    tailNumber: "",
    fuelOnBoard: "",
    notes: "",
  });
  const [waypointsInput, setWaypointsInput] = useState("");
  const [plannedStopsInput, setPlannedStopsInput] = useState("");
  const [plannedFuelUplifts, setPlannedFuelUplifts] = useState<Record<string, string>>({});
  const [departureRunway, setDepartureRunway] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("none");
  const [selectedTypeId, setSelectedTypeId] = useState<string>(FALLBACK_TYPE.id);
  const [fuelBurnMode, setFuelBurnMode] = useState<FuelBurnMode>("standard");
  const [reserveMinutes, setReserveMinutes] = useState("45");
  const [headwind, setHeadwind] = useState("0");
  const [plannedAltitude, setPlannedAltitude] = useState("");
  const [arrivalAuto, setArrivalAuto] = useState(true);
  const [routeSuggestion, setRouteSuggestion] = useState<"direct" | "midpoint">("direct");
  const [mapStyle, setMapStyle] = useState<"standard" | "sectional" | "radar" | "winds" | "clouds" | "globe">("sectional");
  const [mapRenderVersion, setMapRenderVersion] = useState(0);
  const [showAtcStrip, setShowAtcStrip] = useState(true);
  const [showApproachOffer, setShowApproachOffer] = useState(false);
  const [windsAltitudeChoice, setWindsAltitudeChoice] = useState("planned");
  const [tfmsOverlayEnabled, setTfmsOverlayEnabled] = useState(false);
  const [showAiNotamTranslator, setShowAiNotamTranslator] = useState(false);
  const [activeWeatherDetail, setActiveWeatherDetail] = useState<
    "metar" | "notams" | "pireps" | "hazards" | "winds" | "icing" | "turbulence" | null
  >(null);
  const setScratchField = (
    field: keyof ScratchPadFields,
    value: string
  ) => setScratchPad((prev) => ({ ...prev, [field]: value }));
  const scratchPadHasText = useMemo(
    () => Object.values(scratchPad).some((value) => value.trim()),
    [scratchPad]
  );
  const scratchPadHasInk = scratchInk.length > 0;
  const scratchPadHasContent = useMemo(
    () => scratchPadHasText || scratchPadHasInk,
    [scratchPadHasInk, scratchPadHasText]
  );
  const openScratchPad = () => {
    setScratchPad((prev) => ({
      ...prev,
      clearanceLimit: prev.clearanceLimit || form.destination || "",
      departure: prev.departure || form.departure || "",
      route: prev.route || routePreviewFull || "",
      altitude: prev.altitude ||
        (plannedAltitudeFt ? String(plannedAltitudeFt) : ""),
    }));
    setScratchPadMode("ink");
    setScratchPadOpen(true);
    trackEvent("scratch_pad_opened");
  };
  const [, setWakeLockError] = useState<string | null>(null);
  const [customProfile, setCustomProfile] = useState({
    name: "",
    cruiseKtasOverride: "",
    fuelBurnOverrideGph: "",
    usableFuelOverrideGal: "",
    maxGrossWeightOverrideLb: "",
  });
  const [filingDraft, setFilingDraft] = useState({
    flightRules: "VFR",
    aircraftId: "",
    equipment: "S/C",
    soulsOnBoard: "1",
    aircraftColor: "",
    pilotName: "",
    remarks: "",
    wakeTurbulence: "MEDIUM",
    typeOfFlight: "G",
    surveillanceEquipment: "N",
    otherInfo: "",
  });
  const [checklist, setChecklist] = useState(checklistDefaults);
  const [departureSuggestions, setDepartureSuggestions] = useState<AirportSearchResult[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AirportSearchResult[]>([]);
  const [departureResolved, setDepartureResolved] = useState("");
  const [destinationResolved, setDestinationResolved] = useState("");
  const departureLookupRef = useRef<{ value: string; ok: boolean } | null>(null);
  const destinationLookupRef = useRef<{ value: string; ok: boolean } | null>(null);
  const departureSelectedRef = useRef<string | null>(null);
  const destinationSelectedRef = useRef<string | null>(null);
  const lastApproachOfferKeyRef = useRef<string | null>(null);
  const plannedAltitudeFt = Number(plannedAltitude);
  const plannedAltitudeValue = Number.isFinite(plannedAltitudeFt) ? plannedAltitudeFt : undefined;
  const windsAltitudeFt = windsAltitudeChoice === "planned"
    ? plannedAltitudeValue
    : Number(windsAltitudeChoice);

  useEffect(() => {
    if (tfmsTier !== "pro_plus" && tfmsOverlayEnabled) {
      setTfmsOverlayEnabled(false);
    }
  }, [tfmsTier, tfmsOverlayEnabled]);

  useEffect(() => {
    const dep = departureResolved.trim().toUpperCase();
    const dest = destinationResolved.trim().toUpperCase();
    const hasCoreRoute = ICAO_REGEX.test(dep) && ICAO_REGEX.test(dest);
    if (hasCoreRoute && mapStyle === "standard") {
      setMapStyle("sectional");
    }
  }, [departureResolved, destinationResolved, mapStyle]);

  const openWeatherDetail = (
    id: "metar" | "notams" | "pireps" | "hazards" | "winds" | "icing" | "turbulence"
  ) => {
    setActiveWeatherDetail(id);
    const eventMap: Record<string, string> = {
      metar: "view_metar",
      notams: "view_notams",
      pireps: "view_pireps",
      hazards: "view_hazards",
      winds: "view_winds",
      icing: "view_icing",
      turbulence: "view_turb",
    };
    trackEvent(eventMap[id] || "view_weather_detail", { source: "flight_planner" });
  };
  const openApproachPlatesForIcao = (icao: string) => {
    if (typeof window === "undefined") return;
    const normalized = icao.trim().toUpperCase();
    if (!ICAO_REGEX.test(normalized)) return;
    window.open(`/approach-plates?icao=${encodeURIComponent(normalized)}`, "_blank", "noopener,noreferrer");
    trackEvent("planner_open_approach_plate", { icao: normalized });
  };

  useEffect(() => {
    const stored = localStorage.getItem("flightPlannerChecklist");
    if (stored) {
      try {
        setChecklist({ ...checklistDefaults, ...JSON.parse(stored) });
      } catch {
        setChecklist(checklistDefaults);
      }
    }
  }, []);

  useEffect(() => {
    setFilingDraft((current) => ({
      ...current,
      aircraftId: current.aircraftId || form.tailNumber || "",
      aircraftColor: current.aircraftColor || "White / Blue",
      pilotName:
        current.pilotName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "",
      remarks: current.remarks || "RSF filing handoff preview",
    }));
  }, [form.tailNumber, user?.firstName, user?.lastName, user?.email]);

  useEffect(() => {
    localStorage.setItem("flightPlannerChecklist", JSON.stringify(checklist));
  }, [checklist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(FLIGHT_PLANNER_DRAFT_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.form) setForm((current) => ({ ...current, ...parsed.form }));
      if (typeof parsed?.waypointsInput === "string") setWaypointsInput(parsed.waypointsInput);
      if (typeof parsed?.plannedStopsInput === "string") setPlannedStopsInput(parsed.plannedStopsInput);
      if (parsed?.plannedFuelUplifts && typeof parsed.plannedFuelUplifts === "object") {
        setPlannedFuelUplifts(parsed.plannedFuelUplifts as Record<string, string>);
      }
      if (typeof parsed?.departureRunway === "string") setDepartureRunway(parsed.departureRunway);
      if (typeof parsed?.selectedProfileId === "string") setSelectedProfileId(parsed.selectedProfileId);
      if (typeof parsed?.selectedTypeId === "string") setSelectedTypeId(parsed.selectedTypeId);
      if (parsed?.fuelBurnMode === "standard" || parsed?.fuelBurnMode === "economy" || parsed?.fuelBurnMode === "performance") {
        setFuelBurnMode(parsed.fuelBurnMode);
      }
      if (typeof parsed?.reserveMinutes === "string") setReserveMinutes(parsed.reserveMinutes);
      if (typeof parsed?.headwind === "string") setHeadwind(parsed.headwind);
      if (typeof parsed?.plannedAltitude === "string") setPlannedAltitude(parsed.plannedAltitude);
      if (typeof parsed?.arrivalAuto === "boolean") setArrivalAuto(parsed.arrivalAuto);
      if (parsed?.routeSuggestion === "direct" || parsed?.routeSuggestion === "midpoint") {
        setRouteSuggestion(parsed.routeSuggestion);
      }
      if (parsed?.filingDraft) setFilingDraft((current) => ({ ...current, ...parsed.filingDraft }));
      if (parsed?.customProfile) setCustomProfile((current) => ({ ...current, ...parsed.customProfile }));
    } catch {
      window.localStorage.removeItem(FLIGHT_PLANNER_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FLIGHT_PLANNER_DRAFT_KEY,
      JSON.stringify({
        form,
        waypointsInput,
        plannedStopsInput,
        plannedFuelUplifts,
        departureRunway,
        selectedProfileId,
        selectedTypeId,
        fuelBurnMode,
        reserveMinutes,
        headwind,
        plannedAltitude,
        arrivalAuto,
        routeSuggestion,
        filingDraft,
        customProfile,
      }),
    );
  }, [
    arrivalAuto,
    customProfile,
    departureRunway,
    filingDraft,
    fuelBurnMode,
    form,
    headwind,
    plannedAltitude,
    plannedFuelUplifts,
    plannedStopsInput,
    reserveMinutes,
    routeSuggestion,
    selectedProfileId,
    selectedTypeId,
    waypointsInput,
  ]);

  useEffect(() => {
    let wakeLock: any = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        setWakeLockError(null);
        if (typeof navigator === "undefined" || !(navigator as any).wakeLock?.request) {
          setWakeLockError("Wake lock not supported in this browser.");
          return;
        }
        wakeLock = await (navigator as any).wakeLock.request("screen");
      } catch (err: any) {
        if (!cancelled) {
          setWakeLockError(err?.message || "Unable to keep screen awake.");
        }
      }
    };

    requestWakeLock();

    return () => {
      cancelled = true;
      if (wakeLock) {
        wakeLock.release().catch(() => null);
      }
    };
  }, []);

  useEffect(() => {
    const value = form.departure.trim();
    if (!value || value.length < 2) {
      setDepartureSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(value)}`));
        if (!res.ok) {
          setDepartureSuggestions([]);
          return;
        }
        const data = await res.json();
        setDepartureSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setDepartureSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.departure]);

  useEffect(() => {
    const value = form.departure.trim().toUpperCase();
    if (!value) {
      departureSelectedRef.current = null;
      setDepartureResolved("");
      return;
    }
    if (departureSelectedRef.current && departureSelectedRef.current !== value) {
      departureSelectedRef.current = null;
    }
    const exact = departureSuggestions.find((airport) => airport.icao?.toUpperCase() === value);
    if (exact) {
      setDepartureResolved(exact.icao.toUpperCase());
      return;
    }
    if (departureSelectedRef.current && departureSelectedRef.current === value) {
      setDepartureResolved(value);
      return;
    }
    if (value.length === 3 && ICAO_REGEX.test(value)) {
      setDepartureResolved(value);
      return;
    }
    if (value.length === 4 && ICAO_REGEX.test(value)) {
      setDepartureResolved("");
      return;
    }
    setDepartureResolved("");
  }, [form.departure, departureSuggestions]);

  useEffect(() => {
    const value = form.departure.trim().toUpperCase();
    if (value.length !== 4 || !ICAO_REGEX.test(value)) return;
    const cached = departureLookupRef.current;
    if (cached?.value === value) {
      if (cached.ok) setDepartureResolved(value);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const runLookup = async () => {
      try {
        const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(value)}`), {
          signal: controller.signal,
        });
        if (!active) return;
        const data = res.ok ? await res.json().catch(() => []) : [];
        const ok = Array.isArray(data) && data.some((airport) => airport?.icao?.toUpperCase() === value);
        departureLookupRef.current = { value, ok };
        if (ok) {
          setDepartureResolved(value);
        }
      } catch (error: any) {
        if (!active || error?.name === "AbortError") return;
        departureLookupRef.current = { value, ok: false };
      }
    };
    runLookup();
    return () => {
      active = false;
      controller.abort();
    };
  }, [form.departure]);

  useEffect(() => {
    const value = form.destination.trim();
    if (!value || value.length < 2) {
      setDestinationSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(value)}`));
        if (!res.ok) {
          setDestinationSuggestions([]);
          return;
        }
        const data = await res.json();
        setDestinationSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setDestinationSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.destination]);

  useEffect(() => {
    const value = form.destination.trim().toUpperCase();
    if (!value) {
      destinationSelectedRef.current = null;
      setDestinationResolved("");
      return;
    }
    if (destinationSelectedRef.current && destinationSelectedRef.current !== value) {
      destinationSelectedRef.current = null;
    }
    const exact = destinationSuggestions.find((airport) => airport.icao?.toUpperCase() === value);
    if (exact) {
      setDestinationResolved(exact.icao.toUpperCase());
      return;
    }
    if (destinationSelectedRef.current && destinationSelectedRef.current === value) {
      setDestinationResolved(value);
      return;
    }
    if (value.length === 3 && ICAO_REGEX.test(value)) {
      setDestinationResolved(value);
      return;
    }
    if (value.length === 4 && ICAO_REGEX.test(value)) {
      setDestinationResolved("");
      return;
    }
    setDestinationResolved("");
  }, [form.destination, destinationSuggestions]);

  useEffect(() => {
    const value = form.destination.trim().toUpperCase();
    if (value.length !== 4 || !ICAO_REGEX.test(value)) return;
    const cached = destinationLookupRef.current;
    if (cached?.value === value) {
      if (cached.ok) setDestinationResolved(value);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const runLookup = async () => {
      try {
        const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(value)}`), {
          signal: controller.signal,
        });
        if (!active) return;
        const data = res.ok ? await res.json().catch(() => []) : [];
        const ok = Array.isArray(data) && data.some((airport) => airport?.icao?.toUpperCase() === value);
        destinationLookupRef.current = { value, ok };
        if (ok) {
          setDestinationResolved(value);
        }
      } catch (error: any) {
        if (!active || error?.name === "AbortError") return;
        destinationLookupRef.current = { value, ok: false };
      }
    };
    runLookup();
    return () => {
      active = false;
      controller.abort();
    };
  }, [form.destination]);

  const { data: savedPlans = [], isLoading: plansLoading } = useQuery<FlightPlan[]>({
    queryKey: ["/api/flight-plans"],
    enabled: isAuthenticated,
  });

  const { data: savedProfiles = [] } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
    enabled: isAuthenticated && isPro,
  });

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types?limit=500"],
  });

  useEffect(() => {
    if (!selectedTypeId && aircraftTypes.length) {
      setSelectedTypeId(aircraftTypes[0].id);
    }
  }, [aircraftTypes, selectedTypeId]);

  const selectedProfile = selectedProfileId === "none"
    ? null
    : savedProfiles.find((p) => p.id === selectedProfileId) || null;
  const selectedType = aircraftTypes.find((t) => t.id === selectedTypeId) || FALLBACK_TYPE;
  const selectedTypeNeedsVerification =
    selectedTypeId !== CUSTOM_TYPE_ID &&
    selectedType.id !== FALLBACK_TYPE.id &&
    selectedType.isVerified === false;
  const selectedProfileHasFilingDefaults = Boolean(
    selectedProfile?.tailNumber ||
    selectedProfile?.filingEquipmentDefault ||
    selectedProfile?.filingSoulsOnBoardDefault ||
    selectedProfile?.filingAircraftColorDefault ||
    selectedProfile?.filingPilotNameDefault ||
    selectedProfile?.filingRemarksDefault ||
    selectedProfile?.filingWakeTurbulenceDefault ||
    selectedProfile?.filingTypeOfFlightDefault ||
    selectedProfile?.filingSurveillanceEquipmentDefault ||
    selectedProfile?.filingOtherInfoDefault
  );
  const planLimitReached = isFree && !editingPlan && savedPlans.length >= 1;
  const savePlanActionRef = useRef<() => Promise<void>>(async () => {});
  const saveProfileActionRef = useRef<() => Promise<void>>(async () => {});
  const sendToLogbookActionRef = useRef<() => Promise<void>>(async () => {});

  const applyAircraftFilingDefaults = () => {
    if (!selectedProfile) return;
    setFilingDraft((current) => ({
      ...current,
      aircraftId: selectedProfile.tailNumber?.trim() || current.aircraftId,
      equipment: selectedProfile.filingEquipmentDefault?.trim() || current.equipment,
      soulsOnBoard: selectedProfile.filingSoulsOnBoardDefault?.trim() || current.soulsOnBoard,
      aircraftColor: selectedProfile.filingAircraftColorDefault?.trim() || current.aircraftColor,
      pilotName: selectedProfile.filingPilotNameDefault?.trim() || current.pilotName,
      remarks: selectedProfile.filingRemarksDefault?.trim() || current.remarks,
      wakeTurbulence: selectedProfile.filingWakeTurbulenceDefault?.trim() || current.wakeTurbulence,
      typeOfFlight: selectedProfile.filingTypeOfFlightDefault?.trim() || current.typeOfFlight,
      surveillanceEquipment: selectedProfile.filingSurveillanceEquipmentDefault?.trim() || current.surveillanceEquipment,
      otherInfo: selectedProfile.filingOtherInfoDefault?.trim() || current.otherInfo,
    }));
  };

  const manualCruise = customProfile.cruiseKtasOverride ? Number(customProfile.cruiseKtasOverride) : null;
  const manualBurn = customProfile.fuelBurnOverrideGph ? Number(customProfile.fuelBurnOverrideGph) : null;
  const manualFuel = customProfile.usableFuelOverrideGal ? Number(customProfile.usableFuelOverrideGal) : null;
  const manualMaxWeight = customProfile.maxGrossWeightOverrideLb ? Number(customProfile.maxGrossWeightOverrideLb) : null;

  const useManual = selectedTypeId === CUSTOM_TYPE_ID;
  const planningCruise =
    (useManual ? manualCruise : null) ??
    selectedProfile?.cruise_ktas_effective ??
    selectedType.cruise_ktas_effective ??
    FALLBACK_TYPE.cruise_ktas_effective ??
    110;
  const planningBurn =
    (useManual ? manualBurn : null) ??
    selectedProfile?.fuel_burn_gph_effective ??
    (fuelBurnMode === "economy"
      ? selectedType.fuel_burn_economy_gph_effective
      : fuelBurnMode === "performance"
        ? selectedType.fuel_burn_performance_gph_effective
        : null) ??
    selectedType.fuel_burn_gph_effective ??
    FALLBACK_TYPE.fuel_burn_gph_effective ??
    8;
  const selectedTypeSupportsBurnProfiles = Boolean(
    selectedType.fuel_burn_economy_gph_effective ||
    selectedType.fuel_burn_performance_gph_effective
  );
  const planningFuel =
    (useManual ? manualFuel : null) ??
    selectedProfile?.usable_fuel_gal_effective ??
    selectedType.usable_fuel_gal_effective ??
    FALLBACK_TYPE.usable_fuel_gal_effective ??
    40;
  const planningMaxWeight =
    (useManual ? manualMaxWeight : null) ??
    selectedProfile?.max_gross_weight_lb_effective ??
    selectedType.max_gross_weight_lb_effective ??
    FALLBACK_TYPE.max_gross_weight_lb_effective ??
    2400;
  const referenceFuelCapacityGallons =
    selectedProfile?.usable_fuel_gal_effective ??
    selectedType.usable_fuel_gal_effective ??
    FALLBACK_TYPE.usable_fuel_gal_effective ??
    null;

  const routeSuggestionQuery = useQuery<RouteSuggestionResponse>({
    queryKey: [
      "/api/airports/route-suggestions",
      departureResolved,
      destinationResolved,
      planningCruise,
      planningBurn,
      planningFuel,
      reserveMinutes,
      form.fuelOnBoard,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        departure: departureResolved,
        destination: destinationResolved,
        cruiseKtas: String(planningCruise),
        fuelBurnGph: String(planningBurn),
        usableFuelGal: String(planningFuel),
        reserveMinutes: String(reserveMinutes),
      });
      const fuelOnBoard = Number(form.fuelOnBoard);
      if (Number.isFinite(fuelOnBoard) && fuelOnBoard > 0) {
        params.set("fuelOnBoard", String(fuelOnBoard));
      }
      const res = await fetch(apiUrl(`/api/airports/route-suggestions?${params.toString()}`));
      if (!res.ok) {
        if (res.status === 400 || res.status === 404) {
          return { waypoints: [], plannedStops: [], meta: null };
        }
        throw new Error("Failed to load route suggestions");
      }
      return res.json();
    },
    enabled:
      Boolean(departureResolved && destinationResolved) &&
      ICAO_REGEX.test(departureResolved.trim().toUpperCase()) &&
      ICAO_REGEX.test(destinationResolved.trim().toUpperCase()),
    staleTime: 1000 * 60 * 10,
  });

  const leidosRouteQuery = useQuery<LeidosRouteSearchResponse>({
    queryKey: [
      "/api/flight-plans/route-search",
      departureResolved,
      destinationResolved,
      plannedAltitude,
      filingDraft.flightRules,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        departure: departureResolved.trim().toUpperCase(),
        destination: destinationResolved.trim().toUpperCase(),
      });
      if (plannedAltitude) {
        params.set("altitudeFt", plannedAltitude);
      }
      const res = await fetch(apiUrl(`/api/flight-plans/route-search?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to load Leidos route suggestions");
      }
      return res.json();
    },
    enabled:
      filingDraft.flightRules === "IFR" &&
      Boolean(departureResolved && destinationResolved) &&
      ICAO_REGEX.test(departureResolved.trim().toUpperCase()) &&
      ICAO_REGEX.test(destinationResolved.trim().toUpperCase()),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const suggestedWaypoints = routeSuggestionQuery.data?.waypoints ?? [];
  const suggestedStops = routeSuggestionQuery.data?.plannedStops ?? [];
  const suggestionMeta = routeSuggestionQuery.data?.meta;

  const waypoints = useMemo(() => parseWaypoints(waypointsInput), [waypointsInput]);
  const plannedStops = useMemo(() => parseWaypoints(plannedStopsInput), [plannedStopsInput]);
  const filedRouteInputNormalized = useMemo(() => normalizeRouteText(form.route), [form.route]);
  const filedRouteTokens = useMemo(() => parseFiledRouteTokens(filedRouteInputNormalized), [filedRouteInputNormalized]);
  const filedRouteAirportTokens = useMemo(() => extractAirportTokensFromFiledRoute(filedRouteTokens), [filedRouteTokens]);
  const filedRouteTokenCounts = useMemo(() => {
    return filedRouteTokens.reduce<Record<FiledRouteTokenKind, number>>((acc, token) => {
      acc[token.kind] = (acc[token.kind] || 0) + 1;
      return acc;
    }, {
      airport: 0,
      fix: 0,
      navaid: 0,
      airway: 0,
      procedure: 0,
      direct: 0,
      coordinate: 0,
      unknown: 0,
    });
  }, [filedRouteTokens]);
  const isUsingSuggestedWaypoints = useMemo(() => {
    if (suggestedWaypoints.length === 0) return false;
    const normalized = waypointsInput.trim().toUpperCase();
    return normalized === suggestedWaypoints.join(" ");
  }, [suggestedWaypoints, waypointsInput]);
  const isUsingSuggestedStops = useMemo(() => {
    if (suggestedStops.length === 0) return false;
    const normalized = plannedStopsInput.trim().toUpperCase();
    return normalized === suggestedStops.join(" ");
  }, [suggestedStops, plannedStopsInput]);
  const shouldOrderSuggestions = isUsingSuggestedWaypoints || isUsingSuggestedStops;

  const routeSequenceRaw = useMemo(() => {
    const intermediateAirports = plannedStops.length > 0 || waypoints.length > 0
      ? [...plannedStops, ...waypoints]
      : filedRouteAirportTokens;
    return [
      departureResolved.trim().toUpperCase(),
      ...intermediateAirports,
      destinationResolved.trim().toUpperCase(),
    ]
      .filter(Boolean)
      .filter((icao) => ICAO_REGEX.test(icao));
  }, [departureResolved, destinationResolved, plannedStops, waypoints, filedRouteAirportTokens]);

  const routeIcaos = useMemo(() => {
    return Array.from(new Set(routeSequenceRaw));
  }, [routeSequenceRaw]);

  const airportQueries = useQueries({
    queries: routeIcaos.map((icao) => ({
      queryKey: ["/api/airports", icao],
      queryFn: async () => {
        const searchRes = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(icao)}`), {
          credentials: "include",
        });
        if (!searchRes.ok) throw new Error("Failed to search airport data");
        const matches = (await searchRes.json()) as any[];
        const candidates = new Set(buildPlannerIcaoCandidates(icao));
        const exactMatch = matches.find((match) => {
          const matchIcao = String(match?.icao || "").trim().toUpperCase();
          return candidates.has(matchIcao);
        });
        if (!exactMatch) return null;

        const detailIcao = String(exactMatch.icao || icao).trim().toUpperCase();
        const detailRes = await fetch(apiUrl(`/api/airports/${detailIcao}`), { credentials: "include" });
        if (!detailRes.ok) {
          return {
            icao: detailIcao,
            name: exactMatch.name ?? null,
            lat: Number(exactMatch.lat),
            lon: Number(exactMatch.lon),
            elevationFt: exactMatch.elevationFt ?? null,
            timezone: exactMatch.timezone ?? null,
            source: "search",
          };
        }
        return detailRes.json();
      },
      enabled: routeIcaos.length > 0,
      staleTime: 1000 * 60 * 60,
    })),
  });

  const airportFrequencyQueries = useQueries({
    queries: routeIcaos.map((icao) => ({
      queryKey: ["/api/airports", icao, "frequencies"],
      queryFn: async () => {
        const searchRes = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(icao)}`), {
          credentials: "include",
        });
        if (!searchRes.ok) throw new Error("Failed to search airport frequencies");
        const matches = (await searchRes.json()) as any[];
        const candidates = new Set(buildPlannerIcaoCandidates(icao));
        const exactMatch = matches.find((match) => {
          const matchIcao = String(match?.icao || "").trim().toUpperCase();
          return candidates.has(matchIcao);
        });
        if (!exactMatch) {
          return { icao, frequencies: [] } as AirportFrequencyResponse;
        }
        const detailIcao = String(exactMatch.icao || icao).trim().toUpperCase();
        const res = await fetch(apiUrl(`/api/airports/${detailIcao}/frequencies`), { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch airport frequencies");
        return res.json() as Promise<AirportFrequencyResponse>;
      },
      enabled: routeIcaos.length > 0,
      staleTime: 1000 * 60 * 60,
    })),
  });

  const airportMap = useMemo(() => {
    const map = new Map<string, any>();
    airportQueries.forEach((query, index) => {
      const icao = routeIcaos[index];
      if (query.data && icao) {
        map.set(icao, query.data);
      }
    });
    return map;
  }, [airportQueries, routeIcaos]);

  const airportFrequencyMap = useMemo(() => {
    const map = new Map<string, AirportFrequency[]>();
    airportFrequencyQueries.forEach((query, index) => {
      const icao = routeIcaos[index];
      if (icao && query.data?.frequencies) {
        map.set(icao, query.data.frequencies);
      }
    });
    return map;
  }, [airportFrequencyQueries, routeIcaos]);

  const orderedIntermediates = useMemo(() => {
    const combined = (plannedStops.length > 0 || waypoints.length > 0
      ? [...plannedStops, ...waypoints]
      : filedRouteAirportTokens).filter((icao) => ICAO_REGEX.test(icao));
    if (!shouldOrderSuggestions) return combined;
    const departureKey = departureResolved.trim().toUpperCase();
    const departurePoint = airportMap.get(departureKey);
    if (!departurePoint || !Number.isFinite(departurePoint.lat) || !Number.isFinite(departurePoint.lon)) {
      return combined;
    }
    const destinationKey = destinationResolved.trim().toUpperCase();
    const destinationPoint = airportMap.get(destinationKey);
    if (!destinationPoint || !Number.isFinite(destinationPoint.lat) || !Number.isFinite(destinationPoint.lon)) {
      return combined;
    }
    const basePoint: AirportPoint = {
      icao: departureKey,
      lat: Number(departurePoint.lat),
      lon: Number(departurePoint.lon),
    };
    const targetPoint: AirportPoint = {
      icao: destinationKey,
      lat: Number(destinationPoint.lat),
      lon: Number(destinationPoint.lon),
    };
    const routeBearing = bearingDeg(basePoint, targetPoint);
    return combined
      .map((icao, index) => {
        const data = airportMap.get(icao);
        if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) {
          return { icao, index, order: Number.POSITIVE_INFINITY, distance: Number.POSITIVE_INFINITY };
        }
        const candidatePoint: AirportPoint = {
          icao,
          lat: Number(data.lat),
          lon: Number(data.lon),
        };
        const dist = distanceNm(basePoint, candidatePoint);
        const bearingToCandidate = bearingDeg(basePoint, candidatePoint);
        const angleDiff = smallestAngleDiff(bearingToCandidate, routeBearing);
        const alongTrack = dist * Math.cos(toRadians(angleDiff));
        const order = alongTrack >= 0 ? alongTrack : Number.POSITIVE_INFINITY;
        return { icao, index, order, distance: dist };
      })
      .sort((a, b) => {
        if (a.order === b.order) {
          return a.distance === b.distance ? a.index - b.index : a.distance - b.distance;
        }
        return a.order - b.order;
      })
      .map((item) => item.icao);
  }, [plannedStops, waypoints, filedRouteAirportTokens, shouldOrderSuggestions, airportMap, departureResolved, destinationResolved]);

  const orderedPlannedStops = useMemo(
    () => orderedIntermediates.filter((icao) => plannedStops.includes(icao)),
    [orderedIntermediates, plannedStops],
  );

  useEffect(() => {
    setPlannedFuelUplifts((current) => {
      const allowed = new Set(orderedPlannedStops);
      const next = Object.fromEntries(
        Object.entries(current).filter(([icao, value]) => allowed.has(icao) && value !== ""),
      );
      const currentKeys = Object.keys(current).sort().join("|");
      const nextKeys = Object.keys(next).sort().join("|");
      return currentKeys === nextKeys ? current : next;
    });
  }, [orderedPlannedStops]);

  const routeSequenceOrdered = useMemo(() => {
    return [
      departureResolved.trim().toUpperCase(),
      ...orderedIntermediates,
      destinationResolved.trim().toUpperCase(),
    ]
      .filter(Boolean)
      .filter((icao) => ICAO_REGEX.test(icao));
  }, [departureResolved, destinationResolved, orderedIntermediates]);

  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const departureTimeZone = useMemo(() => {
    const tz = airportMap.get(departureResolved)?.timezone;
    return normalizeTimeZone(tz || browserTimeZone);
  }, [airportMap, departureResolved, browserTimeZone]);

  const destinationTimeZone = useMemo(() => {
    const tz = airportMap.get(destinationResolved)?.timezone;
    return normalizeTimeZone(tz || browserTimeZone);
  }, [airportMap, destinationResolved, browserTimeZone]);

  const plannedDepartureUtc = useMemo(() => {
    if (!form.plannedDepartureAt) return null;
    return zonedDateTimeToUtc(form.plannedDepartureAt, departureTimeZone);
  }, [form.plannedDepartureAt, departureTimeZone]);

  const hoursToDeparture = useMemo(() => {
    if (!plannedDepartureUtc) return null;
    return (plannedDepartureUtc.getTime() - Date.now()) / 3600000;
  }, [plannedDepartureUtc]);

  const forecastNotice = useMemo(() => {
    if (!hoursToDeparture || hoursToDeparture <= 24) return null;
    const days = hoursToDeparture / 24;
    if (days > 10) {
      return `Planned departure is ${days.toFixed(1)} days out. Long-range forecasts are limited; recheck weather 24 hours and day-of.`;
    }
    if (days > 3) {
      return `Planned departure is about ${Math.round(days)} days out. TAFs cover ~24–30 hours; recheck the night before and day-of.`;
    }
    return `Planned departure is about ${Math.round(hoursToDeparture)} hours out. Recheck weather within 24 hours of departure.`;
  }, [hoursToDeparture]);

  const airportErrors = useMemo(() => {
    return airportQueries
      .map((query, index) => ({ icao: routeIcaos[index], error: query.error }))
      .filter((item) => item.icao && item.error);
  }, [airportQueries, routeIcaos]);

  const missingIcaos = useMemo(() => {
    return routeIcaos.filter((icao, index) => {
      const query = airportQueries[index];
      return Boolean(icao && (query?.isPending || query?.isFetching));
    });
  }, [routeIcaos, airportQueries]);

  const unresolvedIcaos = useMemo(() => {
    return routeIcaos.filter((icao, index) => {
      const query = airportQueries[index];
      return Boolean(icao && !query?.isPending && !query?.isFetching && !query?.error && !airportMap.has(icao));
    });
  }, [routeIcaos, airportQueries, airportMap]);

  const routeAirportFrequencyCards = useMemo(() => {
    return routeSequenceOrdered
      .filter((icao, index, arr) => arr.indexOf(icao) === index)
      .map((icao) => {
        const airport = airportMap.get(icao);
        const frequencies = (airportFrequencyMap.get(icao) || [])
          .slice()
          .sort((a, b) => {
            const byPriority = frequencyTypePriority(a.type) - frequencyTypePriority(b.type);
            if (byPriority !== 0) return byPriority;
            return formatFrequencyTypeLabel(a.type).localeCompare(formatFrequencyTypeLabel(b.type));
          });
        return {
          icao,
          airport,
          frequencies,
        };
      });
  }, [routeSequenceOrdered, airportMap, airportFrequencyMap]);

  const getAirportHoverLabel = useCallback((icao: string) => {
    const airport = airportMap.get(icao);
    if (!airport?.name) return icao;
    return `${icao} — ${airport.name}`;
  }, [airportMap]);

  const renderAirportIcaoTooltip = useCallback((icao: string, child: ReactElement) => {
    const label = getAirportHoverLabel(icao);
    if (label === icao) return child;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }, [getAirportHoverLabel]);

  const airportPoints: PlannerPoint[] = useMemo(() => {
    return routeSequenceOrdered
      .map((icao) => {
        const data = airportMap.get(icao);
        if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) return null;
        return { icao, lat: Number(data.lat), lon: Number(data.lon), label: data.name || null };
      })
      .filter(Boolean) as PlannerPoint[];
  }, [airportMap, routeSequenceOrdered]);

  const suggestedWaypoint = useMemo(() => {
    if (routeSuggestion !== "midpoint") return null;
    if (waypoints.length > 0 || plannedStops.length > 0) return null;
    if (airportPoints.length < 2) return null;
    const start = airportPoints[0];
    const end = airportPoints[airportPoints.length - 1];
    const lat1 = (start.lat * Math.PI) / 180;
    const lon1 = (start.lon * Math.PI) / 180;
    const lat2 = (end.lat * Math.PI) / 180;
    const lon2 = (end.lon * Math.PI) / 180;
    const dLon = lon2 - lon1;
    const bx = Math.cos(lat2) * Math.cos(dLon);
    const by = Math.cos(lat2) * Math.sin(dLon);
    const lat3 = Math.atan2(
      Math.sin(lat1) + Math.sin(lat2),
      Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
    );
    const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
    const midpoint = {
      icao: "MID",
      lat: (lat3 * 180) / Math.PI,
      lon: (lon3 * 180) / Math.PI,
    };
    return midpoint;
  }, [airportPoints, routeSuggestion, waypoints.length]);

  const routePoints: PlannerPoint[] = useMemo(() => {
    if (!suggestedWaypoint) return airportPoints;
    const [start, ...rest] = airportPoints;
    if (!start || rest.length === 0) return airportPoints;
    return [start, suggestedWaypoint, rest[rest.length - 1]];
  }, [airportPoints, suggestedWaypoint]);

  const routeBbox = useMemo(() => {
    if (routePoints.length === 0) return null;
    const lats = routePoints.map((point) => point.lat);
    const lons = routePoints.map((point) => point.lon);
    const pad = 1.5;
    const south = Math.min(...lats) - pad;
    const north = Math.max(...lats) + pad;
    const west = Math.min(...lons) - pad;
    const east = Math.max(...lons) + pad;
    return { south, west, north, east };
  }, [routePoints]);

  const routeBboxParam = routeBbox
    ? `${routeBbox.south},${routeBbox.west},${routeBbox.north},${routeBbox.east}`
    : null;
  const tfrBboxParam = routeBbox
    ? `${routeBbox.west},${routeBbox.south},${routeBbox.east},${routeBbox.north}`
    : null;

  const legs = useMemo(() => buildLegs(routePoints), [routePoints]);
  const totalDistance = useMemo(() => sumDistance(legs), [legs]);

  const windValue = Number(headwind || 0);
  const groundspeed = Math.max(40, planningCruise - (isPro ? windValue : 0));
  const eteHours = totalDistance ? totalDistance / groundspeed : 0;
  const reserveFuel = (Number(reserveMinutes) / 60) * planningBurn;
  const tripFuel = eteHours * planningBurn;
  const totalFuel = tripFuel + reserveFuel;
  const eteMinutes = eteHours ? Math.round(eteHours * 60) : 0;
  const canAutoArrival = Boolean(form.plannedDepartureAt && eteMinutes);
  const generatedRouteCore = useMemo(
    () =>
      [plannedStopsInput, waypointsInput]
        .map((value) => normalizeRouteText(value))
        .filter(Boolean)
        .join(" "),
    [plannedStopsInput, waypointsInput]
  );
  const activeFiledRoute = useMemo(
    () => filedRouteInputNormalized || generatedRouteCore,
    [filedRouteInputNormalized, generatedRouteCore]
  );
  const routePreviewFull = useMemo(
    () => buildRoutePreview(form.departure, activeFiledRoute, form.destination),
    [form.departure, activeFiledRoute, form.destination]
  );
  const fuelAvailableGallons = useMemo(() => {
    const onboard = Number(form.fuelOnBoard);
    if (Number.isFinite(onboard) && onboard > 0) return onboard;
    return planningFuel;
  }, [form.fuelOnBoard, planningFuel]);
  const fuelOnBoardCapacityWarning = useMemo(() => {
    const onboard = Number(form.fuelOnBoard);
    if (!Number.isFinite(onboard) || onboard <= 0) return null;
    if (!Number.isFinite(planningFuel) || planningFuel <= 0) return null;
    if (onboard <= planningFuel) return null;
    return `Fuel on board exceeds usable fuel capacity by ${(onboard - planningFuel).toFixed(1)} gal. Reduce the value to ${planningFuel.toFixed(1)} gal or less.`;
  }, [form.fuelOnBoard, planningFuel]);
  const usableFuelCapacityWarning = useMemo(() => {
    const overrideFuel = Number(customProfile.usableFuelOverrideGal);
    if (!Number.isFinite(overrideFuel) || overrideFuel <= 0) return null;
    if (useManual) return null;
    if (!Number.isFinite(referenceFuelCapacityGallons) || !referenceFuelCapacityGallons || referenceFuelCapacityGallons <= 0) return null;
    if (overrideFuel <= referenceFuelCapacityGallons) return null;
    return `Entered usable fuel exceeds the current aircraft reference value by ${(overrideFuel - referenceFuelCapacityGallons).toFixed(1)} gal. Verify the RSF library/profile value before planning with it.`;
  }, [customProfile.usableFuelOverrideGal, useManual, referenceFuelCapacityGallons]);
  const plannedFuelUpliftGallonsByStop = useMemo(() => {
    const entries = orderedPlannedStops.map((icao) => {
      const raw = Number(plannedFuelUplifts[icao]);
      const gallons = Number.isFinite(raw) && raw > 0 ? raw : 0;
      return [icao, gallons] as const;
    });
    return new Map(entries);
  }, [orderedPlannedStops, plannedFuelUplifts]);
  const totalPlannedFuelUplift = useMemo(
    () => Array.from(plannedFuelUpliftGallonsByStop.values()).reduce((sum, gallons) => sum + gallons, 0),
    [plannedFuelUpliftGallonsByStop],
  );
  const enduranceMinutes = useMemo(() => {
    if (!planningBurn || planningBurn <= 0) return 0;
    return (fuelAvailableGallons / planningBurn) * 60;
  }, [fuelAvailableGallons, planningBurn]);
  const legNavRows = useMemo(() => {
    let cumulativeNm = 0;
    let cumulativeMinutes = 0;
    let fuelRemainingGallons = fuelAvailableGallons;
    return legs.map((leg) => {
      cumulativeNm += leg.distanceNm;
      const course = Math.round(bearingDeg(leg.from, leg.to));
      const legMinutes = groundspeed > 0 ? (leg.distanceNm / groundspeed) * 60 : 0;
      const legFuel = planningBurn > 0 ? (leg.distanceNm / groundspeed) * planningBurn : 0;
      cumulativeMinutes += legMinutes;
      const legEtaUtc = plannedDepartureUtc
        ? new Date(plannedDepartureUtc.getTime() + cumulativeMinutes * 60000)
        : null;
      const fuelBeforeLeg = fuelRemainingGallons;
      const fuelAfterLeg = fuelBeforeLeg - legFuel;
      const requestedFuelUplift = plannedFuelUpliftGallonsByStop.get(leg.to.icao) ?? 0;
      const availableTankSpace = Math.max(0, planningFuel - Math.max(fuelAfterLeg, 0));
      const actualFuelUplift = Math.min(requestedFuelUplift, availableTankSpace);
      const fuelAfterUplift = fuelAfterLeg + actualFuelUplift;
      fuelRemainingGallons = fuelAfterUplift;
      return {
        key: `${leg.from.icao}-${leg.to.icao}`,
        from: leg.from.icao,
        to: leg.to.icao,
        course,
        distanceNm: leg.distanceNm,
        legMinutes,
        legEtaUtc,
        legFuel,
        fuelBeforeLeg,
        fuelAfterLeg,
        requestedFuelUplift,
        actualFuelUplift,
        fuelAfterUplift,
        cumulativeNm,
      };
    });
  }, [legs, fuelAvailableGallons, groundspeed, plannedDepartureUtc, plannedFuelUpliftGallonsByStop, planningBurn, planningFuel]);
  const fuelPlanSummary = useMemo(() => {
    const overCapacityStops = legNavRows
      .filter((leg) => leg.requestedFuelUplift > leg.actualFuelUplift + 0.01)
      .map((leg) => ({
        icao: leg.to,
        excessGallons: leg.requestedFuelUplift - leg.actualFuelUplift,
      }));
    const firstUnreachableLeg = legNavRows.find((leg) => leg.fuelAfterLeg < 0);
    const endingFuelGallons = legNavRows.length > 0
      ? legNavRows[legNavRows.length - 1].fuelAfterUplift
      : fuelAvailableGallons;
    const reserveBalanceGallons = endingFuelGallons - reserveFuel;
    return {
      overCapacityStops,
      firstUnreachableLeg,
      endingFuelGallons,
      reserveBalanceGallons,
    };
  }, [fuelAvailableGallons, legNavRows, reserveFuel]);
  const fuelSurplus = fuelPlanSummary.reserveBalanceGallons;
  const surplusMinutes = planningBurn > 0 ? (fuelSurplus / planningBurn) * 60 : 0;
  const filingPacket = useMemo(() => ({
    filingLive: false,
    provider: "pending-flight-service-handoff",
    flightRules: filingDraft.flightRules,
    departure: form.departure.trim().toUpperCase() || null,
    destination: form.destination.trim().toUpperCase() || null,
    route: activeFiledRoute || null,
    alternate: form.alternate.trim().toUpperCase() || null,
    plannedDepartureLocal: form.plannedDepartureAt || null,
    plannedDepartureUtc: form.plannedDepartureAt ? toUtcIso(form.plannedDepartureAt, departureTimeZone) : null,
    plannedArrivalLocal: form.plannedArrivalAt || null,
    plannedArrivalUtc: form.plannedArrivalAt ? toUtcIso(form.plannedArrivalAt, destinationTimeZone) : null,
    trueAirspeedKtas: Math.round(planningCruise),
    plannedAltitudeFt: plannedAltitude ? Number(plannedAltitude) : null,
    estimatedEnrouteMinutes: eteMinutes || null,
    enduranceMinutes: Math.round(enduranceMinutes) || null,
    fuelRequiredGallons: totalFuel ? Number(totalFuel.toFixed(1)) : null,
    fuelOnBoardGallons: fuelAvailableGallons ? Number(fuelAvailableGallons.toFixed(1)) : null,
    aircraftId: filingDraft.aircraftId.trim() || form.tailNumber.trim() || null,
    aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
    equipment: filingDraft.equipment.trim() || null,
    soulsOnBoard: filingDraft.soulsOnBoard.trim() || null,
    aircraftColor: filingDraft.aircraftColor.trim() || null,
    pilotName: filingDraft.pilotName.trim() || null,
    wakeTurbulence: filingDraft.wakeTurbulence.trim() || null,
    typeOfFlight: filingDraft.typeOfFlight.trim() || null,
    surveillanceEquipment: filingDraft.surveillanceEquipment.trim() || null,
    otherInfo: filingDraft.otherInfo.trim() || null,
    remarks: [filingDraft.remarks.trim(), form.notes.trim()].filter(Boolean).join(" | ") || "Prepared in RSF",
  }), [
    filingDraft,
    form.departure,
    form.destination,
    form.alternate,
    form.plannedDepartureAt,
    form.plannedArrivalAt,
    form.tailNumber,
    form.aircraftType,
    form.notes,
    activeFiledRoute,
    departureTimeZone,
    destinationTimeZone,
    planningCruise,
    plannedAltitude,
    eteMinutes,
    enduranceMinutes,
    totalFuel,
    fuelAvailableGallons,
    selectedProfile?.name,
    selectedType.make,
    selectedType.model,
  ]);

  const tfrRouteQuery = useQuery({
    queryKey: ["/api/tfrs", "route", tfrBboxParam],
    queryFn: async () => {
      if (!tfrBboxParam) return { features: [] };
      const res = await fetch(apiUrl(`/api/tfrs?bbox=${encodeURIComponent(tfrBboxParam)}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch TFRs");
      return res.json();
    },
    enabled: Boolean(tfrBboxParam && routePoints.length > 1),
    staleTime: 1000 * 60 * 15,
  });

  const tfrConflicts = useMemo(() => {
    if (!routeBbox || routePoints.length < 2) return [];
    const features = tfrRouteQuery.data?.features ?? [];
    if (!Array.isArray(features) || features.length === 0) return [];
    return features.filter((feature: any) => {
      const rings = extractPolygonRings(feature?.geometry);
      if (!rings.length) return false;
      return rings.some((ring) => routeIntersectsRing(routePoints, ring, routeBbox));
    });
  }, [routeBbox, routePoints, tfrRouteQuery.data?.features]);

  const tfrConflictIds = useMemo(() => {
    return tfrConflicts
      .map((feature: any) => feature?.properties?.notamId)
      .filter(Boolean)
      .map((value: string) => String(value));
  }, [tfrConflicts]);
  const tfrConflictRef = useRef<string | null>(null);

  useEffect(() => {
    if (routePoints.length < 2) return;
    if (tfrConflictIds.length === 0) {
      tfrConflictRef.current = null;
      return;
    }
    const key = [...tfrConflictIds].sort().join("|");
    if (tfrConflictRef.current === key) return;
    tfrConflictRef.current = key;
    trackEvent("planner_tfr_conflict", {
      count: tfrConflictIds.length,
      tfrIds: tfrConflictIds.slice(0, 6),
    });
  }, [tfrConflictIds, routePoints.length]);

  const altitudeRisks = useMemo(() => {
    if (!Number.isFinite(plannedAltitudeFt) || plannedAltitudeFt <= 0) return [];
    const risks: string[] = [];
    if (plannedAltitudeFt >= 18000) {
      risks.push("Flight levels require IFR clearance and performance planning.");
    }
    if (plannedAltitudeFt >= 12500) {
      risks.push("Oxygen required above 12,500 ft MSL for more than 30 minutes.");
    }
    if (plannedAltitudeFt >= 14000) {
      risks.push("Oxygen required for crew above 14,000 ft MSL.");
    }
    if (plannedAltitudeFt >= 15000) {
      risks.push("Passengers require oxygen above 15,000 ft MSL.");
    }
    if (windValue >= 25) {
      risks.push(`Headwind ${windValue} kt may increase fuel burn at altitude.`);
    }
    risks.push("Review AIRMET/SIGMETs and turbulence or icing layers before departure.");
    if (mapStyle !== "winds") {
      risks.push("Review the Winds (Aloft) overlay for upper-level flow and turbulence hints.");
    }
    return risks;
  }, [plannedAltitudeFt, windValue, mapStyle]);

  useEffect(() => {
    if (!arrivalAuto || !form.plannedDepartureAt || !eteMinutes) return;
    const departureUtc = zonedDateTimeToUtc(form.plannedDepartureAt, departureTimeZone);
    if (!departureUtc) return;
    const arrivalUtc = new Date(departureUtc.getTime() + eteMinutes * 60000);
    const arrivalLocal = formatDateTimeLocal(arrivalUtc, destinationTimeZone);
    setForm((prev) => ({ ...prev, plannedArrivalAt: arrivalLocal }));
  }, [arrivalAuto, form.plannedDepartureAt, eteMinutes, departureTimeZone, destinationTimeZone]);

  const weatherIcaos = useMemo(() => {
    const list = [
      departureResolved.trim().toUpperCase(),
      ...plannedStops,
      ...waypoints,
      destinationResolved.trim().toUpperCase(),
    ].filter(Boolean);
    return Array.from(new Set(list))
      .filter((icao) => ICAO_REGEX.test(icao))
      .slice(0, 8);
  }, [departureResolved, destinationResolved, plannedStops, waypoints]);

  const weatherQueries = useQueries({
    queries: weatherIcaos.map((icao) => ({
      queryKey: ["/api/aviation-weather", icao],
      queryFn: async () => {
        const res = await fetch(apiUrl(`/api/aviation-weather/${icao}`), { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch weather data");
        return res.json();
      },
      enabled: weatherIcaos.length > 0,
      staleTime: 1000 * 60 * 5,
    })),
  });

  const weatherData = weatherQueries
    .map((query, index) => ({ icao: weatherIcaos[index], data: query.data as WeatherResponse | undefined }))
    .filter((item) => item.icao);

  const weatherFindings = useMemo(() => {
    return weatherData.map(({ icao, data }) => ({
      icao,
      category: parseFlightCategory(data?.metar),
      thunder: hasThunder(data?.taf),
    }));
  }, [weatherData]);

  const primaryIcao = departureResolved.trim().toUpperCase();
  const hasPrimaryIcao = ICAO_REGEX.test(primaryIcao);

  const windsSummaryQuery = useQuery({
    queryKey: ["/api/aviation/winds-temps", routeBboxParam, windsAltitudeFt],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (windsAltitudeFt) params.set("altitude", String(windsAltitudeFt));
      if (routeBboxParam) params.set("bbox", routeBboxParam);
      const res = await fetch(apiUrl(`/api/aviation/winds-temps?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch winds aloft");
      return res.json();
    },
    enabled: Boolean(routeBboxParam),
    staleTime: 1000 * 60 * 15,
  });

  const pirepsQuery = useQuery({
    queryKey: ["/api/aviation/pireps", primaryIcao],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/aviation/pireps?icao=${primaryIcao}&radiusNm=150&ageHours=4`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch PIREPs");
      return res.json();
    },
    enabled: hasPrimaryIcao,
    staleTime: 1000 * 60 * 10,
  });

  const notamsSummaryQuery = useQuery({
    queryKey: ["/api/notams", primaryIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/notams?icao=${primaryIcao}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch NOTAMs");
      return res.json();
    },
    enabled: hasPrimaryIcao,
    staleTime: 1000 * 60 * 5,
  });

  const convectiveHazardsQuery = useQuery({
    queryKey: ["/api/aviation/hazards", "conv"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/hazards?hazard=conv"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch convective hazards");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const icingHazardsQuery = useQuery({
    queryKey: ["/api/aviation/hazards", "ice"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/hazards?hazard=ice"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch icing hazards");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const turbulenceHazardsQuery = useQuery({
    queryKey: ["/api/aviation/hazards", "turb"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/aviation/hazards?hazard=turb"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch turbulence hazards");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const countHazards = (payload: any) => {
    if (!payload) return 0;
    const count = (value: any) => {
      if (Array.isArray(value)) return value.length;
      if (Array.isArray(value?.features)) return value.features.length;
      return 0;
    };
    return count(payload.airsigmet) + count(payload.gairmet) + count(payload.airmet) + count(payload.tcf);
  };

  const convectiveSummary = useMemo(
    () => buildHazardSummary(convectiveHazardsQuery.data),
    [convectiveHazardsQuery.data]
  );
  const icingSummary = useMemo(
    () => buildHazardSummary(icingHazardsQuery.data),
    [icingHazardsQuery.data]
  );
  const turbulenceSummary = useMemo(
    () => buildHazardSummary(turbulenceHazardsQuery.data),
    [turbulenceHazardsQuery.data]
  );

  const notamsCount = Array.isArray(notamsSummaryQuery.data?.notams) ? notamsSummaryQuery.data.notams.length : 0;
  const pirepsCount = Array.isArray(pirepsQuery.data?.reports) ? pirepsQuery.data.reports.length : 0;
  const windsCount = Array.isArray(windsSummaryQuery.data?.stations) ? windsSummaryQuery.data.stations.length : 0;
  const convectiveCount = countHazards(convectiveHazardsQuery.data);
  const icingCount = countHazards(icingHazardsQuery.data);
  const turbulenceCount = countHazards(turbulenceHazardsQuery.data);

  const hasIfrWeather = useMemo(
    () => weatherFindings.some((item) => item.category === "IFR" || item.category === "LIFR"),
    [weatherFindings]
  );

  const summaryCategoryLabel = useMemo(() => {
    if (weatherData.length === 0) return "No METARs yet";
    if (hasIfrWeather) return "IFR/LIFR risk";
    return "VFR/MVFR trend";
  }, [weatherData.length, hasIfrWeather]);

  const hasThunderRisk = useMemo(
    () => weatherFindings.some((item) => item.thunder),
    [weatherFindings]
  );
  const weatherByIcao = useMemo(() => {
    const lookup = new Map<string, { category: string; thunder: boolean }>();
    weatherFindings.forEach((item) => {
      lookup.set(item.icao, { category: item.category, thunder: item.thunder });
    });
    return lookup;
  }, [weatherFindings]);
  const legRiskByKey = useMemo(() => {
    const features = Array.isArray(tfrRouteQuery.data?.features) ? tfrRouteQuery.data.features : [];
    const riskMap = new Map<string, LegRiskSummary>();
    let cumulativeFuelUsed = 0;

    legs.forEach((leg, index) => {
      const navRow = legNavRows[index];
      if (!navRow) return;
      const fromWeather = weatherByIcao.get(navRow.from);
      const toWeather = weatherByIcao.get(navRow.to);
      const hasIfrRisk =
        fromWeather?.category === "IFR" ||
        fromWeather?.category === "LIFR" ||
        toWeather?.category === "IFR" ||
        toWeather?.category === "LIFR";
      const hasThunderRiskForLeg = Boolean(fromWeather?.thunder || toWeather?.thunder);

      const legBbox = {
        west: Math.min(leg.from.lon, leg.to.lon),
        east: Math.max(leg.from.lon, leg.to.lon),
        south: Math.min(leg.from.lat, leg.to.lat),
        north: Math.max(leg.from.lat, leg.to.lat),
      };
      const hasTfrConflict = features.some((feature: any) => {
        const rings = extractPolygonRings(feature?.geometry);
        if (!rings.length) return false;
        return rings.some((ring) => routeIntersectsRing([leg.from, leg.to], ring, legBbox));
      });

      cumulativeFuelUsed += navRow.legFuel;
      const remainingFuelGallons = navRow.fuelAfterUplift;
      const hasFuelDeficit = navRow.fuelAfterLeg < 0;
      const hasFuelReserveRisk = !hasFuelDeficit && remainingFuelGallons < reserveFuel;

      const level: LegRiskLevel =
        hasTfrConflict || hasThunderRiskForLeg || hasFuelDeficit
          ? "alert"
          : hasIfrRisk || hasFuelReserveRisk
            ? "caution"
            : "normal";

      riskMap.set(navRow.key, {
        level,
        hasTfrConflict,
        hasIfrRisk,
        hasThunderRisk: hasThunderRiskForLeg,
        hasFuelReserveRisk,
        hasFuelDeficit,
        remainingFuelGallons,
      });
    });

    return riskMap;
  }, [tfrRouteQuery.data?.features, legs, legNavRows, weatherByIcao, reserveFuel]);
  const weatherStatusText = weatherData.length === 0
    ? "No METARs loaded"
    : hasThunderRisk
      ? "Thunder risk"
      : hasIfrWeather
        ? "IFR/LIFR risk"
        : "VFR/MVFR";
  const weatherStatusTone = weatherData.length === 0
    ? "text-slate-300"
    : hasThunderRisk
      ? "text-amber-300"
      : hasIfrWeather
        ? "text-red-300"
        : "text-emerald-300";
  const tfrStatusText = !tfrRouteQuery.isFetched
    ? "Not checked"
    : tfrConflicts.length > 0
      ? `${tfrConflicts.length} conflict${tfrConflicts.length === 1 ? "" : "s"}`
      : "No conflicts";
  const tfrStatusTone = !tfrRouteQuery.isFetched
    ? "text-slate-300"
    : tfrConflicts.length > 0
      ? "text-amber-300"
      : "text-emerald-300";
  const weatherDataUpdatedAtMs = useMemo(
    () =>
      weatherQueries.reduce((maxValue, query) => {
        const value = typeof query.dataUpdatedAt === "number" ? query.dataUpdatedAt : 0;
        return Math.max(maxValue, value);
      }, 0),
    [weatherQueries]
  );
  const latestBriefingUpdatedAtMs = useMemo(
    () =>
      Math.max(
        weatherDataUpdatedAtMs,
        windsSummaryQuery.dataUpdatedAt || 0,
        pirepsQuery.dataUpdatedAt || 0,
        notamsSummaryQuery.dataUpdatedAt || 0,
        tfrRouteQuery.dataUpdatedAt || 0
      ),
    [
      weatherDataUpdatedAtMs,
      windsSummaryQuery.dataUpdatedAt,
      pirepsQuery.dataUpdatedAt,
      notamsSummaryQuery.dataUpdatedAt,
      tfrRouteQuery.dataUpdatedAt,
    ]
  );
  const isBriefingStale = latestBriefingUpdatedAtMs > 0 && Date.now() - latestBriefingUpdatedAtMs > 20 * 60 * 1000;
  const briefingUpdatedLabel = latestBriefingUpdatedAtMs
    ? new Date(latestBriefingUpdatedAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--";
  const briefingUpdatedTone = latestBriefingUpdatedAtMs === 0
    ? "text-slate-300"
    : isBriefingStale
      ? "text-amber-300"
      : "text-emerald-300";

  const autoChecklist = useMemo(() => ({
    weather: weatherData.length > 0 && !hasIfrWeather && !hasThunderRisk,
    fuel: totalFuel > 0 && !fuelPlanSummary.firstUnreachableLeg && fuelPlanSummary.reserveBalanceGallons >= 0,
    notams: notamsSummaryQuery.isFetched && !notamsSummaryQuery.isError,
    tfr: tfrRouteQuery.isFetched && tfrConflicts.length === 0,
    fuelSufficient: totalFuel > 0 && !fuelPlanSummary.firstUnreachableLeg && fuelPlanSummary.reserveBalanceGallons >= 0,
    currency: false,
  }), [weatherData, hasIfrWeather, hasThunderRisk, totalFuel,
    fuelPlanSummary.firstUnreachableLeg, fuelPlanSummary.reserveBalanceGallons, notamsSummaryQuery.isFetched,
    notamsSummaryQuery.isError, tfrRouteQuery.isFetched, tfrConflicts]);
  const checklistCompletionCount = useMemo(() => {
    const keys: (keyof typeof autoChecklist)[] = ["weather", "fuel", "currency", "notams", "tfr", "fuelSufficient"];
    return keys.filter((key) => checklist[key] || autoChecklist[key]).length;
  }, [autoChecklist, checklist]);
  const recentPlans = useMemo(() => savedPlans.slice(0, 8), [savedPlans]);

  const isIfrFlight = hasIfrWeather || plannedAltitudeFt >= 18000;
  const isVfrFlight = !isIfrFlight;

  const departureMetar = useMemo(() => {
    return weatherData.find((item) => item.icao === departureResolved.trim().toUpperCase())?.data?.metar;
  }, [weatherData, departureResolved]);

  const departureTempC = useMemo(() => parseMetarTempC(departureMetar), [departureMetar]);
  const departureElevationFt = useMemo(() => {
    const airport = airportMap.get(departureResolved.trim().toUpperCase());
    const elevation = airport?.elevationFt ?? airport?.elevation_ft ?? airport?.elevation ?? null;
    const value = Number(elevation);
    return Number.isFinite(value) ? value : null;
  }, [airportMap, departureResolved]);

  const runwayHeading = useMemo(() => parseRunwayHeading(departureRunway), [departureRunway]);
  const metarWind = useMemo(() => parseMetarWind(departureMetar), [departureMetar]);
  const crosswindComponent = useMemo(() => {
    if (!runwayHeading || !metarWind) return null;
    const diff = Math.abs(((metarWind.direction - runwayHeading + 540) % 360) - 180);
    const radians = (diff * Math.PI) / 180;
    return Math.abs(metarWind.speed * Math.sin(radians));
  }, [metarWind, runwayHeading]);
  const crosswindTrigger = crosswindComponent !== null && crosswindComponent >= 10;
  const densityAltitudeTrigger =
    (departureTempC !== null && departureTempC >= 25) ||
    (departureElevationFt !== null && departureElevationFt >= 3000);

  const routeAirports = useMemo(() => {
    return [
      departureResolved.trim().toUpperCase(),
      destinationResolved.trim().toUpperCase(),
      ...plannedStops,
      ...waypoints,
    ].filter(Boolean);
  }, [departureResolved, destinationResolved, plannedStops, waypoints]);
  const approachOfferAirports = useMemo(() => {
    return Array.from(new Set(routeAirports))
      .filter((icao) => ICAO_REGEX.test(icao))
      .slice(0, 8);
  }, [routeAirports]);
  const approachOfferKey = useMemo(() => approachOfferAirports.join("|"), [approachOfferAirports]);

  const hasControlledAirport = useMemo(
    () => routeAirports.some((icao) => CONTROLLED_AIRPORTS.has(icao)),
    [routeAirports]
  );

  const trainingCostTrigger = isStudent || eteHours >= 3;

  const contextualTools = useMemo<ContextualTool[]>(() => {
    const tools: ContextualTool[] = [];

    if (densityAltitudeTrigger) {
      tools.push({
        id: "density-altitude",
        title: "Density altitude check",
        description: "Performance may be impacted at the departure airport based on temperature and elevation.",
        cta: "Open density altitude calculator",
        href: "/pilot-tools",
      });
    }

    if (crosswindTrigger) {
      tools.push({
        id: "crosswind",
        title: "Crosswind component",
        description: "Winds and runway heading suggest a notable crosswind component for departure.",
        cta: "Review crosswind calculator",
        href: "/pilot-tools",
      });
    }

    if (trainingCostTrigger) {
      tools.push({
        id: "training-cost",
        title: "Training time & cost",
        description: "Longer routes are a good moment to estimate training time and budget.",
        cta: "Open training cost calculator",
        href: "/student/cost",
      });
    }

    if (isIfrFlight) {
      tools.push({
        id: "vor-trainer",
        title: "VOR trainer",
        description: "Practice intercepts and tracking for IFR routing or VOR-based segments.",
        cta: "Open VOR trainer",
        href: "/student/vor-trainer",
      });
    }

    if (hasControlledAirport) {
      tools.push({
        id: "radio-trainer",
        title: "Radio comms trainer",
        description: "Your route includes controlled airspace. Rehearse clearances and handoffs.",
        cta: "Open radio trainer",
        href: "/radio-comms-trainer",
      });
    }

    if (isStudent && isVfrFlight) {
      tools.push({
        id: "six-pack",
        title: "6-pack panel trainer",
        description: "Sharpen scan fundamentals before a VFR flight.",
        cta: "Open 6-pack trainer",
        href: "/student/six-pack-trainer",
      });
    }

    return tools;
  }, [
    densityAltitudeTrigger,
    crosswindTrigger,
    trainingCostTrigger,
    isIfrFlight,
    hasControlledAirport,
    isStudent,
    isVfrFlight,
  ]);

  const [briefingLocked, setBriefingLocked] = useState(false);
  const briefingKey = useMemo(() => {
    return [
      departureResolved.trim().toUpperCase(),
      destinationResolved.trim().toUpperCase(),
      waypointsInput.trim().toUpperCase(),
      plannedStopsInput.trim().toUpperCase(),
      plannedAltitude.trim(),
    ]
      .filter(Boolean)
      .join("|");
  }, [departureResolved, destinationResolved, waypointsInput, plannedStopsInput, plannedAltitude]);

  const briefingReady = Boolean(departureResolved && destinationResolved);

  useEffect(() => {
    if (!briefingReady || approachOfferAirports.length < 2 || !approachOfferKey) return;
    if (typeof window === "undefined") return;
    if (lastApproachOfferKeyRef.current === approachOfferKey) return;
    const storageKey = `rsf.approachOfferSeen.${approachOfferKey}`;
    if (window.localStorage.getItem(storageKey) === "1") {
      lastApproachOfferKeyRef.current = approachOfferKey;
      return;
    }
    window.localStorage.setItem(storageKey, "1");
    lastApproachOfferKeyRef.current = approachOfferKey;
    setShowApproachOffer(true);
  }, [briefingReady, approachOfferAirports.length, approachOfferKey]);

  useEffect(() => {
    if (!isGuest || !briefingReady) {
      setBriefingLocked(false);
      return;
    }
    if (typeof window === "undefined") return;
    const storageKey = "rsf.briefingViews";
    let views: string[] = [];
    try {
      views = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      views = [];
    }
    if (views.includes(briefingKey)) {
      setBriefingLocked(false);
      return;
    }
    if (views.length === 0) {
      localStorage.setItem(storageKey, JSON.stringify([briefingKey]));
      setBriefingLocked(false);
      return;
    }
    setBriefingLocked(true);
  }, [briefingKey, briefingReady, isGuest]);

  const enrouteFindings = useMemo(() => {
    return weatherFindings.filter(
      (item) =>
        item.icao !== departureResolved.trim().toUpperCase() &&
        item.icao !== destinationResolved.trim().toUpperCase()
    );
  }, [weatherFindings, departureResolved, destinationResolved]);

  const enrouteIfr = useMemo(
    () =>
      enrouteFindings
        .filter((item) => item.category === "IFR" || item.category === "LIFR")
        .map((item) => item.icao),
    [enrouteFindings]
  );
  const enrouteTs = useMemo(
    () => enrouteFindings.filter((item) => item.thunder).map((item) => item.icao),
    [enrouteFindings]
  );

  const routeVariationNotes = useMemo(() => {
    const notes: string[] = [];
    if (enrouteIfr.length > 0) {
      notes.push(`IFR/LIFR reported enroute: ${enrouteIfr.join(", ")}.`);
    }
    if (enrouteTs.length > 0) {
      notes.push(`Thunderstorms flagged in TAFs: ${enrouteTs.join(", ")}.`);
    }
    return notes;
  }, [enrouteIfr, enrouteTs]);

  const routeRisk = useMemo(() => {
    let risk = "Normal";
    let hasIfr = false;
    let hasTs = false;
    weatherFindings.forEach((item) => {
      if (item.category === "IFR" || item.category === "LIFR") hasIfr = true;
      if (item.thunder) hasTs = true;
    });
    if (hasIfr) risk = "IFR Conditions";
    if (hasTs) risk = hasIfr ? "IFR + Thunderstorms" : "Thunderstorms";
    return risk;
  }, [weatherFindings]);
  const resetForm = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FLIGHT_PLANNER_DRAFT_KEY);
    }
    setEditingPlan(null);
      setForm({
        title: "",
        departure: "",
        destination: "",
        route: "",
        alternate: "",
        plannedDepartureAt: "",
        plannedArrivalAt: "",
        aircraftType: "",
        tailNumber: "",
        fuelOnBoard: "",
        notes: "",
      });
      setWaypointsInput("");
      setPlannedStopsInput("");
      setDepartureRunway("");
      setSelectedProfileId("none");
      setSelectedTypeId(FALLBACK_TYPE.id);
      setFuelBurnMode("standard");
      setReserveMinutes("45");
      setHeadwind("0");
      setPlannedAltitude("");
      setArrivalAuto(true);
      setRouteSuggestion("direct");
      setCustomProfile({
        name: "",
        cruiseKtasOverride: "",
        fuelBurnOverrideGph: "",
        usableFuelOverrideGal: "",
        maxGrossWeightOverrideLb: "",
      });
      setPlannedFuelUplifts({});
      setFilingDraft({
        flightRules: "VFR",
        aircraftId: "",
        equipment: "S/C",
        soulsOnBoard: "1",
        aircraftColor: "",
        pilotName: "",
        remarks: "",
        wakeTurbulence: "MEDIUM",
        typeOfFlight: "G",
        surveillanceEquipment: "N",
        otherInfo: "",
      });
    };

  const copyFilingPacket = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filingPacket, null, 2));
      toast({ title: "Filing packet copied" });
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy the filing packet.", variant: "destructive" });
    }
  };

  const scrollToSection = (id: string, eventName: string) => {
    if (typeof document === "undefined") return;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      trackEvent(eventName, { target: id });
    }
  };

  const jumpToSection = (id: string, eventName: string, tab: FlightPlannerTab) => {
    if (activeTab !== tab) {
      setPendingSectionJump({ id, eventName });
      setActiveTab(tab);
      return;
    }
    scrollToSection(id, eventName);
  };

  const exportNavLogCsv = () => {
    if (!legNavRows.length) return;
    const header = ["Leg", "CourseDeg", "DistanceNm", "LegMinutes", "ETA (Z)", "LegFuelGal", "ArrivalFuelGal", "FuelUpliftGal", "DepartureFuelGal", "CumulativeNm"];
    const rows = legNavRows.map((leg) => [
      `${leg.from} to ${leg.to}`,
      String(leg.course),
      leg.distanceNm.toFixed(1),
      Math.round(leg.legMinutes).toString(),
      leg.legEtaUtc ? `${leg.legEtaUtc.toISOString().slice(11, 16)}Z` : "",
      leg.legFuel.toFixed(1),
      leg.fuelAfterLeg.toFixed(1),
      leg.actualFuelUplift.toFixed(1),
      leg.fuelAfterUplift.toFixed(1),
      leg.cumulativeNm.toFixed(1),
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rsf-nav-log-${(departureResolved || "dep").toLowerCase()}-${(destinationResolved || "dest").toLowerCase()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    trackEvent("planner_navlog_export", {
      departure: departureResolved || undefined,
      destination: destinationResolved || undefined,
      legs: legNavRows.length,
    });
  };

  const openFlightServiceHandoff = () => {
    trackEvent("planner_filing_preview", {
      flightRules: filingPacket.flightRules,
      departure: filingPacket.departure || undefined,
      destination: filingPacket.destination || undefined,
    });
    filingPreviewMutation.mutate();
  };

  const createPlanMutation = useMutation({
    mutationFn: async () => {
        const payload = {
          ...form,
          route: activeFiledRoute || null,
          aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
          fuelRequired: totalFuel ? totalFuel.toFixed(1) : null,
          filingFlightRules: filingDraft.flightRules,
          filingEquipment: filingDraft.equipment.trim() || null,
          filingSoulsOnBoard: filingDraft.soulsOnBoard.trim() || null,
          filingAircraftColor: filingDraft.aircraftColor.trim() || null,
          filingPilotName: filingDraft.pilotName.trim() || null,
          filingRemarks: filingDraft.remarks.trim() || null,
          filingWakeTurbulence: filingDraft.wakeTurbulence.trim() || null,
          filingTypeOfFlight: filingDraft.typeOfFlight.trim() || null,
          filingSurveillanceEquipment: filingDraft.surveillanceEquipment.trim() || null,
          filingOtherInfo: filingDraft.otherInfo.trim() || null,
          filingTrueAirspeedKtas: Math.round(planningCruise) || null,
          filingPlannedAltitudeFt: plannedAltitude ? Number(plannedAltitude) : null,
          filingEstimatedEnrouteMinutes: Math.round(eteMinutes) || null,
          filingEnduranceMinutes: Math.round(enduranceMinutes) || null,
          plannedDepartureAt: form.plannedDepartureAt
            ? toUtcIso(form.plannedDepartureAt, departureTimeZone)
            : null,
          plannedArrivalAt: form.plannedArrivalAt
            ? toUtcIso(form.plannedArrivalAt, destinationTimeZone)
            : null,
        };
      const res = await apiRequest("POST", "/api/flight-plans", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({ title: "Flight plan saved" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      if (!editingPlan) return null;
      const payload = {
        ...form,
        route: activeFiledRoute || null,
        aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
        fuelRequired: totalFuel ? totalFuel.toFixed(1) : null,
        filingFlightRules: filingDraft.flightRules,
        filingEquipment: filingDraft.equipment.trim() || null,
        filingSoulsOnBoard: filingDraft.soulsOnBoard.trim() || null,
        filingAircraftColor: filingDraft.aircraftColor.trim() || null,
        filingPilotName: filingDraft.pilotName.trim() || null,
        filingRemarks: filingDraft.remarks.trim() || null,
        filingWakeTurbulence: filingDraft.wakeTurbulence.trim() || null,
        filingTypeOfFlight: filingDraft.typeOfFlight.trim() || null,
        filingSurveillanceEquipment: filingDraft.surveillanceEquipment.trim() || null,
        filingOtherInfo: filingDraft.otherInfo.trim() || null,
        filingTrueAirspeedKtas: Math.round(planningCruise) || null,
        filingPlannedAltitudeFt: plannedAltitude ? Number(plannedAltitude) : null,
        filingEstimatedEnrouteMinutes: Math.round(eteMinutes) || null,
        filingEnduranceMinutes: Math.round(enduranceMinutes) || null,
        plannedDepartureAt: form.plannedDepartureAt
          ? toUtcIso(form.plannedDepartureAt, departureTimeZone)
          : null,
        plannedArrivalAt: form.plannedArrivalAt
          ? toUtcIso(form.plannedArrivalAt, destinationTimeZone)
          : null,
      };
      const res = await apiRequest("PATCH", `/api/flight-plans/${editingPlan.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({ title: "Flight plan updated" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/flight-plans/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({ title: "Flight plan deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: customProfile.name.trim(),
        tailNumber: form.tailNumber || null,
        typeId: selectedType?.id && selectedType.id !== FALLBACK_TYPE.id ? selectedType.id : null,
        cruiseKtasOverride: customProfile.cruiseKtasOverride ? Number(customProfile.cruiseKtasOverride) : null,
        fuelBurnOverrideGph: customProfile.fuelBurnOverrideGph ? Number(customProfile.fuelBurnOverrideGph) : null,
        usableFuelOverrideGal: customProfile.usableFuelOverrideGal ? Number(customProfile.usableFuelOverrideGal) : null,
        maxGrossWeightOverrideLb: customProfile.maxGrossWeightOverrideLb ? Number(customProfile.maxGrossWeightOverrideLb) : null,
      };
      const res = await apiRequest("POST", "/api/aircraft/profiles", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/profiles"] });
      toast({ title: "Aircraft profile saved" });
      setCustomProfile({
        name: "",
        cruiseKtasOverride: "",
        fuelBurnOverrideGph: "",
        usableFuelOverrideGal: "",
        maxGrossWeightOverrideLb: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const sendToLogbookMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        flightDate: new Date().toISOString().slice(0, 10),
        aircraftType: selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
        route: routePreviewFull,
        remarks: "Planned from Flight Planner",
      };
      const res = await apiRequest("POST", "/api/logbook", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Logbook entry created" });
    },
    onError: (error: any) => {
      toast({ title: "Logbook entry failed", description: error.message, variant: "destructive" });
    },
  });

  const filingPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/flight-plans/filing-preview", filingPacket);
      return res.json() as Promise<FilingPreviewResponse>;
    },
    onSuccess: (result) => {
      setFilingPreview(result);
      setShowFilingPayload(true);
      toast({
        title: result.readyToFile ? "Filing preview ready" : "Filing preview generated",
        description: result.readyToFile
          ? (result.liveAvailable
            ? "RSF validated the packet and the Leidos live filing path is available."
            : "RSF validated the packet and kept the handoff staged until live Leidos paths are fully configured.")
          : "Review the filing errors and warnings before continuing to Flight Service.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Preview failed",
        description: error.message || "Unable to build the filing preview.",
        variant: "destructive",
      });
    },
  });
  const filingStateText = filingPreviewMutation.isPending ? "Preview building" : "Packet ready";
  const filingStateTone = filingPreviewMutation.isPending ? "text-amber-300" : "text-emerald-300";
  const currentSavedPlan = editingPlan;
  const currentSavedPlanFlightRules = (currentSavedPlan?.filingFlightRules || filingDraft.flightRules || "VFR").toUpperCase();
  const currentSavedPlanStatus = filingStatusLabel(currentSavedPlan?.filingStatus);
  const hasCurrentSavedPlan = Boolean(currentSavedPlan?.id);

  const filingActionMutation = useMutation({
    mutationFn: async ({ planId, action }: { planId: string; action: "file" | "amend" | "activate" | "cancel" | "close" }) => {
      const res = await apiRequest("POST", `/api/flight-plans/${planId}/filing-action`, { action });
      return res.json();
    },
    onSuccess: (result: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({
        title: `${variables.action[0].toUpperCase()}${variables.action.slice(1)} ${result?.live ? "submitted" : "staged"}`,
        description: result?.message || "The provider handoff was recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Staging failed",
        description: error.message || "Unable to stage the filing action.",
        variant: "destructive",
      });
    },
  });

  savePlanActionRef.current = async () => {
    if (!isAuthenticated) return;
    if (planLimitReached) {
      toast({
        title: "Upgrade to RSF Pro",
        description: "Free accounts can save one plan. Upgrade to unlock unlimited plans.",
      });
      trackEvent("planner_upgrade_prompt", { action: "save_plan_limit" });
      window.location.href = "/logbook/pro";
      return;
    }
    if (editingPlan) {
      trackEvent("planner_save_plan", { action: "update" });
      updatePlanMutation.mutate();
      return;
    }
    trackEvent("planner_save_plan", { action: "create" });
    createPlanMutation.mutate();
  };

  saveProfileActionRef.current = async () => {
    if (!isAuthenticated) return;
    if (!isPro) {
      toast({
        title: "Upgrade to RSF Pro",
        description: "RSF Pro unlocks saved aircraft profiles.",
      });
      window.location.href = "/logbook/pro";
      return;
    }
    saveProfileMutation.mutate();
  };

  sendToLogbookActionRef.current = async () => {
    if (!isAuthenticated) return;
    if (!isPro) {
      toast({
        title: "Upgrade to RSF Pro",
        description: "RSF Pro membership is required to sync to logbook.",
      });
      trackEvent("planner_upgrade_prompt", { action: "send_to_logbook" });
      window.location.href = "/logbook/pro";
      return;
    }
    trackEvent("planner_send_to_logbook", { action: "create_entry" });
    sendToLogbookMutation.mutate();
  };

  useEffect(() => {
    if (!editingPlan) return;
    setForm({
      title: editingPlan.title || "",
      departure: editingPlan.departure || "",
      destination: editingPlan.destination || "",
      route: editingPlan.route || "",
      alternate: editingPlan.alternate || "",
      plannedDepartureAt: editingPlan.plannedDepartureAt ? new Date(editingPlan.plannedDepartureAt).toISOString().slice(0, 16) : "",
      plannedArrivalAt: editingPlan.plannedArrivalAt ? new Date(editingPlan.plannedArrivalAt).toISOString().slice(0, 16) : "",
      aircraftType: editingPlan.aircraftType || "",
      tailNumber: editingPlan.tailNumber || "",
      fuelOnBoard: editingPlan.fuelOnBoard ? String(editingPlan.fuelOnBoard) : "",
      notes: editingPlan.notes || "",
    });
    setFilingDraft((current) => ({
      ...current,
      flightRules: editingPlan.filingFlightRules || current.flightRules,
      aircraftId: editingPlan.tailNumber || current.aircraftId,
      equipment: editingPlan.filingEquipment || current.equipment,
      soulsOnBoard: editingPlan.filingSoulsOnBoard || current.soulsOnBoard,
      aircraftColor: editingPlan.filingAircraftColor || current.aircraftColor,
      pilotName: editingPlan.filingPilotName || current.pilotName,
      remarks: editingPlan.filingRemarks || editingPlan.notes || current.remarks,
      wakeTurbulence: editingPlan.filingWakeTurbulence || current.wakeTurbulence,
      typeOfFlight: editingPlan.filingTypeOfFlight || current.typeOfFlight,
      surveillanceEquipment: editingPlan.filingSurveillanceEquipment || current.surveillanceEquipment,
      otherInfo: editingPlan.filingOtherInfo || current.otherInfo,
    }));
    const normalizedSavedRoute = normalizeRouteText(editingPlan.route || "");
    const savedRouteTokens = normalizedSavedRoute ? normalizedSavedRoute.split(/\s+/) : [];
    const savedRouteIsAirportOnly = savedRouteTokens.length > 0 && savedRouteTokens.every((token) => ICAO_REGEX.test(token));
    setWaypointsInput(savedRouteIsAirportOnly ? normalizedSavedRoute : "");
    setPlannedStopsInput("");
    setPlannedAltitude(editingPlan.filingPlannedAltitudeFt ? String(editingPlan.filingPlannedAltitudeFt) : "");
    setArrivalAuto(false);
  }, [editingPlan]);

  useEffect(() => {
    if (selectedProfile) {
      setCustomProfile((prev) => ({
        ...prev,
        name: selectedProfile.name || prev.name,
        cruiseKtasOverride: selectedProfile.cruise_ktas_effective ? String(selectedProfile.cruise_ktas_effective) : prev.cruiseKtasOverride,
        fuelBurnOverrideGph: selectedProfile.fuel_burn_gph_effective ? String(selectedProfile.fuel_burn_gph_effective) : prev.fuelBurnOverrideGph,
        usableFuelOverrideGal: selectedProfile.usable_fuel_gal_effective ? String(selectedProfile.usable_fuel_gal_effective) : prev.usableFuelOverrideGal,
        maxGrossWeightOverrideLb: selectedProfile.max_gross_weight_lb_effective ? String(selectedProfile.max_gross_weight_lb_effective) : prev.maxGrossWeightOverrideLb,
      }));
      return;
    }
    if (selectedTypeId === CUSTOM_TYPE_ID) return;
    setCustomProfile((prev) => ({
      ...prev,
      name: `${selectedType.make} ${selectedType.model}`.trim(),
      cruiseKtasOverride: selectedType.cruise_ktas_effective ? String(selectedType.cruise_ktas_effective) : prev.cruiseKtasOverride,
      fuelBurnOverrideGph: selectedType.fuel_burn_gph_effective ? String(selectedType.fuel_burn_gph_effective) : prev.fuelBurnOverrideGph,
      usableFuelOverrideGal: selectedType.usable_fuel_gal_effective ? String(selectedType.usable_fuel_gal_effective) : prev.usableFuelOverrideGal,
      maxGrossWeightOverrideLb: selectedType.max_gross_weight_lb_effective ? String(selectedType.max_gross_weight_lb_effective) : prev.maxGrossWeightOverrideLb,
    }));
  }, [selectedProfile, selectedType, selectedTypeId]);

  useEffect(() => {
    if (!selectedProfile || editingPlan) return;
    setFilingDraft((current) => ({
      ...current,
      aircraftId: current.aircraftId.trim() || selectedProfile.tailNumber?.trim() || current.aircraftId,
      equipment: current.equipment.trim() || selectedProfile.filingEquipmentDefault?.trim() || current.equipment,
      soulsOnBoard: current.soulsOnBoard.trim() || selectedProfile.filingSoulsOnBoardDefault?.trim() || current.soulsOnBoard,
      aircraftColor: current.aircraftColor.trim() || selectedProfile.filingAircraftColorDefault?.trim() || current.aircraftColor,
      pilotName: current.pilotName.trim() || selectedProfile.filingPilotNameDefault?.trim() || current.pilotName,
      remarks: current.remarks.trim() || selectedProfile.filingRemarksDefault?.trim() || current.remarks,
      wakeTurbulence: current.wakeTurbulence.trim() || selectedProfile.filingWakeTurbulenceDefault?.trim() || current.wakeTurbulence,
      typeOfFlight: current.typeOfFlight.trim() || selectedProfile.filingTypeOfFlightDefault?.trim() || current.typeOfFlight,
      surveillanceEquipment: current.surveillanceEquipment.trim() || selectedProfile.filingSurveillanceEquipmentDefault?.trim() || current.surveillanceEquipment,
      otherInfo: current.otherInfo.trim() || selectedProfile.filingOtherInfoDefault?.trim() || current.otherInfo,
    }));
  }, [selectedProfile, editingPlan]);

  return (
    <PageShell
      kicker="Plan"
      title="Plan a Flight"
      description={
        <>
          Build the route, check the conditions, and keep the trip ready to save or file.
          {!isPro ? (
            <span className="block pt-2 text-xs text-slate-200/80 sm:text-sm">
              Free accounts can save the first plan. RSF Pro adds unlimited saved plans, aircraft profiles, alerts, and planning history.
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          {!isPro && <Badge variant="outline" className="border-white/12 bg-white/8 text-slate-100">Preview mode</Badge>}
          <Button
            variant="outline"
            size="sm"
            className="border-white/14 bg-white/6 text-slate-100 hover:bg-white/10"
            onClick={openScratchPad}
          >
            ✏ Scratch Pad
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/14 bg-white/6 text-slate-100 hover:bg-white/10"
            onClick={() => {
              trackEvent("planner_upgrade_click", { target: "/logbook/pro" });
              trackEvent("subscription_cta_click", { source_page: "/flight-planner", target: "/logbook/pro", context: "planner_header" });
            }}
          >
            <Link href={withSourceParam("/logbook/pro", "/flight-planner")}>Upgrade to RSF Pro</Link>
          </Button>
        </>
      }
      canopyClassName="hidden"
      contentClassName="max-w-[1400px] space-y-6"
    >
      <UpgradePromptDialog
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        toolName="Flight Planner"
        toolSummary="Route builder, advisory analysis, and flight-plan tracking."
        freeFeatures={[
          "Build routes with basic advisory summaries.",
          "Live METAR/TAF, runway, and NOTAM context.",
          "One saved plan with manual updates.",
          "Upgrade for unlimited saved plans, alerts, and advanced analytics.",
        ]}
      />
      <Card className="border-sky-200 bg-[linear-gradient(180deg,hsl(204_100%_98%),hsl(210_40%_97%))] text-slate-900 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sky-600 text-white hover:bg-sky-600">IFR Scratch Pad</Badge>
              <Badge variant="outline">CRAFT</Badge>
              {scratchPadHasContent && (
                <Badge variant="secondary">Notes saved</Badge>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">Write IFR clearance notes with your finger, stylus, or keyboard.</div>
              <div className="text-sm text-slate-600">
                Ink Pad is fastest for live readback. CRAFT fields stay available when you want the structured version, and both auto-save on this device.
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-[220px]">
            <Button onClick={openScratchPad}>
              {scratchPadHasContent ? "Open scratch pad" : "Start scratch pad"}
            </Button>
            <div className="text-xs text-slate-500">
              Opens full-screen. Press <span className="font-mono">Esc</span> to close.
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_540px]">
      <div className="min-w-0 space-y-4">
      <Card className="border-slate-200 bg-white text-slate-900 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Flights</CardTitle>
          <CardDescription className="text-slate-600">Open a saved route without leaving the planner.</CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="text-sm text-slate-600">Loading plans...</div>
          ) : recentPlans.length === 0 ? (
            <div className="text-sm text-slate-600">No saved plans yet.</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                size="sm"
                className="min-w-[170px]"
                onClick={resetForm}
              >
                Start new plan
              </Button>
              {recentPlans.map((plan) => (
                <button
                  key={`recent-${plan.id}`}
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  className="min-w-[230px] rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-200"
                >
                  <div className="truncate text-sm font-semibold text-slate-900">{plan.title || `${plan.departure} to ${plan.destination}`}</div>
                  <div className="text-xs text-slate-700">{plan.departure} to {plan.destination}</div>
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-[170px] border-slate-300 text-slate-800 hover:bg-slate-100"
                onClick={() => setActiveTab("file")}
              >
                Open saved plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white text-slate-900 shadow-sm">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7">
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Route</div>
              <div className="truncate text-base font-semibold text-slate-900">
                {(form.departure || "---").toUpperCase()} to {(form.destination || "---").toUpperCase()}
              </div>
            </div>
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Legs</div>
              <div className="text-base font-semibold text-slate-900">{legNavRows.length || 0}</div>
            </div>
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Distance</div>
              <div className="text-base font-semibold text-slate-900">{totalDistance ? `${totalDistance.toFixed(1)} NM` : "--"}</div>
            </div>
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Fuel</div>
              <div className="text-base font-semibold text-slate-900">{totalFuel ? `${totalFuel.toFixed(1)} gal` : "--"}</div>
            </div>
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Weather</div>
              <div className={cn("text-base font-semibold", weatherStatusTone)}>{weatherStatusText}</div>
            </div>
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Checklist</div>
              <div className="text-base font-semibold text-slate-900">{checklistCompletionCount}/6 complete</div>
            </div>
            <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">Briefing Sync</div>
              <div className={cn("text-base font-semibold", briefingUpdatedTone)}>
                {briefingUpdatedLabel}
                {isBriefingStale ? " (stale)" : latestBriefingUpdatedAtMs > 0 ? " (fresh)" : ""}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FlightPlannerTab)} className="min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-300 bg-white p-1 md:grid-cols-5">
          <TabsTrigger value="route" className="h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-700">Route</TabsTrigger>
          <TabsTrigger value="weather" className="h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-700">Weather</TabsTrigger>
          <TabsTrigger value="navlog" className="h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-700">Nav Log</TabsTrigger>
          <TabsTrigger value="analysis" className="h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-700">Analysis</TabsTrigger>
          <TabsTrigger value="file" className="h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-700">File &amp; Save</TabsTrigger>
        </TabsList>
        <TabsContent value="route" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick Planning References</CardTitle>
          <CardDescription>Open and hide each reference as needed without leaving the planner workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full space-y-2">
            <AccordionItem value="airport-conditions" className="rounded-lg border px-3">
              <AccordionTrigger className="text-sm">Airport conditions</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3 text-sm text-muted-foreground">
                <p>Jump to the route weather summary already on this page.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => jumpToSection("route-weather-summary", "planner_jump_weather_summary", "weather")}>
                    Go to weather summary
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="airspace-review" className="rounded-lg border px-3">
              <AccordionTrigger className="text-sm">Airspace review</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3 text-sm text-muted-foreground">
                <p>Review route conflicts in this page, or open the full TFR map in a new tab.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => jumpToSection("route-analysis", "planner_jump_route_analysis", "analysis")}>
                    Go to route analysis
                  </Button>
                  <Button type="button" size="sm" asChild>
                    <a href="/tfr-map" target="_blank" rel="noopener noreferrer">Open full TFR map</a>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="approach-plates" className="rounded-lg border px-3">
              <AccordionTrigger className="text-sm">Approach plates</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3 text-sm text-muted-foreground">
                <p>Open RSF approach plates in a new tab while keeping the planner route loaded here.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" asChild>
                    <a href="/approach-plates" target="_blank" rel="noopener noreferrer">Open approach plates</a>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Setup</CardTitle>
          <CardDescription>Enter airports, pick your aircraft, and add waypoints or stops before you plot the trip.</CardDescription>
        </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Departure (ICAO)</Label>
              <Input
              value={form.departure}
              onChange={(e) => setForm({ ...form, departure: e.target.value.toUpperCase() })}
              placeholder="KJFK or Austin, TX"
            />
            {departureSuggestions.length > 0 && (
              <div className="rounded-md border bg-background p-2 max-h-40 overflow-y-auto space-y-1 text-sm">
                {departureSuggestions.map((airport) => (
                  <button
                    key={`${airport.icao}-${airport.name ?? ""}`}
                    type="button"
                    className="w-full text-left hover:bg-muted rounded px-2 py-1"
                    onClick={() => {
                      departureSelectedRef.current = airport.icao.toUpperCase();
                      setForm({ ...form, departure: airport.icao.toUpperCase() });
                      setDepartureResolved(airport.icao.toUpperCase());
                      setDepartureSuggestions([]);
                    }}
                  >
                    <span className="font-medium">{airport.icao}</span>
                    {airport.name ? ` — ${airport.name}` : ""}
                    {airport.city ? ` (${airport.city}${airport.state ? `, ${airport.state}` : ""})` : ""}
                  </button>
                ))}
              </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Destination (ICAO)</Label>
              <Input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })}
              placeholder="KBOS or Dallas, TX"
            />
            {destinationSuggestions.length > 0 && (
              <div className="rounded-md border bg-background p-2 max-h-40 overflow-y-auto space-y-1 text-sm">
                {destinationSuggestions.map((airport) => (
                  <button
                    key={`${airport.icao}-${airport.name ?? ""}`}
                    type="button"
                    className="w-full text-left hover:bg-muted rounded px-2 py-1"
                    onClick={() => {
                      destinationSelectedRef.current = airport.icao.toUpperCase();
                      setForm({ ...form, destination: airport.icao.toUpperCase() });
                      setDestinationResolved(airport.icao.toUpperCase());
                      setDestinationSuggestions([]);
                    }}
                  >
                    <span className="font-medium">{airport.icao}</span>
                    {airport.name ? ` — ${airport.name}` : ""}
                    {airport.city ? ` (${airport.city}${airport.state ? `, ${airport.state}` : ""})` : ""}
                  </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Departure runway (optional)</Label>
              <Input
                value={departureRunway}
                onChange={(e) => setDepartureRunway(e.target.value.toUpperCase())}
                placeholder="17L"
              />
              <p className="text-xs text-muted-foreground">
                Add a runway to surface crosswind guidance in the route analysis.
              </p>
            </div>
            <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-col gap-1">
                <div className="font-semibold">Aircraft setup</div>
                <div className="text-xs text-muted-foreground">
                  Select an aircraft from the RSF library or a saved profile to prefill performance assumptions before you plan the route.
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>RSF Aircraft Library</Label>
                  <Select
                    value={selectedTypeId}
                    onValueChange={(value) => {
                      setSelectedTypeId(value);
                      setSelectedProfileId("none");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select aircraft type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectItem value={CUSTOM_TYPE_ID}>Custom entry</SelectItem>
                      <SelectItem value={FALLBACK_TYPE.id}>
                        {FALLBACK_TYPE.make} {FALLBACK_TYPE.model}
                      </SelectItem>
                      {aircraftTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.make} {type.model}{type.icaoType ? ` (${type.icaoType})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Saved Profile</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select saved profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {savedProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Saved profiles override library values when selected. This prefill is one of RSF's strongest planning workflow advantages.
              </div>
              {selectedTypeNeedsVerification && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertDescription>
                    This RSF library template is still marked as a planning estimate. Verify the performance values against the POH/AFM before relying on them for fuel, range, or cost planning.
                    {selectedType.sourceNote ? ` ${selectedType.sourceNote}` : ""}
                    {selectedType.verificationSource ? ` Source: ${selectedType.verificationSource}.` : ""}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Route Assist Waypoints (optional)</Label>
              <Input
                value={waypointsInput}
                onChange={(e) => setWaypointsInput(e.target.value.toUpperCase())}
                placeholder="KISP KPVD (comma or space separated)"
              />
              <p className="text-xs text-muted-foreground">
                Optional planning aids only. Add ICAO codes separated by space or comma, or use the helper suggestions below and edit as needed.
              </p>
              {routeSuggestionQuery.isFetching && departureResolved && destinationResolved && (
                <div className="text-xs text-muted-foreground">Calculating route-assist waypoints...</div>
              )}
              {suggestedWaypoints.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Route assist:</span>
                  {suggestedWaypoints.map((icao) => (
                    <span key={`waypoint-${icao}`}>
                      {renderAirportIcaoTooltip(
                        icao,
                        <Badge variant="secondary">
                          {icao}
                        </Badge>,
                      )}
                    </span>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setWaypointsInput(suggestedWaypoints.join(" "))}
                  >
                    {waypoints.length > 0 ? "Replace with assist" : "Use assist"}
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Suggested Fuel Stops (optional)</Label>
              <Input
                value={plannedStopsInput}
                onChange={(e) => setPlannedStopsInput(e.target.value.toUpperCase())}
                placeholder="KACT KTYR (fuel/meal stops)"
              />
              <p className="text-xs text-muted-foreground">
                Optional planning aids for fuel or rest stops. Pilots can keep these, replace them, or ignore them entirely.
              </p>
              {routeSuggestionQuery.isFetching && departureResolved && destinationResolved && (
                <div className="text-xs text-muted-foreground">Estimating suggested fuel stops...</div>
              )}
              {suggestedStops.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Suggested fuel stops:</span>
                  {suggestedStops.map((icao) => (
                    <span key={`stop-${icao}`}>
                      {renderAirportIcaoTooltip(
                        icao,
                        <Badge variant="secondary">
                          {icao}
                        </Badge>,
                      )}
                    </span>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPlannedStopsInput(suggestedStops.join(" "))}
                  >
                    {plannedStops.length > 0 ? "Replace with suggested stops" : "Use suggested stops"}
                  </Button>
                </div>
              )}
              {suggestionMeta && suggestedStops.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Max leg ~{suggestionMeta.maxLegNm.toFixed(0)} NM based on {suggestionMeta.fuelGallons.toFixed(0)} gal
                  at {suggestionMeta.fuelBurnGph.toFixed(1)} gph with {suggestionMeta.reserveMinutes} min reserve.
                </div>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Label>Filed route (ATC / Leidos)</Label>
                  <p className="text-xs text-muted-foreground">
                    This is the route that actually matters for filing. Enter the enroute string you want to file, including fixes, VORs, airways, SIDs, STARs, or `DCT`.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedRouteCore && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setForm((current) => ({ ...current, route: generatedRouteCore }))}
                    >
                      Use route builder
                    </Button>
                  )}
                  {filedRouteInputNormalized && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setForm((current) => ({ ...current, route: "" }))}
                    >
                      Clear override
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={form.route}
                onChange={(e) => setForm({ ...form, route: e.target.value.toUpperCase() })}
                placeholder="DCT TXK V18 MEM J42 ATL"
                className="min-h-[88px]"
              />
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2 text-xs text-muted-foreground">
                Planning preview only: <span className="font-medium text-foreground">{routePreviewFull || "-"}</span>
              </div>
              {filedRouteTokens.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Parsed Route Structure</div>
                      <div className="text-xs text-muted-foreground">
                        RSF now recognizes route token types for review. Airports can drive map/frequency lookups; airways, fixes, navaids, and procedures stay in the filed route for ATC/Leidos.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {filedRouteTokenCounts.airway > 0 && <span>{filedRouteTokenCounts.airway} airway</span>}
                      {filedRouteTokenCounts.fix > 0 && <span>{filedRouteTokenCounts.fix} fix</span>}
                      {filedRouteTokenCounts.navaid > 0 && <span>{filedRouteTokenCounts.navaid} navaid</span>}
                      {filedRouteTokenCounts.procedure > 0 && <span>{filedRouteTokenCounts.procedure} SID/STAR</span>}
                      {filedRouteTokenCounts.airport > 0 && <span>{filedRouteTokenCounts.airport} airport</span>}
                      {filedRouteTokenCounts.direct > 0 && <span>{filedRouteTokenCounts.direct} DCT</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filedRouteTokens.map((routeToken, index) => {
                      const badgeClassName =
                        routeToken.kind === "airway"
                          ? "border-sky-200 bg-sky-50 text-sky-900"
                          : routeToken.kind === "fix"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : routeToken.kind === "navaid"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-900"
                              : routeToken.kind === "procedure"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : routeToken.kind === "airport"
                                  ? "border-slate-200 bg-white text-slate-900"
                                  : routeToken.kind === "direct"
                                    ? "border-violet-200 bg-violet-50 text-violet-900"
                                    : routeToken.kind === "coordinate"
                                      ? "border-rose-200 bg-rose-50 text-rose-900"
                                      : "border-slate-200 bg-slate-100 text-slate-700";
                      return (
                        <Tooltip key={`${routeToken.token}-${index}`}>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className={badgeClassName}>
                              {routeToken.token}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{filedRouteTokenKindLabel(routeToken.kind)}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  {filedRouteAirportTokens.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      This filed route currently contains no airport-type enroute tokens, so the map will stay anchored to departure, destination, and any planned airport stops instead of trying to draw airway segments as airports.
                    </div>
                  )}
                </div>
              )}
              {filingDraft.flightRules === "IFR" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Leidos Route Assist</div>
                      <div className="text-xs text-muted-foreground">
                        Optional IFR routing help from Flight Service. Use it as a starting point, but review and edit the filed route yourself before filing.
                      </div>
                    </div>
                    {leidosRouteQuery.data?.environment && (
                      <Badge variant="secondary">{leidosRouteQuery.data.environment}</Badge>
                    )}
                  </div>
                  <div className="mt-3 space-y-3 text-sm">
                    {leidosRouteQuery.isFetching && (
                      <div className="text-xs text-muted-foreground">Checking Leidos for recommended routes...</div>
                    )}
                    {leidosRouteQuery.error && (
                      <Alert>
                        <AlertDescription>
                          {(leidosRouteQuery.error as Error).message || "Leidos route search is unavailable right now."}
                        </AlertDescription>
                      </Alert>
                    )}
                    {leidosRouteQuery.data?.available === false && leidosRouteQuery.data?.message && (
                      <Alert>
                        <AlertDescription>{leidosRouteQuery.data.message}</AlertDescription>
                      </Alert>
                    )}
                    {leidosRouteQuery.data?.route && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                          System Recommended Assist
                        </div>
                        <div className="mt-1 font-mono text-sm text-foreground break-words">{leidosRouteQuery.data.route}</div>
                        <div className="mt-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setForm((current) => ({ ...current, route: leidosRouteQuery.data?.route || "" }))}
                          >
                            Use recommended route
                          </Button>
                        </div>
                      </div>
                    )}
                    {[
                      { title: "Recent ATC IFR Routes", routes: leidosRouteQuery.data?.atcRecentIFRRoutes || [] },
                      { title: "FAA Preferred Routes", routes: leidosRouteQuery.data?.faaPreferredRoutes || [] },
                      { title: "Coded Departure Routes", routes: leidosRouteQuery.data?.codedDepartureRoutes || [] },
                    ].map((group) => (
                      group.routes.length > 0 ? (
                        <div key={group.title} className="space-y-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</div>
                          <div className="grid gap-2">
                            {group.routes.slice(0, 3).map((route) => (
                              <div key={`${group.title}-${route}`} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-background px-3 py-2">
                                <div className="font-mono text-xs text-foreground break-words">{route}</div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setForm((current) => ({ ...current, route }))}
                                >
                                  Use route
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null
                    ))}
                    {leidosRouteQuery.data?.warnings?.length ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                        {leidosRouteQuery.data.warnings.join(" ")}
                      </div>
                    ) : null}
                    {!leidosRouteQuery.isFetching &&
                      !leidosRouteQuery.error &&
                      leidosRouteQuery.data?.available !== false &&
                      !leidosRouteQuery.data?.route &&
                      !(leidosRouteQuery.data?.atcRecentIFRRoutes?.length) &&
                      !(leidosRouteQuery.data?.faaPreferredRoutes?.length) &&
                      !(leidosRouteQuery.data?.codedDepartureRoutes?.length) && (
                        <div className="text-xs text-muted-foreground">
                          No Leidos route assist suggestions came back for this city pair yet. You can still file a custom route or use the planning helpers above.
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          <div className="space-y-2">
            <Label>Alternate (optional)</Label>
            <Input
              value={form.alternate}
              onChange={(e) => setForm({ ...form, alternate: e.target.value })}
              placeholder="KBDL"
            />
          </div>
            <div className="space-y-2">
              <Label>Tail Number</Label>
              <Input
                value={form.tailNumber}
                onChange={(e) => setForm({ ...form, tailNumber: e.target.value })}
                placeholder="N12345"
              />
            </div>
            <div className="space-y-2">
              <Label>Planned Departure</Label>
              <Input
                type="datetime-local"
                value={form.plannedDepartureAt}
                onChange={(e) => setForm({ ...form, plannedDepartureAt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Local time at departure ({departureTimeZone}).
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Planned Arrival</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canAutoArrival}
                  onClick={() => setArrivalAuto(true)}
                >
                  Auto-calc
                </Button>
              </div>
              <Input
                type="datetime-local"
                value={form.plannedArrivalAt}
                onChange={(e) => {
                  setForm({ ...form, plannedArrivalAt: e.target.value });
                  setArrivalAuto(false);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Local time at destination ({destinationTimeZone}).
              </p>
            </div>
            <div className="md:col-span-2 rounded-lg border p-4 space-y-2">
              <div className="font-semibold">Quick Route Helpers</div>
              <div className="text-xs text-muted-foreground">
                Optional planning shortcuts only. Midpoint adds a virtual waypoint for planning and does not replace the route you choose to file.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={routeSuggestion === "direct" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRouteSuggestion("direct")}
                >
                  Direct
                </Button>
                <Button
                  variant={routeSuggestion === "midpoint" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRouteSuggestion("midpoint")}
                  disabled={waypoints.length > 0}
                >
                  Add midpoint
                </Button>
              </div>
              {(waypoints.length > 0 || plannedStops.length > 0) && (
                <div className="text-xs text-muted-foreground">
                  Midpoint is disabled when custom waypoints are entered.
                </div>
              )}
              {suggestedWaypoint && (
                <div className="text-xs text-muted-foreground">
                  Planning helper waypoint: MID ({suggestedWaypoint.lat.toFixed(3)}, {suggestedWaypoint.lon.toFixed(3)})
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distance & Performance</CardTitle>
          <CardDescription>Review trip distance, time, and fuel after your aircraft selection fills in the planning assumptions above.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Reserve Fuel (minutes)</Label>
              <Select value={reserveMinutes} onValueChange={setReserveMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avg Headwind (kt)</Label>
              <Input
                value={headwind}
                onChange={(e) => setHeadwind(e.target.value)}
                disabled={!isPro}
                placeholder="0"
              />
              {!isPro && <p className="text-xs text-muted-foreground">RSF Pro unlocks wind-adjusted ETE.</p>}
            </div>
            <div className="space-y-2">
              <Label>Planned Altitude (ft)</Label>
              <Input
                value={plannedAltitude}
                onChange={(e) => setPlannedAltitude(e.target.value)}
                placeholder="8500"
                type="number"
              />
              <p className="text-xs text-muted-foreground">
                Used for enroute awareness and winds aloft checks.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Fuel On Board (gal)</Label>
              <Input
                value={form.fuelOnBoard}
                onChange={(e) => setForm({ ...form, fuelOnBoard: e.target.value })}
                placeholder={String(planningFuel)}
                type="number"
              />
              <p className="text-xs text-muted-foreground">
                Drives trip fuel, endurance, reserve margin, and suggested fuel stops.
              </p>
            </div>
          </div>

          {selectedTypeSupportsBurnProfiles && !useManual && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fuel Burn Profile</Label>
                <Select
                  value={fuelBurnMode}
                  onValueChange={(value) => setFuelBurnMode(value as FuelBurnMode)}
                  disabled={Boolean(selectedProfile?.fuelBurnOverrideGph)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard ({selectedType.fuel_burn_gph_effective?.toFixed(1) || "-"} gph)</SelectItem>
                    {selectedType.fuel_burn_economy_gph_effective ? (
                      <SelectItem value="economy">Economy ({selectedType.fuel_burn_economy_gph_effective.toFixed(1)} gph)</SelectItem>
                    ) : null}
                    {selectedType.fuel_burn_performance_gph_effective ? (
                      <SelectItem value="performance">Performance ({selectedType.fuel_burn_performance_gph_effective.toFixed(1)} gph)</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use the profile that best matches how you plan to cruise this trip.
                  {selectedProfile?.fuelBurnOverrideGph ? " Saved profile burn override is active, so the selector is locked." : ""}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-xs text-muted-foreground">Selected burn profile</div>
                <div className="font-semibold">{fuelBurnMode[0].toUpperCase() + fuelBurnMode.slice(1)} • {planningBurn.toFixed(1)} gph</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Library baseline {selectedType.fuel_burn_gph_effective?.toFixed(1) || "-"} gph
                  {selectedType.fuel_burn_economy_gph_effective ? ` | Economy ${selectedType.fuel_burn_economy_gph_effective.toFixed(1)}` : ""}
                  {selectedType.fuel_burn_performance_gph_effective ? ` | Performance ${selectedType.fuel_burn_performance_gph_effective.toFixed(1)}` : ""}
                </div>
              </div>
            </div>
          )}

          {(fuelOnBoardCapacityWarning || usableFuelCapacityWarning) && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-semibold mb-1">Fuel capacity warning</div>
                <div className="space-y-1 text-sm">
                  {fuelOnBoardCapacityWarning && <div>{fuelOnBoardCapacityWarning}</div>}
                  {usableFuelCapacityWarning && <div>{usableFuelCapacityWarning}</div>}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {orderedPlannedStops.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div>
                <div className="font-semibold">Planned Fuel Uplifts</div>
                <div className="text-xs text-muted-foreground">
                  Add the gallons you expect to take on at each planned fuel stop. This is used for planner fuel math only and is not filed with ATC or Leidos.
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {orderedPlannedStops.map((icao) => (
                  <div key={`uplift-${icao}`} className="space-y-2">
                    {renderAirportIcaoTooltip(
                      icao,
                      <Label>{icao} fuel added (gal)</Label>,
                    )}
                    <Input
                      value={plannedFuelUplifts[icao] || ""}
                      onChange={(e) => setPlannedFuelUplifts((current) => ({ ...current, [icao]: e.target.value }))}
                      placeholder="0"
                      type="number"
                    />
                  </div>
                ))}
              </div>
              {fuelPlanSummary.overCapacityStops.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {fuelPlanSummary.overCapacityStops.map((stop) => (
                      <div key={`overfill-${stop.icao}`}>
                        {stop.icao} uplift exceeds usable capacity by {stop.excessGallons.toFixed(1)} gal.
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {altitudeRisks.length > 0 && (
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-1">Altitude notes</div>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {altitudeRisks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total Distance</div>
              <div className="text-lg font-semibold">{totalDistance ? totalDistance.toFixed(1) : "-"} NM</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">ETE</div>
              <div className="text-lg font-semibold">
                {eteHours ? `${Math.round(eteHours * 60)} min` : "-"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Trip Fuel</div>
              <div className="text-lg font-semibold">{tripFuel ? tripFuel.toFixed(1) : "-"} gal</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total Fuel + Reserve</div>
              <div className="text-lg font-semibold">{totalFuel ? totalFuel.toFixed(1) : "-"} gal</div>
            </div>
          </div>
          {totalFuel > 0 && (
            <div className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium",
              !fuelPlanSummary.firstUnreachableLeg && fuelSurplus >= 0
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-red-300 bg-red-50 text-red-800"
            )}>
              {fuelPlanSummary.firstUnreachableLeg
                ? `⚠ You cannot reach ${fuelPlanSummary.firstUnreachableLeg.to} on current fuel planning. Short by ${Math.abs(fuelPlanSummary.firstUnreachableLeg.fuelAfterLeg).toFixed(1)} gal before planned uplift.`
                : fuelSurplus >= 0
                  ? `Fuel surplus after planned stops: +${fuelSurplus.toFixed(1)} gal (${formatMinutesLabel(surplusMinutes)} beyond reserve)`
                  : `⚠ Fuel deficit after planned stops: ${fuelSurplus.toFixed(1)} gal — add fuel, adjust stop uplifts, or reduce route`}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Start fuel: {fuelAvailableGallons ? `${fuelAvailableGallons.toFixed(1)} gal` : "-"} | Planned uplift: {totalPlannedFuelUplift.toFixed(1)} gal | Usable fuel: {planningFuel ? `${planningFuel} gal` : "-"} | Max gross weight: {planningMaxWeight ? `${planningMaxWeight} lb` : "-"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <Link
                href={withSourceParam("/weight-balance", "/flight-planner")}
                onClick={() => trackEvent("planner_open_weight_balance", { source_page: "/flight-planner" })}
              >
                Open Weight &amp; Balance
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Use the same fuel-on-board value in Weight &amp; Balance to keep takeoff and landing numbers aligned.
            </p>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Planning Aircraft Name</Label>
              <Input
                value={customProfile.name}
                onChange={(e) => setCustomProfile({ ...customProfile, name: e.target.value })}
                placeholder="My C172"
              />
            </div>
            <div className="space-y-2">
              <Label>Cruise KTAS</Label>
              <Input
                value={customProfile.cruiseKtasOverride}
                onChange={(e) => setCustomProfile({ ...customProfile, cruiseKtasOverride: e.target.value })}
                placeholder="110"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label>Fuel Burn (gph)</Label>
              <Input
                value={customProfile.fuelBurnOverrideGph}
                onChange={(e) => setCustomProfile({ ...customProfile, fuelBurnOverrideGph: e.target.value })}
                placeholder="8.5"
                type="number"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Usable Fuel (gal)</Label>
              <Input
                value={customProfile.usableFuelOverrideGal}
                onChange={(e) => setCustomProfile({ ...customProfile, usableFuelOverrideGal: e.target.value })}
                placeholder="40"
                type="number"
              />
              {usableFuelCapacityWarning && (
                <p className="text-xs text-red-600">{usableFuelCapacityWarning}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Max Gross Weight (lb)</Label>
              <Input
                value={customProfile.maxGrossWeightOverrideLb}
                onChange={(e) => setCustomProfile({ ...customProfile, maxGrossWeightOverrideLb: e.target.value })}
                placeholder="2400"
                type="number"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Start from the RSF library or a saved profile, then adjust these planning assumptions if your actual aircraft performs differently.
          </p>
          <Button
            variant="outline"
            disabled={!customProfile.name || saveProfileMutation.isPending}
            onClick={() => {
              runWithAuth("save_aircraft_profile", async () => {
                await saveProfileActionRef.current();
              });
            }}
          >
            Save Aircraft Profile
          </Button>
          {!isAuthenticated ? (
            <p className="text-xs text-muted-foreground">Create a free account to save custom aircraft profiles.</p>
          ) : !isPro ? (
            <p className="text-xs text-muted-foreground">Upgrade to RSF Pro to save aircraft profiles.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ATC &amp; Airport Frequencies</CardTitle>
          <CardDescription>
            Route airport frequencies from the airport reference feed. Verify against current charts, ATIS, and official airport publications before use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {routeAirportFrequencyCards.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Enter a valid route to load airport frequencies for departure, stops, and destination.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {routeAirportFrequencyCards.map(({ icao, airport, frequencies }) => (
                <div key={`freq-${icao}`} className="rounded-lg border p-4 space-y-3">
                  <div>
                    {renderAirportIcaoTooltip(
                      icao,
                      <div className="font-semibold">{icao}</div>,
                    )}
                    <div className="text-xs text-muted-foreground">
                      {airport?.name || "Airport"}{airport?.timezone ? ` • ${airport.timezone}` : ""}
                    </div>
                  </div>
                  {frequencies.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No frequencies returned for this airport from the current reference source.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {frequencies.slice(0, 8).map((item, index) => (
                        <div key={`${icao}-${item.type || "other"}-${item.frequencyMhz || "na"}-${index}`} className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                          <div>
                            <div className="text-sm font-medium">{formatFrequencyTypeLabel(item.type)}</div>
                            {item.description ? (
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            ) : null}
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {item.frequencyMhz ? `${item.frequencyMhz.toFixed(3)}` : "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="navlog" className="space-y-6">

      <Card id="planner-nav-log">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Navigation Log</CardTitle>
              <CardDescription>Leg-by-leg course, time, and fuel summary.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportNavLogCsv}
              disabled={legNavRows.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {legNavRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Enter a valid route to generate the nav log.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Leg</th>
                    <th className="py-2 pr-3">Course</th>
                    <th className="py-2 pr-3">Dist</th>
                    <th className="py-2 pr-3">ETE</th>
                    <th className="py-2 pr-3">ETA (Z)</th>
                    <th className="py-2 pr-3">Leg Fuel</th>
                    <th className="py-2 pr-3">Arrive Fuel</th>
                    <th className="py-2 pr-3">Uplift</th>
                    <th className="py-2 pr-3">Depart Fuel</th>
                    <th className="py-2">Cum</th>
                  </tr>
                </thead>
                <tbody>
                  {legNavRows.map((leg) => (
                    <tr key={leg.key} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium">
                        {renderAirportIcaoTooltip(
                          leg.from,
                          <span>{leg.from}</span>,
                        )}
                        {" to "}
                        {renderAirportIcaoTooltip(
                          leg.to,
                          <span>{leg.to}</span>,
                        )}
                      </td>
                      <td className="py-2 pr-3">{String(leg.course).padStart(3, "0")}°</td>
                      <td className="py-2 pr-3">{leg.distanceNm.toFixed(1)} NM</td>
                      <td className="py-2 pr-3">{formatMinutesLabel(leg.legMinutes)}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {leg.legEtaUtc
                          ? leg.legEtaUtc.toISOString().slice(11, 16) + "Z"
                          : "-"}
                      </td>
                      <td className="py-2 pr-3">{leg.legFuel.toFixed(1)} gal</td>
                      <td className="py-2 pr-3">{leg.fuelAfterLeg.toFixed(1)} gal</td>
                      <td className="py-2 pr-3">{leg.actualFuelUplift > 0 ? `+${leg.actualFuelUplift.toFixed(1)} gal` : "-"}</td>
                      <td className="py-2 pr-3">{leg.fuelAfterUplift.toFixed(1)} gal</td>
                      <td className="py-2">{leg.cumulativeNm.toFixed(1)} NM</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="weather" className="space-y-6">

      <Card id="route-weather-summary">
        <CardHeader>
          <CardTitle>Route Weather Summary</CardTitle>
          <CardDescription>One-glance NOAA/AWC snapshot for your route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Flight category trend</div>
              <div className="text-sm font-semibold">{summaryCategoryLabel}</div>
              {hasThunderRisk && (
                <div className="text-xs text-amber-600 mt-1">Thunderstorm risk in TAFs</div>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Winds aloft coverage</div>
              <div className="text-sm font-semibold">
                {windsCount > 0 ? `${windsCount} stations` : "No winds data yet"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">NOTAMs</div>
              <div className="text-sm font-semibold">
                {notamsSummaryQuery.isError ? "Unavailable" : notamsCount > 0 ? `${notamsCount} active` : "None loaded"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("metar")}>
              METAR/TAF
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("winds")}>
              Winds Aloft {windsCount > 0 && <Badge className="ml-2" variant="secondary">{windsCount}</Badge>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("notams")}>
              NOTAMs {notamsCount > 0 && <Badge className="ml-2" variant="secondary">{notamsCount}</Badge>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("pireps")}>
              PIREPs {pirepsCount > 0 && <Badge className="ml-2" variant="secondary">{pirepsCount}</Badge>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("hazards")}>
              Convective {convectiveCount > 0 && <Badge className="ml-2" variant="secondary">{convectiveCount}</Badge>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("icing")}>
              Icing {icingCount > 0 && <Badge className="ml-2" variant="secondary">{icingCount}</Badge>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWeatherDetail("turbulence")}>
              Turbulence {turbulenceCount > 0 && <Badge className="ml-2" variant="secondary">{turbulenceCount}</Badge>}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/aviation-weather">Open Aviation Weather Hub</Link>
            </Button>
          </div>
          {(windsSummaryQuery.isLoading || pirepsQuery.isLoading || notamsSummaryQuery.isLoading) && (
            <div className="text-xs text-muted-foreground">Loading summary data...</div>
          )}
        </CardContent>
      </Card>

      <OperationalIntelligencePanel
        dep={departureResolved.trim().toUpperCase()}
        dest={destinationResolved.trim().toUpperCase()}
        route={activeFiledRoute}
        tier={tfmsTier}
        mapStyle={mapStyle}
        overlayEnabled={tfmsOverlayEnabled}
        onToggleOverlay={setTfmsOverlayEnabled}
      />
      </TabsContent>

      <TabsContent value="analysis" className="space-y-6">
      <Card id="route-analysis" className="relative">
        <CardHeader>
          <CardTitle>Route Analysis</CardTitle>
          <CardDescription>Advisory summary based on your route, altitude, and weather.</CardDescription>
        </CardHeader>
        <CardContent className={cn("space-y-4", briefingLocked && "opacity-30 pointer-events-none")}>
          {!briefingReady && (
            <div className="text-sm text-muted-foreground">
              Enter a departure and destination to generate route analysis.
            </div>
          )}
            {forecastNotice && (
              <Alert>
                <AlertDescription>{forecastNotice}</AlertDescription>
              </Alert>
            )}
            {tfrRouteQuery.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  TFR overlay is unavailable right now. Recheck before departure and verify with official sources.
                </AlertDescription>
              </Alert>
            )}
            {tfrConflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="font-semibold">TFRs intersect your planned route</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Update waypoints to avoid restricted airspace before flight.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tfrConflicts.slice(0, 4).map((feature: any) => {
                      const id = feature?.properties?.notamId || "TFR";
                      const title = feature?.properties?.title || feature?.properties?.reason || "";
                      return (
                        <Badge key={`${id}-${title}`} variant="outline">
                          {title ? `${id} • ${title}` : id}
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="mt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/tfr-map">Open TFR map</Link>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {densityAltitudeTrigger && (
              <Alert>
                <AlertDescription>
                  Density altitude may affect performance at departure. Consider running the density altitude
                  calculation before dispatch.
                </AlertDescription>
              </Alert>
            )}
            {crosswindTrigger && (
              <Alert>
                <AlertDescription>
                  Crosswind component estimated at{" "}
                  <strong>{crosswindComponent?.toFixed(0)} kt</strong>. Review crosswind limits for the selected runway.
                </AlertDescription>
              </Alert>
            )}
            {weatherData.length === 0 ? (
              <div className="text-sm text-muted-foreground">Enter airports to load weather summaries.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {weatherData.map(({ icao, data }) => {
                  const category = parseFlightCategory(data?.metar);
                  const hazards = parseWeatherHazards(data?.metar, data?.taf);
                  return (
                    <div key={icao} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{icao}</div>
                        <Badge className={flightCategoryClassName(category)}>{category}</Badge>
                      </div>
                      {hazards.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {hazards.map((hazard) => (
                            <Badge
                              key={`${icao}-${hazard.id}`}
                              variant="outline"
                              className={
                                hazard.tone === "red"
                                  ? "border-red-300 bg-red-50 text-red-800"
                                  : hazard.tone === "amber"
                                    ? "border-amber-300 bg-amber-50 text-amber-800"
                                    : "border-sky-300 bg-sky-50 text-sky-800"
                              }
                            >
                              {hazard.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {data?.metar?.rawOb || "No METAR data"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {data?.taf?.rawTAF || "No TAF data"}
                      </div>
                      {hazards.length > 0 && (
                        <div className="text-[11px] text-amber-700 mt-2">
                          {category} is category only; additional hazards are flagged above.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {routeVariationNotes.length > 0 ? (
              <Alert>
                <AlertDescription>
                  <div className="font-semibold">Potential routing adjustments</div>
                  <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                    {routeVariationNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              enrouteFindings.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  No enroute weather flags in selected waypoints/stops.
                </div>
              )
            )}
            <Alert>
              <AlertDescription>
                Route Risk: <strong>{routeRisk}</strong>. Always verify with official weather sources and review NOTAMs before flight.
              </AlertDescription>
            </Alert>
          </CardContent>
        {briefingLocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6 text-center text-white">
            <div className="space-y-3 max-w-sm">
              <div className="text-lg font-semibold">Create a free account to continue</div>
              <p className="text-sm text-white/80">
                Save this route, return to it later, and keep your planning workflow moving across devices.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild variant="secondary">
                  <Link href={withReturnTo("/register", getCurrentReturnTo())}>Create free account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={withReturnTo("/login", getCurrentReturnTo())}>Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {contextualTools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Tools for This Flight</CardTitle>
            <CardDescription>Recommended based on your route, altitude, and aircraft details.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {contextualTools.map((tool) => (
                <div key={tool.id} className="rounded-lg border p-4 space-y-2">
                  <div className="font-semibold">{tool.title}</div>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={tool.href}
                      onClick={() =>
                        trackEvent("planner_contextual_tool_open", { tool: tool.id, target: tool.href })
                      }
                    >
                      {tool.cta}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Go / No-Go Checklist</CardTitle>
          <CardDescription>Quick preflight checklist (stored locally).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {(() => {
            const checklistLabels: Record<string, string> = {
              weather: "Weather reviewed — no IFR/TS risk detected",
              fuel: "Fuel sufficient for trip + reserve",
              currency: "Pilot currency verified",
              notams: "NOTAMs acknowledged",
              tfr: "No TFR conflicts on route",
              fuelSufficient: "Fuel on board ≥ fuel required",
            };
            return (Object.keys(checklistDefaults) as Array<keyof typeof checklistDefaults>).map((key) => {
              const isAutoSatisfied = autoChecklist[key as keyof typeof autoChecklist];
              const isChecked = checklist[key as keyof typeof checklist] || isAutoSatisfied;
              return (
                <label key={key} className="flex items-center gap-2">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => setChecklist({ ...checklist, [key]: Boolean(checked) })}
                  />
                  <span>{checklistLabels[key] || key}</span>
                  {isAutoSatisfied && !checklist[key as keyof typeof checklist] && (
                    <span className="text-xs text-green-700/80">(auto-checked — click to override)</span>
                  )}
                </label>
              );
            });
          })()}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="file" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Flight Plan Summary &amp; Filing</CardTitle>
          <CardDescription>
            Review the current packet, validate it against Leidos, and run filing actions for the plan you are actively editing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Full Route Preview</div>
              <div>{routePreviewFull || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Filed Enroute String</div>
              <div>{activeFiledRoute || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated Time</div>
              <div>{eteHours ? `${Math.round(eteHours * 60)} min` : "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Alternate</div>
              <div>{form.alternate || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Fuel Required</div>
              <div>{totalFuel ? `${totalFuel.toFixed(1)} gal` : "-"}</div>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">Filing Identity</div>
                  <div className="text-xs text-muted-foreground">
                    These are the core ICAO-style details Leidos expects for the aircraft and pilot.
                  </div>
                </div>
                {selectedProfileHasFilingDefaults && (
                  <Button type="button" size="sm" variant="outline" onClick={applyAircraftFilingDefaults}>
                    Apply aircraft defaults
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Flight Rules</Label>
                  <Select
                    value={filingDraft.flightRules}
                    onValueChange={(value) => setFilingDraft((current) => ({ ...current, flightRules: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VFR">VFR</SelectItem>
                      <SelectItem value="IFR">IFR</SelectItem>
                      <SelectItem value="DVFR">DVFR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aircraft ID / Tail</Label>
                  <Input
                    value={filingDraft.aircraftId}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, aircraftId: e.target.value.toUpperCase() }))}
                    placeholder="N123RS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equipment</Label>
                  <Input
                    value={filingDraft.equipment}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, equipment: e.target.value.toUpperCase() }))}
                    placeholder="S/C"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Souls On Board</Label>
                  <Input
                    value={filingDraft.soulsOnBoard}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, soulsOnBoard: e.target.value }))}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Aircraft Color</Label>
                  <Input
                    value={filingDraft.aircraftColor}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, aircraftColor: e.target.value }))}
                    placeholder="White / Blue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PIC Name</Label>
                  <Input
                    value={filingDraft.pilotName}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, pilotName: e.target.value }))}
                    placeholder="Pilot name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wake Turbulence</Label>
                  <Input
                    value={filingDraft.wakeTurbulence}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, wakeTurbulence: e.target.value.toUpperCase() }))}
                    placeholder="MEDIUM"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type Of Flight</Label>
                  <Input
                    value={filingDraft.typeOfFlight}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, typeOfFlight: e.target.value.toUpperCase() }))}
                    placeholder="G"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Surveillance Equipment</Label>
                  <Input
                    value={filingDraft.surveillanceEquipment}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, surveillanceEquipment: e.target.value.toUpperCase() }))}
                    placeholder="N"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Other ICAO Info</Label>
                  <Input
                    value={filingDraft.otherInfo}
                    onChange={(e) => setFilingDraft((current) => ({ ...current, otherInfo: e.target.value.toUpperCase() }))}
                    placeholder="PBN/... NAV/... DAT/... SUR/..."
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <div className="font-semibold">Operational Packet</div>
                <div className="text-xs text-muted-foreground">
                  Review the values that are already being generated from your route, fuel, and performance setup.
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Cruise / Altitude</div>
                  <div className="font-semibold">{Math.round(planningCruise)} KTAS at {plannedAltitude || "-"} ft</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Fuel on board / endurance</div>
                  <div className="font-semibold">{fuelAvailableGallons.toFixed(1)} gal / {formatMinutesLabel(enduranceMinutes)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Estimated Enroute</div>
                  <div className="font-semibold">{eteHours ? `${Math.round(eteHours * 60)} min` : "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Filing status</div>
                  <div className="font-semibold">
                    {hasCurrentSavedPlan ? currentSavedPlanStatus : (filingPreviewMutation.isPending ? "Validating handoff..." : "Save plan to enable lifecycle actions")}
                  </div>
                </div>
              </div>
              {selectedProfile && (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Using saved profile <span className="font-medium text-foreground">{selectedProfile.name}</span>
                  {selectedProfileHasFilingDefaults ? " with filing defaults ready to apply." : "."}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Filing Remarks</Label>
            <Textarea
              value={filingDraft.remarks}
              onChange={(e) => setFilingDraft((current) => ({ ...current, remarks: e.target.value }))}
              rows={2}
              placeholder="Route notes or filing remarks"
            />
          </div>
          <Alert>
            <AlertDescription>
              Filing guidance: validate the packet first, then use the filing actions below on the saved plan you are editing. RSF now sends Leidos actions live when the lab/production environment is enabled and fully configured.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={copyFilingPacket}>
              Copy filing packet
            </Button>
            <Button type="button" variant="outline" onClick={openFlightServiceHandoff} disabled={filingPreviewMutation.isPending}>
              {filingPreviewMutation.isPending ? "Building preview..." : "Validate filing packet"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <a href="https://www.1800wxbrief.com/" target="_blank" rel="noopener noreferrer">
                Open Flight Service
              </a>
            </Button>
          </div>
          {hasCurrentSavedPlan ? (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">Current Saved Plan Actions</div>
                  <div className="text-xs text-muted-foreground">
                    Editing <span className="font-medium text-foreground">{currentSavedPlan?.title || `${currentSavedPlan?.departure} to ${currentSavedPlan?.destination}`}</span>. Use these actions for the active plan instead of hunting through the saved list below.
                  </div>
                </div>
                <Badge variant="outline">{currentSavedPlanStatus}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "file" })}
                  disabled={filingActionMutation.isPending}
                >
                  File
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "amend" })}
                  disabled={filingActionMutation.isPending}
                >
                  Amend
                </Button>
                {currentSavedPlanFlightRules === "VFR" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "activate" })}
                      disabled={filingActionMutation.isPending}
                    >
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "close" })}
                      disabled={filingActionMutation.isPending}
                    >
                      Close
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "cancel" })}
                  disabled={filingActionMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Save this plan once to enable Leidos filing lifecycle actions from this tab. The packet preview works before save, but file/amend/activate/cancel/close actions require a saved plan record.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Save Flight Plan</CardTitle>
          <CardDescription>
            Save one plan with a free account. After you fly, log it to update currency and history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGuest && (
            <Alert>
              <AlertDescription>
                Create a free RSF account to save your first flight plan, come back to it later, and keep building toward a cleaner logbook and currency workflow.
              </AlertDescription>
            </Alert>
          )}
          {isGuest && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link
                  href={withReturnTo("/register", getCurrentReturnTo())}
                  onClick={() => trackEvent("cta_click", { label: "planner_save_register", target: "/register" })}
                >
                  Create Free Account
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link
                  href={withReturnTo("/login", getCurrentReturnTo())}
                  onClick={() => trackEvent("cta_click", { label: "planner_save_sign_in", target: "/login" })}
                >
                  Sign In
                </Link>
              </Button>
            </div>
          )}
          {planLimitReached && (
            <Alert>
              <AlertDescription>
                Free accounts can save one active plan. Upgrade to RSF Pro for unlimited saved plans, aircraft profiles, and planning history.
              </AlertDescription>
            </Alert>
          )}
          {isFree && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-sm font-semibold text-emerald-900">
                Want unlimited saved plans and a full planning workflow?
              </div>
              <div className="mt-1 text-xs text-emerald-800">
                Start a 14-day Pro trial for unlimited saved plans, aircraft profiles, and linked logbook workflow.
              </div>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100">
                  <Link
                    href={withSourceParam("/logbook/pro", "/flight-planner")}
                    onClick={() => {
                      trackEvent("cta_click", { label: "planner_save_start_trial", target: "/logbook/pro" });
                      trackEvent("subscription_cta_click", { source_page: "/flight-planner", target: "/logbook/pro", context: "planner_save_banner" });
                    }}
                  >
                    Start 14-day Pro trial
                  </Link>
                </Button>
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Cross-country KAUS -> KDAL"
              />
            </div>
            <div className="space-y-2">
              <Label>Aircraft Type (optional)</Label>
              <Input
                value={form.aircraftType}
                onChange={(e) => setForm({ ...form, aircraftType: e.target.value })}
                placeholder={selectedProfile?.name || ""}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                if (isGuest) {
                  trackEvent("cta_click", { label: "planner_save_requires_auth", target: "/register" });
                }
                runWithAuth("save_flight_plan", async () => {
                  await savePlanActionRef.current();
                });
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
            >
              {editingPlan ? "Save Changes" : "Save Flight Plan"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (isGuest) {
                  trackEvent("cta_click", { label: "planner_logbook_requires_auth", target: "/register" });
                } else if (isFree) {
                  trackEvent("cta_click", { label: "planner_logbook_upgrade_interest", target: "/logbook/pro" });
                }
                runWithAuth("sync_logbook_entry", async () => {
                  await sendToLogbookActionRef.current();
                });
              }}
            >
              Log this flight (after you fly)
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Clear Form
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Plans</CardTitle>
          <CardDescription>Access saved routes and fuel notes. Free accounts keep one plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPro && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <div>Free accounts keep one active plan. RSF Pro unlocks unlimited storage and per-leg breakdowns.</div>
              {isFree && (
                <div className="mt-3">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={withSourceParam("/logbook/pro", "/flight-planner")}
                      onClick={() => {
                        trackEvent("cta_click", { label: "planner_saved_plans_start_trial", target: "/logbook/pro" });
                        trackEvent("subscription_cta_click", { source_page: "/flight-planner", target: "/logbook/pro", context: "planner_saved_plans" });
                      }}
                    >
                      Start 14-day Pro trial
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
          {plansLoading ? (
            <div className="text-sm text-muted-foreground">Loading flight plans...</div>
          ) : savedPlans.length === 0 ? (
            <div className="text-sm text-muted-foreground">No flight plans saved yet.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={resetForm}>
                  Start new plan
                </Button>
                {editingPlan && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Leave saved plan
                  </Button>
                )}
              </div>
              {savedPlans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-lg font-semibold">{plan.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {plan.departure} to {plan.destination}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{filingStatusLabel(plan.filingStatus)}</Badge>
                    {plan.filingPendingAction && (
                      <Badge variant="secondary">Pending {plan.filingPendingAction}</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditingPlan(plan)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(plan.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Route</div>
                    <div>{plan.route || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Departure</div>
                    <div>{plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt).toLocaleString() : "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Arrival</div>
                    <div>{plan.plannedArrivalAt ? new Date(plan.plannedArrivalAt).toLocaleString() : "-"}</div>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Flight rules</div>
                    <div>{plan.filingFlightRules || "VFR"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Provider</div>
                    <div>{plan.filingProvider || "Leidos Flight Service"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Live filing</div>
                    <div>{plan.filingIsLive ? "Enabled" : "Disabled"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last sync</div>
                    <div>{plan.filingLastProviderSyncAt ? new Date(plan.filingLastProviderSyncAt).toLocaleString() : "-"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "file" })}
                    disabled={filingActionMutation.isPending}
                  >
                    File
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "amend" })}
                    disabled={filingActionMutation.isPending}
                  >
                    Amend
                  </Button>
                  {(plan.filingFlightRules || "VFR").toUpperCase() === "VFR" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "activate" })}
                        disabled={filingActionMutation.isPending}
                      >
                        Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "close" })}
                        disabled={filingActionMutation.isPending}
                      >
                        Close
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "cancel" })}
                    disabled={filingActionMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Filing requests submit live when the Leidos environment is fully configured. If a required live path is still missing, RSF keeps the request staged instead of dropping it.
                </div>
                {Array.isArray(plan.filingActionHistory) && plan.filingActionHistory.length > 0 && (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-2 font-semibold">Filing history</div>
                    <div className="space-y-2">
                      {[...plan.filingActionHistory]
                        .slice()
                        .reverse()
                        .map((entry: any, index: number) => (
                          <div key={`${entry?.action || "entry"}-${entry?.stagedAt || index}`} className="rounded-md border bg-background/80 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium capitalize">{String(entry?.action || "Unknown action")}</div>
                              <div className="text-xs text-muted-foreground">
                                {entry?.stagedAt ? new Date(entry.stagedAt).toLocaleString() : "Unknown time"}
                              </div>
                            </div>
                            {entry?.message && (
                              <div className="mt-1 text-sm text-muted-foreground">{String(entry.message)}</div>
                            )}
                            {Array.isArray(entry?.warnings) && entry.warnings.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {entry.warnings.map((warning: string) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {plan.notes && (
                  <div className="text-sm text-muted-foreground">Notes: {plan.notes}</div>
                )}
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>
      </Tabs>
        </div>
      <div className="space-y-4">
        <Card id="planner-route-map" className="border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle>Route Map</CardTitle>
            <CardDescription>Live route view while you build, brief, and file.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <a
                href="/adsb-receiver-help"
                className="text-blue-700 hover:underline"
                onClick={() => trackEvent("adsb_help_click", { target: "/adsb-receiver-help" })}
              >
                How to connect your ADS-B receiver
              </a>
              <span className="text-slate-600">
                RSF Synthetic Vision Lab <span className="font-medium">(coming soon)</span>
              </span>
            </div>
            <div className="mb-3 rounded-lg border border-slate-300 bg-slate-100 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-300 text-slate-800 hover:bg-slate-200"
                  onClick={() => setMapRenderVersion((value) => value + 1)}
                >
                  Fit route
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-300 text-slate-800 hover:bg-slate-200"
                  onClick={() => {
                    setActiveTab("weather");
                    openWeatherDetail("metar");
                  }}
                >
                  METAR/TAF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-300 text-slate-800 hover:bg-slate-200"
                  onClick={() => {
                    setActiveTab("weather");
                    openWeatherDetail("notams");
                  }}
                >
                  NOTAMs
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-300 text-slate-800 hover:bg-slate-200"
                  onClick={() => setShowApproachOffer(true)}
                >
                  Plates
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-300 text-slate-800 hover:bg-slate-200"
                  onClick={() => setShowAtcStrip((value) => !value)}
                >
                  {showAtcStrip ? "Hide" : "Show"} nav strip
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 border-slate-300 text-slate-800 hover:bg-slate-200" asChild>
                  <a href="/tfr-map" target="_blank" rel="noopener noreferrer">Full TFR map</a>
                </Button>
              </div>
            </div>
            {routePoints.length > 1 && (
              <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/80 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    ATC Leg Strip
                  </div>
                  <button
                    type="button"
                    className="text-xs text-blue-300 hover:underline"
                    onClick={() => setShowAtcStrip((value) => !value)}
                  >
                    {showAtcStrip ? "Collapse" : "Expand"}
                  </button>
                </div>
                {showAtcStrip ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {legNavRows.length === 0 ? (
                      <div className="text-xs text-slate-300">No route legs yet.</div>
                    ) : (
                      legNavRows.map((leg) => {
                        const risk = legRiskByKey.get(leg.key);
                        const riskContainerClass =
                          risk?.level === "alert"
                            ? "border-red-500/80 bg-red-950/30"
                            : risk?.level === "caution"
                              ? "border-amber-500/80 bg-amber-950/20"
                              : "border-emerald-500/60 bg-emerald-950/20";
                        return (
                          <div
                            key={`strip-${leg.key}`}
                            className={cn("min-w-[208px] rounded-md border px-2 py-1.5 text-xs text-slate-100", riskContainerClass)}
                          >
                            <div className="font-semibold">{leg.from} to {leg.to}</div>
                            <div className="text-slate-300">
                              {String(leg.course).padStart(3, "0")} deg · {leg.distanceNm.toFixed(1)} NM
                            </div>
                            <div className="text-slate-400">
                              ETA {leg.legEtaUtc ? `${leg.legEtaUtc.toISOString().slice(11, 16)}Z` : "--"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {risk?.hasTfrConflict && (
                                <span className="rounded-full border border-red-400/70 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-200">
                                  TFR
                                </span>
                              )}
                              {risk?.hasThunderRisk && (
                                <span className="rounded-full border border-red-400/70 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-200">
                                  TS
                                </span>
                              )}
                              {risk?.hasIfrRisk && (
                                <span className="rounded-full border border-amber-400/70 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                                  IFR
                                </span>
                              )}
                              {risk?.hasFuelDeficit && (
                                <span className="rounded-full border border-red-400/70 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-200">
                                  Fuel Deficit
                                </span>
                              )}
                              {!risk?.hasFuelDeficit && risk?.hasFuelReserveRisk && (
                                <span className="rounded-full border border-amber-400/70 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                                  Low Reserve
                                </span>
                              )}
                              {!risk?.hasTfrConflict && !risk?.hasThunderRisk && !risk?.hasIfrRisk && !risk?.hasFuelDeficit && !risk?.hasFuelReserveRisk && (
                                <span className="rounded-full border border-emerald-400/70 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                                  Normal
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-300">
                              Rem fuel {risk ? `${risk.remainingFuelGallons.toFixed(1)} gal` : "--"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300">Collapsed. Expand to see per-leg track, distance, and ETA.</div>
                )}
              </div>
            )}
            {routeIcaos.length === 0 ? (
              <div className="text-sm text-muted-foreground">Enter a departure and destination to preview the route.</div>
            ) : routePoints.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Waiting for airport coordinates... Waypoints are optional. Check ICAO codes if this takes more than a few seconds.
              </div>
            ) : (
              mapStyle === "globe" ? (
                <Suspense fallback={<div className="h-[380px] rounded-xl border bg-muted animate-pulse" />}>
                  <CesiumGlobe
                    key={`globe-${mapRenderVersion}`}
                    points={routePoints.map((p) => ({ icao: p.icao, lat: p.lat, lon: p.lon }))}
                    tfmsOverlayEnabled={tfmsTier === "pro_plus" && tfmsOverlayEnabled}
                  />
                </Suspense>
              ) : (
                <PlannerMap
                  key={`map-${mapStyle}-${mapRenderVersion}`}
                  points={routePoints.map((p) => ({ icao: p.icao, lat: p.lat, lon: p.lon, label: p.label ?? null }))}
                  mapStyle={mapStyle}
                  plannedAltitudeFt={plannedAltitudeValue}
                  windsAltitudeFt={windsAltitudeFt}
                />
              )
            )}
            {airportErrors.length > 0 && (
              <div className="mt-3 text-xs text-destructive">
                Airport lookup failed for: {airportErrors.map((item) => item.icao).join(", ")}. Check ICAO codes.
              </div>
            )}
            {routeIcaos.length > 0 && routePoints.length === 1 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Route map updates as additional points resolve. Waypoints and planned stops are optional.
              </div>
            )}
            {airportErrors.length === 0 && missingIcaos.length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Waiting on coordinates for: {missingIcaos.join(", ")}.
              </div>
            )}
            {airportErrors.length === 0 && missingIcaos.length === 0 && unresolvedIcaos.length > 0 && (
              <div className="mt-3 text-xs text-amber-700">
                Airport reference details are unavailable for: {unresolvedIcaos.join(", ")}. The planner will keep the route, but map labels and airport details may be limited for those helper codes.
              </div>
            )}
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">Map style</div>
              <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-700 bg-slate-900/70 p-1">
                {MAP_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMapStyle(option.value)}
                    className={cn(
                      "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                      mapStyle === option.value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-300 hover:bg-slate-800"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {mapStyle === "winds" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Winds altitude</span>
                  <Select value={windsAltitudeChoice} onValueChange={setWindsAltitudeChoice}>
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[1001]">
                      <SelectItem value="planned">Use planned altitude</SelectItem>
                      <SelectItem value="3000">3,000 ft</SelectItem>
                      <SelectItem value="6000">6,000 ft</SelectItem>
                      <SelectItem value="9000">9,000 ft</SelectItem>
                      <SelectItem value="12000">12,000 ft</SelectItem>
                      <SelectItem value="18000">18,000 ft</SelectItem>
                      <SelectItem value="24000">24,000 ft</SelectItem>
                      <SelectItem value="30000">30,000 ft</SelectItem>
                      <SelectItem value="34000">34,000 ft</SelectItem>
                      <SelectItem value="39000">39,000 ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {mapStyle === "sectional" && (
              <div className="text-xs text-muted-foreground mt-2">
                Sectional tiles appear from zoom 4+; zoom in for FAA chart detail.
              </div>
            )}
            {(mapStyle === "radar" || mapStyle === "winds" || mapStyle === "clouds") && (
              <div className="text-xs text-muted-foreground mt-2">
                Weather layers are for situational awareness only. Radar shows precip; clouds are satellite IR.
                Winds aloft uses NOAA AWC data near your planned altitude. Verify with official sources.
              </div>
            )}
            {mapStyle === "globe" && (
              <div className="text-xs text-muted-foreground mt-2">
                3D globe view uses CesiumJS. Weather overlays are available in 2D for now.
              </div>
            )}
            {mapStyle === "winds" && (
              <div className="text-xs text-muted-foreground mt-1">
                Wind arrows point in the direction the wind is blowing from; size scales with speed.
              </div>
            )}
            {!isAuthenticated && routePoints.length > 0 && (
              <Alert className="mt-3">
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>Save this route and keep repeat planning faster with a free account.</span>
                  <Button asChild size="sm">
                    <Link href={withReturnTo("/register", getCurrentReturnTo())}>Create free account</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={withReturnTo("/login", getCurrentReturnTo())}>Sign in</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
      </div>

      <Dialog open={showApproachOffer} onOpenChange={setShowApproachOffer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approach Plates for This Route</DialogTitle>
            <DialogDescription>
              Your selected route airports are ready. Open plates for each stop before you file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {approachOfferAirports.map((icao) => (
                <Button
                  key={`plate-offer-${icao}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openApproachPlatesForIcao(icao)}
                >
                  {icao}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowApproachOffer(false)}>
                Not now
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const firstIcao = approachOfferAirports[0];
                  if (firstIcao) {
                    openApproachPlatesForIcao(firstIcao);
                  }
                  setShowApproachOffer(false);
                }}
              >
                Open first airport
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(activeWeatherDetail)} onOpenChange={(open) => !open && setActiveWeatherDetail(null)}>
        <SheetContent side="right" className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {activeWeatherDetail === "metar" && (
            <>
              <SheetHeader>
                <SheetTitle>METAR & TAF</SheetTitle>
                <SheetDescription>Latest conditions along your route.</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 text-sm">
                {weatherData.length === 0 && <div className="text-muted-foreground">No METAR/TAF data yet.</div>}
                {weatherData.map(({ icao, data }) => {
                  const category = parseFlightCategory(data?.metar);
                  const wind = parseMetarWind(data?.metar);
                  const tempC = parseMetarTempC(data?.metar);
                  const hazards = parseWeatherHazards(data?.metar, data?.taf);
                  return (
                    <div key={icao} className="rounded-lg border p-3">
                      <div className="font-semibold">{icao}</div>
                      <div className="flex flex-wrap gap-3 text-xs font-medium mt-1 mb-1">
                        <span className={cn("px-1.5 py-0.5 rounded border", flightCategoryClassName(category))}>
                          {category}
                        </span>
                        {wind && <span>{wind.direction}° @ {wind.speed}kt</span>}
                        {tempC !== null && <span>Temp {tempC}°C</span>}
                      </div>
                      {hazards.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {hazards.map((hazard) => (
                            <span
                              key={`${icao}-${hazard.id}`}
                              className={cn(
                                "px-1.5 py-0.5 rounded border text-[11px] font-medium",
                                hazard.tone === "red"
                                  ? "border-red-300 bg-red-50 text-red-800"
                                  : hazard.tone === "amber"
                                    ? "border-amber-300 bg-amber-50 text-amber-800"
                                    : "border-sky-300 bg-sky-50 text-sky-800"
                              )}
                            >
                              {hazard.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {hazards.length > 0 && (
                        <div className="text-[11px] text-amber-700 mt-2">
                          {category} reflects ceiling/visibility only; review hazards before launch.
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">{data?.metar?.rawOb || "No METAR"}</div>
                      <div className="text-xs text-muted-foreground mt-2">{data?.taf?.rawTAF || "No TAF"}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {activeWeatherDetail === "winds" && (
            <>
              <SheetHeader>
                <SheetTitle>Winds Aloft</SheetTitle>
                <SheetDescription>NOAA AWC winds/temps near your route.</SheetDescription>
              </SheetHeader>
              <div className="space-y-2 text-sm">
                {windsCount === 0 && <div className="text-muted-foreground">No winds aloft data in view.</div>}
                {windsSummaryQuery.data?.stations?.slice(0, 12).map((station: any) => (
                  <div key={`${station.stationId}-${station.lat}`} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="font-semibold">{station.icao || station.stationId}</div>
                    <div className="text-xs text-muted-foreground">
                      {station.windDir ?? "-"} deg / {station.windSpeed ?? "-"} kt
                      {station.tempC !== null ? `, ${station.tempC}C` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {activeWeatherDetail === "notams" && (
            <>
              <SheetHeader>
                <SheetTitle>NOTAMs</SheetTitle>
                <SheetDescription>Latest NOTAMs for {primaryIcao || "your route"}.</SheetDescription>
              </SheetHeader>
              <div className="space-y-2 text-sm">
                {notamsSummaryQuery.isError && (
                  <div className="text-muted-foreground">NOTAM feed unavailable.</div>
                )}
                {!notamsSummaryQuery.isError && notamsCount === 0 && (
                  <div className="text-muted-foreground">No active NOTAMs.</div>
                )}
                {notamsSummaryQuery.data?.notams?.map((notam: any) => (
                  <div key={notam.id} className="rounded-lg border p-2">
                    <div className="font-semibold">{notam.id}</div>
                    <div className="text-xs text-muted-foreground mt-1">{notam.text}</div>
                  </div>
                ))}
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">AI NOTAM translator</div>
                      <div className="text-xs text-muted-foreground">
                        Translate raw NOTAM text into plain-English relevance and legality impacts.
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAiNotamTranslator((current) => !current)}
                      className="w-full sm:w-auto"
                    >
                      {showAiNotamTranslator ? "Hide AI translator" : "Open AI translator"}
                    </Button>
                  </div>
                  {showAiNotamTranslator && (
                    <div className="mt-3">
                      <NotamTranslator
                        notams={notamsSummaryQuery.data?.notams?.map((notam: any) => notam.text ?? notam.notamTxt ?? notam.raw ?? "").filter(Boolean).join("\n\n") ?? ""}
                        airport={primaryIcao}
                        route={routePreviewFull}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {activeWeatherDetail === "pireps" && (
            <>
              <SheetHeader>
                <SheetTitle>PIREPs</SheetTitle>
                <SheetDescription>Recent pilot reports near {primaryIcao || "your route"}.</SheetDescription>
              </SheetHeader>
              <div className="space-y-2 text-sm">
                {pirepsCount === 0 && <div className="text-muted-foreground">No recent PIREPs in range.</div>}
                {pirepsQuery.data?.reports?.slice(0, 12).map((report: any, index: number) => (
                  <div key={`${report.rawOb || report.id || index}`} className="rounded-lg border p-2">
                    <div className="font-semibold">{report.rawOb || "PIREP"}</div>
                    {report.obsTime && <div className="text-xs text-muted-foreground mt-1">{report.obsTime}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
          {activeWeatherDetail === "hazards" && (
            <>
              <SheetHeader>
                <SheetTitle>Convective Hazards</SheetTitle>
                <SheetDescription>Domestic SIGMETs, G-AIRMETs, and TCF.</SheetDescription>
              </SheetHeader>
              {convectiveSummary.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>{convectiveSummary.warnings.join(" ")}</AlertDescription>
                </Alert>
              )}
              <div className="text-sm text-muted-foreground">
                {convectiveCount > 0 ? `${convectiveCount} hazard items available.` : "No convective hazards returned."}
                {convectiveSummary.tcfCount > 0 && ` TCF features: ${convectiveSummary.tcfCount}.`}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {convectiveSummary.items.length === 0 && convectiveSummary.tcfCount === 0 ? (
                  <div className="text-muted-foreground">No convective hazards returned.</div>
                ) : (
                  convectiveSummary.items.slice(0, 12).map((item, index) => (
                    <div key={`${item.source}-${item.hazard}-${index}`} className="rounded-lg border p-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{item.hazard}</div>
                        <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                      </div>
                      {item.dueTo && <div className="text-xs text-muted-foreground mt-1">Due to {item.dueTo}</div>}
                      {(item.validFrom || item.validTo) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Valid {item.validFrom || "-"} to {item.validTo || "-"}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          {activeWeatherDetail === "icing" && (
            <>
              <SheetHeader>
                <SheetTitle>Icing Guidance</SheetTitle>
                <SheetDescription>AWC icing signals (stub if not available).</SheetDescription>
              </SheetHeader>
              {icingSummary.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>{icingSummary.warnings.join(" ")}</AlertDescription>
                </Alert>
              )}
              <div className="mt-3 space-y-2 text-sm">
                {icingSummary.items.length === 0 ? (
                  <div className="text-muted-foreground">No icing guidance returned yet.</div>
                ) : (
                  icingSummary.items.slice(0, 12).map((item, index) => (
                    <div key={`${item.source}-${item.hazard}-${index}`} className="rounded-lg border p-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{item.hazard}</div>
                        <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                      </div>
                      {item.dueTo && <div className="text-xs text-muted-foreground mt-1">Due to {item.dueTo}</div>}
                      {(item.validFrom || item.validTo) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Valid {item.validFrom || "-"} to {item.validTo || "-"}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          {activeWeatherDetail === "turbulence" && (
            <>
              <SheetHeader>
                <SheetTitle>Turbulence Guidance</SheetTitle>
                <SheetDescription>AWC turbulence signals (stub if not available).</SheetDescription>
              </SheetHeader>
              {turbulenceSummary.warnings.length > 0 && (
                <Alert>
                  <AlertDescription>{turbulenceSummary.warnings.join(" ")}</AlertDescription>
                </Alert>
              )}
              <div className="mt-3 space-y-2 text-sm">
                {turbulenceSummary.items.length === 0 ? (
                  <div className="text-muted-foreground">No turbulence guidance returned yet.</div>
                ) : (
                  turbulenceSummary.items.slice(0, 12).map((item, index) => (
                    <div key={`${item.source}-${item.hazard}-${index}`} className="rounded-lg border p-2">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{item.hazard}</div>
                        <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                      </div>
                      {item.dueTo && <div className="text-xs text-muted-foreground mt-1">Due to {item.dueTo}</div>}
                      {(item.validFrom || item.validTo) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Valid {item.validFrom || "-"} to {item.validTo || "-"}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={showFilingPayload}
        onOpenChange={(open) => {
          setShowFilingPayload(open);
          if (!open) setFilingPreview(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auto-file Handoff Preview</DialogTitle>
            <DialogDescription>
              RSF validates and stages the filing packet, but official filing still completes through Flight Service until live handoff is enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {filingPreview ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Provider</div>
                    <div className="font-semibold">{filingPreview.provider}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Route type</div>
                    <div className="font-semibold">{filingPreview.routeType}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Readiness</div>
                    <div className="font-semibold">
                      {filingPreview.readyToFile ? "Validated for handoff" : "Needs review"}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Live filing</div>
                    <div className="font-semibold">{filingPreview.live ? "Available" : "Staged only"}</div>
                  </div>
                </div>
                {filingPreview.errors.length > 0 && (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">
                    <div className="font-semibold">Required fixes before filing</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {filingPreview.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {filingPreview.warnings.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <div className="font-semibold">Items to review before filing</div>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {filingPreview.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="rounded-lg border p-3">
                  <div className="font-semibold">Next steps</div>
                  <ol className="mt-2 list-decimal pl-5 space-y-1 text-muted-foreground">
                    {filingPreview.nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="mb-2 font-semibold">Staged filing payload</div>
                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(filingPreview.packet, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={copyFilingPacket}>
                    Copy filing packet
                  </Button>
                  <Button type="button" disabled>
                    {filingPreview.live ? "Use saved-plan actions to file live" : "Live filing not currently available"}
                  </Button>
                  <Button type="button" variant="ghost" asChild>
                    <a href={filingPreview.providerUrl} target="_blank" rel="noopener noreferrer">
                      Continue with Flight Service
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">Building filing preview...</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {scratchPadOpen && (
        <div
          className="fixed inset-0 z-[2000] flex flex-col bg-zinc-950 text-white"
          role="dialog"
          aria-modal="true"
          aria-label="IFR Clearance Scratch Pad"
        >
          <Tabs
            value={scratchPadMode}
            onValueChange={(value) => setScratchPadMode(value as "ink" | "craft")}
            className="flex h-full flex-col"
          >
            <div className="border-b border-zinc-700 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold tracking-tight">
                      ✏ IFR Clearance Scratch Pad
                    </span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono tracking-widest text-zinc-400">
                      INK + CRAFT
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    Ink Pad is built for finger-speed readback. Switch to CRAFT fields when you need structured notes.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => setScratchInk((current) => current.slice(0, -1))}
                    disabled={!scratchPadHasInk}
                  >
                    Undo ink
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      if (window.confirm("Clear all scratch pad notes and ink?")) {
                        setScratchPad(SCRATCH_PAD_DEFAULT);
                        setScratchInk([]);
                      }
                    }}
                  >
                    Clear all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => setScratchPadOpen(false)}
                  >
                    Close <span className="ml-1 opacity-50">Esc</span>
                  </Button>
                </div>
              </div>
              <TabsList className="mt-3 grid w-full max-w-[320px] grid-cols-2 bg-zinc-900">
                <TabsTrigger value="ink">Ink Pad</TabsTrigger>
                <TabsTrigger value="craft">CRAFT Fields</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <TabsContent value="ink" className="mt-0 h-full focus-visible:outline-none">
                <div className="mx-auto max-w-5xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Writing surface</div>
                      <div className="text-xs text-zinc-400">
                        Choose the pad that matches how you copy clearance notes.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "ruled" as ScratchPadInkLayout, label: "Ruled" },
                        { value: "blank" as ScratchPadInkLayout, label: "Blank" },
                        { value: "craft" as ScratchPadInkLayout, label: "CRAFT grid" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={scratchInkLayout === option.value ? "default" : "outline"}
                          className={
                            scratchInkLayout === option.value
                              ? ""
                              : "border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                          }
                          onClick={() => setScratchInkLayout(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <ScratchPadInkBoard
                      strokes={scratchInk}
                      layout={scratchInkLayout}
                      onChange={setScratchInk}
                    />
                    <div className="space-y-3">
                      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
                        <div className="text-sm font-semibold text-white">Fast IFR copy flow</div>
                        <div className="mt-2 space-y-2 text-xs text-zinc-400">
                          <div>1. Write the readback freehand while ATC is talking.</div>
                          <div>2. Use Undo if you miss a stroke.</div>
                          <div>3. Use Ruled, Blank, or CRAFT grid depending on the clearance.</div>
                          <div>4. Switch to CRAFT fields if you want a cleaner final copy.</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
                        <div className="text-sm font-semibold text-white">Current plan prefill</div>
                        <div className="mt-2 space-y-1 text-xs text-zinc-400">
                          <div>Departure: <span className="font-mono text-zinc-200">{form.departure || "-"}</span></div>
                          <div>Destination: <span className="font-mono text-zinc-200">{form.destination || "-"}</span></div>
                          <div>Altitude: <span className="font-mono text-zinc-200">{plannedAltitudeFt ? `${plannedAltitudeFt} ft` : "-"}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="craft" className="mt-0 focus-visible:outline-none">
                <div className="mx-auto max-w-3xl space-y-3">
                  <ScratchField
                    label="C — Clearance Limit"
                    hint="Usually destination airport or fix"
                    value={scratchPad.clearanceLimit}
                    onChange={(v) => setScratchField("clearanceLimit", v)}
                  />

                  <ScratchField
                    label="R — Route"
                    hint="Departure procedure, airways, fixes"
                    value={scratchPad.route}
                    onChange={(v) => setScratchField("route", v)}
                    multiline
                  />

                  <ScratchField
                    label="A — Altitude"
                    hint="Initial altitude / expect altitude / time"
                    value={scratchPad.altitude}
                    onChange={(v) => setScratchField("altitude", v)}
                  />

                  <ScratchField
                    label="F — Frequency"
                    hint="Departure control frequency"
                    value={scratchPad.frequency}
                    onChange={(v) => setScratchField("frequency", v)}
                  />

                  <ScratchField
                    label="T — Transponder / Squawk"
                    hint="4-digit squawk code"
                    value={scratchPad.squawk}
                    onChange={(v) => setScratchField("squawk", v)}
                  />

                  <div className="border-t border-zinc-700 pt-3">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      Additional
                    </div>
                  </div>

                  <ScratchField
                    label="Departure Airport"
                    hint="ICAO identifier"
                    value={scratchPad.departure}
                    onChange={(v) => setScratchField("departure", v)}
                  />

                  <ScratchField
                    label="Void / Release Time"
                    hint="IFR void time if clearance on ground"
                    value={scratchPad.void}
                    onChange={(v) => setScratchField("void", v)}
                  />

                  <ScratchField
                    label="Notes"
                    hint="Anything else — hold instructions, restrictions, remarks"
                    value={scratchPad.notes}
                    onChange={(v) => setScratchField("notes", v)}
                    multiline
                    tall
                  />
                </div>
              </TabsContent>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-700 px-4 py-2 text-xs text-zinc-500">
              <span>Content auto-saved - Escape to close</span>
              <span className="font-mono">
                {scratchPadHasContent
                  ? "● Notes present"
                  : "○ Empty"}
              </span>
            </div>
          </Tabs>
        </div>
      )}
    </PageShell>
  );
}
