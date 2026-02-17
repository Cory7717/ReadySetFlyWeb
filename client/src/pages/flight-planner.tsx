
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { trackEvent } from "@/lib/analytics";
import { buildLegs, sumDistance, distanceNm, type AirportPoint } from "@/lib/flightPlanner";
import { cn } from "@/lib/utils";
import type { FlightPlan } from "@shared/schema";
import { UpgradePromptDialog } from "@/components/upgrade/UpgradePromptDialog";

const PlannerMap = lazy(() => import("@/components/flight-planner/PlannerMap"));
const CesiumGlobe = lazy(() => import("@/components/flight-planner/CesiumGlobe"));

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
const CONTROLLED_AIRPORTS = new Set([
  "KATL", "KDFW", "KDEN", "KORD", "KLAX", "KJFK", "KSFO", "KSEA", "KLAS", "KPHX",
  "KCLT", "KIAH", "KMIA", "KBOS", "KMSP", "KDCA", "KIAD", "KEWR", "KLGA", "KPDX",
  "KPHL", "KDTW", "KSTL", "KMDW", "KSAN", "KTPA", "KAUS", "KDAL", "KHOU",
]);

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

type AircraftProfile = {
  id: string;
  name: string;
  tailNumber?: string | null;
  typeId?: string | null;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
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
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
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

type ContextualTool = {
  id: string;
  title: string;
  description: string;
  cta: string;
  href: string;
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
  const declared = String(metar?.fltCat || metar?.flightCategory || "").toUpperCase();
  if (declared === "VFR" || declared === "MVFR" || declared === "IFR" || declared === "LIFR") {
    return declared;
  }
  if (!metar?.rawOb) return "UNKNOWN";
  const raw = metar.rawOb || "";
  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) return "VFR";
  if (ceiling >= 1000 && visibility >= 3) return "MVFR";
  if (ceiling >= 500 && visibility >= 1) return "IFR";
  return "LIFR";
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

const checklistDefaults = {
  weather: false,
  fuel: false,
  currency: false,
  notams: false,
};
export default function FlightPlanner() {
  const { user, isAuthenticated } = useAuth();
  const { profile: studentProfile } = useStudentProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const entitlements = (user as any)?.entitlements;
  const isPro = entitlements?.canPersist ?? (user?.logbookProStatus === "active");
  const isGuest = !isAuthenticated;
  const isFree = isAuthenticated && !isPro;
  const isStudent = Boolean(
    studentProfile?.wizardJson || studentProfile?.roadmapJson || studentProfile?.progressJson
  );
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

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
  const [departureRunway, setDepartureRunway] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("none");
  const [selectedTypeId, setSelectedTypeId] = useState<string>(FALLBACK_TYPE.id);
  const [reserveMinutes, setReserveMinutes] = useState("45");
  const [headwind, setHeadwind] = useState("0");
  const [plannedAltitude, setPlannedAltitude] = useState("");
  const [arrivalAuto, setArrivalAuto] = useState(true);
  const [routeSuggestion, setRouteSuggestion] = useState<"direct" | "midpoint">("direct");
  const [mapStyle, setMapStyle] = useState<"standard" | "sectional" | "radar" | "winds" | "clouds" | "globe">("standard");
  const [windsAltitudeChoice, setWindsAltitudeChoice] = useState("planned");
  const [activeWeatherDetail, setActiveWeatherDetail] = useState<
    "metar" | "notams" | "pireps" | "hazards" | "winds" | "icing" | "turbulence" | null
  >(null);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const [customProfile, setCustomProfile] = useState({
    name: "",
    cruiseKtasOverride: "",
    fuelBurnOverrideGph: "",
    usableFuelOverrideGal: "",
    maxGrossWeightOverrideLb: "",
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
  const plannedAltitudeFt = Number(plannedAltitude);
  const plannedAltitudeValue = Number.isFinite(plannedAltitudeFt) ? plannedAltitudeFt : undefined;
  const windsAltitudeFt = windsAltitudeChoice === "planned"
    ? plannedAltitudeValue
    : Number(windsAltitudeChoice);

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
    localStorage.setItem("flightPlannerChecklist", JSON.stringify(checklist));
  }, [checklist]);

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
        const res = await fetch(apiUrl(`/api/airports/${value}`), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!active) return;
        const ok = res.ok;
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
        const res = await fetch(apiUrl(`/api/airports/${value}`), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!active) return;
        const ok = res.ok;
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
  const planLimitReached = isFree && !editingPlan && savedPlans.length >= 1;

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
    selectedType.fuel_burn_gph_effective ??
    FALLBACK_TYPE.fuel_burn_gph_effective ??
    8;
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

  const suggestedWaypoints = routeSuggestionQuery.data?.waypoints ?? [];
  const suggestedStops = routeSuggestionQuery.data?.plannedStops ?? [];
  const suggestionMeta = routeSuggestionQuery.data?.meta;

  const waypoints = useMemo(() => parseWaypoints(waypointsInput), [waypointsInput]);
  const plannedStops = useMemo(() => parseWaypoints(plannedStopsInput), [plannedStopsInput]);
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
    return [
      departureResolved.trim().toUpperCase(),
      ...plannedStops,
      ...waypoints,
      destinationResolved.trim().toUpperCase(),
    ]
      .filter(Boolean)
      .filter((icao) => ICAO_REGEX.test(icao));
  }, [departureResolved, destinationResolved, plannedStops, waypoints]);

  const routeIcaos = useMemo(() => {
    return Array.from(new Set(routeSequenceRaw));
  }, [routeSequenceRaw]);

  const airportQueries = useQueries({
    queries: routeIcaos.map((icao) => ({
      queryKey: ["/api/airports", icao],
      queryFn: async () => {
        const res = await fetch(apiUrl(`/api/airports/${icao}`), { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch airport data");
        return res.json();
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

  const orderedIntermediates = useMemo(() => {
    const combined = [...plannedStops, ...waypoints].filter((icao) => ICAO_REGEX.test(icao));
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
  }, [plannedStops, waypoints, shouldOrderSuggestions, airportMap, departureResolved, destinationResolved]);

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
    return routeIcaos.filter((icao) => !airportMap.has(icao));
  }, [routeIcaos, airportMap]);

  const airportPoints: AirportPoint[] = useMemo(() => {
    return routeSequenceOrdered
      .map((icao) => {
        const data = airportMap.get(icao);
        if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) return null;
        return { icao, lat: Number(data.lat), lon: Number(data.lon) };
      })
      .filter(Boolean) as AirportPoint[];
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

  const routePoints: AirportPoint[] = useMemo(() => {
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
      const res = await fetch(apiUrl(`/api/notams/${primaryIcao}`), { credentials: "include" });
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
      setPlannedAltitude("");
      setArrivalAuto(true);
    };

  const toUtcIso = (value: string, timeZone: string) => {
    const utcDate = zonedDateTimeToUtc(value, timeZone);
    if (utcDate) return utcDate.toISOString();
    return new Date(value).toISOString();
  };

  const createPlanMutation = useMutation({
    mutationFn: async () => {
        const routeString = [plannedStopsInput, waypointsInput]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" ");
        const payload = {
          ...form,
          route: routeString,
          aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
          fuelRequired: totalFuel ? totalFuel.toFixed(1) : null,
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
        const routeString = [plannedStopsInput, waypointsInput]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" ");
      const payload = {
        ...form,
        route: routeString,
        aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
        fuelRequired: totalFuel ? totalFuel.toFixed(1) : null,
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
        route: [form.departure, plannedStopsInput, waypointsInput, form.destination]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" "),
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
    setWaypointsInput(editingPlan.route || "");
    setPlannedStopsInput("");
    setPlannedAltitude("");
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

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl space-y-6">
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
      <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Plan a Flight</h1>
            <p className="text-muted-foreground">
              Build a route and get route analysis before you fly.
            </p>
            {!isPro && (
              <p className="text-xs text-muted-foreground mt-2">
                RSF Pro adds saved plans, alerts, analytics, and full training scenarios.
              </p>
            )}
          </div>
        <div className="flex items-center gap-2">
          {!isPro && <Badge variant="outline">Preview mode</Badge>}
          <Button
            asChild
            variant="outline"
            onClick={() => trackEvent("planner_upgrade_click", { target: "/logbook/pro" })}
          >
            <Link href="/logbook/pro">Upgrade to RSF Pro</Link>
          </Button>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Planning estimates only. Always verify against the aircraft POH/AFM and current conditions.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Route Builder</CardTitle>
          <CardDescription>Enter airports and optional waypoints to plot your route.</CardDescription>
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
            <div className="space-y-2 md:col-span-2">
              <Label>Waypoints (optional)</Label>
              <Input
                value={waypointsInput}
                onChange={(e) => setWaypointsInput(e.target.value.toUpperCase())}
                placeholder="KISP KPVD (comma or space separated)"
              />
              <p className="text-xs text-muted-foreground">Optional. Add ICAO codes separated by space or comma.</p>
              {routeSuggestionQuery.isFetching && departureResolved && destinationResolved && (
                <div className="text-xs text-muted-foreground">Calculating suggested waypoints...</div>
              )}
              {suggestedWaypoints.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Suggested:</span>
                  {suggestedWaypoints.map((icao) => (
                    <Badge key={`waypoint-${icao}`} variant="secondary">
                      {icao}
                    </Badge>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setWaypointsInput(suggestedWaypoints.join(" "))}
                  >
                    {waypoints.length > 0 ? "Replace with suggested" : "Use suggested"}
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Planned stops (optional)</Label>
              <Input
                value={plannedStopsInput}
                onChange={(e) => setPlannedStopsInput(e.target.value.toUpperCase())}
                placeholder="KACT KTYR (fuel/meal stops)"
              />
              <p className="text-xs text-muted-foreground">Use ICAO codes for planned fuel or rest stops.</p>
              {routeSuggestionQuery.isFetching && departureResolved && destinationResolved && (
                <div className="text-xs text-muted-foreground">Estimating fuel-based stops...</div>
              )}
              {suggestedStops.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Suggested fuel stops:</span>
                  {suggestedStops.map((icao) => (
                    <Badge key={`stop-${icao}`} variant="secondary">
                      {icao}
                    </Badge>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPlannedStopsInput(suggestedStops.join(" "))}
                  >
                    {plannedStops.length > 0 ? "Replace with suggested" : "Use suggested"}
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
            <div className="md:col-span-2 rounded-lg border p-4 space-y-2">
              <div className="font-semibold">Suggested routes</div>
              <div className="text-xs text-muted-foreground">
                Choose a quick routing hint. Midpoint adds a virtual waypoint for planning only.
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
                  Suggested waypoint: MID ({suggestedWaypoint.lat.toFixed(3)}, {suggestedWaypoint.lon.toFixed(3)})
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Map</CardTitle>
          <CardDescription>Route draws once valid airport coordinates are found.</CardDescription>
        </CardHeader>
        <CardContent>
          {wakeLockError && (
            <div className="mb-3 text-xs text-muted-foreground">
              {wakeLockError}
            </div>
          )}
          <div className="mb-3 text-sm">
            <a
              href="/adsb-receiver-help"
              className="text-primary hover:underline"
              onClick={() => trackEvent("adsb_help_click", { target: "/adsb-receiver-help" })}
            >
              How to connect your ADS‑B receiver
            </a>
          </div>
            {routeIcaos.length === 0 ? (
              <div className="text-sm text-muted-foreground">Enter a departure and destination to preview the route.</div>
            ) : routePoints.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Waiting for airport coordinates... Waypoints are optional. Check ICAO codes if this takes more than a few seconds.
              </div>
            ) : (
              <Suspense fallback={<div className="h-[380px] rounded-xl border bg-muted animate-pulse" />}>
                {mapStyle === "globe" ? (
                  <CesiumGlobe
                    points={routePoints.map((p) => ({ icao: p.icao, lat: p.lat, lon: p.lon }))}
                  />
                ) : (
                  <PlannerMap
                    points={routePoints.map((p) => ({ icao: p.icao, lat: p.lat, lon: p.lon }))}
                    mapStyle={mapStyle}
                    plannedAltitudeFt={plannedAltitudeValue}
                    windsAltitudeFt={windsAltitudeFt}
                  />
                )}
              </Suspense>
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
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted-foreground">Map style</div>
              <Button
                variant={mapStyle === "standard" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapStyle("standard")}
              >
                Standard
              </Button>
              <Button
                variant={mapStyle === "sectional" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapStyle("sectional")}
              >
                Sectional (FAA)
              </Button>
              <Button
                variant={mapStyle === "radar" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapStyle("radar")}
              >
                Weather (Radar)
              </Button>
              <Button
                variant={mapStyle === "clouds" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapStyle("clouds")}
              >
                Clouds (Satellite)
              </Button>
              <Button
                variant={mapStyle === "globe" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapStyle("globe")}
              >
                3D Globe
              </Button>
              <Button
                variant={mapStyle === "winds" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapStyle("winds")}
              >
                Winds Aloft (NOAA)
              </Button>
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
                Sectional tiles appear at zoom 6+; zoom in for FAA chart detail.
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
                  <span>Save this route and get planning reminders with a free account.</span>
                  <Button asChild size="sm">
                    <Link href="/register">Create free account</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distance & Performance</CardTitle>
          <CardDescription>Estimate time enroute and fuel required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>RSF Aircraft Library</Label>
              <Select value={selectedTypeId} onValueChange={(value) => {
                setSelectedTypeId(value);
                setSelectedProfileId("none");
              }}>
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
              <p className="text-xs text-muted-foreground">
                Planning estimates only. Select a library type or choose Custom entry.
              </p>
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
              <p className="text-xs text-muted-foreground">Overrides take priority when selected.</p>
            </div>
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
          </div>

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
          <div className="text-xs text-muted-foreground">
            Usable fuel: {planningFuel ? `${planningFuel} gal` : "-"} | Max gross weight: {planningMaxWeight ? `${planningMaxWeight} lb` : "-"}
          </div>

          {isPro && legs.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="font-semibold">Per-Leg Breakdown (Pro)</div>
              <div className="grid gap-2 text-sm">
                {legs.map((leg) => (
                  <div key={`${leg.from.icao}-${leg.to.icao}`} className="flex justify-between">
                      <span>{leg.from.icao}{" to "}{leg.to.icao}</span>
                    <span>{leg.distanceNm.toFixed(1)} NM</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Custom Aircraft Name</Label>
              <Input
                value={customProfile.name}
                onChange={(e) => setCustomProfile({ ...customProfile, name: e.target.value })}
                placeholder="My C172"
                disabled={selectedTypeId !== CUSTOM_TYPE_ID && !selectedProfile}
              />
            </div>
            <div className="space-y-2">
              <Label>Cruise KTAS (override)</Label>
              <Input
                value={customProfile.cruiseKtasOverride}
                onChange={(e) => setCustomProfile({ ...customProfile, cruiseKtasOverride: e.target.value })}
                placeholder="110"
                type="number"
                disabled={selectedTypeId !== CUSTOM_TYPE_ID && !selectedProfile}
              />
            </div>
            <div className="space-y-2">
              <Label>Fuel Burn (gph override)</Label>
              <Input
                value={customProfile.fuelBurnOverrideGph}
                onChange={(e) => setCustomProfile({ ...customProfile, fuelBurnOverrideGph: e.target.value })}
                placeholder="8.5"
                type="number"
                disabled={selectedTypeId !== CUSTOM_TYPE_ID && !selectedProfile}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Usable Fuel (gal override)</Label>
              <Input
                value={customProfile.usableFuelOverrideGal}
                onChange={(e) => setCustomProfile({ ...customProfile, usableFuelOverrideGal: e.target.value })}
                placeholder="40"
                type="number"
                disabled={selectedTypeId !== CUSTOM_TYPE_ID && !selectedProfile}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Gross Weight (lb override)</Label>
              <Input
                value={customProfile.maxGrossWeightOverrideLb}
                onChange={(e) => setCustomProfile({ ...customProfile, maxGrossWeightOverrideLb: e.target.value })}
                placeholder="2400"
                type="number"
                disabled={selectedTypeId !== CUSTOM_TYPE_ID && !selectedProfile}
              />
            </div>
          </div>
          <Button
            variant="outline"
            disabled={!isPro || !customProfile.name || saveProfileMutation.isPending}
            onClick={() => {
              if (!isAuthenticated) {
                toast({
                  title: "Create a free account to continue",
                  description: "Sign up to save aircraft profiles and keep them synced.",
                });
                window.location.href = "/register";
                return;
              }
              if (!isPro) {
                toast({
                  title: "Upgrade to RSF Pro",
                  description: "RSF Pro unlocks saved aircraft profiles.",
                });
                window.location.href = "/logbook/pro";
                return;
              }
              saveProfileMutation.mutate();
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
                {notamsCount > 0 ? `${notamsCount} active` : "None loaded"}
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

      <Dialog open={Boolean(activeWeatherDetail)} onOpenChange={(open) => !open && setActiveWeatherDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {activeWeatherDetail === "metar" && (
            <>
              <DialogHeader>
                <DialogTitle>METAR & TAF</DialogTitle>
                <DialogDescription>Latest conditions along your route.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {weatherData.length === 0 && <div className="text-muted-foreground">No METAR/TAF data yet.</div>}
                {weatherData.map(({ icao, data }) => (
                  <div key={icao} className="rounded-lg border p-3">
                    <div className="font-semibold">{icao}</div>
                    <div className="text-xs text-muted-foreground mt-2">{data?.metar?.rawOb || "No METAR"}</div>
                    <div className="text-xs text-muted-foreground mt-2">{data?.taf?.rawTAF || "No TAF"}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {activeWeatherDetail === "winds" && (
            <>
              <DialogHeader>
                <DialogTitle>Winds Aloft</DialogTitle>
                <DialogDescription>NOAA AWC winds/temps near your route.</DialogDescription>
              </DialogHeader>
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
              <DialogHeader>
                <DialogTitle>NOTAMs</DialogTitle>
                <DialogDescription>Latest NOTAMs for {primaryIcao || "your route"}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {notamsCount === 0 && <div className="text-muted-foreground">No NOTAMs loaded.</div>}
                {notamsSummaryQuery.data?.notams?.map((notam: any) => (
                  <div key={notam.id} className="rounded-lg border p-2">
                    <div className="font-semibold">{notam.id}</div>
                    <div className="text-xs text-muted-foreground mt-1">{notam.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {activeWeatherDetail === "pireps" && (
            <>
              <DialogHeader>
                <DialogTitle>PIREPs</DialogTitle>
                <DialogDescription>Recent pilot reports near {primaryIcao || "your route"}.</DialogDescription>
              </DialogHeader>
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
              <DialogHeader>
                <DialogTitle>Convective Hazards</DialogTitle>
                <DialogDescription>Domestic SIGMETs, G-AIRMETs, and TCF.</DialogDescription>
              </DialogHeader>
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
              <DialogHeader>
                <DialogTitle>Icing Guidance</DialogTitle>
                <DialogDescription>AWC icing signals (stub if not available).</DialogDescription>
              </DialogHeader>
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
              <DialogHeader>
                <DialogTitle>Turbulence Guidance</DialogTitle>
                <DialogDescription>AWC turbulence signals (stub if not available).</DialogDescription>
              </DialogHeader>
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
        </DialogContent>
      </Dialog>
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
                  return (
                    <div key={icao} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{icao}</div>
                        <Badge variant="outline">{category}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {data?.metar?.rawOb || "No METAR data"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {data?.taf?.rawTAF || "No TAF data"}
                      </div>
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
                Save your planning history and unlock additional route analysis.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild variant="secondary">
                  <Link href="/register">Create free account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">Sign in</Link>
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
          {Object.entries(checklist).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2">
              <Checkbox
                checked={value}
                onCheckedChange={(checked) => setChecklist({ ...checklist, [key]: Boolean(checked) })}
              />
              {key === "weather" && "Weather reviewed"}
              {key === "fuel" && "Fuel planned"}
              {key === "currency" && "Currency checked"}
              {key === "notams" && "NOTAMs acknowledged"}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flight Plan Summary (Preparation)</CardTitle>
          <CardDescription>ReadySetFly does not file flight plans. Use this summary as a planning aid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Route</div>
              <div>
                {[form.departure || "-", plannedStopsInput, waypointsInput, form.destination || ""]
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .join(" ")}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Alternate</div>
              <div>{form.alternate || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated Time</div>
              <div>{eteHours ? `${Math.round(eteHours * 60)} min` : "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Fuel Required</div>
              <div>{totalFuel ? `${totalFuel.toFixed(1)} gal` : "-"}</div>
            </div>
          </div>
          <Alert>
            <AlertDescription>
              Filing guidance: VFR flight plans can be filed via Flight Service. IFR flight plans must be filed through an approved provider. Filing integration is coming soon.
            </AlertDescription>
          </Alert>
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
                Create a free RSF account to save your first flight plan and keep it synced.
              </AlertDescription>
            </Alert>
          )}
          {planLimitReached && (
            <Alert>
              <AlertDescription>
                Free accounts can save one active plan. Upgrade to RSF Pro to save more.
              </AlertDescription>
            </Alert>
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
              <Label>Aircraft Type (optional)</Label>
              <Input
                value={form.aircraftType}
                onChange={(e) => setForm({ ...form, aircraftType: e.target.value })}
                placeholder={selectedProfile?.name || ""}
              />
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
            <div className="space-y-2">
              <Label>Fuel On Board (gal)</Label>
              <Input
                value={form.fuelOnBoard}
                onChange={(e) => setForm({ ...form, fuelOnBoard: e.target.value })}
                placeholder="35"
              />
            </div>
            <div className="space-y-2">
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
                if (!isAuthenticated) {
                  toast({
                    title: "Create a free account to continue",
                    description: "Save your plan and keep it ready for the next flight.",
                  });
                  trackEvent("planner_register_prompt", { action: "save_plan" });
                  window.location.href = "/register";
                  return;
                }
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
                } else {
                  trackEvent("planner_save_plan", { action: "create" });
                  createPlanMutation.mutate();
                }
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
            >
              {editingPlan ? "Save Changes" : "Save Flight Plan"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!isAuthenticated) {
                  toast({
                    title: "Create a free account to continue",
                    description: "RSF Pro syncs plans into your logbook and analytics.",
                  });
                  trackEvent("planner_register_prompt", { action: "send_to_logbook" });
                  window.location.href = "/register";
                  return;
                }
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
              Free accounts keep one active plan. RSF Pro unlocks unlimited storage and per-leg breakdowns.
            </div>
          )}
          {plansLoading ? (
            <div className="text-sm text-muted-foreground">Loading flight plans...</div>
          ) : savedPlans.length === 0 ? (
            <div className="text-sm text-muted-foreground">No flight plans saved yet.</div>
          ) : (
            savedPlans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-lg font-semibold">{plan.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {plan.departure} to {plan.destination}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Planned</Badge>
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
                {plan.notes && (
                  <div className="text-sm text-muted-foreground">Notes: {plan.notes}</div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

