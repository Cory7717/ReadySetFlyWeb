
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { buildLegs, sumDistance, type AirportPoint } from "@/lib/flightPlanner";
import type { FlightPlan } from "@shared/schema";

const PlannerMap = lazy(() => import("@/components/flight-planner/PlannerMap"));

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;

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

function parseFlightCategory(metar: any): "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN" {
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

function parseWaypoints(input: string) {
  return input
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .filter((item) => ICAO_REGEX.test(item));
}

const checklistDefaults = {
  weather: false,
  fuel: false,
  currency: false,
  notams: false,
};
export default function FlightPlanner() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPro = user?.logbookProStatus === "active";

  useEffect(() => {
    trackEvent("planner_page_view", { page: "flight-planner" });
  }, []);

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
  const [selectedProfileId, setSelectedProfileId] = useState<string>("none");
  const [selectedTypeId, setSelectedTypeId] = useState<string>(FALLBACK_TYPE.id);
  const [reserveMinutes, setReserveMinutes] = useState("45");
  const [headwind, setHeadwind] = useState("0");
  const [customProfile, setCustomProfile] = useState({
    name: "",
    cruiseKtasOverride: "",
    fuelBurnOverrideGph: "",
    usableFuelOverrideGal: "",
    maxGrossWeightOverrideLb: "",
  });
  const [checklist, setChecklist] = useState(checklistDefaults);

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

  const { data: savedPlans = [], isLoading: plansLoading } = useQuery<FlightPlan[]>({
    queryKey: ["/api/flight-plans"],
    enabled: isPro,
  });

  const { data: savedProfiles = [] } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
    enabled: isAuthenticated,
  });

  const { data: aircraftTypes = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
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

  const waypoints = useMemo(() => parseWaypoints(waypointsInput), [waypointsInput]);
  const routeIcaos = useMemo(() => {
    const list = [
      form.departure.trim().toUpperCase(),
      ...waypoints,
      form.destination.trim().toUpperCase(),
    ].filter(Boolean);
    return Array.from(new Set(list)).filter((icao) => ICAO_REGEX.test(icao));
  }, [form.departure, form.destination, waypoints]);

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

  const mapPoints: AirportPoint[] = useMemo(() => {
    return routeIcaos
      .map((icao) => {
        const data = airportMap.get(icao);
        if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) return null;
        return { icao, lat: Number(data.lat), lon: Number(data.lon) };
      })
      .filter(Boolean) as AirportPoint[];
  }, [airportMap, routeIcaos]);

  const legs = useMemo(() => buildLegs(mapPoints), [mapPoints]);
  const totalDistance = useMemo(() => sumDistance(legs), [legs]);

  const windValue = Number(headwind || 0);
  const groundspeed = Math.max(40, planningCruise - (isPro ? windValue : 0));
  const eteHours = totalDistance ? totalDistance / groundspeed : 0;
  const reserveFuel = (Number(reserveMinutes) / 60) * planningBurn;
  const tripFuel = eteHours * planningBurn;
  const totalFuel = tripFuel + reserveFuel;

  const weatherIcaos = useMemo(() => {
    const list = [
      form.departure.trim().toUpperCase(),
      ...waypoints.slice(0, 2),
      form.destination.trim().toUpperCase(),
    ].filter(Boolean);
    return Array.from(new Set(list)).filter((icao) => ICAO_REGEX.test(icao));
  }, [form.departure, form.destination, waypoints]);

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

  const routeRisk = useMemo(() => {
    let risk = "Normal";
    let hasIfr = false;
    let hasTs = false;
    weatherData.forEach(({ data }) => {
      const category = parseFlightCategory(data?.metar);
      if (category === "IFR" || category === "LIFR") hasIfr = true;
      if (hasThunder(data?.taf)) hasTs = true;
    });
    if (hasIfr) risk = "IFR Conditions";
    if (hasTs) risk = hasIfr ? "IFR + Thunderstorms" : "Thunderstorms";
    return risk;
  }, [weatherData]);
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
  };

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        route: waypointsInput,
        aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
        fuelRequired: totalFuel ? totalFuel.toFixed(1) : null,
        plannedDepartureAt: form.plannedDepartureAt ? new Date(form.plannedDepartureAt).toISOString() : null,
        plannedArrivalAt: form.plannedArrivalAt ? new Date(form.plannedArrivalAt).toISOString() : null,
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
        route: waypointsInput,
        aircraftType: form.aircraftType || selectedProfile?.name || `${selectedType.make} ${selectedType.model}`,
        fuelRequired: totalFuel ? totalFuel.toFixed(1) : null,
        plannedDepartureAt: form.plannedDepartureAt ? new Date(form.plannedDepartureAt).toISOString() : null,
        plannedArrivalAt: form.plannedArrivalAt ? new Date(form.plannedArrivalAt).toISOString() : null,
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
        route: `${form.departure} ${waypointsInput} ${form.destination}`.trim(),
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Flight Planner</h1>
          <p className="text-muted-foreground">Build a route, estimate time and fuel, then save to Logbook Pro.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && <Badge variant="outline">Preview mode</Badge>}
          <Button
            asChild
            variant="outline"
            onClick={() => trackEvent("planner_upgrade_click", { target: "/logbook/pro" })}
          >
            <Link href="/logbook/pro">Upgrade to Logbook Pro</Link>
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
              placeholder="KJFK"
            />
          </div>
          <div className="space-y-2">
            <Label>Destination (ICAO)</Label>
            <Input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })}
              placeholder="KBOS"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Waypoints (optional)</Label>
            <Input
              value={waypointsInput}
              onChange={(e) => setWaypointsInput(e.target.value.toUpperCase())}
              placeholder="KISP KPVD (comma or space separated)"
            />
            <p className="text-xs text-muted-foreground">Optional. Add ICAO codes separated by space or comma.</p>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Map</CardTitle>
          <CardDescription>Route draws once valid airport coordinates are found.</CardDescription>
        </CardHeader>
        <CardContent>
          {routeIcaos.length === 0 ? (
            <div className="text-sm text-muted-foreground">Enter a departure and destination to preview the route.</div>
          ) : mapPoints.length < 2 ? (
            <div className="text-sm text-muted-foreground">
              Waiting for airport coordinates... Waypoints are optional. Check ICAO codes if this takes more than a few seconds.
            </div>
          ) : (
            <Suspense fallback={<div className="h-[380px] rounded-xl border bg-muted animate-pulse" />}>
              <PlannerMap points={mapPoints.map((p) => ({ icao: p.icao, lat: p.lat, lon: p.lon }))} />
            </Suspense>
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
                <SelectContent>
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
              {!isPro && <p className="text-xs text-muted-foreground">Logbook Pro unlocks wind-adjusted ETE.</p>}
            </div>
          </div>

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
            disabled={!isAuthenticated || !customProfile.name || saveProfileMutation.isPending}
            onClick={() => saveProfileMutation.mutate()}
          >
            Save Aircraft Profile
          </Button>
          {!isAuthenticated && (
            <p className="text-xs text-muted-foreground">Sign in to save custom aircraft profiles.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Weather & ATIS Awareness</CardTitle>
          <CardDescription>Quick look at departure, destination, and waypoint weather.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <Alert>
            <AlertDescription>
              Route Risk: <strong>{routeRisk}</strong>. Always obtain an official briefing and review NOTAMs before flight.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

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
          <CardDescription>ReadySetFly does not file flight plans. Use this summary as a briefing aid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Route</div>
              <div>{form.departure || "-"} {waypointsInput} {form.destination || ""}</div>
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
          <CardTitle>Save & Sync</CardTitle>
          <CardDescription>Save plans and send routes to your logbook (Logbook Pro only).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Planned Arrival</Label>
              <Input
                type="datetime-local"
                value={form.plannedArrivalAt}
                onChange={(e) => setForm({ ...form, plannedArrivalAt: e.target.value })}
              />
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
                if (!isPro) {
                  toast({ title: "Upgrade to save", description: "Logbook Pro is required to save flight plans." });
                  trackEvent("planner_upgrade_prompt", { action: "save_plan" });
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
                if (!isPro) {
                  toast({ title: "Upgrade to sync", description: "Logbook Pro is required to sync to logbook." });
                  trackEvent("planner_upgrade_prompt", { action: "send_to_logbook" });
                  window.location.href = "/logbook/pro";
                  return;
                }
                trackEvent("planner_send_to_logbook", { action: "create_entry" });
                sendToLogbookMutation.mutate();
              }}
            >
              Send Planned Flight to Logbook
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
          <CardDescription>Access saved routes and fuel notes (Pro).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPro && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Logbook Pro unlocks saved plans, per-leg breakdowns, and unlimited route storage.
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

