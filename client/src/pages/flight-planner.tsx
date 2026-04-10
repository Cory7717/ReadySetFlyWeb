
import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { trackEvent } from "@/lib/analytics";
import { getCurrentReturnTo, withReturnTo, withSourceParam } from "@/lib/returnTo";
import { runWithAuth } from "@/utils/authGate";
import { getAnonFlightPlanFileCount, recordAnonFlightPlanFile } from "@/utils/anonUsage";
import { buildLegs, sumDistance, distanceNm, type AirportPoint } from "@/lib/flightPlanner";
import { cn } from "@/lib/utils";
import { parseFlightCategory as getFlightCategory, parseWeatherHazards } from "@/lib/weatherInterpretation";
import {
  RSF_PLANNER_MAP_STYLE_OPTIONS,
  type RsfPlannerMapStyle,
} from "@/map/rsfMapSpec";
import type { FlightPlan } from "@shared/schema";
import {
  analyzeFiledRoute,
  buildFiledRouteStructure,
  filedRouteTokenKindLabel,
  normalizeRouteText,
  parseAirportWaypoints,
  type FiledRouteStructureSegment,
  type FiledRouteToken,
  type FiledRouteTokenKind,
} from "@shared/flight-plan-route";
import { extractFilingVersionStamp } from "@shared/flight-plan-filing";
import { isFlightPlanCloseOverdue } from "@shared/flight-plan-lifecycle";
import { UpgradePromptDialog } from "@/components/upgrade/UpgradePromptDialog";
import OperationalIntelligencePanel, { type TfmsTier } from "@/components/flight-planner/OperationalIntelligencePanel";
import { OpenInAppBanner } from "@/components/OpenInAppBanner";
import { PageShell } from "@/components/layout/PageShell";
import { RsfModeToggle } from "@/components/map/RsfModeToggle";
import Planner2DMapSurface from "@/components/flight-planner/Planner2DMapSurface";
import type { PlannerLegHealthMarker, PlannerPoint } from "@/components/flight-planner/plannerMapTypes";
import { PressDemoBanner, PressDemoSpotlight, type PressDemoStep, usePressDemo } from "@/components/press/PressDemo";
import NotamTranslator from "@/components/ai/NotamTranslator";
import logoImage from "@assets/RSFOpaqueLogo_1761494760586.png";

const CesiumGlobe = lazy(() => import("@/components/flight-planner/CesiumGlobe"));

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const CONTROLLED_AIRPORTS = new Set([
  "KATL", "KDFW", "KDEN", "KORD", "KLAX", "KJFK", "KSFO", "KSEA", "KLAS", "KPHX",
  "KCLT", "KIAH", "KMIA", "KBOS", "KMSP", "KDCA", "KIAD", "KEWR", "KLGA", "KPDX",
  "KPHL", "KDTW", "KSTL", "KMDW", "KSAN", "KTPA", "KAUS", "KDAL", "KHOU",
]);

const FLIGHT_PLANNER_PRESS_STEPS: PressDemoStep[] = [
  {
    id: "route-setup",
    title: "Build the route quickly",
    body: "Show airports, aircraft setup, and helper routing so the planner feels fast and approachable on camera.",
  },
  {
    id: "distance-performance",
    title: "Walk through performance and fuel",
    body: "Highlight reserve fuel, altitude, fuel on board, uplifts, and leg health in one operational planning view.",
  },
  {
    id: "route-map",
    title: "Show the live route map",
    body: "Use the map to show weather layers, terrain cueing, and overall route awareness while planning.",
  },
  {
    id: "route-analysis",
    title: "Review route analysis",
    body: "Highlight terrain, weather, airspace, and filing-readiness checks before the pilot submits anything.",
  },
  {
    id: "filing",
    title: "Finish with filing and saved plans",
    body: "Close with packet review, lifecycle actions, and filing summary download so the workflow feels complete.",
  },
];

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

const summarizePlannerError = (value: unknown) => {
  let message = String(value || "").trim();
  if (!message) return "Unable to stage the filing action.";

  if (message.startsWith("{") && message.includes("\"error\"")) {
    try {
      const parsed = JSON.parse(message);
      if (typeof parsed?.error === "string" && parsed.error.trim()) {
        message = parsed.error.trim();
      }
    } catch {
      // Keep the original message if it is not valid JSON.
    }
  }

  if (/Leidos .* timed out before Flight Service responded/i.test(message)) {
    return "Leidos is taking longer than usual to respond. Wait a few minutes, then try again.";
  }

  if (/connect timeout|timed out|fetch failed/i.test(message)) {
    return "Leidos is taking longer than usual to respond. Wait a few minutes, then try again.";
  }

  if (/<!doctype html|<html[\s>]|<body[\s>]|<head[\s>]/i.test(message)) {
    return "Leidos returned HTML instead of a REST response. Check the configured endpoint paths, credentials, and lab environment settings.";
  }

  if (/<[^>]+>/.test(message)) {
    const stripped = message.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (stripped) {
      return stripped.length > 280 ? `${stripped.slice(0, 279).trimEnd()}…` : stripped;
    }
  }

  return message.length > 280 ? `${message.slice(0, 279).trimEnd()}…` : message;
};

const isLeidosTimeoutMessage = (value: unknown) =>
  /Leidos .* timed out before Flight Service responded|connect timeout|timed out|fetch failed/i.test(String(value || ""));

const roundAltitudeUp = (value: number, increment = 500) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.ceil(value / increment) * increment;
};

const normalizeAircraftLabel = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const aircraftTypeMatchesPlan = (type: AircraftType, planAircraftType: string | null | undefined) => {
  const normalizedPlanType = normalizeAircraftLabel(planAircraftType);
  if (!normalizedPlanType) return false;
  const candidates = [
    `${type.make} ${type.model}`,
    type.icaoType || "",
    `${type.make} ${type.model}${type.icaoType ? ` (${type.icaoType})` : ""}`,
  ]
    .map(normalizeAircraftLabel)
    .filter(Boolean);
  return candidates.includes(normalizedPlanType);
};

const extractClientVersionStamp = (plan: FlightPlan | null | undefined) => {
  const rawValue = plan?.filingRaw;
  let raw: Record<string, any> | null = null;

  if (rawValue && typeof rawValue === "object") {
    raw = rawValue as Record<string, any>;
  } else if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          raw = parsed as Record<string, any>;
        }
      } catch {
        raw = null;
      }
    }
  }

  const rawVersion = extractFilingVersionStamp(raw);
  if (rawVersion) return rawVersion;

  const history = Array.isArray(plan?.filingActionHistory) ? [...plan.filingActionHistory].reverse() : [];
  for (const entry of history) {
    const version =
      extractFilingVersionStamp(entry) ||
      extractFilingVersionStamp((entry as Record<string, unknown>)?.raw) ||
      extractFilingVersionStamp((entry as Record<string, unknown>)?.response);
    if (version) return version;
  }

  return null;
};

const normalizedClientFilingStatus = (plan: FlightPlan | null | undefined) =>
  String(plan?.filingStatus || "").toLowerCase();

const buildPlannerStateSnapshot = ({
  selectedProfileId,
  selectedTypeId,
  selectedTypeIcao,
  selectedTypeMaxGrossWeightLb,
  selectedProfileMaxGrossWeightLb,
  customProfile,
}: {
  selectedProfileId: string;
  selectedTypeId: string;
  selectedTypeIcao: string | null;
  selectedTypeMaxGrossWeightLb: number | null;
  selectedProfileMaxGrossWeightLb: number | null;
  customProfile: {
    name: string;
    cruiseKtasOverride: string;
    fuelBurnOverrideGph: string;
    usableFuelOverrideGal: string;
    maxGrossWeightOverrideLb: string;
  };
}) => ({
  selectedProfileId,
  selectedTypeId,
  selectedTypeIcao,
  selectedTypeMaxGrossWeightLb,
  selectedProfileMaxGrossWeightLb,
  customProfile,
});

const hasLiveProviderPlan = (plan: FlightPlan | null | undefined) =>
  Boolean(plan?.filingIsLive && plan?.filingProviderPlanId);

const canSubmitAmendForPlan = (plan: FlightPlan | null | undefined) => {
  if (!plan) return false;
  const rules = String(plan.filingFlightRules || "VFR").toUpperCase();
  const status = normalizedClientFilingStatus(plan);
  return Boolean(
    hasLiveProviderPlan(plan) &&
    (rules === "VFR" ? ["filed", "activated"].includes(status) : status === "filed"),
  );
};

const canActivatePlan = (plan: FlightPlan | null | undefined) =>
  Boolean(
    plan &&
    String(plan.filingFlightRules || "VFR").toUpperCase() === "VFR" &&
    normalizedClientFilingStatus(plan) === "filed" &&
    hasLiveProviderPlan(plan),
  );

const canClosePlan = (plan: FlightPlan | null | undefined) =>
  Boolean(
    plan &&
    String(plan.filingFlightRules || "VFR").toUpperCase() === "VFR" &&
    normalizedClientFilingStatus(plan) === "activated" &&
    hasLiveProviderPlan(plan) &&
    !isFlightPlanCloseOverdue(plan.plannedArrivalAt),
  );

const canCancelPlan = (plan: FlightPlan | null | undefined) =>
  Boolean(
    plan &&
    normalizedClientFilingStatus(plan) === "filed" &&
    hasLiveProviderPlan(plan),
  );

const getAmendAvailabilityMessage = (plan: FlightPlan | null | undefined) => {
  if (!plan) {
    return "Save this plan first, then file it before trying to amend it through Leidos.";
  }

  const status = normalizedClientFilingStatus(plan);
  const rules = String(plan.filingFlightRules || "VFR").toUpperCase();

  if (!plan.filingIsLive) {
    return "This saved plan is still local or staged. File it live with Leidos first, then amend it from the filed record.";
  }

  if (!plan.filingProviderPlanId) {
    return "This filed record is missing the Leidos flight identifier. File it again so RSF can refresh the amend tracking.";
  }

  if (!extractClientVersionStamp(plan)) {
    return "This filed record is still waiting on the Leidos amend token. Refresh provider sync in a few minutes, then try amend again.";
  }

  if (rules === "IFR" && status !== "filed") {
    return "IFR plans can only be amended from the filed state.";
  }

  if (rules === "VFR" && !["filed", "activated"].includes(status)) {
    return "VFR plans can only be amended from the filed or active state.";
  }

  return "This plan is not currently in a live amendable state. Save your edits, then use File to submit the updated version.";
};

const getDraftAmendAvailabilityMessage = ({
  plan,
  flightRules,
  route,
  plannedDepartureAt,
  trueAirspeedKtas,
  plannedAltitudeFt,
}: {
  plan: FlightPlan | null | undefined;
  flightRules: string;
  route: string | null | undefined;
  plannedDepartureAt: string | null | undefined;
  trueAirspeedKtas: number | null | undefined;
  plannedAltitudeFt: number | null | undefined;
}) => {
  if (!plan) {
    return "Save this plan first, then file it before trying to amend it through Leidos.";
  }

  const normalizedRules = String(flightRules || "VFR").toUpperCase();
  const draftPlan = { ...plan, filingFlightRules: normalizedRules } as FlightPlan;
  if (!canSubmitAmendForPlan(draftPlan)) {
    return getAmendAvailabilityMessage(draftPlan);
  }

  if (normalizedRules === "IFR" && !String(route || "").trim()) {
    return "IFR amendments require a filed route before RSF can send the update to Leidos.";
  }

  if (!plannedDepartureAt) {
    return "Planned departure time is required before RSF can send this amend request.";
  }

  if (!trueAirspeedKtas || trueAirspeedKtas <= 0) {
    return "Cruise speed is required before RSF can send this amend request.";
  }

  if (!plannedAltitudeFt || plannedAltitudeFt <= 0) {
    return "Planned altitude is required before RSF can send this amend request.";
  }

  return null;
};

const getPlannerAircraftTypeValue = ({
  manualAircraftType,
  selectedProfile,
  selectedType,
  selectedTypeId,
}: {
  manualAircraftType: string | null | undefined;
  selectedProfile: AircraftProfile | null | undefined;
  selectedType: AircraftType | null | undefined;
  selectedTypeId: string | null | undefined;
}) => {
  const manual = String(manualAircraftType || "").trim();
  const selectedTypeLabel = selectedType ? `${selectedType.make} ${selectedType.model}`.trim() : "";

  if (selectedProfile?.name?.trim()) {
    return selectedProfile.name.trim();
  }

  if (selectedTypeId && selectedTypeId !== CUSTOM_TYPE_ID && selectedTypeLabel) {
    if (!manual) return selectedTypeLabel;
    const normalizedManual = normalizeAircraftLabel(manual);
    const normalizedSelected = normalizeAircraftLabel(selectedTypeLabel);
    return normalizedManual === normalizedSelected ? selectedTypeLabel : manual;
  }

  return manual || null;
};

const extractIntermediateAirportTokensForAppliedRoute = ({
  route,
  departure,
  destination,
}: {
  route: string;
  departure: string;
  destination: string;
}) => {
  const normalizedDeparture = departure.trim().toUpperCase();
  const normalizedDestination = destination.trim().toUpperCase();
  const analysis = analyzeFiledRoute(normalizeRouteText(route));
  return analysis.airportTokens.filter((icao) => {
    const normalized = icao.trim().toUpperCase();
    return normalized !== normalizedDeparture && normalized !== normalizedDestination;
  });
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

type RunwayBriefingRunway = {
  leIdent?: string | null;
  heIdent?: string | null;
  leHeading?: number | null;
  heHeading?: number | null;
  lengthFt?: number | null;
  surface?: string | null;
};

type RunwayBriefingResponse = {
  icao: string;
  runwayInUse?: string | null;
  wind?: {
    direction?: number | null;
    speed?: number | null;
    gust?: number | null;
  } | null;
  advisory?: {
    runway?: string | null;
    heading?: number | null;
    headwind?: number | null;
    crosswind?: number | null;
  } | null;
  runways: RunwayBriefingRunway[];
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

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type WeatherResponse = {
  icao: string;
  metar: any;
  taf: any;
};

type RouteSuggestionMeta = {
  routeDistanceNm: number;
  maxLegNm: number;
  planningLegNm?: number;
  cruiseKtas: number;
  fuelBurnGph: number;
  fuelGallons: number;
  reserveMinutes: number;
  overwaterLikely?: boolean;
  stopPlanningMode?: "sequential_topoff" | "direct_no_stop";
  suggestedStopCount?: number;
  coastlineSuggestedStopCount?: number;
};

type RouteSuggestionResponse = {
  departure: string;
  destination: string;
  waypoints: string[];
  plannedStops: string[];
  coastlineWaypoints?: string[];
  coastlinePlannedStops?: string[];
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

type TerrainProfilePlannerResponse = {
  source: string;
  sampledPointCount: number;
  maxElevationFt: number | null;
  samples: Array<{
    lat: number;
    lon: number;
    elevationFt: number | null;
  }>;
};

type PlannerTerrainCueSegment = {
  positions: [[number, number], [number, number]];
  maxElevationFt: number | null;
  clearanceFt: number | null;
  risk: "comfortable" | "caution" | "warning";
};

type PlannerTerrainProfileChartPoint = {
  x: number;
  y: number;
  elevationFt: number;
};

type TerrainRouteAdvisorOption = {
  id: "current" | "assist" | "coastline";
  label: string;
  description: string;
  icaos: string[];
  stopIcaos: string[];
  applyKind: "current" | "assist" | "coastline";
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

type FiledRouteAnalysisResponse = {
  normalizedRoute: string;
  tokens: FiledRouteToken[];
  counts: Record<FiledRouteTokenKind, number>;
  airportTokens: string[];
  airwaySegments: {
    airway: string;
    index: number;
    entryToken: string | null;
    exitToken: string | null;
  }[];
  warnings: string[];
  recognizedAirportTokens: string[];
  unresolvedAirportTokens: string[];
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

type StopAdjustmentSuggestion = {
  id: string;
  detail: string;
  action?:
    | { kind: "use-suggested-stops"; label: string }
    | { kind: "insert-comfort-stop"; label: string; from: string; to: string; fuelOnBoardGallons: number }
    | { kind: "top-off-stop"; label: string; stopIcao: string; gallons: number };
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

function extractRunwayIdent(value?: string | null) {
  const match = String(value || "").trim().toUpperCase().match(/\b(\d{1,2}[LCR]?)\b/);
  return match ? match[1] : null;
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
    case "VFR": return "bg-[#10211d] text-[#cfe7df] border-[#3a7d6e]/40";
    case "MVFR": return "bg-[#122030] text-[#d7e6f6] border-[#45658b]/40";
    case "IFR": return "bg-[#23131a] text-[#f0d4df] border-[#864c63]/38";
    case "LIFR": return "bg-[#1f162c] text-[#eadcf8] border-[#6f5a99]/38";
    default: return "bg-[#121820] text-[#d9e4f0] border-[#5d6f85]/26";
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
  const fieldId = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <label htmlFor={fieldId} className="text-sm font-semibold text-[#F5F8FC]">
          {label}
        </label>
        {hint && (
          <span className="text-xs text-[#8fa6c0]">{hint}</span>
        )}
      </div>
      {multiline ? (
        <textarea
          id={fieldId}
          aria-label={label}
          title={label}
          placeholder={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={tall ? 4 : 2}
          className="w-full rounded-[0.95rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-3 py-2 text-sm font-mono text-[#F5F8FC] placeholder:text-[#6d829c] focus:border-[#6ea2ff]/55 focus:outline-none focus:ring-2 focus:ring-[#6ea2ff]/20 resize-none"
          spellCheck={false}
        />
      ) : (
        <input
          id={fieldId}
          aria-label={label}
          title={label}
          placeholder={label}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[0.95rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-3 py-2 text-sm font-mono text-[#F5F8FC] placeholder:text-[#6d829c] focus:border-[#6ea2ff]/55 focus:outline-none focus:ring-2 focus:ring-[#6ea2ff]/20"
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A9BBCD]">
        <div>Finger, mouse, or stylus. Write the clearance first, organize later.</div>
        <div className="font-mono">{strokes.length} stroke{strokes.length === 1 ? "" : "s"} saved</div>
      </div>
      <div
        ref={wrapperRef}
        className="relative h-[60vh] min-h-[360px] overflow-hidden rounded-[1.2rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-36px_rgba(0,0,0,0.88)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-[#5d6f85]/20 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-[#8fa6c0]">
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
  const [plannerLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pressDemo = usePressDemo(FLIGHT_PLANNER_PRESS_STEPS);
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
  const [guestFlightPlanFiles, setGuestFlightPlanFiles] = useState(() => getAnonFlightPlanFileCount());
  const [activeTab, setActiveTab] = useState<FlightPlannerTab>("route");
  const [returnToFileAfterSave, setReturnToFileAfterSave] = useState(false);
  const [pendingFilingActionAfterSave, setPendingFilingActionAfterSave] = useState<{
    planId: string;
    action: "amend";
  } | null>(null);
  const [draftPlanId, setDraftPlanId] = useState<string | null>(null);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState<FlightPlan | null>(null);
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
    setShowUpgradePrompt(false);
  }, []);

  useEffect(() => {
    if (!pressDemo.enabled || !pressDemo.currentStep) return;
    const stepToTab: Partial<Record<PressDemoStep["id"], FlightPlannerTab>> = {
      "route-setup": "route",
      "distance-performance": "route",
      "route-map": "route",
      "route-analysis": "analysis",
      filing: "file",
    };
    const nextTab = stepToTab[pressDemo.currentStep.id];
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, pressDemo.currentStep, pressDemo.enabled]);

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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const source = String(params.get("source") || "").trim();
    const alternateFromLiveMap = String(params.get("alternate") || "").trim().toUpperCase();
    const destinationFromLiveMap = String(params.get("destination") || "").trim().toUpperCase();
    const departureFromLiveMap = String(params.get("departure") || "").trim().toUpperCase();
    const routeFromLiveMap = String(params.get("route") || "").trim().toUpperCase();

    if (source === "live-map" && alternateFromLiveMap) {
      if (appliedLiveMapAlternateRef.current === `alt:${alternateFromLiveMap}`) return;
      appliedLiveMapAlternateRef.current = `alt:${alternateFromLiveMap}`;
      setForm((prev) => ({ ...prev, alternate: alternateFromLiveMap }));
      setActiveTab("route");
      toast({
        title: "Alternate loaded from Live Map",
        description: `${alternateFromLiveMap} was inserted into the alternate field. This only updates the local RSF plan until you save and file or amend it.`,
      });
    } else if (source === "live-map-direct" && destinationFromLiveMap) {
      const handoffKey = `direct:${departureFromLiveMap}:${destinationFromLiveMap}:${routeFromLiveMap}`;
      if (appliedLiveMapAlternateRef.current === handoffKey) return;
      appliedLiveMapAlternateRef.current = handoffKey;
      setForm((prev) => ({
        ...prev,
        departure: departureFromLiveMap || prev.departure,
        destination: destinationFromLiveMap,
        route: routeFromLiveMap || "DCT",
      }));
      setActiveTab("route");
      toast({
        title: "Direct-to route loaded from Live Map",
        description: `${destinationFromLiveMap} was loaded into Flight Planner as a local direct-to route. This does not change any filed plan until you save and file or amend it.`,
      });
    } else if (source === "live-map-destination" && destinationFromLiveMap) {
      const handoffKey = `destination:${departureFromLiveMap}:${destinationFromLiveMap}:${routeFromLiveMap}`;
      if (appliedLiveMapAlternateRef.current === handoffKey) return;
      appliedLiveMapAlternateRef.current = handoffKey;
      setForm((prev) => ({
        ...prev,
        departure: departureFromLiveMap || prev.departure,
        destination: destinationFromLiveMap,
        route: routeFromLiveMap || "DCT",
        alternate: "",
      }));
      setActiveTab("route");
      toast({
        title: "Destination replaced from Live Map",
        description: `${destinationFromLiveMap} is now the local destination in Flight Planner. This does not change any filed plan until you save and file or amend it.`,
      });
    } else {
      return;
    }

    params.delete("alternate");
    params.delete("destination");
    params.delete("departure");
    params.delete("route");
    params.delete("source");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [plannerLocation, toast]);

  useEffect(() => {
    if (!scratchPadOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScratchPadOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [scratchPadOpen]);

  const [editingPlan, setEditingPlan] = useState<FlightPlan | null>(null);
  const editingPlanRef = useRef<FlightPlan | null>(null);
  const draftPlanIdRef = useRef<string | null>(null);
  const skipNextEditingPlanHydrationRef = useRef(false);
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
  const appliedLiveMapAlternateRef = useRef<string | null>(null);
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
  const [mapStyle, setMapStyle] = useState<RsfPlannerMapStyle>("sectional");
  const [mapRenderVersion, setMapRenderVersion] = useState(0);
  const [airportLabelMode, setAirportLabelMode] = useState<"icao" | "full" | "markers">("icao");
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
  const departureRunwayAutoAirportRef = useRef<string | null>(null);
  const lastApproachOfferKeyRef = useRef<string | null>(null);
  const plannedAltitudeFt = Number(plannedAltitude);
  const plannedAltitudeValue = Number.isFinite(plannedAltitudeFt) ? plannedAltitudeFt : undefined;
  const windsAltitudeFt = windsAltitudeChoice === "planned"
    ? plannedAltitudeValue
    : Number(windsAltitudeChoice);

  useEffect(() => {
    editingPlanRef.current = editingPlan;
  }, [editingPlan]);

  useEffect(() => {
    draftPlanIdRef.current = draftPlanId;
  }, [draftPlanId]);

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
      if (typeof parsed?.editingPlanId === "string") setDraftPlanId(parsed.editingPlanId);
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
        editingPlanId: draftPlanId || editingPlanRef.current?.id || null,
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
    draftPlanId,
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
      setDepartureResolved(value);
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
      setDestinationResolved(value);
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

  const mergePlanIntoList = useCallback((plans: FlightPlan[], nextPlan: FlightPlan | null | undefined) => {
    if (!nextPlan?.id) return plans;
    let replaced = false;
    const merged = plans.map((plan) => {
      if (plan.id !== nextPlan.id) return plan;
      replaced = true;
      return { ...plan, ...nextPlan };
    });
    if (replaced) return merged;
    return [nextPlan, ...plans];
  }, []);

  const savedPlansView = useMemo(
    () => mergePlanIntoList(savedPlans, editingPlan),
    [editingPlan, mergePlanIntoList, savedPlans]
  );

  useEffect(() => {
    if (editingPlan || !draftPlanId || savedPlans.length === 0) return;
    const matchingPlan = savedPlans.find((plan) => plan.id === draftPlanId);
    if (!matchingPlan) return;
    skipNextEditingPlanHydrationRef.current = true;
    setEditingPlan(matchingPlan);
  }, [draftPlanId, editingPlan, savedPlans]);

  const { data: savedProfiles = [] } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
    enabled: isAuthenticated,
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
  const planLimitReached = false;
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
          return { waypoints: [], plannedStops: [], coastlineWaypoints: [], coastlinePlannedStops: [], meta: null };
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
  const suggestedCoastlineWaypoints = routeSuggestionQuery.data?.coastlineWaypoints ?? [];
  const suggestedCoastlineStops = routeSuggestionQuery.data?.coastlinePlannedStops ?? [];
  const suggestionMeta = routeSuggestionQuery.data?.meta;
  const hasCoastlineRouteOption = Boolean(
    suggestionMeta?.overwaterLikely &&
    (suggestedCoastlineWaypoints.length > 0 || suggestedCoastlineStops.length > 0)
  );

  const waypoints = useMemo(() => parseAirportWaypoints(waypointsInput), [waypointsInput]);
  const plannedStops = useMemo(() => parseAirportWaypoints(plannedStopsInput), [plannedStopsInput]);
  const filedRouteInputNormalized = useMemo(() => normalizeRouteText(form.route), [form.route]);
  const filedRouteAnalysis = useMemo(() => analyzeFiledRoute(filedRouteInputNormalized), [filedRouteInputNormalized]);
  const filedRouteTokens = filedRouteAnalysis.tokens;
  const filedRouteAirportTokens = filedRouteAnalysis.airportTokens;
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

  const autoSuggestedIntermediates = useMemo(() => {
    if (!departureResolved || !destinationResolved) return [];
    if (plannedStops.length > 0 || waypoints.length > 0 || filedRouteAirportTokens.length > 0) return [];
    return [...suggestedStops, ...suggestedWaypoints]
      .map((icao) => icao.trim().toUpperCase())
      .filter(Boolean)
      .filter((icao, index, arr) => ICAO_REGEX.test(icao) && arr.indexOf(icao) === index);
  }, [
    departureResolved,
    destinationResolved,
    plannedStops.length,
    waypoints.length,
    filedRouteAirportTokens,
    suggestedStops,
    suggestedWaypoints,
  ]);

  const routeIntermediates = useMemo(() => {
    if (plannedStops.length > 0 || waypoints.length > 0) {
      return [...plannedStops, ...waypoints];
    }
    if (filedRouteAirportTokens.length > 0) {
      return filedRouteAirportTokens;
    }
    return autoSuggestedIntermediates;
  }, [plannedStops, waypoints, filedRouteAirportTokens, autoSuggestedIntermediates]);

  const routeSequenceRaw = useMemo(() => {
    return [
      departureResolved.trim().toUpperCase(),
      ...routeIntermediates,
      destinationResolved.trim().toUpperCase(),
    ]
      .filter(Boolean)
      .filter((icao) => ICAO_REGEX.test(icao));
  }, [departureResolved, destinationResolved, routeIntermediates]);

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
    const combined = routeIntermediates.filter((icao) => ICAO_REGEX.test(icao));
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
  }, [routeIntermediates, shouldOrderSuggestions, airportMap, departureResolved, destinationResolved]);

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

  const terrainAdvisorOptions = useMemo<TerrainRouteAdvisorOption[]>(() => {
    const options: TerrainRouteAdvisorOption[] = [];
    if (routeSequenceOrdered.length >= 2) {
      options.push({
        id: "current",
        label: "Current route",
        description: "Your current route builder / filed-airport path.",
        icaos: routeSequenceOrdered,
        stopIcaos: orderedPlannedStops,
        applyKind: "current",
      });
    }
    if (departureResolved && destinationResolved && (suggestedWaypoints.length > 0 || suggestedStops.length > 0)) {
      options.push({
        id: "assist",
        label: suggestionMeta?.overwaterLikely ? "Direct / overwater assist" : "Route assist",
        description: suggestionMeta?.overwaterLikely
          ? "Direct helper route with the current overwater planning assist."
          : "RSF helper route using suggested waypoints and fuel stops.",
        icaos: [
          departureResolved.trim().toUpperCase(),
          ...suggestedStops,
          ...suggestedWaypoints,
          destinationResolved.trim().toUpperCase(),
        ].filter((icao, index, arr) => Boolean(icao) && arr.indexOf(icao) === index),
        stopIcaos: suggestedStops,
        applyKind: "assist",
      });
    }
    if (departureResolved && destinationResolved && hasCoastlineRouteOption) {
      options.push({
        id: "coastline",
        label: "Coastline assist",
        description: "Land-biased helper route intended to stay closer to shore.",
        icaos: [
          departureResolved.trim().toUpperCase(),
          ...suggestedCoastlineStops,
          ...suggestedCoastlineWaypoints,
          destinationResolved.trim().toUpperCase(),
        ].filter((icao, index, arr) => Boolean(icao) && arr.indexOf(icao) === index),
        stopIcaos: suggestedCoastlineStops,
        applyKind: "coastline",
      });
    }
    return options.filter((option, index, arr) =>
      option.icaos.length >= 2 &&
      arr.findIndex((candidate) => candidate.id === option.id) === index
    );
  }, [
    departureResolved,
    destinationResolved,
    hasCoastlineRouteOption,
    routeSequenceOrdered,
    suggestedCoastlineStops,
    suggestedCoastlineWaypoints,
    suggestedStops,
    suggestedWaypoints,
    suggestionMeta?.overwaterLikely,
  ]);
  const terrainAdvisorAlternativeOptions = useMemo(
    () => terrainAdvisorOptions.filter((option) => option.id !== "current"),
    [terrainAdvisorOptions]
  );
  const terrainAdvisorCandidateIcaos = useMemo(() => {
    const codes = terrainAdvisorAlternativeOptions.flatMap((option) => option.icaos);
    return Array.from(new Set(codes));
  }, [terrainAdvisorAlternativeOptions]);
  const terrainAdvisorAirportQueries = useQueries({
    queries: terrainAdvisorCandidateIcaos.map((icao) => ({
      queryKey: ["/api/airports/search", icao, "terrain-advisor"],
      queryFn: async () => {
        const searchRes = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(icao)}`), {
          credentials: "include",
        });
        if (!searchRes.ok) throw new Error("Failed to search terrain advisor airports");
        const matches = (await searchRes.json()) as any[];
        const candidates = new Set(buildPlannerIcaoCandidates(icao));
        const exactMatch = matches.find((match) => {
          const matchIcao = String(match?.icao || "").trim().toUpperCase();
          return candidates.has(matchIcao);
        });
        if (!exactMatch) return null;
        return {
          icao,
          lat: Number(exactMatch.lat),
          lon: Number(exactMatch.lon),
          name: exactMatch.name ?? null,
        };
      },
      enabled: terrainAdvisorCandidateIcaos.length > 0,
      staleTime: 1000 * 60 * 60,
    })),
  });
  const terrainAdvisorAirportMap = useMemo(() => {
    const map = new Map<string, { icao: string; lat: number; lon: number; name: string | null }>();
    terrainAdvisorAirportQueries.forEach((query, index) => {
      const icao = terrainAdvisorCandidateIcaos[index];
      const data = query.data;
      if (icao && data && Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
        map.set(icao, data);
      }
    });
    return map;
  }, [terrainAdvisorAirportQueries, terrainAdvisorCandidateIcaos]);
  const terrainAdvisorResolvedAirportMap = useMemo(() => {
    const map = new Map<string, { icao: string; lat: number; lon: number; name: string | null }>();
    airportMap.forEach((airport, icao) => {
      const lat = Number(airport?.lat);
      const lon = Number(airport?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      map.set(icao, {
        icao,
        lat,
        lon,
        name: airport?.name ?? null,
      });
    });
    terrainAdvisorAirportMap.forEach((airport, icao) => {
      if (map.has(icao)) return;
      map.set(icao, airport);
    });
    return map;
  }, [airportMap, terrainAdvisorAirportMap]);
  const terrainAdvisorAlternativePathParams = useMemo(
    () =>
      terrainAdvisorAlternativeOptions.map((option) => {
        const points = option.icaos
          .map((icao) => terrainAdvisorResolvedAirportMap.get(icao))
          .filter((point): point is { icao: string; lat: number; lon: number; name: string | null } =>
            Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lon))
          );
        const path = points.length >= 2
          ? points.map((point) => `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`).join(";")
          : null;
        return { option, path };
      }),
    [terrainAdvisorAlternativeOptions, terrainAdvisorResolvedAirportMap]
  );
  const terrainAdvisorTerrainQueries = useQueries({
    queries: terrainAdvisorAlternativePathParams.map(({ option, path }) => ({
      queryKey: ["/api/aviation/terrain-profile", option.id, path],
      queryFn: async () => {
        const res = await fetch(apiUrl(`/api/aviation/terrain-profile?path=${encodeURIComponent(path as string)}`), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load advisor terrain profile");
        return res.json() as Promise<TerrainProfilePlannerResponse>;
      },
      enabled: Boolean(path),
      staleTime: 1000 * 60 * 10,
    })),
  });

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
    if (routeIntermediates.length > 0) return null;
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
  }, [airportPoints, routeSuggestion, routeIntermediates.length]);

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
  const routePathParam = useMemo(
    () => routePoints.map((point) => `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`).join(";"),
    [routePoints]
  );

  const legs = useMemo(() => buildLegs(routePoints), [routePoints]);
  const totalDistance = useMemo(() => sumDistance(legs), [legs]);

  const windValue = Number(headwind || 0);
  const groundspeed = Math.max(40, planningCruise - (isPro ? windValue : 0));
  const eteHours = totalDistance ? totalDistance / groundspeed : 0;
  const reserveFuel = (Number(reserveMinutes) / 60) * planningBurn;
  const tripFuel = eteHours * planningBurn;
  const totalFuel = tripFuel + reserveFuel;
  const eteMinutes = totalDistance > 0 && Number.isFinite(eteHours)
    ? Math.max(1, Math.round(eteHours * 60))
    : 0;
  const canAutoArrival = Boolean(form.plannedDepartureAt && totalDistance > 0 && groundspeed > 0);
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
  const legPlanningTargetNm = useMemo(() => {
    if (suggestionMeta?.planningLegNm && suggestionMeta.planningLegNm > 0) return suggestionMeta.planningLegNm;
    if (suggestionMeta?.maxLegNm && suggestionMeta.maxLegNm > 0) return suggestionMeta.maxLegNm * 0.9;
    return null;
  }, [suggestionMeta]);
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
        planningTargetStatus:
          fuelAfterLeg < 0 || (legPlanningTargetNm != null && leg.distanceNm > (suggestionMeta?.maxLegNm ?? Number.POSITIVE_INFINITY))
            ? ("warning" as const)
            : legPlanningTargetNm != null && leg.distanceNm > legPlanningTargetNm
              ? ("caution" as const)
              : ("comfortable" as const),
      };
    });
  }, [legPlanningTargetNm, legs, fuelAvailableGallons, groundspeed, plannedDepartureUtc, plannedFuelUpliftGallonsByStop, planningBurn, planningFuel, suggestionMeta?.maxLegNm]);
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
    aircraftType: getPlannerAircraftTypeValue({
      manualAircraftType: form.aircraftType,
      selectedProfile,
      selectedType,
      selectedTypeId,
    }),
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
    selectedProfile,
    selectedType,
    selectedTypeId,
  ]);

  const terrainProfileQuery = useQuery<TerrainProfilePlannerResponse>({
    queryKey: ["/api/aviation/terrain-profile", routePathParam],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation/terrain-profile?path=${encodeURIComponent(routePathParam)}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load terrain profile");
      return res.json();
    },
    enabled: routePoints.length >= 2,
    staleTime: 1000 * 60 * 10,
  });

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

  const terrainReferenceAltitudeFt = plannedAltitudeValue ?? null;
  const terrainCueSegments = useMemo<PlannerTerrainCueSegment[]>(() => {
    const samples = terrainProfileQuery.data?.samples ?? [];
    if (samples.length < 2) return [];

    return samples.slice(1).map((sample, index) => {
      const previous = samples[index];
      const maxElevationFt =
        previous.elevationFt != null && sample.elevationFt != null
          ? Math.max(previous.elevationFt, sample.elevationFt)
          : previous.elevationFt ?? sample.elevationFt ?? null;
      const clearanceFt =
        terrainReferenceAltitudeFt != null && maxElevationFt != null
          ? terrainReferenceAltitudeFt - maxElevationFt
          : null;
      const risk =
        clearanceFt == null
          ? "comfortable"
          : clearanceFt < 1000
            ? "warning"
            : clearanceFt < 2000
              ? "caution"
              : "comfortable";
      return {
        positions: [
          [previous.lat, previous.lon],
          [sample.lat, sample.lon],
        ],
        maxElevationFt,
        clearanceFt,
        risk,
      };
    });
  }, [terrainProfileQuery.data?.samples, terrainReferenceAltitudeFt]);
  const terrainCueCounts = useMemo(
    () =>
      terrainCueSegments.reduce(
        (acc, segment) => {
          acc[segment.risk] += 1;
          return acc;
        },
        { comfortable: 0, caution: 0, warning: 0 }
      ),
    [terrainCueSegments]
  );
  const worstTerrainSegment = useMemo(() => {
    if (terrainCueSegments.length === 0) return null;
    return terrainCueSegments.reduce((worst, segment, index) => {
      const segmentClearance = segment.clearanceFt ?? Number.POSITIVE_INFINITY;
      const worstClearance = worst.segment.clearanceFt ?? Number.POSITIVE_INFINITY;
      if (segmentClearance < worstClearance) {
        return { index, segment };
      }
      return worst;
    }, { index: 0, segment: terrainCueSegments[0] });
  }, [terrainCueSegments]);
  const terrainHotSpots = useMemo(() => {
    if (terrainCueSegments.length === 0) return [] as Array<{
      index: number;
      segment: PlannerTerrainCueSegment;
      progressLabel: string;
    }>;
    return terrainCueSegments
      .map((segment, index) => {
        const startPct = Math.round((index / terrainCueSegments.length) * 100);
        const endPct = Math.round(((index + 1) / terrainCueSegments.length) * 100);
        return {
          index,
          segment,
          progressLabel: `${startPct}% to ${endPct}%`,
          riskScore: segment.risk === "warning" ? 0 : segment.risk === "caution" ? 1 : 2,
          clearanceScore: segment.clearanceFt ?? Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) => {
        if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
        return a.clearanceScore - b.clearanceScore;
      })
      .slice(0, 3)
      .map(({ index, segment, progressLabel }) => ({ index, segment, progressLabel }));
  }, [terrainCueSegments]);
  const terrainClearanceHeadline = worstTerrainSegment
    ? `${Math.round(worstTerrainSegment.segment.clearanceFt ?? 0).toLocaleString()} ft minimum clearance`
    : "--";
  const terrainClearanceAdvisory = worstTerrainSegment
    ? worstTerrainSegment.segment.risk === "warning"
      ? "One or more route segments are below the 1,000 ft terrain buffer."
      : worstTerrainSegment.segment.risk === "caution"
        ? "Part of the route is inside the tighter 2,000 ft terrain margin."
        : "Current route stays in the comfortable terrain margin."
    : "Enter a route and planned altitude to evaluate terrain clearance.";
  const terrainMinimumSuggestedAltitudeFt = useMemo(
    () =>
      terrainProfileQuery.data?.maxElevationFt != null
        ? roundAltitudeUp(terrainProfileQuery.data.maxElevationFt + 1000)
        : null,
    [terrainProfileQuery.data?.maxElevationFt]
  );
  const terrainComfortSuggestedAltitudeFt = useMemo(
    () =>
      terrainProfileQuery.data?.maxElevationFt != null
        ? roundAltitudeUp(terrainProfileQuery.data.maxElevationFt + 2000)
        : null,
    [terrainProfileQuery.data?.maxElevationFt]
  );
  const terrainOperationalNotes = useMemo(() => {
    if (!worstTerrainSegment) return [] as string[];
    const notes: string[] = [];
    if (worstTerrainSegment.segment.risk === "warning") {
      notes.push(
        terrainComfortSuggestedAltitudeFt != null
          ? `Planned altitude is not terrain-safe for the current route. Raise to about ${terrainComfortSuggestedAltitudeFt.toLocaleString()} ft or adjust the route.`
          : "Planned altitude is not terrain-safe for the current route. Raise altitude or adjust the route."
      );
    } else if (worstTerrainSegment.segment.risk === "caution") {
      notes.push(
        terrainComfortSuggestedAltitudeFt != null
          ? `Terrain clearance is tight. Consider raising to about ${terrainComfortSuggestedAltitudeFt.toLocaleString()} ft for a more comfortable margin.`
          : "Terrain clearance is tight. Consider raising planned altitude or adjusting the route."
      );
    }
    if (
      terrainReferenceAltitudeFt != null &&
      terrainMinimumSuggestedAltitudeFt != null &&
      terrainReferenceAltitudeFt < terrainMinimumSuggestedAltitudeFt
    ) {
      notes.push(`Minimum basic terrain target for this route is about ${terrainMinimumSuggestedAltitudeFt.toLocaleString()} ft.`);
    }
    return notes;
  }, [
    terrainComfortSuggestedAltitudeFt,
    terrainMinimumSuggestedAltitudeFt,
    terrainReferenceAltitudeFt,
    worstTerrainSegment,
  ]);
  const terrainToneClass = terrainCueCounts.warning > 0
    ? "text-[#f09aa8]"
    : terrainCueCounts.caution > 0
      ? "text-[#e2c06d]"
      : terrainCueSegments.length > 0
        ? "text-[#8fd0bf]"
        : "text-[#D9E4F0]";
  const terrainProfileChart = useMemo(() => {
    const samples = terrainProfileQuery.data?.samples ?? [];
    const validSamples = samples
      .map((sample, index) => ({
        index,
        elevationFt: sample.elevationFt,
      }))
      .filter((sample): sample is { index: number; elevationFt: number } => sample.elevationFt != null && Number.isFinite(sample.elevationFt));

    if (validSamples.length < 2) return null;

    const chartWidth = 320;
    const chartHeight = 148;
    const padding = { top: 10, right: 8, bottom: 22, left: 8 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    const maxTerrainFt = Math.max(...validSamples.map((sample) => sample.elevationFt));
    const topAltitudeFt = Math.max(
      maxTerrainFt + 2500,
      terrainReferenceAltitudeFt != null ? terrainReferenceAltitudeFt + 1000 : 0,
      4000
    );
    const altitudeSpanFt = Math.max(1000, topAltitudeFt);
    const sampleCount = samples.length;

    const points: PlannerTerrainProfileChartPoint[] = validSamples.map((sample) => {
      const progressRatio = sampleCount > 1 ? sample.index / (sampleCount - 1) : 0;
      return {
        x: padding.left + progressRatio * innerWidth,
        y: padding.top + ((topAltitudeFt - sample.elevationFt) / altitudeSpanFt) * innerHeight,
        elevationFt: sample.elevationFt,
      };
    });
    const terrainLine = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const terrainArea = [
      `${padding.left},${chartHeight - padding.bottom}`,
      ...points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`),
      `${padding.left + innerWidth},${chartHeight - padding.bottom}`,
    ].join(" ");
    const referenceY = terrainReferenceAltitudeFt != null
      ? padding.top + ((topAltitudeFt - terrainReferenceAltitudeFt) / altitudeSpanFt) * innerHeight
      : null;
    const yTicks = [0.25, 0.5, 0.75].map((ratio) => ({
      y: padding.top + ratio * innerHeight,
      altitudeFt: Math.round(topAltitudeFt - ratio * altitudeSpanFt),
    }));
    return { chartWidth, chartHeight, padding, terrainLine, terrainArea, referenceY, yTicks };
  }, [terrainProfileQuery.data?.samples, terrainReferenceAltitudeFt]);
  const terrainMapHotSpots = useMemo(
    () =>
      terrainHotSpots.map((item, hotSpotIndex) => {
        const point = terrainCueSegments[item.index + 1]?.positions?.[0]
          ?? terrainCueSegments[item.index]?.positions?.[1]
          ?? terrainCueSegments[item.index]?.positions?.[0]
          ?? null;
        if (!point) return null;
        return {
          rank: hotSpotIndex + 1,
          risk: item.segment.risk,
          progressLabel: item.progressLabel,
          maxElevationFt: item.segment.maxElevationFt,
          clearanceFt: item.segment.clearanceFt,
          lat: point[0],
          lon: point[1],
        };
      }).filter(Boolean) as Array<{
        rank: number;
        risk: PlannerTerrainCueSegment["risk"];
        progressLabel: string;
        maxElevationFt: number | null;
        clearanceFt: number | null;
        lat: number;
        lon: number;
      }>,
    [terrainCueSegments, terrainHotSpots]
  );
  const terrainAdvisorSummaries = useMemo(() => {
    const summarizeProfile = (
      option: TerrainRouteAdvisorOption,
      profile: TerrainProfilePlannerResponse | null | undefined,
    ) => {
      const optionPoints = option.icaos
        .map((icao) => terrainAdvisorResolvedAirportMap.get(icao))
        .filter((point): point is { icao: string; lat: number; lon: number; name: string | null } =>
          Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lon))
        )
        .map((point) => ({
          icao: point.icao,
          lat: point.lat,
          lon: point.lon,
        }));
      const optionLegs = optionPoints.length >= 2 ? buildLegs(optionPoints) : [];
      const fuelStopSet = new Set(option.stopIcaos);
      let fuelRemainingGallons = fuelAvailableGallons;
      let tripFuelGallons = 0;
      let firstUnreachableLeg: { from: string; to: string; shortageGallons: number } | null = null;

      optionLegs.forEach((leg) => {
        const legFuelGallons =
          groundspeed > 0 && planningBurn > 0
            ? (leg.distanceNm / groundspeed) * planningBurn
            : 0;
        tripFuelGallons += legFuelGallons;
        const fuelAfterLeg = fuelRemainingGallons - legFuelGallons;
        if (!firstUnreachableLeg && fuelAfterLeg < 0) {
          firstUnreachableLeg = {
            from: leg.from.icao,
            to: leg.to.icao,
            shortageGallons: Math.abs(fuelAfterLeg),
          };
        }
        if (fuelAfterLeg >= 0 && fuelStopSet.has(leg.to.icao) && planningFuel > 0) {
          fuelRemainingGallons = planningFuel;
        } else {
          fuelRemainingGallons = fuelAfterLeg;
        }
      });

      const reserveBalanceGallons =
        optionLegs.length > 0 ? fuelRemainingGallons - reserveFuel : fuelAvailableGallons - reserveFuel;
      const longestLegNm = optionLegs.reduce(
        (maxValue, leg) => Math.max(maxValue, leg.distanceNm),
        0,
      );
      const fuelStatus = firstUnreachableLeg
        ? "unreachable"
        : reserveBalanceGallons < 0
          ? "tight"
          : "healthy";
      const samples = profile?.samples ?? [];
      if (samples.length < 2) {
        return {
          ...option,
          available: false,
          minClearanceFt: null as number | null,
          maxElevationFt: profile?.maxElevationFt ?? null,
          warningCount: 0,
          cautionCount: 0,
          risk: "comfortable" as PlannerTerrainCueSegment["risk"],
          fuelStatus,
          longestLegNm: longestLegNm > 0 ? longestLegNm : null,
          tripFuelGallons: tripFuelGallons > 0 ? tripFuelGallons : null,
          blockFuelGallons: tripFuelGallons > 0 ? tripFuelGallons + reserveFuel : null,
          endingFuelGallons: optionLegs.length > 0 ? fuelRemainingGallons : fuelAvailableGallons,
          reserveBalanceGallons,
          firstUnreachableLeg,
        };
      }
      const segments = samples.slice(1).map((sample, index) => {
        const previous = samples[index];
        const maxElevationFt =
          previous.elevationFt != null && sample.elevationFt != null
            ? Math.max(previous.elevationFt, sample.elevationFt)
            : previous.elevationFt ?? sample.elevationFt ?? null;
        const clearanceFt =
          terrainReferenceAltitudeFt != null && maxElevationFt != null
            ? terrainReferenceAltitudeFt - maxElevationFt
            : null;
        const risk =
          clearanceFt == null
            ? "comfortable"
            : clearanceFt < 1000
              ? "warning"
              : clearanceFt < 2000
                ? "caution"
                : "comfortable";
        return { maxElevationFt, clearanceFt, risk };
      });
      const minClearanceFt = segments.reduce((minValue, segment) => {
        const value = segment.clearanceFt ?? Number.POSITIVE_INFINITY;
        return Math.min(minValue, value);
      }, Number.POSITIVE_INFINITY);
      const warningCount = segments.filter((segment) => segment.risk === "warning").length;
      const cautionCount = segments.filter((segment) => segment.risk === "caution").length;
      const risk = warningCount > 0 ? "warning" : cautionCount > 0 ? "caution" : "comfortable";
      return {
        ...option,
        available: true,
        minClearanceFt: Number.isFinite(minClearanceFt) ? minClearanceFt : null,
        maxElevationFt: profile?.maxElevationFt ?? null,
        warningCount,
        cautionCount,
        risk,
        fuelStatus,
        longestLegNm: longestLegNm > 0 ? longestLegNm : null,
        tripFuelGallons: tripFuelGallons > 0 ? tripFuelGallons : null,
        blockFuelGallons: tripFuelGallons > 0 ? tripFuelGallons + reserveFuel : null,
        endingFuelGallons: optionLegs.length > 0 ? fuelRemainingGallons : fuelAvailableGallons,
        reserveBalanceGallons,
        firstUnreachableLeg,
      };
    };

    const currentSummary = summarizeProfile(
      terrainAdvisorOptions.find((option) => option.id === "current") ?? {
        id: "current",
        label: "Current route",
        description: "Your current route builder / filed-airport path.",
        icaos: routeSequenceOrdered,
        stopIcaos: orderedPlannedStops,
        applyKind: "current",
      },
      terrainProfileQuery.data
    );
    const alternativeSummaries = terrainAdvisorAlternativeOptions.map((option, index) =>
      summarizeProfile(option, terrainAdvisorTerrainQueries[index]?.data)
    );
    return [currentSummary, ...alternativeSummaries].filter((summary) => summary.icaos.length >= 2);
  }, [
    routeSequenceOrdered,
    terrainAdvisorAlternativeOptions,
    terrainAdvisorResolvedAirportMap,
    terrainAdvisorOptions,
    terrainAdvisorTerrainQueries,
    terrainProfileQuery.data,
    fuelAvailableGallons,
    groundspeed,
    orderedPlannedStops,
    planningBurn,
    planningFuel,
    reserveFuel,
    terrainReferenceAltitudeFt,
  ]);
  const recommendedTerrainRoute = useMemo(() => {
    const available = terrainAdvisorSummaries.filter((summary) => summary.available);
    if (available.length === 0) return null;
    return available.slice().sort((a, b) => {
      const aFuel = a.fuelStatus === "unreachable" ? 2 : a.fuelStatus === "tight" ? 1 : 0;
      const bFuel = b.fuelStatus === "unreachable" ? 2 : b.fuelStatus === "tight" ? 1 : 0;
      if (aFuel !== bFuel) return aFuel - bFuel;
      const aRisk = a.risk === "warning" ? 2 : a.risk === "caution" ? 1 : 0;
      const bRisk = b.risk === "warning" ? 2 : b.risk === "caution" ? 1 : 0;
      if (aRisk !== bRisk) return aRisk - bRisk;
      const reserveDelta = (b.reserveBalanceGallons ?? Number.NEGATIVE_INFINITY) - (a.reserveBalanceGallons ?? Number.NEGATIVE_INFINITY);
      if (reserveDelta !== 0) return reserveDelta;
      return (b.minClearanceFt ?? Number.NEGATIVE_INFINITY) - (a.minClearanceFt ?? Number.NEGATIVE_INFINITY);
    })[0];
  }, [terrainAdvisorSummaries]);
  const currentTerrainRouteSummary = useMemo(
    () => terrainAdvisorSummaries.find((summary) => summary.id === "current") ?? null,
    [terrainAdvisorSummaries]
  );
  const terrainAdjustmentRecommendation = useMemo(() => {
    if (!currentTerrainRouteSummary || !currentTerrainRouteSummary.available) return null;

    const helperRouteGainFt =
      recommendedTerrainRoute &&
      recommendedTerrainRoute.id !== "current" &&
      recommendedTerrainRoute.minClearanceFt != null &&
      currentTerrainRouteSummary.minClearanceFt != null
        ? recommendedTerrainRoute.minClearanceFt - currentTerrainRouteSummary.minClearanceFt
        : null;
    const currentFuelScore =
      currentTerrainRouteSummary.fuelStatus === "unreachable"
        ? 2
        : currentTerrainRouteSummary.fuelStatus === "tight"
          ? 1
          : 0;
    const recommendedFuelScore =
      recommendedTerrainRoute?.fuelStatus === "unreachable"
        ? 2
        : recommendedTerrainRoute?.fuelStatus === "tight"
          ? 1
          : 0;
    const hasMeaningfulFuelImprovement =
      recommendedTerrainRoute &&
      recommendedTerrainRoute.id !== "current" &&
      recommendedFuelScore < currentFuelScore;

    if (
      hasMeaningfulFuelImprovement &&
      recommendedTerrainRoute &&
      recommendedTerrainRoute.id !== "current"
    ) {
      return {
        kind: "switch-route" as const,
        title: "Best route fix: use the healthier helper route",
        detail:
          recommendedTerrainRoute.fuelStatus === "healthy"
            ? `${recommendedTerrainRoute.label} keeps the legs workable with a better reserve picture while still improving route practicality at the current altitude.`
            : `${recommendedTerrainRoute.label} removes the current leg shortfall and gives you a more workable fuel plan at the current altitude.`,
        targetRouteId: recommendedTerrainRoute.id,
      };
    }

    if (currentTerrainRouteSummary.risk === "warning") {
      if (
        recommendedTerrainRoute &&
        recommendedTerrainRoute.id !== "current" &&
        recommendedTerrainRoute.risk !== "warning" &&
        (helperRouteGainFt == null || helperRouteGainFt >= 500 || terrainComfortSuggestedAltitudeFt == null)
      ) {
        return {
          kind: "switch-route" as const,
          title: "Best terrain fix: switch helper route",
          detail:
            recommendedTerrainRoute.minClearanceFt != null
              ? `${recommendedTerrainRoute.label} improves minimum clearance to about ${Math.round(recommendedTerrainRoute.minClearanceFt).toLocaleString()} ft at your current altitude.`
              : `${recommendedTerrainRoute.label} offers a stronger terrain margin at your current altitude.`,
          targetRouteId: recommendedTerrainRoute.id,
        };
      }
      if (terrainComfortSuggestedAltitudeFt != null) {
        return {
          kind: "raise-altitude" as const,
          title: "Best terrain fix: raise altitude",
          detail: `Raising the current route to about ${terrainComfortSuggestedAltitudeFt.toLocaleString()} ft should restore a more comfortable terrain margin without changing the route.`,
          targetAltitudeFt: terrainComfortSuggestedAltitudeFt,
        };
      }
    }

    if (currentTerrainRouteSummary.risk === "caution") {
      if (
        recommendedTerrainRoute &&
        recommendedTerrainRoute.id !== "current" &&
        helperRouteGainFt != null &&
        helperRouteGainFt >= 1000
      ) {
        return {
          kind: "switch-route" as const,
          title: "Best terrain fix: use the safer helper route",
          detail: `${recommendedTerrainRoute.label} gives about ${Math.round(helperRouteGainFt).toLocaleString()} ft more minimum clearance at the current altitude.`,
          targetRouteId: recommendedTerrainRoute.id,
        };
      }
      if (terrainComfortSuggestedAltitudeFt != null) {
        return {
          kind: "raise-altitude" as const,
          title: "Best terrain fix: climb a little higher",
          detail: `Keeping this route and climbing to about ${terrainComfortSuggestedAltitudeFt.toLocaleString()} ft should move the route into a more comfortable terrain margin.`,
          targetAltitudeFt: terrainComfortSuggestedAltitudeFt,
        };
      }
    }

    if (
      recommendedTerrainRoute &&
      recommendedTerrainRoute.id !== "current" &&
      ((helperRouteGainFt != null && helperRouteGainFt >= 1500) ||
        ((recommendedTerrainRoute.reserveBalanceGallons ?? Number.NEGATIVE_INFINITY) -
          (currentTerrainRouteSummary.reserveBalanceGallons ?? Number.NEGATIVE_INFINITY) >= 3))
    ) {
      return {
        kind: "switch-route" as const,
        title: "Optional route improvement",
        detail:
          helperRouteGainFt != null && helperRouteGainFt >= 1500
            ? `${recommendedTerrainRoute.label} offers a stronger terrain margin if you want a more conservative route.`
            : `${recommendedTerrainRoute.label} keeps a little more fuel reserve in hand with the current planning assumptions.`,
        targetRouteId: recommendedTerrainRoute.id,
      };
    }

    return null;
  }, [
    currentTerrainRouteSummary,
    recommendedTerrainRoute,
    terrainComfortSuggestedAltitudeFt,
    terrainReferenceAltitudeFt,
  ]);

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

  const departureRunwayBriefingQuery = useQuery<RunwayBriefingResponse>({
    queryKey: ["/api/airports/runway-briefing", primaryIcao],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/airports/${primaryIcao}/runway-briefing`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch runway briefing");
      return res.json();
    },
    enabled: hasPrimaryIcao,
    staleTime: 1000 * 60 * 5,
  });

  const filedRouteAnalysisQuery = useQuery<FiledRouteAnalysisResponse>({
    queryKey: ["/api/flight-plans/route-analysis", filedRouteInputNormalized],
    queryFn: async () => {
      const params = new URLSearchParams({
        route: filedRouteInputNormalized,
      });
      const res = await fetch(apiUrl(`/api/flight-plans/route-analysis?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to analyze filed route");
      }
      return res.json();
    },
    enabled: Boolean(filedRouteInputNormalized),
    staleTime: 1000 * 60 * 10,
  });
  const resolvedFiledRouteAnalysis = filedRouteAnalysisQuery.data ?? {
    ...filedRouteAnalysis,
    recognizedAirportTokens: filedRouteAnalysis.airportTokens,
    unresolvedAirportTokens: [] as string[],
  };
  const resolvedFiledRouteStructure = useMemo<FiledRouteStructureSegment[]>(
    () =>
      buildFiledRouteStructure(resolvedFiledRouteAnalysis.tokens, {
        departureAirport: form.departure,
        destinationAirport: form.destination,
      }),
    [form.departure, form.destination, resolvedFiledRouteAnalysis.tokens]
  );

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
  const legHealthMarkers = useMemo<PlannerLegHealthMarker[]>(() => {
    if (routePoints.length < 2 || legNavRows.length === 0) return [];
    return legNavRows.map((leg, index) => {
      const fromPoint = routePoints[index];
      const toPoint = routePoints[index + 1];
      if (!fromPoint || !toPoint) return null;
      const midLat = (fromPoint.lat + toPoint.lat) / 2;
      const midLon = (fromPoint.lon + toPoint.lon) / 2;
      const status = leg.planningTargetStatus;
      const detailParts = [
        `${leg.distanceNm.toFixed(0)} NM`,
        legPlanningTargetNm != null ? `target ${legPlanningTargetNm.toFixed(0)} NM` : null,
        leg.fuelAfterLeg >= 0 ? `${leg.fuelAfterLeg.toFixed(1)} gal on arrival` : `short ${Math.abs(leg.fuelAfterLeg).toFixed(1)} gal`,
      ].filter(Boolean);
      return {
        key: leg.key,
        status,
        label:
          status === "warning"
            ? `${leg.from} to ${leg.to}: exceeds leg plan`
            : status === "caution"
              ? `${leg.from} to ${leg.to}: leg is getting tight`
              : `${leg.from} to ${leg.to}: leg looks healthy`,
        detail: detailParts.join(" • "),
        lat: midLat,
        lon: midLon,
      };
    }).filter(Boolean) as PlannerLegHealthMarker[];
  }, [legNavRows, legPlanningTargetNm, routePoints]);
  const legPlanningSummary = useMemo(
    () =>
      legNavRows.reduce(
        (acc, leg) => {
          acc[leg.planningTargetStatus] += 1;
          return acc;
        },
        { comfortable: 0, caution: 0, warning: 0 }
      ),
    [legNavRows]
  );
  const stopAdjustmentSuggestions = useMemo<StopAdjustmentSuggestion[]>(() => {
    const suggestions: StopAdjustmentSuggestion[] = [];

    const firstFuelShortLeg = legNavRows.find((leg) => leg.fuelAfterLeg < 0);
    if (firstFuelShortLeg) {
      if (orderedPlannedStops.includes(firstFuelShortLeg.to)) {
        suggestions.push({
          id: `short-leg-${firstFuelShortLeg.key}`,
          detail: `You still cannot reach ${firstFuelShortLeg.to} from ${firstFuelShortLeg.from}. Add another stop before ${firstFuelShortLeg.to} or shorten that leg.`,
          action: {
            kind: "insert-comfort-stop",
            label: `Insert stop before ${firstFuelShortLeg.to}`,
            from: firstFuelShortLeg.from,
            to: firstFuelShortLeg.to,
            fuelOnBoardGallons: Math.max(0, firstFuelShortLeg.fuelBeforeLeg),
          },
        });
      } else {
        suggestions.push({
          id: `new-stop-${firstFuelShortLeg.key}`,
          detail: `Add another planned stop between ${firstFuelShortLeg.from} and ${firstFuelShortLeg.to}; the current leg runs short by about ${Math.abs(firstFuelShortLeg.fuelAfterLeg).toFixed(1)} gal.`,
          action: {
            kind: "insert-comfort-stop",
            label: `Insert stop between ${firstFuelShortLeg.from} and ${firstFuelShortLeg.to}`,
            from: firstFuelShortLeg.from,
            to: firstFuelShortLeg.to,
            fuelOnBoardGallons: Math.max(0, firstFuelShortLeg.fuelBeforeLeg),
          },
        });
      }
    }

    const reserveRiskAtStop = legNavRows.find((leg) =>
      orderedPlannedStops.includes(leg.to) &&
      leg.fuelAfterLeg >= 0 &&
      leg.fuelAfterUplift < reserveFuel &&
      (leg.actualFuelUplift <= 0 || leg.actualFuelUplift + 0.1 < planningFuel - Math.max(leg.fuelAfterLeg, 0))
    );
    if (reserveRiskAtStop) {
      suggestions.push({
        id: `topoff-${reserveRiskAtStop.key}`,
        detail: `Plan a larger fuel uplift at ${reserveRiskAtStop.to}. You arrive with ${reserveRiskAtStop.fuelAfterLeg.toFixed(1)} gal and still leave short of reserve after the current uplift.`,
        action: {
          kind: "top-off-stop",
          label: `Top off at ${reserveRiskAtStop.to}`,
          stopIcao: reserveRiskAtStop.to,
          gallons: Math.max(0, planningFuel - Math.max(reserveRiskAtStop.fuelAfterLeg, 0)),
        },
      });
    }

    const tightLegWithoutStop = legNavRows.find((leg) =>
      leg.planningTargetStatus === "caution" &&
      !orderedPlannedStops.includes(leg.to) &&
      leg.fuelAfterLeg >= 0
    );
    if (tightLegWithoutStop && legPlanningTargetNm != null) {
      suggestions.push({
        id: `comfort-stop-${tightLegWithoutStop.key}`,
        detail: `${tightLegWithoutStop.from} to ${tightLegWithoutStop.to} is longer than the current planning target of about ${legPlanningTargetNm.toFixed(0)} NM. Consider adding a comfort stop on that segment.`,
        action: {
          kind: "insert-comfort-stop",
          label: `Insert comfort stop between ${tightLegWithoutStop.from} and ${tightLegWithoutStop.to}`,
          from: tightLegWithoutStop.from,
          to: tightLegWithoutStop.to,
          fuelOnBoardGallons: Math.max(0, tightLegWithoutStop.fuelBeforeLeg),
        },
      });
    }

    return suggestions.slice(0, 3);
  }, [legNavRows, legPlanningTargetNm, orderedPlannedStops, planningFuel, reserveFuel]);
  const weatherStatusText = weatherData.length === 0
    ? "No METARs loaded"
    : hasThunderRisk
      ? "Thunder risk"
      : hasIfrWeather
        ? "IFR/LIFR risk"
        : "VFR/MVFR";
  const weatherStatusTone = weatherData.length === 0
    ? "text-[#A9BBCD]"
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
    ? "text-[#A9BBCD]"
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
  const plannerAppDeepLink = useMemo(() => {
    const params = new URLSearchParams();
    const departureCode = form.departure.trim().toUpperCase();
    const destinationCode = form.destination.trim().toUpperCase();
    if (departureCode) params.set("departure", departureCode);
    if (destinationCode) params.set("destination", destinationCode);
    return `readysetfly://flight-planner${params.toString() ? `?${params.toString()}` : ""}`;
  }, [form.departure, form.destination]);
  const isBriefingStale = latestBriefingUpdatedAtMs > 0 && Date.now() - latestBriefingUpdatedAtMs > 20 * 60 * 1000;
  const briefingUpdatedLabel = latestBriefingUpdatedAtMs
    ? new Date(latestBriefingUpdatedAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--";
  const briefingUpdatedTone = latestBriefingUpdatedAtMs === 0
    ? "text-[#A9BBCD]"
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
  const recentPlans = useMemo(() => savedPlansView.slice(0, 8), [savedPlansView]);

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

  const departureRunwayOptions = useMemo(() => {
    const runways = departureRunwayBriefingQuery.data?.runways || [];
    const options = new Map<string, { label: string; heading: number | null; lengthFt: number | null; source: "runway" | "advisory" | "metar" }>();

    const addOption = (
      ident: string | null | undefined,
      heading: number | null | undefined,
      lengthFt: number | null | undefined,
      source: "runway" | "advisory" | "metar",
    ) => {
      const normalized = extractRunwayIdent(ident);
      if (!normalized) return;
      if (options.has(normalized)) return;
      const parts = [normalized];
      if (heading !== null && heading !== undefined && Number.isFinite(heading)) {
        parts.push(`${Math.round(heading)} deg`);
      }
      if (lengthFt !== null && lengthFt !== undefined && Number.isFinite(lengthFt)) {
        parts.push(`${Math.round(lengthFt).toLocaleString()} ft`);
      }
      options.set(normalized, {
        label: parts.join(" · "),
        heading: heading ?? null,
        lengthFt: lengthFt ?? null,
        source,
      });
    };

    const advisoryRunway = extractRunwayIdent(departureRunwayBriefingQuery.data?.advisory?.runway);
    if (advisoryRunway) {
      addOption(
        advisoryRunway,
        departureRunwayBriefingQuery.data?.advisory?.heading ?? null,
        null,
        "advisory",
      );
    }

    const metarRunway = extractRunwayIdent(departureRunwayBriefingQuery.data?.runwayInUse);
    if (metarRunway) {
      addOption(metarRunway, parseRunwayHeading(metarRunway), null, "metar");
    }

    runways.forEach((runway) => {
      addOption(runway.leIdent, runway.leHeading ?? null, runway.lengthFt ?? null, "runway");
      addOption(runway.heIdent, runway.heHeading ?? null, runway.lengthFt ?? null, "runway");
    });

    const advisory = extractRunwayIdent(departureRunwayBriefingQuery.data?.advisory?.runway);
    const metar = extractRunwayIdent(departureRunwayBriefingQuery.data?.runwayInUse);

    return Array.from(options.entries())
      .map(([ident, value]) => ({ ident, ...value }))
      .sort((a, b) => {
        const score = (item: typeof a) => {
          if (item.ident === advisory) return 0;
          if (item.ident === metar) return 1;
          return 2;
        };
        const scoreDiff = score(a) - score(b);
        if (scoreDiff !== 0) return scoreDiff;
        return a.ident.localeCompare(b.ident);
      });
  }, [departureRunwayBriefingQuery.data]);

  const departureSuggestedRunway = useMemo(() => {
    return (
      extractRunwayIdent(departureRunwayBriefingQuery.data?.advisory?.runway) ||
      extractRunwayIdent(departureRunwayBriefingQuery.data?.runwayInUse) ||
      departureRunwayOptions[0]?.ident ||
      null
    );
  }, [departureRunwayBriefingQuery.data, departureRunwayOptions]);

  useEffect(() => {
    const departureIcao = departureResolved.trim().toUpperCase();
    if (!ICAO_REGEX.test(departureIcao)) {
      departureRunwayAutoAirportRef.current = null;
      return;
    }

    const options = departureRunwayOptions.map((item) => item.ident);
    const currentRunway = departureRunway.trim().toUpperCase();
    const airportChanged = departureRunwayAutoAirportRef.current !== departureIcao;
    const currentRunwayValid = currentRunway ? options.includes(currentRunway) : false;

    if (!departureSuggestedRunway) {
      if (airportChanged && !currentRunwayValid) {
        setDepartureRunway("");
        departureRunwayAutoAirportRef.current = departureIcao;
      }
      return;
    }

    if (!currentRunway || airportChanged || !currentRunwayValid) {
      setDepartureRunway(departureSuggestedRunway);
      departureRunwayAutoAirportRef.current = departureIcao;
    }
  }, [departureResolved, departureRunway, departureRunwayOptions, departureSuggestedRunway]);

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
  const overwaterLikely = Boolean(suggestionMeta?.overwaterLikely);

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

    if (overwaterLikely) {
      tools.push({
        id: "water-safety",
        title: "Overwater safety check",
        description: "This route likely spends meaningful time over water. Review flotation gear, ditching considerations, and whether the coastline assist is a better fit.",
        cta: "Review route analysis",
        href: "#route-analysis",
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
    overwaterLikely,
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
    if (overwaterLikely) {
      notes.push("This route likely includes a meaningful overwater segment. Review flotation devices, emergency locator gear, passenger briefing items, and whether a coastline-biased route is preferable.");
    }
    if (terrainAdjustmentRecommendation) {
      notes.push(terrainAdjustmentRecommendation.detail);
    }
    if (recommendedTerrainRoute && recommendedTerrainRoute.id !== "current" && recommendedTerrainRoute.available) {
      notes.push(
        recommendedTerrainRoute.minClearanceFt != null
          ? `${recommendedTerrainRoute.label} currently offers the best terrain margin at about ${Math.round(recommendedTerrainRoute.minClearanceFt).toLocaleString()} ft minimum clearance.`
          : `${recommendedTerrainRoute.label} currently offers the best terrain margin of the available helper routes.`
      );
    }
    notes.push(...terrainOperationalNotes);
    return notes;
  }, [enrouteIfr, enrouteTs, overwaterLikely, recommendedTerrainRoute, terrainAdjustmentRecommendation, terrainOperationalNotes]);

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
    if (worstTerrainSegment?.segment.risk === "warning") {
      risk = risk === "Normal" ? "Terrain Warning" : `${risk} + Terrain`;
    } else if (worstTerrainSegment?.segment.risk === "caution") {
      risk = risk === "Normal" ? "Terrain Caution" : `${risk} + Terrain`;
    }
    return risk;
  }, [weatherFindings, worstTerrainSegment]);
  const resetForm = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FLIGHT_PLANNER_DRAFT_KEY);
    }
    setActiveTab("route");
    setReturnToFileAfterSave(false);
    setPendingFilingActionAfterSave(null);
    setDraftPlanId(null);
    setEditingPlan(null);
      setFilingPreview(null);
      setShowFilingPayload(false);
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

  const plannerHasDraftContent = Boolean(
    editingPlan ||
    form.title ||
    form.departure ||
    form.destination ||
    form.route ||
    form.alternate ||
    form.plannedDepartureAt ||
    form.plannedArrivalAt ||
    form.aircraftType ||
    form.tailNumber ||
    form.fuelOnBoard ||
    form.notes ||
    waypointsInput ||
    plannedStopsInput ||
    departureRunway,
  );

  const handleClearForm = () => {
    if (
      plannerHasDraftContent &&
      typeof window !== "undefined" &&
      !window.confirm("Clear the current flight plan form and start fresh?")
    ) {
      return;
    }
    resetForm();
    toast({
      title: "Form cleared",
      description: "The planner is ready for a fresh flight plan.",
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

  const downloadFilingSummary = (plan: FlightPlan) => {
    const formatDateTime = (value?: string | Date | null) => {
      if (!value) return "—";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return "—";
      return parsed.toLocaleString();
    };

    const title = plan.title || `${plan.departure || "Departure"} to ${plan.destination || "Destination"}`;
    const status = filingStatusLabel(plan.filingStatus);
    const provider = plan.filingProvider || "leidos_flight_service";
    const providerPlanId = plan.filingProviderPlanId || "—";
    const versionStamp = extractClientVersionStamp(plan) || "—";
    const history = Array.isArray(plan.filingActionHistory) ? [...plan.filingActionHistory].slice().reverse().slice(0, 8) : [];
    const logoUrl = typeof window !== "undefined" ? new URL(logoImage, window.location.origin).toString() : logoImage;
    const generatedAt = new Date().toLocaleString();
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} - RSF Filing Summary</title>
    <style>
      @page { size: letter; margin: 0.55in; }
      :root {
        --ink: #10243b;
        --muted: #5d7289;
        --rule: #d9e2ec;
        --paper: #ffffff;
        --accent: #123d77;
        --soft: #eef4fb;
      }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: var(--ink); background: #eef2f7; }
      .toolbar { max-width: 920px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 10px; }
      .toolbar button { border: 0; border-radius: 999px; background: var(--accent); color: #fff; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
      .toolbar .hint { align-self: center; font-size: 12px; color: var(--muted); }
      .sheet { max-width: 920px; margin: 0 auto; background: var(--paper); border: 1px solid #d6e0eb; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 36px rgba(16,36,59,0.08); }
      .header { display: flex; align-items: center; gap: 16px; padding: 22px 26px; background: linear-gradient(135deg, #123d77 0%, #1f66d1 100%); color: #ffffff; }
      .header img { width: 52px; height: 52px; object-fit: contain; border-radius: 12px; background: rgba(255,255,255,0.14); padding: 6px; }
      .header .eyebrow { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.82; }
      .header .title { font-size: 27px; font-weight: 700; margin-top: 4px; }
      .header .subtitle { font-size: 14px; opacity: 0.92; margin-top: 6px; }
      .meta-bar { display: flex; justify-content: space-between; gap: 16px; padding: 10px 26px; background: var(--soft); border-bottom: 1px solid var(--rule); font-size: 12px; color: var(--muted); }
      .content { padding: 24px 26px 20px; display: grid; gap: 18px; }
      .panel { border: 1px solid var(--rule); border-radius: 14px; padding: 16px 18px; break-inside: avoid; page-break-inside: avoid; }
      .panel h2 { margin: 0 0 12px; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #4d6480; }
      .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cell .label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #71869d; margin-bottom: 5px; }
      .cell .value { font-size: 15px; font-weight: 600; color: var(--ink); word-break: break-word; }
      .route { font-family: "Courier New", monospace; font-size: 13px; white-space: pre-wrap; line-height: 1.5; }
      .clearance-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .clearance-card { border: 1px dashed #c9d7e6; border-radius: 12px; padding: 12px 14px; background: #fbfdff; }
      .clearance-card .label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #71869d; margin-bottom: 8px; }
      .write-line { height: 22px; border-bottom: 1px solid #cfd9e4; margin-bottom: 8px; }
      .write-line:last-child { margin-bottom: 0; }
      .clearance-prompts { margin: 10px 0 0; padding-left: 18px; color: var(--muted); font-size: 12px; line-height: 1.55; }
      .history-entry { border-top: 1px solid #e7edf4; padding-top: 12px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
      .history-entry:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
      .history-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; margin-bottom: 6px; }
      .muted { color: var(--muted); font-size: 13px; line-height: 1.5; }
      .footer { padding: 0 26px 24px; color: var(--muted); font-size: 11px; line-height: 1.6; }
      .print-note { margin-top: 8px; font-size: 11px; color: var(--muted); }
      @media (max-width: 720px) {
        body { padding: 12px; }
        .grid { grid-template-columns: 1fr; }
        .meta-bar { flex-direction: column; }
      }
      @media print {
        body { background: #ffffff; padding: 0; }
        .toolbar { display: none !important; }
        .sheet { box-shadow: none; border: 0; max-width: none; border-radius: 0; }
        .header { background: #ffffff !important; color: var(--ink) !important; border-bottom: 2px solid var(--accent); }
        .header img { background: transparent; border: 1px solid var(--rule); }
        .meta-bar { background: #ffffff; }
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <div class="hint">Use Print and choose Save as PDF for a PDF copy.</div>
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="sheet">
      <div class="header">
        <img src="${escapeHtml(logoUrl)}" alt="Ready Set Fly" />
        <div>
          <div class="eyebrow">Ready Set Fly</div>
          <div class="title">Flight Plan Filing Summary</div>
          <div class="subtitle">${escapeHtml(title)}</div>
        </div>
      </div>
      <div class="meta-bar">
        <div>Generated: ${escapeHtml(generatedAt)}</div>
        <div>RSF filing summary receipt</div>
      </div>
      <div class="content">
        <div class="panel">
          <h2>Submission Status</h2>
          <div class="grid">
            <div class="cell"><div class="label">Status</div><div class="value">${escapeHtml(status)}</div></div>
            <div class="cell"><div class="label">Provider</div><div class="value">${escapeHtml(provider)}</div></div>
            <div class="cell"><div class="label">Provider Flight ID</div><div class="value">${escapeHtml(providerPlanId)}</div></div>
            <div class="cell"><div class="label">Version Stamp</div><div class="value">${escapeHtml(versionStamp)}</div></div>
            <div class="cell"><div class="label">Last Provider Sync</div><div class="value">${escapeHtml(formatDateTime(plan.filingLastProviderSyncAt))}</div></div>
          </div>
        </div>
        <div class="panel">
          <h2>Flight Details</h2>
          <div class="grid">
            <div class="cell"><div class="label">Departure</div><div class="value">${escapeHtml(plan.departure || "—")}</div></div>
            <div class="cell"><div class="label">Destination</div><div class="value">${escapeHtml(plan.destination || "—")}</div></div>
            <div class="cell"><div class="label">Alternate</div><div class="value">${escapeHtml(plan.alternate || "—")}</div></div>
            <div class="cell"><div class="label">Flight Rules</div><div class="value">${escapeHtml(plan.filingFlightRules || "VFR")}</div></div>
            <div class="cell"><div class="label">Planned Departure</div><div class="value">${escapeHtml(formatDateTime(plan.plannedDepartureAt))}</div></div>
            <div class="cell"><div class="label">Planned Arrival</div><div class="value">${escapeHtml(formatDateTime(plan.plannedArrivalAt))}</div></div>
            <div class="cell"><div class="label">Aircraft / Tail</div><div class="value">${escapeHtml(plan.tailNumber || "—")}</div></div>
            <div class="cell"><div class="label">Aircraft Type</div><div class="value">${escapeHtml(plan.aircraftType || "—")}</div></div>
            <div class="cell"><div class="label">Expected Flight Altitude</div><div class="value">${escapeHtml(plan.filingPlannedAltitudeFt ? `${plan.filingPlannedAltitudeFt.toLocaleString()} ft` : "—")}</div></div>
            <div class="cell"><div class="label">True Airspeed</div><div class="value">${escapeHtml(plan.filingTrueAirspeedKtas ? `${plan.filingTrueAirspeedKtas} KTAS` : "—")}</div></div>
            <div class="cell"><div class="label">Endurance / Souls</div><div class="value">${escapeHtml(`${formatMinutesLabel(Number(plan.filingEnduranceMinutes || 0))} / ${plan.filingSoulsOnBoard || "—"} onboard`)}</div></div>
            <div class="cell"><div class="label">Estimated Enroute Time</div><div class="value">${escapeHtml(plan.filingEstimatedEnrouteMinutes ? formatMinutesLabel(Number(plan.filingEstimatedEnrouteMinutes)) : "—")}</div></div>
            <div class="cell"><div class="label">Total Fuel Required</div><div class="value">${escapeHtml(plan.fuelRequired ? `${plan.fuelRequired} gal` : "—")}</div></div>
            <div class="cell"><div class="label">Fuel On Board</div><div class="value">${escapeHtml(plan.fuelOnBoard ? `${plan.fuelOnBoard} gal` : "—")}</div></div>
          </div>
        </div>
        <div class="panel">
          <h2>Clearance / Readback Notes</h2>
          <div class="muted">Use this space for ATC clearance notes and route changes after filing.</div>
          <ul class="clearance-prompts">
            <li>Cleared to __ via __</li>
            <li>Expect FL__/__ altitude __ minutes after departure</li>
            <li>Departure frequency __</li>
            <li>Squawk __</li>
          </ul>
          <div class="clearance-grid" style="margin-top:14px;">
            <div class="clearance-card">
              <div class="label">Primary Readback Notes</div>
              <div class="write-line"></div>
              <div class="write-line"></div>
              <div class="write-line"></div>
              <div class="write-line"></div>
              <div class="write-line"></div>
            </div>
            <div class="clearance-card">
              <div class="label">Route Change / New Waypoint</div>
              <div class="write-line"></div>
              <div class="write-line"></div>
              <div class="write-line"></div>
              <div class="write-line"></div>
              <div class="write-line"></div>
            </div>
          </div>
        </div>
        <div class="panel">
          <h2>Filed Route</h2>
          <div class="cell">
            <div class="label">Enroute String</div>
            <div class="value route">${escapeHtml(plan.route || "—")}</div>
          </div>
          <div class="grid" style="margin-top:14px;">
            <div class="cell"><div class="label">Other ICAO Info</div><div class="value">${escapeHtml(plan.filingOtherInfo || "—")}</div></div>
            <div class="cell"><div class="label">Filing Remarks</div><div class="value">${escapeHtml(plan.filingRemarks || plan.notes || "—")}</div></div>
          </div>
        </div>
        <div class="panel">
          <h2>Lifecycle History</h2>
          ${history.length > 0 ? history.map((entry: any) => `
            <div class="history-entry">
              <div class="history-head">
                <span>${escapeHtml(String(entry?.action || "Unknown action").toUpperCase())}</span>
                <span>${escapeHtml(formatDateTime(entry?.stagedAt))}</span>
              </div>
              <div class="muted">${escapeHtml(entry?.message || "No summary available.")}</div>
            </div>
          `).join("") : `<div class="muted">No filing lifecycle history has been recorded yet.</div>`}
        </div>
      </div>
      <div class="footer">
        Generated by Ready Set Fly.<br />
        Flight planning and filing workflow may still be under testing. Verify operational status and official provider acceptance before relying on any submission.
        <div class="print-note">This summary is intended as a filing receipt and reference copy. The official plan state remains in Ready Set Fly and the connected filing provider.</div>
      </div>
    </div>
  </body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rsf-filing-summary-${(plan.departure || "dep").toLowerCase()}-${(plan.destination || "dest").toLowerCase()}-${plan.id.slice(0, 8)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    trackEvent("planner_filing_summary_download", {
      plan_id: plan.id,
      filing_status: plan.filingStatus || "draft",
      departure: plan.departure || undefined,
      destination: plan.destination || undefined,
    });
    toast({
      title: "Filing summary downloaded",
      description: "Saved an RSF-branded filing summary for this plan.",
    });
  };

  const saveCurrentPlan = async (options?: { returnToFile?: boolean }) => {
    if (!isAuthenticated) return;

    if (options?.returnToFile) {
      setReturnToFileAfterSave(true);
    }

    const currentEditingPlan = editingPlanRef.current;
    if (currentEditingPlan?.id) {
      trackEvent("planner_save_plan", { action: "update" });
      updatePlanMutation.mutate(currentEditingPlan.id);
      return;
    }

    if (draftPlanIdRef.current) {
      trackEvent("planner_save_plan", { action: "update" });
      updatePlanMutation.mutate(draftPlanIdRef.current);
      return;
    }

    trackEvent("planner_save_plan", { action: "create" });
    createPlanMutation.mutate();
  };

  const beginAmendWorkflow = (plan: FlightPlan) => {
    const canSubmitLiveAmend = canSubmitAmendForPlan(plan);
    setDraftPlanId(plan.id);
    setEditingPlan(plan);
    setReturnToFileAfterSave(false);
    setPendingFilingActionAfterSave(null);

    if (!canSubmitLiveAmend) {
      setActiveTab("route");
      toast({
        title: "Plan loaded to edit and refile",
        description: "Make your changes, then save and continue to filing. This plan will need to be filed again because live amend is not available for this saved record.",
      });
      return;
    }

    setActiveTab("route");
    toast({
      title: "Filed plan loaded for amendment",
      description: "Make your changes anywhere in the planner, then return to File & Save and click Amend to submit the updated plan to Leidos.",
    });
  };

  const applyFiledRouteToPlanner = (route: string) => {
    const nextRoute = route.trim().toUpperCase();
    const intermediateAirports = extractIntermediateAirportTokensForAppliedRoute({
      route: nextRoute,
      departure: departureResolved || form.departure || "",
      destination: destinationResolved || form.destination || "",
    });

    setForm((current) => ({ ...current, route: nextRoute }));
    setWaypointsInput(intermediateAirports.join(" "));
    setPlannedStopsInput("");
  };

  const createPlanMutation = useMutation({
    mutationFn: async () => {
        const payload = {
          ...form,
          fuelOnBoard: form.fuelOnBoard?.trim() ? form.fuelOnBoard.trim() : "",
          route: activeFiledRoute || null,
          aircraftType: getPlannerAircraftTypeValue({
            manualAircraftType: form.aircraftType,
            selectedProfile,
            selectedType,
            selectedTypeId,
          }),
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
          plannerState: buildPlannerStateSnapshot({
            selectedProfileId,
            selectedTypeId,
            selectedTypeIcao: selectedType?.icaoType?.trim() || null,
            selectedTypeMaxGrossWeightLb: selectedType?.max_gross_weight_lb_effective ?? null,
            selectedProfileMaxGrossWeightLb: selectedProfile?.max_gross_weight_lb_effective ?? null,
            customProfile,
          }),
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
    onSuccess: (savedPlan: FlightPlan) => {
      queryClient.setQueryData<FlightPlan[]>(["/api/flight-plans"], (current = []) =>
        mergePlanIntoList(current, savedPlan)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      setDraftPlanId(savedPlan.id);
      setEditingPlan(savedPlan);
      setPendingFilingActionAfterSave(null);
      if (returnToFileAfterSave) {
        setActiveTab("file");
        setReturnToFileAfterSave(false);
        toast({
          title: "Flight plan saved",
          description: "The saved plan is ready in File & Save for filing actions.",
        });
        return;
      }
      setReturnToFileAfterSave(false);
      toast({
        title: "Flight plan saved",
        description: "This saved plan stays active so additional changes update the same record.",
      });
    },
    onError: (error: any) => {
      setPendingFilingActionAfterSave(null);
      setReturnToFileAfterSave(false);
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const payload = {
        ...form,
        fuelOnBoard: form.fuelOnBoard?.trim() ? form.fuelOnBoard.trim() : "",
        route: activeFiledRoute || null,
        aircraftType: getPlannerAircraftTypeValue({
          manualAircraftType: form.aircraftType,
          selectedProfile,
          selectedType,
          selectedTypeId,
        }),
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
        plannerState: buildPlannerStateSnapshot({
          selectedProfileId,
          selectedTypeId,
          selectedTypeIcao: selectedType?.icaoType?.trim() || null,
          selectedTypeMaxGrossWeightLb: selectedType?.max_gross_weight_lb_effective ?? null,
          selectedProfileMaxGrossWeightLb: selectedProfile?.max_gross_weight_lb_effective ?? null,
          customProfile,
        }),
        plannedDepartureAt: form.plannedDepartureAt
          ? toUtcIso(form.plannedDepartureAt, departureTimeZone)
          : null,
        plannedArrivalAt: form.plannedArrivalAt
          ? toUtcIso(form.plannedArrivalAt, destinationTimeZone)
          : null,
      };
      const res = await apiRequest("PATCH", `/api/flight-plans/${planId}`, payload);
      return res.json();
    },
    onSuccess: (updatedPlan: FlightPlan | null) => {
      if (updatedPlan) {
        queryClient.setQueryData<FlightPlan[]>(["/api/flight-plans"], (current = []) =>
          mergePlanIntoList(current, updatedPlan)
        );
      }
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      if (updatedPlan) {
        setDraftPlanId(updatedPlan.id);
        setEditingPlan(updatedPlan);
      }
      if (pendingFilingActionAfterSave && updatedPlan) {
        setActiveTab("file");
        setReturnToFileAfterSave(false);
        toast({
          title: "Flight plan updated",
          description: "Submitting the amended plan to Leidos.",
        });
        filingActionMutation.mutate({ planId: updatedPlan.id, action: pendingFilingActionAfterSave.action });
        setPendingFilingActionAfterSave(null);
        return;
      }
      if (returnToFileAfterSave && updatedPlan) {
        setActiveTab("file");
        setReturnToFileAfterSave(false);
        toast({
          title: "Flight plan updated",
          description: "Review the updated plan and submit File or Amend from the filing tab.",
        });
        return;
      }
      setReturnToFileAfterSave(false);
      toast({
        title: "Flight plan updated",
        description: "Changes were saved to the current plan.",
      });
    },
    onError: (error: any) => {
      setPendingFilingActionAfterSave(null);
      setReturnToFileAfterSave(false);
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/flight-plans/${id}`);
      return res.json();
    },
    onSuccess: (_result, deletedId) => {
      queryClient.setQueryData<FlightPlan[]>(["/api/flight-plans"], (current = []) =>
        current.filter((plan) => plan.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      setDeleteConfirmPlan((current) => (current?.id === deletedId ? null : current));
      if (editingPlanRef.current?.id === deletedId || draftPlanIdRef.current === deletedId) {
        setDraftPlanId(null);
        setEditingPlan(null);
      }
      toast({ title: "Flight plan deleted" });
    },
    onError: (error: any) => {
      setDeleteConfirmPlan(null);
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
  const guestFlightPlanFileLimitReached = isGuest && guestFlightPlanFiles >= 2;
  const guestFlightPlanFilesRemaining = Math.max(0, 2 - guestFlightPlanFiles);
  const filingStateText = filingPreviewMutation.isPending ? "Preview building" : "Packet ready";
  const filingStateTone = filingPreviewMutation.isPending ? "text-amber-300" : "text-emerald-300";
  const currentSavedPlan = editingPlan || savedPlans.find((plan) => plan.id === draftPlanId) || null;
  const currentSavedPlanFlightRules = (currentSavedPlan?.filingFlightRules || filingDraft.flightRules || "VFR").toUpperCase();
  const currentSavedPlanStatus = filingStatusLabel(currentSavedPlan?.filingStatus);
  const currentSavedPlanCanAmend = canSubmitAmendForPlan(currentSavedPlan);
  const currentSavedPlanCanActivate = canActivatePlan(currentSavedPlan);
  const currentSavedPlanCanClose = canClosePlan(currentSavedPlan);
  const currentSavedPlanCanCancel = canCancelPlan(currentSavedPlan);
  const hasCurrentSavedPlan = Boolean(currentSavedPlan?.id);
  const draftAmendAvailabilityMessage = useMemo(
    () =>
      getDraftAmendAvailabilityMessage({
        plan: currentSavedPlan,
        flightRules: filingDraft.flightRules,
        route: activeFiledRoute || null,
        plannedDepartureAt: form.plannedDepartureAt || null,
        trueAirspeedKtas: Math.round(planningCruise) || null,
        plannedAltitudeFt: plannedAltitude ? Number(plannedAltitude) : null,
      }),
    [
      currentSavedPlan,
      filingDraft.flightRules,
      activeFiledRoute,
      form.plannedDepartureAt,
      planningCruise,
      plannedAltitude,
    ],
  );
  const currentDraftCanAmend = !draftAmendAvailabilityMessage;

  const filingActionMutation = useMutation({
    mutationFn: async ({ planId, action }: { planId: string; action: "file" | "amend" | "activate" | "cancel" | "close" }) => {
      const res = await apiRequest("POST", `/api/flight-plans/${planId}/filing-action`, { action });
      return res.json();
    },
    onSuccess: (result: any, variables) => {
      if (result?.plan) {
        queryClient.setQueryData<FlightPlan[]>(["/api/flight-plans"], (current = []) =>
          mergePlanIntoList(current, result.plan)
        );
        setDraftPlanId(result.plan.id);
        setEditingPlan(result.plan);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({
        title: `${variables.action[0].toUpperCase()}${variables.action.slice(1)} ${result?.live ? "submitted" : "staged"}`,
        description: result?.message || "The provider handoff was recorded.",
      });
    },
    onError: (error: any) => {
      setPendingFilingActionAfterSave(null);
      toast({
        title: isLeidosTimeoutMessage(error?.message) ? "Leidos is taking longer than usual" : "Staging failed",
        description: summarizePlannerError(error?.message),
        variant: "destructive",
      });
    },
  });

  const filingSyncMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("POST", `/api/flight-plans/${planId}/filing-sync`);
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result?.plan) {
        queryClient.setQueryData<FlightPlan[]>(["/api/flight-plans"], (current = []) =>
          mergePlanIntoList(current, result.plan)
        );
        if (editingPlanRef.current?.id === result.plan.id) {
          setEditingPlan(result.plan);
        }
        setDraftPlanId(result.plan.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({
        title: result?.versionStamp ? "Provider sync refreshed" : "Provider sync checked",
        description: result?.message || "RSF refreshed the Leidos provider state.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Provider sync failed",
        description: summarizePlannerError(error?.message),
        variant: "destructive",
      });
    },
  });

  const insertComfortStopMutation = useMutation({
    mutationFn: async ({
      from,
      to,
      fuelOnBoardGallons,
    }: {
      from: string;
      to: string;
      fuelOnBoardGallons: number;
    }) => {
      const params = new URLSearchParams({
        departure: from,
        destination: to,
        cruiseKtas: String(planningCruise),
        fuelBurnGph: String(planningBurn),
        usableFuelGal: String(planningFuel),
        reserveMinutes: String(reserveMinutes),
      });
      if (Number.isFinite(fuelOnBoardGallons) && fuelOnBoardGallons > 0) {
        params.set("fuelOnBoard", String(fuelOnBoardGallons));
      }
      const res = await fetch(apiUrl(`/api/airports/route-suggestions?${params.toString()}`));
      if (!res.ok) {
        throw new Error("Unable to search for a comfort stop on that leg.");
      }
      const payload = await res.json() as RouteSuggestionResponse;
      const candidate = payload.plannedStops?.[0] || null;
      if (!candidate) {
        throw new Error(`RSF could not find a good intermediate fuel stop between ${from} and ${to} with the current planning assumptions.`);
      }
      const legDistanceNm = payload.meta?.routeDistanceNm ?? null;
      const legFuelGallons =
        legDistanceNm != null && planningCruise > 0 && planningBurn > 0
          ? (legDistanceNm / planningCruise) * planningBurn
          : null;
      const arrivalFuelGallons =
        legFuelGallons != null
          ? Math.max(0, fuelOnBoardGallons - legFuelGallons)
          : Math.max(0, fuelOnBoardGallons * 0.4);
      const suggestedUpliftGallons = Math.max(0, planningFuel - arrivalFuelGallons);
      return { from, to, candidate, suggestedUpliftGallons };
    },
    onSuccess: ({ candidate, from, to, suggestedUpliftGallons }) => {
      if (plannedStops.includes(candidate)) {
        toast({
          title: "Comfort stop already in plan",
          description: `${candidate} is already part of the planned stop list.`,
        });
        return;
      }
      const nextStops = Array.from(new Set([...plannedStops, candidate]));
      setPlannedStopsInput(nextStops.join(" "));
      setPlannedFuelUplifts((current) => ({
        ...current,
        [candidate]: suggestedUpliftGallons > 0 ? suggestedUpliftGallons.toFixed(1) : current[candidate] || "",
      }));
      toast({
        title: "Comfort stop inserted",
        description:
          suggestedUpliftGallons > 0
            ? `${candidate} was added between ${from} and ${to}, and RSF seeded about ${suggestedUpliftGallons.toFixed(1)} gal as the planned uplift.`
            : `${candidate} was added between ${from} and ${to} in the local planner draft.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "No comfort stop found",
        description: error?.message || "RSF could not insert a stop on that leg with the current planning assumptions.",
        variant: "destructive",
      });
    },
  });

  const guestFileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/flight-plans/guest-file", filingPacket);
      return res.json() as Promise<{ live: boolean; message: string; providerPlanId?: string | null }>;
    },
    onSuccess: (result) => {
      recordAnonFlightPlanFile();
      setGuestFlightPlanFiles((current) => current + 1);
      toast({
        title: result.live ? "Guest flight plan submitted" : "Guest filing staged",
        description: result.live
          ? "RSF submitted this guest filing to Leidos. Create a free account to save future plans and manage amendments."
          : (result.message || "RSF processed the guest filing request."),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Guest filing failed",
        description: error.message || "Unable to submit the guest flight plan.",
        variant: "destructive",
      });
    },
  });

  savePlanActionRef.current = async () => {
    await saveCurrentPlan();
  };

  saveProfileActionRef.current = async () => {
    if (!isAuthenticated) return;
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
    if (skipNextEditingPlanHydrationRef.current) {
      skipNextEditingPlanHydrationRef.current = false;
      return;
    }
    setDraftPlanId(editingPlan.id);
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
    const plannerState =
      editingPlan.plannerState && typeof editingPlan.plannerState === "object" && !Array.isArray(editingPlan.plannerState)
        ? editingPlan.plannerState as Record<string, any>
        : null;
    if (plannerState?.customProfile && typeof plannerState.customProfile === "object") {
      setCustomProfile((prev) => ({
        ...prev,
        ...plannerState.customProfile,
      }));
    }
    if (typeof plannerState?.selectedProfileId === "string") {
      setSelectedProfileId(plannerState.selectedProfileId);
    }
    if (typeof plannerState?.selectedTypeId === "string") {
      setSelectedTypeId(plannerState.selectedTypeId);
    }
    if (typeof plannerState?.selectedProfileId === "string" || typeof plannerState?.selectedTypeId === "string") {
      setArrivalAuto(false);
      return;
    }
    const normalizedTail = normalizeAircraftLabel(editingPlan.tailNumber);
    const normalizedAircraftType = normalizeAircraftLabel(editingPlan.aircraftType);
    const matchingProfile = savedProfiles.find((profile) => {
      const profileTail = normalizeAircraftLabel(profile.tailNumber);
      const profileName = normalizeAircraftLabel(profile.name);
      return (
        (normalizedTail && profileTail === normalizedTail) ||
        (normalizedAircraftType && profileName === normalizedAircraftType)
      );
    });
    if (matchingProfile) {
      setSelectedProfileId(matchingProfile.id);
      setSelectedTypeId(matchingProfile.typeId || CUSTOM_TYPE_ID);
    } else {
      const matchingType = aircraftTypes.find((type) => aircraftTypeMatchesPlan(type, editingPlan.aircraftType));
      if (matchingType) {
        setSelectedProfileId("none");
        setSelectedTypeId(matchingType.id);
      } else if (normalizedAircraftType) {
        setSelectedProfileId("none");
        setSelectedTypeId(CUSTOM_TYPE_ID);
      }
    }
    setArrivalAuto(false);
  }, [aircraftTypes, editingPlan, savedProfiles]);

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

  const plannerPanelClass = "rsf-card-shell rounded-[1.35rem] text-[#E8EDF4]";
  const plannerCardTitleClass = "text-[#F5F8FC]";
  const plannerCardDescriptionClass = "text-[#A9BBCD]";
  const plannerMetricClass = "rsf-planner-metric px-3 py-2.5";
  const plannerSubpanelClass = "rsf-planner-subpanel";
  const plannerSubpanelMutedClass = "rounded-[1rem] border border-[#5d6f85]/16 bg-[#0f141a]/92 p-3 text-[#A9BBCD] shadow-[0_16px_36px_-28px_rgba(0,0,0,0.88)]";
  const plannerSubpanelInfoClass = "rounded-[1rem] border border-[#2e4c74]/34 bg-[linear-gradient(180deg,rgba(18,25,36,0.98),rgba(11,16,23,0.98))] p-3 text-[#C7D7EA] shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)]";
  const plannerSubpanelSuccessClass = "rounded-[1rem] border border-[#2f7a6a]/36 bg-[linear-gradient(180deg,rgba(15,31,28,0.98),rgba(10,18,17,0.98))] p-3 text-[#CFE7DF] shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)]";
  const plannerSubpanelWarningClass = "rounded-[1rem] border border-[#7f6327]/38 bg-[linear-gradient(180deg,rgba(36,27,12,0.98),rgba(19,14,7,0.98))] p-3 text-[#F2DCA4] shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)]";
  const plannerSubpanelDangerClass = "rounded-[1rem] border border-[#7a3440]/38 bg-[linear-gradient(180deg,rgba(34,15,19,0.98),rgba(17,10,12,0.98))] p-3 text-[#F4CDD3] shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)]";
  const plannerSelectContentClass = "border-[#5d6f85]/30 bg-[#11161d] text-[#E8EDF4] shadow-[0_22px_44px_-30px_rgba(0,0,0,0.9)]";
  const plannerInsetActionClass = "border-[#5d6f85]/30 bg-[#141b24] text-[#E8EDF4] hover:bg-[#1a2430]";
  const jumpToPlannerSection = (sectionId: string, tab?: FlightPlannerTab) => {
    if (tab) {
      setActiveTab(tab);
    }
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
    <PageShell
      kicker="Plan"
      title="Plan a Flight"
      description={
        "Build the route, check the conditions, and keep the trip ready to save or file."
      }
      actions={
        pressDemo.enabled ? undefined : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="rsf-metal-button-secondary"
              onClick={openScratchPad}
            >
              ✏ Scratch Pad
            </Button>
          </>
        )
      }
      canopyClassName="rsf-metal-hero border-b border-white/10"
      contentClassName={cn(
        "rsf-planner-theme max-w-[1400px] space-y-6 overflow-x-clip p-4 sm:p-6",
        isMobile && "space-y-4 p-3 pb-24 text-[#E8EDF4]"
      )}
    >
      <UpgradePromptDialog
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        toolName="Flight Planner"
        toolSummary="Route builder, advisory analysis, and flight-plan tracking."
        freeFeatures={[
          "Build routes with basic advisory summaries.",
          "Live METAR/TAF, runway, and NOTAM context.",
          "Free accounts can save and manage flight plans.",
          "Guest access includes two direct filings before signup is required.",
        ]}
      />
      {pressDemo.enabled && (
        <PressDemoBanner
          pageLabel="Flight Planner"
          stepIndex={pressDemo.stepIndex}
          totalSteps={pressDemo.steps.length}
          currentStep={pressDemo.currentStep}
          onPrevious={pressDemo.previousStep}
          onNext={pressDemo.nextStep}
          onExit={pressDemo.exitDemo}
        />
      )}
      {!pressDemo.enabled && (
      <Card className={plannerPanelClass}>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[#5d6f85]/35 bg-[#141d29] text-[#d6e4ff] hover:bg-[#141d29]">IFR Scratch Pad</Badge>
              <Badge variant="outline" className="border-[#5d6f85]/30 bg-[#141b24] text-[#d7e1ef]">CRAFT</Badge>
              {scratchPadHasContent && (
                <Badge variant="secondary" className="border-0 bg-[#21324a] text-[#e3ecfb]">Notes saved</Badge>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#F5F8FC]">Write IFR clearance notes with your finger, stylus, or keyboard.</div>
              <div className="text-sm text-[#A9BBCD]">
                Ink Pad is fastest for live readback. CRAFT fields stay available when you want the structured version, and both auto-save on this device.
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-[220px]">
            <Button onClick={openScratchPad} className="rsf-metal-button-primary">
              {scratchPadHasContent ? "Open scratch pad" : "Start scratch pad"}
            </Button>
            <div className="text-xs text-[#A9BBCD]">
              Opens full-screen. Press <span className="font-mono">Esc</span> to close.
            </div>
          </div>
        </CardContent>
      </Card>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_540px]">
      <div className="min-w-0 space-y-4">
      {!pressDemo.enabled && (
      <Card className={plannerPanelClass}>
        <CardHeader className="pb-3">
          <CardTitle className={cn("text-base", plannerCardTitleClass)}>Recent Flights</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Open a saved route without leaving the planner.</CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="text-sm text-[#A9BBCD]">Loading plans...</div>
          ) : recentPlans.length === 0 ? (
            <div className="text-sm text-[#A9BBCD]">No saved plans yet.</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                size="sm"
                className="min-w-[170px] rsf-metal-button-primary"
                onClick={handleClearForm}
              >
                Clear form
              </Button>
              {recentPlans.map((plan) => (
                <button
                  key={`recent-${plan.id}`}
                  type="button"
                  onClick={() => {
                    setPendingFilingActionAfterSave(null);
                    setDraftPlanId(plan.id);
                    setEditingPlan(plan);
                  }}
                  className="min-w-[230px] rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(22,27,35,0.98),rgba(14,18,24,0.98))] px-3 py-2 text-left transition-all duration-200 hover:-translate-y-px hover:border-[#6f86a7]/35 hover:bg-[linear-gradient(180deg,rgba(28,35,46,0.98),rgba(16,21,28,0.98))]"
                >
                  <div className="truncate text-sm font-semibold text-[#F3F7FC]">{plan.title || `${plan.departure} to ${plan.destination}`}</div>
                  <div className="text-xs text-[#B6C7D9]">{plan.departure} to {plan.destination}</div>
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("min-w-[170px]", plannerInsetActionClass)}
                onClick={() => setActiveTab("file")}
              >
                Open saved plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}
      <Card id="planner-route-setup" className={plannerPanelClass}>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7">
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Route</div>
              <div className="truncate text-base font-semibold text-[#F5F8FC]">
                {(form.departure || "---").toUpperCase()} to {(form.destination || "---").toUpperCase()}
              </div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Legs</div>
              <div className="text-base font-semibold text-[#F5F8FC]">{legNavRows.length || 0}</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Distance</div>
              <div className="text-base font-semibold text-[#F5F8FC]">{totalDistance ? `${totalDistance.toFixed(1)} NM` : "--"}</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Fuel</div>
              <div className="text-base font-semibold text-[#F5F8FC]">{totalFuel ? `${totalFuel.toFixed(1)} gal` : "--"}</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Weather</div>
              <div className={cn("text-base font-semibold", weatherStatusTone)}>{weatherStatusText}</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Checklist</div>
              <div className="text-base font-semibold text-[#F5F8FC]">{checklistCompletionCount}/6 complete</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8fa6c0]">Briefing Sync</div>
              <div className={cn("text-base font-semibold", briefingUpdatedTone)}>
                {briefingUpdatedLabel}
                {isBriefingStale ? " (stale)" : latestBriefingUpdatedAtMs > 0 ? " (fresh)" : ""}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Alert className="border-[#6b5828] bg-[linear-gradient(180deg,rgba(36,28,14,0.96),rgba(24,18,10,0.98))] text-[#e7c27b]">
        <AlertDescription className="space-y-1 text-sm">
          <div className="font-semibold text-[#F5E6BF]">Flight Planner testing notice</div>
          <div>
            RSF flight planning and filing workflow is still undergoing testing. Treat the planner as a beta feature and do not rely on RSF for operational live filing yet.
          </div>
          <div className="text-[#D9A441]/90">
            Live Leidos filing remains limited to controlled testing while validation is in progress.
          </div>
        </AlertDescription>
      </Alert>
      <OpenInAppBanner
        title="Use the app for native in-flight tracking"
        description="RSF on the web is the right place to build routes, review hazards, save plans, and file with Flight Service. For tablet flying with direct ADS-B receiver traffic and native ownship tracking, open the RSF app."
        deepLink={plannerAppDeepLink}
        note="Your web plan stays useful for planning and testing. Opening the app is mainly for native cockpit use."
      />
      {isMobile && (
        <Card className={plannerPanelClass}>
          <CardContent className="space-y-3 p-3">
            <div className="text-sm font-semibold text-[#F5F8FC]">Phone Quick Planner</div>
            <div className="text-xs text-[#A9BBCD]">
              Use quick jumps for the dense planner sections. Full planning stays available; this just keeps the phone workflow navigable.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => jumpToPlannerSection("planner-route-setup", "route")}>Route</Button>
              <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => jumpToPlannerSection("planner-distance-performance", "route")}>Performance</Button>
              <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => setActiveTab("weather")}>Weather</Button>
              <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => setActiveTab("analysis")}>Analysis</Button>
              <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => jumpToPlannerSection("planner-route-map", "route")}>Map</Button>
              <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => setActiveTab("file")}>File & Save</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FlightPlannerTab)} className="min-w-0 space-y-4">
        <TabsList
          className={cn(
            "grid h-auto w-full grid-cols-2 gap-2 rounded-[1.2rem] border p-1.5 md:grid-cols-5",
            isMobile && "p-1.5"
          )}
        >
          <TabsTrigger value="route" className="h-10 rounded-[0.95rem]">Route</TabsTrigger>
          <TabsTrigger value="weather" className="h-10 rounded-[0.95rem]">Weather</TabsTrigger>
          <TabsTrigger value="navlog" className="h-10 rounded-[0.95rem]">Nav Log</TabsTrigger>
          <TabsTrigger value="analysis" className="h-10 rounded-[0.95rem]">Analysis</TabsTrigger>
          <TabsTrigger value="file" className="h-10 rounded-[0.95rem]">File &amp; Save</TabsTrigger>
        </TabsList>
        <TabsContent value="route" className="min-w-0 space-y-6">
      <PressDemoSpotlight
        active={pressDemo.isActive("route-setup")}
        stepNumber={(pressDemo.getStep("route-setup")?.index ?? 0) + 1}
        title={pressDemo.getStep("route-setup")?.title ?? "Route Setup"}
        body={pressDemo.getStep("route-setup")?.body ?? ""}
      >
      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Quick Planning References</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Open and hide each reference as needed without leaving the planner workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full space-y-2">
            <AccordionItem value="airport-conditions" className="rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-4">
              <AccordionTrigger className="text-sm">Airport conditions</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3 text-sm text-[#A9BBCD]">
                <p>Jump to the route weather summary already on this page.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => jumpToSection("route-weather-summary", "planner_jump_weather_summary", "weather")}>
                    Go to weather summary
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="airspace-review" className="rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-4">
              <AccordionTrigger className="text-sm">Airspace review</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3 text-sm text-[#A9BBCD]">
                <p>Review route conflicts in this page, or open the full TFR map in a new tab.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} onClick={() => jumpToSection("route-analysis", "planner_jump_route_analysis", "analysis")}>
                    Go to route analysis
                  </Button>
                  <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} asChild>
                    <a href="/tfr-map" target="_blank" rel="noopener noreferrer">Open full TFR map</a>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="approach-plates" className="rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-4">
              <AccordionTrigger className="text-sm">Approach plates</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3 text-sm text-[#A9BBCD]">
                <p>Open RSF approach plates in a new tab while keeping the planner route loaded here.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className={plannerInsetActionClass} asChild>
                    <a href="/approach-plates" target="_blank" rel="noopener noreferrer">Open approach plates</a>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Route Setup</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Enter airports, pick your aircraft, and add waypoints or stops before you plot the trip.</CardDescription>
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
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] p-2 text-sm">
                {departureSuggestions.map((airport) => (
                  <button
                    key={`${airport.icao}-${airport.name ?? ""}`}
                    type="button"
                    className="w-full rounded-[0.8rem] px-2 py-1 text-left transition-colors hover:bg-[#1a2430]"
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
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] p-2 text-sm">
                {destinationSuggestions.map((airport) => (
                  <button
                    key={`${airport.icao}-${airport.name ?? ""}`}
                    type="button"
                    className="w-full rounded-[0.8rem] px-2 py-1 text-left transition-colors hover:bg-[#1a2430]"
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
                list="departure-runway-options"
                placeholder={departureSuggestedRunway || "Select runway"}
              />
              <datalist id="departure-runway-options">
                {departureRunwayOptions.map((option) => (
                  <option key={option.ident} value={option.ident}>
                    {option.label}
                  </option>
                ))}
              </datalist>
              {departureRunwayOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {departureRunwayOptions.slice(0, 6).map((option) => (
                    <Button
                      key={option.ident}
                      type="button"
                      size="sm"
                      className={departureRunway === option.ident ? "rsf-metal-button-primary" : plannerInsetActionClass}
                      onClick={() => setDepartureRunway(option.ident)}
                    >
                      {option.ident}
                    </Button>
                  ))}
                </div>
              )}
              {departureRunwayBriefingQuery.data && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {departureRunwayBriefingQuery.data.advisory?.runway && (
                    <div>
                      Suggested from current wind:{" "}
                      <span className="font-medium text-foreground">
                        {departureRunwayBriefingQuery.data.advisory.runway}
                      </span>
                    </div>
                  )}
                  {departureRunwayBriefingQuery.data.runwayInUse && (
                    <div>
                      METAR runway in use:{" "}
                      <span className="font-medium text-foreground">
                        {departureRunwayBriefingQuery.data.runwayInUse}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pulling live runway options for the selected departure airport. You can still type a manual runway if needed.
              </p>
            </div>
            <div className={cn("md:col-span-2 p-4 space-y-3", plannerSubpanelClass)}>
              <div className="flex flex-col gap-1">
                <div className="font-semibold text-[#F5F8FC]">Aircraft setup</div>
                <div className="text-xs text-[#A9BBCD]">
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
                    <SelectContent className={cn("max-h-72 overflow-y-auto", plannerSelectContentClass)}>
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
                    <SelectContent className={plannerSelectContentClass}>
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
              <div className="text-xs text-[#A9BBCD]">
                Saved profiles override library values when selected. This prefill is one of RSF's strongest planning workflow advantages.
              </div>
              {selectedTypeNeedsVerification && (
                <Alert className="border-[#D9A441] bg-[#271d0b] text-[#D9A441]">
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
              {autoSuggestedIntermediates.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  RSF is previewing the helper route on the map and in ETE until you enter custom waypoints, planned stops, or a filed airport route.
                </p>
              )}
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
              {hasCoastlineRouteOption && (
                <div className={cn("space-y-2 text-xs", plannerSubpanelInfoClass)}>
                  <div className="font-medium">Water crossing route options</div>
                  <div className="text-[#AFC4DB]">
                    RSF sees this as a likely overwater route. You can keep the more direct helper route, or switch to a coastline-biased assist that adds land-based route guidance for pilots who prefer to stay closer to shore.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWaypointsInput(suggestedWaypoints.join(" "));
                        setPlannedStopsInput(suggestedStops.join(" "));
                      }}
                    >
                      Use direct / overwater assist
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setWaypointsInput(suggestedCoastlineWaypoints.join(" "));
                        setPlannedStopsInput(suggestedCoastlineStops.join(" "));
                      }}
                    >
                      Use coastline assist
                    </Button>
                  </div>
                  <div className="text-[#92AAC3]">
                    Coastline assist:
                    {" "}
                    {suggestedCoastlineStops.length > 0 ? `stops ${suggestedCoastlineStops.join(", ")}` : "no fuel stops"}
                    {suggestedCoastlineWaypoints.length > 0 ? ` • waypoints ${suggestedCoastlineWaypoints.join(", ")}` : ""}
                  </div>
                </div>
              )}
              {suggestionMeta && suggestedStops.length > 0 && (
                <div className={cn("space-y-1 text-xs text-[#D9E4F0]", plannerSubpanelMutedClass)}>
                  <div>
                    Max leg ~{suggestionMeta.maxLegNm.toFixed(0)} NM based on {suggestionMeta.fuelGallons.toFixed(0)} gal
                    at {suggestionMeta.fuelBurnGph.toFixed(1)} gph with {suggestionMeta.reserveMinutes} min reserve.
                  </div>
                  {suggestionMeta.planningLegNm ? (
                    <div>
                      RSF is targeting legs of about {suggestionMeta.planningLegNm.toFixed(0)} NM and placing fuel stops sequentially from the last stop instead of spacing everything only from departure.
                    </div>
                  ) : null}
                  <div>
                    Direct assist: {suggestionMeta.suggestedStopCount ?? suggestedStops.length} planned fuel stop{(suggestionMeta.suggestedStopCount ?? suggestedStops.length) === 1 ? "" : "s"}.
                    {suggestionMeta.overwaterLikely
                      ? ` Coastline assist currently uses ${suggestionMeta.coastlineSuggestedStopCount ?? suggestedCoastlineStops.length} stop${(suggestionMeta.coastlineSuggestedStopCount ?? suggestedCoastlineStops.length) === 1 ? "" : "s"} while biasing the helper route back toward shore.`
                      : ""}
                  </div>
                </div>
              )}
              {terrainAdvisorSummaries.length > 0 && plannedAltitudeValue && (
                <div className={cn("space-y-2 text-xs", plannerSubpanelSuccessClass)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">Terrain + leg health advisor</div>
                    <Badge variant="outline" className="border-[#4d8d7d] bg-[#122621] text-[#d7efe7]">
                      {Math.round(plannedAltitudeValue).toLocaleString()} ft planned
                    </Badge>
                  </div>
                  <div className="text-[#b9ddd1]">
                    RSF compares the current route and helper alternatives against USGS terrain plus fuel-leg practicality at your selected altitude. Leg comparisons assume a top-off at each planned fuel stop.
                  </div>
                  {terrainAdjustmentRecommendation && (
                    <div className={cn("space-y-2", plannerSubpanelClass, "border-[#3a7d6e]/40 bg-[linear-gradient(180deg,rgba(14,29,25,0.98),rgba(10,18,16,0.98))]")}>
                      <div className="font-semibold">{terrainAdjustmentRecommendation.title}</div>
                      <div className="text-[#b9ddd1]">{terrainAdjustmentRecommendation.detail}</div>
                      <div className="flex flex-wrap gap-2">
                        {terrainAdjustmentRecommendation.kind === "raise-altitude" && terrainAdjustmentRecommendation.targetAltitudeFt ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setPlannedAltitude(String(terrainAdjustmentRecommendation.targetAltitudeFt))}
                          >
                            Set altitude to {terrainAdjustmentRecommendation.targetAltitudeFt.toLocaleString()} ft
                          </Button>
                        ) : null}
                        {terrainAdjustmentRecommendation.kind === "switch-route" && terrainAdjustmentRecommendation.targetRouteId === "assist" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setWaypointsInput(suggestedWaypoints.join(" "));
                              setPlannedStopsInput(suggestedStops.join(" "));
                            }}
                          >
                            Apply route assist
                          </Button>
                        ) : null}
                        {terrainAdjustmentRecommendation.kind === "switch-route" && terrainAdjustmentRecommendation.targetRouteId === "coastline" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setWaypointsInput(suggestedCoastlineWaypoints.join(" "));
                              setPlannedStopsInput(suggestedCoastlineStops.join(" "));
                            }}
                          >
                            Apply coastline assist
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <div className="grid gap-2 md:grid-cols-3">
                    {terrainAdvisorSummaries.map((summary) => (
                      <div
                        key={`terrain-advisor-${summary.id}`}
                        className={cn(
                          "rounded-[1rem] border p-3 space-y-2 shadow-[0_16px_32px_-26px_rgba(0,0,0,0.88)]",
                          recommendedTerrainRoute?.id === summary.id
                            ? "border-[#5aa28e] bg-[linear-gradient(180deg,rgba(15,33,29,0.98),rgba(10,18,16,0.98))]"
                            : "border-[#40695f]/34 bg-[linear-gradient(180deg,rgba(14,23,21,0.96),rgba(10,15,15,0.96))]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold">{summary.label}</div>
                            <div className="text-[11px] text-[#a9cec3]">{summary.description}</div>
                          </div>
                          {recommendedTerrainRoute?.id === summary.id && (
                            <Badge className="border-0 bg-[#2f7a6a] text-[#f2fbf8] hover:bg-[#2f7a6a]">Recommended</Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div>
                            Min clearance:{" "}
                            <span className="font-medium">
                              {summary.available && summary.minClearanceFt != null ? `${Math.round(summary.minClearanceFt).toLocaleString()} ft` : "--"}
                            </span>
                          </div>
                          <div>
                            Highest terrain:{" "}
                            <span className="font-medium">
                              {summary.available && summary.maxElevationFt != null ? `${Math.round(summary.maxElevationFt).toLocaleString()} ft` : "--"}
                            </span>
                          </div>
                          <div>
                            Risk:{" "}
                            <span className={cn(
                              "font-medium",
                              summary.risk === "warning"
                                ? "text-[#f09aa8]"
                                : summary.risk === "caution"
                                  ? "text-[#e2c06d]"
                                  : "text-[#8fd0bf]"
                            )}>
                              {summary.risk === "warning" ? "Terrain warning" : summary.risk === "caution" ? "Tight clearance" : "Comfortable"}
                            </span>
                          </div>
                          <div>
                            Fuel legs:{" "}
                            <span
                              className={cn(
                                "font-medium",
                                summary.fuelStatus === "unreachable"
                                  ? "text-[#f09aa8]"
                                  : summary.fuelStatus === "tight"
                                    ? "text-[#e2c06d]"
                                    : "text-[#8fd0bf]"
                              )}
                            >
                              {summary.fuelStatus === "unreachable"
                                ? "Unreachable leg"
                                : summary.fuelStatus === "tight"
                                  ? "Tight reserve"
                                  : "Healthy"}
                            </span>
                          </div>
                          <div>
                            Longest leg:{" "}
                            <span className="font-medium">
                              {summary.longestLegNm != null ? `${summary.longestLegNm.toFixed(0)} NM` : "--"}
                            </span>
                          </div>
                          <div>
                            Reserve balance:{" "}
                            <span className="font-medium">
                              {summary.reserveBalanceGallons != null
                                ? `${summary.reserveBalanceGallons >= 0 ? "+" : ""}${summary.reserveBalanceGallons.toFixed(1)} gal`
                                : "--"}
                            </span>
                          </div>
                        </div>
                        {summary.firstUnreachableLeg ? (
                          <div className={cn(plannerSubpanelDangerClass, "px-2 py-1 text-[11px]")}>
                            Cannot reach {(summary.firstUnreachableLeg as { from: string; to: string; shortageGallons: number }).to} from {(summary.firstUnreachableLeg as { from: string; to: string; shortageGallons: number }).from}; short about {(summary.firstUnreachableLeg as { from: string; to: string; shortageGallons: number }).shortageGallons.toFixed(1)} gal before the planned stop.
                          </div>
                        ) : null}
                        {summary.applyKind !== "current" && (
                          <Button
                            type="button"
                            size="sm"
                            variant={recommendedTerrainRoute?.id === summary.id ? "default" : "outline"}
                            onClick={() => {
                              if (summary.applyKind === "assist") {
                                setWaypointsInput(suggestedWaypoints.join(" "));
                                setPlannedStopsInput(suggestedStops.join(" "));
                              } else if (summary.applyKind === "coastline") {
                                setWaypointsInput(suggestedCoastlineWaypoints.join(" "));
                                setPlannedStopsInput(suggestedCoastlineStops.join(" "));
                              }
                            }}
                          >
                            Apply route
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {recommendedTerrainRoute && recommendedTerrainRoute.id !== "current" && (
                    <div className="text-[#b9ddd1]">
                      {recommendedTerrainRoute.label} currently offers the healthiest balance of terrain margin and stop-planning practicality at this altitude.
                    </div>
                  )}
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
              <div className={cn(plannerSubpanelMutedClass, "border-dashed px-3 py-2 text-xs")}>
                Planning preview only: <span className="font-medium text-[#F5F8FC]">{routePreviewFull || "-"}</span>
              </div>
              {filedRouteTokens.length > 0 && (
                <div className={cn("space-y-3", plannerSubpanelClass)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Parsed Route Structure</div>
                      <div className="text-xs text-muted-foreground">
                        RSF now recognizes route token types for review. Airports can drive map/frequency lookups; airways, fixes, navaids, and procedures stay in the filed route for ATC/Leidos while deeper route resolution is phased in.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {resolvedFiledRouteAnalysis.counts.airway > 0 && <span>{resolvedFiledRouteAnalysis.counts.airway} airway</span>}
                      {resolvedFiledRouteAnalysis.counts.fix > 0 && <span>{resolvedFiledRouteAnalysis.counts.fix} fix</span>}
                      {resolvedFiledRouteAnalysis.counts.navaid > 0 && <span>{resolvedFiledRouteAnalysis.counts.navaid} navaid</span>}
                      {resolvedFiledRouteAnalysis.counts.procedure > 0 && <span>{resolvedFiledRouteAnalysis.counts.procedure} SID/STAR</span>}
                      {resolvedFiledRouteAnalysis.counts.airport > 0 && <span>{resolvedFiledRouteAnalysis.counts.airport} airport</span>}
                      {resolvedFiledRouteAnalysis.counts.direct > 0 && <span>{resolvedFiledRouteAnalysis.counts.direct} DCT</span>}
                    </div>
                  </div>
                  {filedRouteAnalysisQuery.isFetching && (
                    <div className="text-xs text-muted-foreground">Analyzing route structure...</div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {resolvedFiledRouteAnalysis.tokens.map((routeToken, index) => {
                      const badgeClassName =
                        routeToken.kind === "airway"
                          ? "border-[#45658b]/40 bg-[#122030] text-[#c9dbef]"
                          : routeToken.kind === "fix"
                            ? "border-[#3a7d6e]/40 bg-[#10211d] text-[#cfe7df]"
                            : routeToken.kind === "navaid"
                              ? "border-[#4f5f90]/40 bg-[#151d31] text-[#d5def7]"
                              : routeToken.kind === "procedure"
                                ? "border-[#7f6327]/40 bg-[#241c0d] text-[#f2dca4]"
                                : routeToken.kind === "airport"
                                  ? "border-[#5d6f85]/26 bg-[#121820] text-[#E8EDF4]"
                                  : routeToken.kind === "direct"
                                    ? "border-[#68548c]/36 bg-[#191527] text-[#e1d9f5]"
                                    : routeToken.kind === "coordinate"
                                      ? "border-[#864c63]/36 bg-[#23131a] text-[#f0d4df]"
                                      : "border-[#5d6f85]/26 bg-[#121820] text-[#E8EDF4]";
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
                  {resolvedFiledRouteStructure.length > 0 && (
                    <div className={cn("space-y-2 p-3", plannerSubpanelMutedClass)}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-[#E8EDF4]">Procedure-aware route structure</div>
                        <div className="text-[11px] text-muted-foreground">
                          Structured for procedure readiness and future nav-data expansion.
                        </div>
                      </div>
                      <div className="grid gap-2">
                        {resolvedFiledRouteStructure.map((segment, index) => (
                          <div
                            key={`${segment.kind}-${segment.startIndex}-${index}`}
                            className="rounded-[0.95rem] border border-[#5d6f85]/18 bg-[#0f141a]/94 px-3 py-2 text-[#E8EDF4] shadow-[0_14px_28px_-24px_rgba(0,0,0,0.88)]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">{segment.label}</div>
                              <Badge variant="outline" className="border-[#5d6f85]/30 text-[#B8CBDD]">
                                {segment.kind === "departure-procedure"
                                  ? "Departure procedure"
                                  : segment.kind === "arrival-procedure"
                                    ? "Arrival procedure"
                                    : segment.kind === "airway"
                                      ? "Airway"
                                      : segment.kind === "origin"
                                        ? "Origin"
                                        : segment.kind === "destination"
                                          ? "Destination"
                                          : "Enroute"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-[#D9E4F0]">{segment.tokens.join(" ")}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {segment.transitionHint ? `Transition ${segment.transitionHint}` : "Transition context pending nav-data resolution."}
                              {segment.runwayHint ? ` · ${segment.runwayHint}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {resolvedFiledRouteAnalysis.airwaySegments.length > 0 && (
                    <div className={cn("space-y-1 text-xs text-[#D9E4F0]", plannerSubpanelMutedClass)}>
                      <div className="font-medium text-[#E8EDF4]">Airway segments recognized</div>
                      {resolvedFiledRouteAnalysis.airwaySegments.map((segment) => (
                        <div key={`${segment.airway}-${segment.index}`}>
                          {segment.airway}: {segment.entryToken || "?"} to {segment.exitToken || "?"}
                        </div>
                      ))}
                    </div>
                  )}
                  {resolvedFiledRouteAnalysis.warnings.length > 0 && (
                    <Alert>
                      <AlertDescription>
                        <div className="font-semibold">Route analysis notes</div>
                        <ul className="mt-2 list-disc pl-5 space-y-1">
                          {resolvedFiledRouteAnalysis.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {resolvedFiledRouteAnalysis.recognizedAirportTokens.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Airport tokens currently usable for map/frequency lookups: {resolvedFiledRouteAnalysis.recognizedAirportTokens.join(", ")}.
                    </div>
                  )}
                  {resolvedFiledRouteAnalysis.airportTokens.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      This filed route currently contains no airport-type enroute tokens, so the map will stay anchored to departure, destination, and any planned airport stops instead of trying to draw airway segments as airports.
                    </div>
                  )}
                </div>
              )}
              {filingDraft.flightRules === "IFR" && (
                <div className={cn("space-y-3", plannerSubpanelClass)}>
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
                      <div className={cn("space-y-2", plannerSubpanelSuccessClass)}>
                        <div className="text-xs font-medium uppercase tracking-wide text-[#9ccfbe]">
                          System Recommended Assist
                        </div>
                        <div className="font-mono text-sm break-words text-[#F5F8FC]">{leidosRouteQuery.data.route}</div>
                        <div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => applyFiledRouteToPlanner(leidosRouteQuery.data?.route || "")}
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
                              <div key={`${group.title}-${route}`} className="flex flex-wrap items-start justify-between gap-2 rounded-[0.95rem] border border-[#5d6f85]/18 bg-[#0f141a]/94 px-3 py-2 text-[#E8EDF4] shadow-[0_14px_28px_-24px_rgba(0,0,0,0.88)]">
                                <div className="font-mono text-xs break-words text-[#F5F8FC]">{route}</div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applyFiledRouteToPlanner(route)}
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
                      <div className={cn("text-xs", plannerSubpanelWarningClass)}>
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
            <div className={cn("md:col-span-2 space-y-2 p-4", plannerSubpanelClass)}>
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
      </PressDemoSpotlight>

      <PressDemoSpotlight
        active={pressDemo.isActive("distance-performance")}
        stepNumber={(pressDemo.getStep("distance-performance")?.index ?? 0) + 1}
        title={pressDemo.getStep("distance-performance")?.title ?? "Distance & Performance"}
        body={pressDemo.getStep("distance-performance")?.body ?? ""}
      >
      <Card id="planner-distance-performance" className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Distance & Performance</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Review trip distance, time, and fuel after your aircraft selection fills in the planning assumptions above.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Reserve Fuel (minutes)</Label>
              <Select value={reserveMinutes} onValueChange={setReserveMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={plannerSelectContentClass}>
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
                  <SelectContent className={plannerSelectContentClass}>
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
              <div className={cn("p-3 text-sm", plannerSubpanelClass)}>
                <div className="text-xs text-[#A9BBCD]">Selected burn profile</div>
                <div className="font-semibold text-[#F5F8FC]">{fuelBurnMode[0].toUpperCase() + fuelBurnMode.slice(1)} • {planningBurn.toFixed(1)} gph</div>
                <div className="mt-1 text-xs text-[#A9BBCD]">
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
            <div className={cn("p-4 space-y-3", plannerSubpanelClass)}>
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

          {stopAdjustmentSuggestions.length > 0 && (
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-1">Stop planning suggestions</div>
                <div className="space-y-2 text-sm">
                  {stopAdjustmentSuggestions.map((item) => (
                    <div key={item.id} className="rounded-[0.95rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] px-3 py-2">
                      <div>{item.detail}</div>
                      {item.action ? (
                        <div className="mt-2">
                          {item.action.kind === "use-suggested-stops" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setPlannedStopsInput(suggestedStops.join(" "))}
                            >
                              {item.action.label}
                            </Button>
                          ) : item.action.kind === "insert-comfort-stop" ? (
                            (() => {
                              const action = item.action;
                              return (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={insertComfortStopMutation.isPending}
                                  onClick={() =>
                                    insertComfortStopMutation.mutate({
                                      from: action.from,
                                      to: action.to,
                                      fuelOnBoardGallons: action.fuelOnBoardGallons,
                                    })
                                  }
                                >
                                  {insertComfortStopMutation.isPending ? "Searching..." : action.label}
                                </Button>
                              );
                            })()
                          ) : (() => {
                            const action = item.action;
                            return (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPlannedFuelUplifts((current) => ({
                                    ...current,
                                    [action.stopIcao]: action.gallons.toFixed(1),
                                  }))
                                }
                              >
                                {action.label}
                              </Button>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
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
            <div className={plannerMetricClass}>
              <div className="text-xs text-[#A9BBCD]">Total Distance</div>
              <div className="text-lg font-semibold text-[#F5F8FC]">{totalDistance ? totalDistance.toFixed(1) : "-"} NM</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-xs text-[#A9BBCD]">ETE</div>
              <div className="text-lg font-semibold text-[#F5F8FC]">
                {eteHours ? `${Math.round(eteHours * 60)} min` : "-"}
              </div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-xs text-[#A9BBCD]">Trip Fuel</div>
              <div className="text-lg font-semibold text-[#F5F8FC]">{tripFuel ? tripFuel.toFixed(1) : "-"} gal</div>
            </div>
            <div className={plannerMetricClass}>
              <div className="text-xs text-[#A9BBCD]">Total Fuel + Reserve</div>
              <div className="text-lg font-semibold text-[#F5F8FC]">{totalFuel ? totalFuel.toFixed(1) : "-"} gal</div>
            </div>
          </div>
          {totalFuel > 0 && (
            <div className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium",
              !fuelPlanSummary.firstUnreachableLeg && fuelSurplus >= 0
                ? "border-green-300 bg-[#0d2220] text-[#4DA8A8]"
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
            <p className="text-xs text-muted-foreground">Save aircraft profiles to reuse your planning defaults on future flights.</p>
          ) : null}
        </CardContent>
      </Card>
      </PressDemoSpotlight>

      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>ATC &amp; Airport Frequencies</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>
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
                <div key={`freq-${icao}`} className={cn("space-y-3 p-4", plannerSubpanelClass)}>
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
                        <div key={`${icao}-${item.type || "other"}-${item.frequencyMhz || "na"}-${index}`} className={cn(plannerSubpanelMutedClass, "flex items-start justify-between gap-3 px-3 py-2")}>
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

      <Card id="planner-nav-log" className={plannerPanelClass}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className={plannerCardTitleClass}>Navigation Log</CardTitle>
              <CardDescription className={plannerCardDescriptionClass}>Leg-by-leg course, time, and fuel summary.</CardDescription>
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
                    <th className="py-2 pr-3">Leg Health</th>
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
                      <td className="py-2 pr-3">
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              leg.planningTargetStatus === "warning"
                                ? "border-red-300 text-red-700"
                                : leg.planningTargetStatus === "caution"
                                  ? "border-[#D9A441] text-[#D9A441]"
                                  : "border-emerald-300 text-emerald-700"
                            )}
                          >
                            {leg.planningTargetStatus === "warning"
                              ? "Exceeds plan"
                              : leg.planningTargetStatus === "caution"
                                ? "Tight"
                                : "Healthy"}
                          </Badge>
                          <div className="text-[11px] text-muted-foreground">
                            {legPlanningTargetNm != null ? `Target ${legPlanningTargetNm.toFixed(0)} NM` : "No target"}
                          </div>
                        </div>
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

      <Card id="route-weather-summary" className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Route Weather Summary</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>One-glance NOAA/AWC snapshot for your route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className={plannerMetricClass}>
              <div className="text-xs text-muted-foreground">Flight category trend</div>
              <div className="text-sm font-semibold">{summaryCategoryLabel}</div>
              {hasThunderRisk && (
                <div className="text-xs text-[#D9A441] mt-2">Thunderstorm risk in TAFs</div>
              )}
            </div>
            <div className={plannerMetricClass}>
              <div className="text-xs text-muted-foreground">Winds aloft coverage</div>
              <div className="text-sm font-semibold">
                {windsCount > 0 ? `${windsCount} stations` : "No winds data yet"}
              </div>
            </div>
            <div className={plannerMetricClass}>
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
      <PressDemoSpotlight
        active={pressDemo.isActive("route-analysis")}
        stepNumber={(pressDemo.getStep("route-analysis")?.index ?? 0) + 1}
        title={pressDemo.getStep("route-analysis")?.title ?? "Route Analysis"}
        body={pressDemo.getStep("route-analysis")?.body ?? ""}
      >
      <Card id="route-analysis" className={cn("relative", plannerPanelClass)}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Route Analysis</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Advisory summary based on your route, altitude, and weather.</CardDescription>
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
            {overwaterLikely && (
              <Alert>
                <AlertDescription>
                  <div className="font-semibold">Overwater briefing item</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    This route likely includes a meaningful overwater segment. Verify that flotation devices are available for all occupants, review ditching and emergency communications procedures, and consider using the coastline assist if you prefer to stay closer to shore.
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {(terrainProfileQuery.isLoading || terrainProfileQuery.data || terrainProfileQuery.error) && (
              <Card className={plannerPanelClass}>
                <CardHeader>
                  <CardTitle className={plannerCardTitleClass}>Terrain Clearance</CardTitle>
                  <CardDescription className={plannerCardDescriptionClass}>USGS route terrain against your planned cruise altitude.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {terrainProfileQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading terrain profile...</div>
                  ) : terrainProfileQuery.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {terrainProfileQuery.error instanceof Error ? terrainProfileQuery.error.message : "Terrain profile unavailable."}
                      </AlertDescription>
                    </Alert>
                  ) : terrainProfileQuery.data ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">Highest terrain</div>
                          <div className="font-semibold">
                            {terrainProfileQuery.data.maxElevationFt != null
                              ? `${Math.round(terrainProfileQuery.data.maxElevationFt).toLocaleString()} ft`
                              : "--"}
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">Minimum clearance</div>
                          <div className={cn("font-semibold", terrainToneClass)}>{terrainClearanceHeadline}</div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">Reference altitude</div>
                          <div className="font-semibold">
                            {terrainReferenceAltitudeFt != null ? `${Math.round(terrainReferenceAltitudeFt).toLocaleString()} ft` : "--"}
                          </div>
                        </div>
                      </div>
                      <Alert className={cn(
                        worstTerrainSegment?.segment.risk === "warning"
                          ? "border-red-300 bg-red-900/20 text-red-300"
                          : worstTerrainSegment?.segment.risk === "caution"
                            ? "border-[#D9A441] bg-[#271d0b] text-[#D9A441]"
                            : "border-emerald-400 bg-[#0d2220] text-[#4DA8A8]"
                      )}>
                        <AlertDescription>{terrainClearanceAdvisory}</AlertDescription>
                      </Alert>
                      {terrainProfileChart ? (
                        <div className={cn("p-3", plannerSubpanelClass)}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">Vertical profile</div>
                            <div className="text-xs text-muted-foreground">
                              Terrain vs {terrainReferenceAltitudeFt != null ? `${Math.round(terrainReferenceAltitudeFt).toLocaleString()} ft planned` : "reference altitude"}
                            </div>
                          </div>
                          <div className="mt-3 overflow-hidden rounded-[0.95rem] border border-[#5d6f85]/18 bg-[#0f141a]/96">
                            <svg
                              viewBox={`0 0 ${terrainProfileChart.chartWidth} ${terrainProfileChart.chartHeight}`}
                              className="h-40 w-full"
                              role="img"
                              aria-label="Flight planner terrain profile chart"
                            >
                              <rect width={terrainProfileChart.chartWidth} height={terrainProfileChart.chartHeight} fill="transparent" />
                              {terrainProfileChart.yTicks.map((tick) => (
                                <g key={`planner-terrain-tick-${tick.altitudeFt}`}>
                                  <line
                                    x1={terrainProfileChart.padding.left}
                                    x2={terrainProfileChart.chartWidth - terrainProfileChart.padding.right}
                                    y1={tick.y}
                                    y2={tick.y}
                                    stroke="currentColor"
                                    strokeOpacity="0.12"
                                    strokeDasharray="4 4"
                                  />
                                  <text
                                    x={terrainProfileChart.chartWidth - terrainProfileChart.padding.right - 2}
                                    y={tick.y - 4}
                                    textAnchor="end"
                                    fontSize="10"
                                    fill="currentColor"
                                    opacity="0.65"
                                  >
                                    {Math.round(tick.altitudeFt).toLocaleString()} ft
                                  </text>
                                </g>
                              ))}
                              <polygon points={terrainProfileChart.terrainArea} fill="#c084fc" fillOpacity="0.22" />
                              <polyline
                                points={terrainProfileChart.terrainLine}
                                fill="none"
                                stroke="#7c3aed"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                              {terrainProfileChart.referenceY != null ? (
                                <line
                                  x1={terrainProfileChart.padding.left}
                                  x2={terrainProfileChart.chartWidth - terrainProfileChart.padding.right}
                                  y1={terrainProfileChart.referenceY}
                                  y2={terrainProfileChart.referenceY}
                                  stroke="#2563eb"
                                  strokeWidth="2"
                                  strokeDasharray="6 4"
                                />
                              ) : null}
                              {terrainHotSpots.map((hotSpot, hotSpotIndex) => {
                                const x = terrainProfileChart.padding.left + (((hotSpot.index + 1) / Math.max(terrainCueSegments.length, 1)) * (terrainProfileChart.chartWidth - terrainProfileChart.padding.left - terrainProfileChart.padding.right));
                                const y = terrainProfileChart.padding.top + (((Math.max(terrainProfileQuery.data?.maxElevationFt ?? 0, terrainReferenceAltitudeFt ?? 0) + 2500) - (hotSpot.segment.maxElevationFt ?? 0)) / Math.max(Math.max(terrainProfileQuery.data?.maxElevationFt ?? 0, terrainReferenceAltitudeFt ?? 0) + 2500, 1000)) * (terrainProfileChart.chartHeight - terrainProfileChart.padding.top - terrainProfileChart.padding.bottom);
                                return (
                                  <g key={`planner-hotspot-${hotSpot.index}`}>
                                    <circle
                                      cx={x}
                                      cy={y}
                                      r="4"
                                      fill={hotSpot.segment.risk === "warning" ? "#dc2626" : hotSpot.segment.risk === "caution" ? "#f59e0b" : "#16a34a"}
                                      stroke="#ffffff"
                                      strokeWidth="1.5"
                                    />
                                    <text x={x + 6} y={y - 6} fontSize="10" fill="currentColor" opacity="0.75">
                                      {hotSpotIndex + 1}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      ) : null}
                      {terrainHotSpots.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Terrain hot spots</div>
                          {terrainHotSpots.map((item, hotSpotIndex) => (
                            <div key={`planner-terrain-hotspot-${item.index}`} className="rounded-lg border px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 font-medium">
                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs font-semibold">
                                    {hotSpotIndex + 1}
                                  </span>
                                  <span>
                                    {item.segment.risk === "warning"
                                      ? "Warning segment"
                                      : item.segment.risk === "caution"
                                        ? "Tight clearance segment"
                                        : "Comfortable segment"}
                                  </span>
                                </div>
                                <Badge variant="outline">{item.progressLabel}</Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Highest terrain {item.segment.maxElevationFt != null ? `${Math.round(item.segment.maxElevationFt).toLocaleString()} ft` : "--"} · clearance {item.segment.clearanceFt != null ? `${Math.round(item.segment.clearanceFt).toLocaleString()} ft` : "--"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </Card>
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
                                    ? "border-[#D9A441] bg-[#271d0b] text-[#D9A441]"
                                    : "border-[#29415e] bg-[#0d1622] text-[#9CB4CC]"
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
                        <div className="text-[11px] text-[#D9A441] mt-2">
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
      </PressDemoSpotlight>

      {contextualTools.length > 0 && (
        <Card className={plannerPanelClass}>
          <CardHeader>
            <CardTitle className={plannerCardTitleClass}>Suggested Tools for This Flight</CardTitle>
            <CardDescription className={plannerCardDescriptionClass}>Recommended based on your route, altitude, and aircraft details.</CardDescription>
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

      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Go / No-Go Checklist</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Quick preflight checklist (stored locally).</CardDescription>
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
                    <span className="text-xs text-[#4DA8A8]/80">(auto-checked — click to override)</span>
                  )}
                </label>
              );
            });
          })()}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="file" className="space-y-6">

      <PressDemoSpotlight
        active={pressDemo.isActive("filing")}
        stepNumber={(pressDemo.getStep("filing")?.index ?? 0) + 1}
        title={pressDemo.getStep("filing")?.title ?? "Flight Plan Summary & Filing"}
        body={pressDemo.getStep("filing")?.body ?? ""}
      >
      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Flight Plan Summary &amp; Filing</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>
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
            <div className={cn("space-y-4 p-4", plannerSubpanelClass)}>
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
                    <SelectContent className={plannerSelectContentClass}>
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
            <div className={cn("space-y-4 p-4", plannerSubpanelClass)}>
              <div>
                <div className="font-semibold">Operational Packet</div>
                <div className="text-xs text-muted-foreground">
                  Review the values that are already being generated from your route, fuel, and performance setup.
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className={plannerMetricClass}>
                  <div className="text-xs text-[#A9BBCD]">Cruise / Altitude</div>
                  <div className="font-semibold text-[#F5F8FC]">{Math.round(planningCruise)} KTAS at {plannedAltitude || "-"} ft</div>
                </div>
                <div className={plannerMetricClass}>
                  <div className="text-xs text-[#A9BBCD]">Fuel on board / endurance</div>
                  <div className="font-semibold text-[#F5F8FC]">{fuelAvailableGallons.toFixed(1)} gal / {formatMinutesLabel(enduranceMinutes)}</div>
                </div>
                <div className={plannerMetricClass}>
                  <div className="text-xs text-[#A9BBCD]">Estimated Enroute</div>
                  <div className="font-semibold text-[#F5F8FC]">{eteHours ? `${Math.round(eteHours * 60)} min` : "-"}</div>
                </div>
                <div className={plannerMetricClass}>
                  <div className="text-xs text-[#A9BBCD]">Filing status</div>
                  <div className="font-semibold text-[#F5F8FC]">
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
          {terrainOperationalNotes.length > 0 && (
            <Alert
              className={cn(
                worstTerrainSegment?.segment.risk === "warning"
                  ? "border-red-300 bg-red-900/20 text-red-300"
                  : "border-[#D9A441] bg-[#271d0b] text-[#D9A441]"
              )}
            >
              <AlertDescription>
                <div className="font-semibold">Terrain review before filing</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {terrainOperationalNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={copyFilingPacket}>
              Copy filing packet
            </Button>
            <Button type="button" variant="outline" onClick={openFlightServiceHandoff} disabled={filingPreviewMutation.isPending}>
              {filingPreviewMutation.isPending ? "Building preview..." : "Validate filing packet"}
            </Button>
            {isGuest && (
              <Button
                type="button"
                onClick={() => {
                  if (guestFlightPlanFileLimitReached) {
                    runWithAuth("file_flight_plan", async () => {
                      await saveCurrentPlan({ returnToFile: true });
                    });
                    return;
                  }
                  guestFileMutation.mutate();
                }}
                disabled={filingPreviewMutation.isPending || guestFileMutation.isPending}
              >
                {guestFileMutation.isPending
                  ? "Submitting guest filing..."
                  : guestFlightPlanFileLimitReached
                    ? "Create free account to keep filing"
                    : `File as guest (${guestFlightPlanFilesRemaining} free ${guestFlightPlanFilesRemaining === 1 ? "filing" : "filings"} left)`}
              </Button>
            )}
            <Button type="button" variant="ghost" asChild>
              <a href="https://www.1800wxbrief.com/" target="_blank" rel="noopener noreferrer">
                Open Flight Service
              </a>
            </Button>
          </div>
          {isGuest && (
            <div className={cn(plannerSubpanelMutedClass, "border-dashed p-4 text-sm text-[#A9BBCD]")}>
              {guestFlightPlanFileLimitReached
                ? "Guest filing limit reached. Create a free RSF account to save plans, keep filing through RSF, and manage lifecycle actions."
                : `Guest access includes ${guestFlightPlanFilesRemaining} remaining direct ${guestFlightPlanFilesRemaining === 1 ? "flight plan filing" : "flight plan filings"} before a free RSF account is required. Amend, cancel, activate, and close actions still require a saved account plan.`}
            </div>
          )}
          {hasCurrentSavedPlan ? (
            <div className={cn("space-y-3 p-4", plannerSubpanelClass)}>
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
                  disabled={filingActionMutation.isPending || filingSyncMutation.isPending}
                >
                  File
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!currentDraftCanAmend) {
                      toast({
                        title: "Live amend unavailable",
                        description: draftAmendAvailabilityMessage || getAmendAvailabilityMessage(currentSavedPlan),
                      });
                      return;
                    }
                    setActiveTab("file");
                    setPendingFilingActionAfterSave({ planId: currentSavedPlan!.id, action: "amend" });
                    updatePlanMutation.mutate(currentSavedPlan!.id);
                  }}
                  disabled={filingActionMutation.isPending || updatePlanMutation.isPending || filingSyncMutation.isPending}
                >
                  {currentDraftCanAmend ? "Amend" : "Amend unavailable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => filingSyncMutation.mutate(currentSavedPlan!.id)}
                  disabled={filingActionMutation.isPending || filingSyncMutation.isPending}
                >
                  {filingSyncMutation.isPending ? "Refreshing sync..." : "Refresh provider sync"}
                </Button>
                {currentSavedPlanFlightRules === "VFR" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "activate" })}
                      disabled={filingActionMutation.isPending || filingSyncMutation.isPending || !currentSavedPlanCanActivate}
                    >
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "close" })}
                      disabled={filingActionMutation.isPending || filingSyncMutation.isPending || !currentSavedPlanCanClose}
                    >
                      Close
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => filingActionMutation.mutate({ planId: currentSavedPlan!.id, action: "cancel" })}
                  disabled={filingActionMutation.isPending || filingSyncMutation.isPending || !currentSavedPlanCanCancel}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadFilingSummary(currentSavedPlan!)}
                >
                  Download filing summary
                </Button>
              </div>
              {!currentSavedPlanCanAmend && (
                <div className="text-xs text-muted-foreground">
                  {getAmendAvailabilityMessage(currentSavedPlan)}
                </div>
              )}
              {currentSavedPlan && isFlightPlanCloseOverdue(currentSavedPlan.plannedArrivalAt) && normalizedClientFilingStatus(currentSavedPlan) === "activated" && (
                <div className="text-xs text-muted-foreground">
                  Overdue VFR closes need additional Leidos destination-close data that RSF does not collect yet. Close this one directly with Flight Service until that field is implemented.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Save this plan once to enable Leidos filing lifecycle actions from this tab. The packet preview works before save, but file/amend/activate/cancel/close actions require a saved plan record.
            </div>
          )}
        </CardContent>
      </Card>
      </PressDemoSpotlight>

      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Save Flight Plan</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>
            Save plans with a free account. After you fly, log it to update currency and history.
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
                  await saveCurrentPlan();
                });
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
            >
              {editingPlan ? "Save local changes" : "Save Flight Plan"}
            </Button>
            {editingPlan && (
              <Button
                variant="outline"
                onClick={() => {
                  if (isGuest) {
                    trackEvent("cta_click", { label: "planner_save_return_requires_auth", target: "/register" });
                  }
                  runWithAuth("save_flight_plan", async () => {
                    await saveCurrentPlan({ returnToFile: true });
                  });
                }}
                disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              >
                Save and continue to filing
              </Button>
            )}
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
            <Button variant="ghost" onClick={handleClearForm}>
              Clear Form
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={plannerPanelClass}>
        <CardHeader>
          <CardTitle className={plannerCardTitleClass}>Saved Plans</CardTitle>
          <CardDescription className={plannerCardDescriptionClass}>Access saved routes and fuel notes. Free accounts keep one plan.</CardDescription>
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
                <Button type="button" onClick={handleClearForm}>
                  Clear form
                </Button>
                {editingPlan && (
                  <Button type="button" variant="outline" onClick={handleClearForm}>
                    Leave saved plan
                  </Button>
                )}
              </div>
              {savedPlansView.map((plan) => (
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
                    <Button
                      size="sm"
                      variant="outline"
                  onClick={() => {
                    setPendingFilingActionAfterSave(null);
                    setDraftPlanId(plan.id);
                    setEditingPlan(plan);
                  }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmPlan(plan)}
                    >
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
                    disabled={filingActionMutation.isPending || filingSyncMutation.isPending}
                  >
                    File
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const isCurrentEditingPlan =
                        editingPlanRef.current?.id === plan.id || draftPlanIdRef.current === plan.id;
                      const draftMessage = getDraftAmendAvailabilityMessage({
                        plan,
                        flightRules: filingDraft.flightRules,
                        route: activeFiledRoute || null,
                        plannedDepartureAt: form.plannedDepartureAt || null,
                        trueAirspeedKtas: Math.round(planningCruise) || null,
                        plannedAltitudeFt: plannedAltitude ? Number(plannedAltitude) : null,
                      });
                      const canSubmitLiveAmend = !draftMessage;

                      if (isCurrentEditingPlan && canSubmitLiveAmend) {
                        setActiveTab("file");
                        setPendingFilingActionAfterSave({ planId: plan.id, action: "amend" });
                        updatePlanMutation.mutate(plan.id);
                        return;
                      }

                      if (isCurrentEditingPlan && draftMessage) {
                        toast({
                          title: "Live amend unavailable",
                          description: draftMessage,
                        });
                        return;
                      }

                      beginAmendWorkflow(plan);
                    }}
                    disabled={filingActionMutation.isPending || updatePlanMutation.isPending || filingSyncMutation.isPending}
                  >
                    {getDraftAmendAvailabilityMessage({
                      plan,
                      flightRules: filingDraft.flightRules,
                      route: activeFiledRoute || null,
                      plannedDepartureAt: form.plannedDepartureAt || null,
                      trueAirspeedKtas: Math.round(planningCruise) || null,
                      plannedAltitudeFt: plannedAltitude ? Number(plannedAltitude) : null,
                    }) ? "Review amend requirements" : "Amend"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => filingSyncMutation.mutate(plan.id)}
                    disabled={filingActionMutation.isPending || filingSyncMutation.isPending}
                  >
                    {filingSyncMutation.isPending ? "Refreshing sync..." : "Refresh provider sync"}
                  </Button>
                  {(plan.filingFlightRules || "VFR").toUpperCase() === "VFR" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "activate" })}
                        disabled={filingActionMutation.isPending || filingSyncMutation.isPending || !canActivatePlan(plan)}
                      >
                        Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "close" })}
                        disabled={filingActionMutation.isPending || filingSyncMutation.isPending || !canClosePlan(plan)}
                      >
                        Close
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => filingActionMutation.mutate({ planId: plan.id, action: "cancel" })}
                    disabled={filingActionMutation.isPending || filingSyncMutation.isPending || !canCancelPlan(plan)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFilingSummary(plan)}
                  >
                    Download filing summary
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Filing requests submit live when the Leidos environment is fully configured. If a required live path is still missing, RSF keeps the request staged instead of dropping it.
                </div>
                {Array.isArray(plan.filingActionHistory) && plan.filingActionHistory.length > 0 && (
                  <div className={cn("p-3", plannerSubpanelClass)}>
                    <div className="mb-2 font-semibold">Filing history</div>
                    <div className="space-y-2">
                      {[...plan.filingActionHistory]
                        .slice()
                        .reverse()
                        .map((entry: any, index: number) => (
                          <div key={`${entry?.action || "entry"}-${entry?.stagedAt || index}`} className="rounded-[0.95rem] border border-[#5d6f85]/18 bg-[#0f141a]/94 p-3 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.88)]">
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
      <div className="min-w-0 space-y-4">
        <PressDemoSpotlight
          active={pressDemo.isActive("route-map")}
          stepNumber={(pressDemo.getStep("route-map")?.index ?? 0) + 1}
          title={pressDemo.getStep("route-map")?.title ?? "Route Map"}
          body={pressDemo.getStep("route-map")?.body ?? ""}
        >
        <Card id="planner-route-map" className={cn(plannerPanelClass, "min-w-0")}>
          <CardHeader>
            <CardTitle className={plannerCardTitleClass}>Route Map</CardTitle>
            <CardDescription className={plannerCardDescriptionClass}>Live route view while you build, brief, and file.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <a
                href="/adsb-receiver-help"
                className="text-[#9CB4CC] hover:underline"
                onClick={() => trackEvent("adsb_help_click", { target: "/adsb-receiver-help" })}
              >
                How to connect your ADS-B receiver
              </a>
              <Link
                href="/flight-demo"
                className="text-[#9CB4CC] hover:underline"
                onClick={() => trackEvent("planner_flight_demo_click", { target: "/flight-demo" })}
              >
                Open RSF Flight Demo
              </Link>
            </div>
            <div className={cn("mb-3 p-2", plannerSubpanelClass)}>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-8", plannerInsetActionClass)}
                  onClick={() => setMapRenderVersion((value) => value + 1)}
                >
                  Fit route
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-8", plannerInsetActionClass)}
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
                  className={cn("h-8", plannerInsetActionClass)}
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
                  className={cn("h-8", plannerInsetActionClass)}
                  onClick={() => setShowApproachOffer(true)}
                >
                  Plates
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-8", plannerInsetActionClass)}
                  onClick={() => setShowAtcStrip((value) => !value)}
                >
                  {showAtcStrip ? "Hide" : "Show"} nav strip
                </Button>
                <Button type="button" size="sm" variant="outline" className={cn("h-8", plannerInsetActionClass)} asChild>
                  <a href="/tfr-map" target="_blank" rel="noopener noreferrer">Full TFR map</a>
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#A9BBCD]">Airport labels</span>
                {[
                  { value: "icao", label: "ICAO only" },
                  { value: "full", label: "ICAO + name" },
                  { value: "markers", label: "Markers only" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={airportLabelMode === option.value ? "default" : "outline"}
                    className="h-8"
                    onClick={() => setAirportLabelMode(option.value as "icao" | "full" | "markers")}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            {routePoints.length > 1 && (
              <div className={cn("mb-3 p-2", plannerSubpanelClass)}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A9BBCD]">
                    ATC Leg Strip
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[#7daeea] transition-colors hover:text-[#a9cfff]"
                    onClick={() => setShowAtcStrip((value) => !value)}
                  >
                    {showAtcStrip ? "Collapse" : "Expand"}
                  </button>
                </div>
                {showAtcStrip ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {legNavRows.length === 0 ? (
                      <div className="text-xs text-[#A9BBCD]">No route legs yet.</div>
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
                            className={cn("min-w-[208px] rounded-md border px-2 py-1.5 text-xs text-[#E8EDF4]", riskContainerClass)}
                          >
                            <div className="font-semibold">{leg.from} to {leg.to}</div>
                            <div className="text-[#B5C8DB]">
                              {String(leg.course).padStart(3, "0")} deg · {leg.distanceNm.toFixed(1)} NM
                            </div>
                            <div className="text-[#89a0b8]">
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
                            <div className="mt-1 text-[10px] text-[#A9BBCD]">
                              Rem fuel {risk ? `${risk.remainingFuelGallons.toFixed(1)} gal` : "--"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[#A9BBCD]">Collapsed. Expand to see per-leg track, distance, and ETA.</div>
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
                    plannedAltitudeFt={plannedAltitudeValue}
                    terrainSegments={terrainCueSegments}
                    terrainHotSpots={terrainMapHotSpots}
                    tfmsOverlayEnabled={tfmsTier === "pro_plus" && tfmsOverlayEnabled}
                  />
                </Suspense>
              ) : (
                <Planner2DMapSurface
                  key={`map-${mapStyle}-${mapRenderVersion}`}
                  points={routePoints.map((p) => ({
                    icao: p.icao,
                    lat: p.lat,
                    lon: p.lon,
                    label: airportLabelMode === "icao" ? null : p.label ?? null,
                  }))}
                  mapStyle={mapStyle}
                  plannedAltitudeFt={plannedAltitudeValue}
                  windsAltitudeFt={windsAltitudeFt}
                  airportLabelMode={airportLabelMode}
                  terrainSegments={terrainCueSegments}
                  terrainHotSpots={terrainMapHotSpots}
                  legHealthMarkers={legHealthMarkers}
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
              <div className="mt-3 text-xs text-[#D9A441]">
                Airport reference details are unavailable for: {unresolvedIcaos.join(", ")}. The planner will keep the route, but map labels and airport details may be limited for those helper codes.
              </div>
            )}
            {(terrainProfileQuery.isLoading || terrainProfileQuery.data || terrainProfileQuery.error) && (
              <div className={cn("mt-3 p-3 text-sm text-[#E8EDF4]", plannerSubpanelClass)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">Terrain clearance</div>
                  <Badge variant="outline" className="border-[#5d6f85]/30 bg-[#141b24] text-[#E8EDF4]">
                    {plannedAltitudeValue ? `${plannedAltitudeValue.toLocaleString()} ft planned` : "set planned altitude"}
                  </Badge>
                </div>
                {terrainProfileQuery.isLoading ? (
                  <div className="mt-2 text-xs text-[#A9BBCD]">Loading USGS terrain profile...</div>
                ) : terrainProfileQuery.error ? (
                  <div className="mt-2 text-xs text-red-300">
                    {terrainProfileQuery.error instanceof Error ? terrainProfileQuery.error.message : "Terrain profile unavailable."}
                  </div>
                ) : terrainProfileQuery.data ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div className={plannerMetricClass}>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#8fa6c0]">Highest terrain</div>
                      <div className="font-semibold">{terrainProfileQuery.data.maxElevationFt != null ? `${Math.round(terrainProfileQuery.data.maxElevationFt).toLocaleString()} ft` : "--"}</div>
                    </div>
                    <div className={plannerMetricClass}>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#8fa6c0]">Minimum clearance</div>
                      <div className={cn("font-semibold", terrainToneClass)}>
                        {terrainClearanceHeadline}
                      </div>
                    </div>
                    <div className={plannerMetricClass}>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#8fa6c0]">Hot spots</div>
                      <div className="font-semibold">
                        {terrainHotSpots.length > 0 ? `${terrainHotSpots.length} flagged` : "None"}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {legNavRows.length > 0 && (
              <div className={cn("mt-3 p-3 text-sm text-[#E8EDF4]", plannerSubpanelInfoClass)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">Leg planning cue</div>
                  <Badge variant="outline" className="border-[#45658b]/40 bg-[#122030] text-[#d7e6f6]">
                    {legPlanningTargetNm != null ? `Target ~${legPlanningTargetNm.toFixed(0)} NM` : "Fuel-aware legs"}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <div className={plannerMetricClass}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#8fa6c0]">Healthy</div>
                    <div className="font-semibold text-sky-100">{legPlanningSummary.comfortable}</div>
                  </div>
                  <div className={plannerMetricClass}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#8fa6c0]">Tight</div>
                    <div className="font-semibold text-amber-300">{legPlanningSummary.caution}</div>
                  </div>
                  <div className={plannerMetricClass}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#8fa6c0]">Exceeds plan</div>
                    <div className="font-semibold text-red-300">{legPlanningSummary.warning}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[#A9BBCD]">
                  Blue markers on the map show legs inside the current planning target. Amber markers indicate legs that are workable but getting tight. Red markers indicate a leg that exceeds the current planning target or runs out of fuel before the planned stop.
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2">
              <div className="text-xs text-[#8fa6c0] uppercase tracking-[0.12em]">Map style</div>
              <RsfModeToggle
                value={mapStyle}
                options={RSF_PLANNER_MAP_STYLE_OPTIONS}
                onChange={setMapStyle}
              />
              {mapStyle === "winds" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#8fa6c0]">Winds altitude</span>
                  <Select value={windsAltitudeChoice} onValueChange={setWindsAltitudeChoice}>
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={cn("z-[1001]", plannerSelectContentClass)}>
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
              <div className="text-xs text-[#A9BBCD] mt-2">
                FAA sectional charts now render across the route view; chart detail sharpens as you zoom in.
              </div>
            )}
            {(mapStyle === "radar" || mapStyle === "winds" || mapStyle === "clouds") && (
              <div className="text-xs text-[#A9BBCD] mt-2">
                Weather layers are for situational awareness only. Radar shows precip; clouds are satellite IR.
                Winds aloft uses NOAA AWC data near your planned altitude. Verify with official sources.
              </div>
            )}
            {mapStyle === "globe" && (
              <div className="text-xs text-[#A9BBCD] mt-2">
                3D globe view uses CesiumJS. Weather overlays are available in 2D for now.
              </div>
            )}
            {mapStyle === "winds" && (
              <div className="text-xs text-[#A9BBCD] mt-1">
                Wind arrows point in the direction the wind is blowing from; size scales with speed.
              </div>
            )}
            {!isAuthenticated && routePoints.length > 0 && (
              <Alert className="mt-3 border-[#5d6f85]/30 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))]">
                <AlertDescription className="flex flex-wrap items-center gap-3 text-[#C7D7EA]">
                  <span>Save this route and keep repeat planning faster with a free account.</span>
                  <Button asChild size="sm" className="rsf-metal-button-primary">
                    <Link href={withReturnTo("/register", getCurrentReturnTo())}>Create free account</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className={plannerInsetActionClass}>
                    <Link href={withReturnTo("/login", getCurrentReturnTo())}>Sign in</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        </PressDemoSpotlight>
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
                                    ? "border-[#D9A441] bg-[#271d0b] text-[#D9A441]"
                                    : "border-[#29415e] bg-[#0d1622] text-[#9CB4CC]"
                              )}
                            >
                              {hazard.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {hazards.length > 0 && (
                        <div className="text-[11px] text-[#D9A441] mt-2">
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
                  <div key={`${station.stationId}-${station.lat}`} className={cn("flex items-center justify-between p-2", plannerSubpanelClass)}>
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
                  <div key={notam.id} className={cn("p-2", plannerSubpanelClass)}>
                    <div className="font-semibold">{notam.id}</div>
                    <div className="text-xs text-muted-foreground mt-1">{notam.text}</div>
                  </div>
                ))}
                <div className={cn("p-3", plannerSubpanelClass)}>
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
                  <div key={`${report.rawOb || report.id || index}`} className={cn("p-2", plannerSubpanelClass)}>
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
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
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
                  <div className="rounded-lg border border-red-300 bg-red-900/20 p-3 text-red-300">
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
                {terrainOperationalNotes.length > 0 && (
                  <Alert
                    className={cn(
                      worstTerrainSegment?.segment.risk === "warning"
                        ? "border-red-300 bg-red-900/20 text-red-300"
                        : "border-[#D9A441] bg-[#271d0b] text-[#D9A441]"
                    )}
                  >
                    <AlertDescription>
                      <div className="font-semibold">Terrain review before handoff</div>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {terrainOperationalNotes.map((note) => (
                          <li key={`preview-${note}`}>{note}</li>
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
          className="fixed inset-0 z-[2000] flex flex-col bg-[linear-gradient(180deg,rgba(10,12,16,0.99),rgba(6,8,11,1))] text-white"
          role="dialog"
          aria-modal="true"
          aria-label="IFR Clearance Scratch Pad"
        >
          <Tabs
            value={scratchPadMode}
            onValueChange={(value) => setScratchPadMode(value as "ink" | "craft")}
            className="flex h-full flex-col"
          >
            <div className="border-b border-[#5d6f85]/20 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold tracking-tight">
                      ✏ IFR Clearance Scratch Pad
                    </span>
                    <span className="rounded-full border border-[#5d6f85]/30 bg-[#141b24] px-2 py-0.5 text-xs font-mono tracking-widest text-[#A9BBCD]">
                      INK + CRAFT
                    </span>
                  </div>
                  <div className="text-sm text-[#A9BBCD]">
                    Ink Pad is built for finger-speed readback. Switch to CRAFT fields when you need structured notes.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={plannerInsetActionClass}
                    onClick={() => setScratchInk((current) => current.slice(0, -1))}
                    disabled={!scratchPadHasInk}
                  >
                    Undo ink
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={plannerInsetActionClass}
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
                    className={plannerInsetActionClass}
                    onClick={() => setScratchPadOpen(false)}
                  >
                    Close <span className="ml-1 opacity-50">Esc</span>
                  </Button>
                </div>
              </div>
              <TabsList className="mt-3 grid w-full max-w-[320px] grid-cols-2 rounded-[1rem] border border-[#5d6f85]/20 bg-[linear-gradient(180deg,rgba(20,24,31,0.98),rgba(13,17,22,0.98))] p-1.5">
                <TabsTrigger value="ink">Ink Pad</TabsTrigger>
                <TabsTrigger value="craft">CRAFT Fields</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <TabsContent value="ink" className="mt-0 h-full focus-visible:outline-none">
                <div className="mx-auto max-w-5xl space-y-4">
                  <div className={`${plannerSubpanelClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
                    <div>
                      <div className="text-sm font-semibold text-[#F5F8FC]">Writing surface</div>
                      <div className="text-xs text-[#A9BBCD]">
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
                          className={scratchInkLayout === option.value ? "rsf-metal-button-primary" : plannerInsetActionClass}
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
                      <div className={`${plannerSubpanelClass} p-4`}>
                        <div className="text-sm font-semibold text-[#F5F8FC]">Fast IFR copy flow</div>
                        <div className="mt-2 space-y-2 text-xs text-[#A9BBCD]">
                          <div>1. Write the readback freehand while ATC is talking.</div>
                          <div>2. Use Undo if you miss a stroke.</div>
                          <div>3. Use Ruled, Blank, or CRAFT grid depending on the clearance.</div>
                          <div>4. Switch to CRAFT fields if you want a cleaner final copy.</div>
                        </div>
                      </div>
                      <div className={`${plannerSubpanelClass} p-4`}>
                        <div className="text-sm font-semibold text-[#F5F8FC]">Current plan prefill</div>
                        <div className="mt-2 space-y-1 text-xs text-[#A9BBCD]">
                          <div>Departure: <span className="font-mono text-[#E8EDF4]">{form.departure || "-"}</span></div>
                          <div>Destination: <span className="font-mono text-[#E8EDF4]">{form.destination || "-"}</span></div>
                          <div>Altitude: <span className="font-mono text-[#E8EDF4]">{plannedAltitudeFt ? `${plannedAltitudeFt} ft` : "-"}</span></div>
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

                  <div className="border-t border-[#5d6f85]/20 pt-3">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#8fa6c0]">
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

            <div className="flex items-center justify-between border-t border-[#5d6f85]/20 px-4 py-2 text-xs text-[#8fa6c0]">
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
    <AlertDialog
      open={Boolean(deleteConfirmPlan)}
      onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) {
          setDeleteConfirmPlan(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this flight plan?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteConfirmPlan
              ? `This will permanently remove "${deleteConfirmPlan.title}" from your saved plans in RSF.`
              : "This will permanently remove this flight plan from your saved plans in RSF."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (!deleteConfirmPlan) return;
              deleteMutation.mutate(deleteConfirmPlan.id);
            }}
            disabled={deleteMutation.isPending || !deleteConfirmPlan}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete flight plan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
