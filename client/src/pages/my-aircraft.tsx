import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import {
  ICAO_OTHER_INFO_VALUE_OPTIONS,
  ICAO_ALL_SURVEILLANCE_OPTIONS,
  FLIGHT_SERVICE_DIRECT_SURVEILLANCE_CODES,
  ICAO_OTHER_INFO_PREFIX_OPTIONS,
  ICAO_SURVEILLANCE_OPTIONS,
  buildIcaoOtherInfo,
  normalizeIcaoSurveillanceCodes,
  parseIcaoOtherInfoEntries,
  parseIcaoSurveillanceCodes,
  type IcaoOtherInfoEntry,
  type IcaoOtherInfoPrefix,
} from "@shared/icao-filing";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  category?: string | null;
  engineType?: string | null;
  defaultAltitudeFt?: number | null;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
  isVerified?: boolean | null;
  sourceNote?: string | null;
  verificationSource?: string | null;
  verificationUrl?: string | null;
  lastVerifiedAt?: string | null;
};

type AircraftProfile = {
  id: string;
  name: string;
  tailNumber?: string | null;
  typeId?: string | null;
  isDefault?: boolean | null;
  customManufacturer?: string | null;
  customModel?: string | null;
  customIcaoType?: string | null;
  engineTypeOverride?: string | null;
  engineCountOverride?: number | null;
  fuelBurnDefaultGph?: number | null;
  aircraftType?: string | null;
  cruiseKtas?: number | null;
  fuelBurnGph?: number | null;
  maxRangeNm?: number | null;
  serviceCeilingFt?: number | null;
  wakeCategory?: string | null;
  equipmentCodes?: string | null;
  surveillanceCodes?: string | null;
  notes?: string | null;
  cruiseKtasOverride?: number | null;
  fuelBurnOverrideGph?: number | null;
  usableFuelOverrideGal?: number | null;
  maxGrossWeightOverrideLb?: number | null;
  filingEquipmentDefault?: string | null;
  filingSoulsOnBoardDefault?: string | null;
  filingAircraftColorDefault?: string | null;
  filingPilotNameDefault?: string | null;
  filingRemarksDefault?: string | null;
  filingWakeTurbulenceDefault?: string | null;
  filingTypeOfFlightDefault?: string | null;
  filingSurveillanceEquipmentDefault?: string | null;
  filingOtherInfoDefault?: string | null;
  filingEmergencyEquipmentDefault?: string | null;
  filingTransponderDefault?: string | null;
  filingPerformanceCategoryDefault?: string | null;
  filingEltDefault?: string | null;
  filingFlightRulesDefault?: string | null;
  filingCruisingSpeedDefault?: string | null;
  filingAltitudePreferenceDefault?: string | null;
  filingEnduranceMinutesDefault?: number | null;
  defaultReadiness?: { complete: boolean; errors: string[]; warnings: string[] } | null;
  type?: AircraftType | null;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
};

const emptyForm = {
  name: "",
  tailNumber: "",
  typeId: "",
  isDefault: false,
  customManufacturer: "",
  customModel: "",
  customIcaoType: "",
  engineTypeOverride: "",
  engineCountOverride: "",
  fuelBurnDefaultGph: "",
  serviceCeilingFt: "",
  notes: "",
  cruiseKtasOverride: "",
  fuelBurnOverrideGph: "",
  usableFuelOverrideGal: "",
  maxGrossWeightOverrideLb: "",
  filingEquipmentDefault: "",
  filingSoulsOnBoardDefault: "1",
  filingAircraftColorDefault: "",
  filingPilotNameDefault: "",
  filingRemarksDefault: "",
  filingWakeTurbulenceDefault: "MEDIUM",
  filingTypeOfFlightDefault: "G",
  filingSurveillanceEquipmentDefault: "",
  filingOtherInfoDefault: "",
  filingEmergencyEquipmentDefault: "",
  filingTransponderDefault: "",
  filingPerformanceCategoryDefault: "",
  filingEltDefault: "",
  filingFlightRulesDefault: "VFR",
  filingCruisingSpeedDefault: "",
  filingAltitudePreferenceDefault: "",
  filingEnduranceMinutesDefault: "",
};

export default function MyAircraft() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAircraftDialogOpen, setIsAircraftDialogOpen] = useState(false);
  const [aircraftSearch, setAircraftSearch] = useState("");
  const numberOrNull = useCallback((value: string | number | null | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, []);
  const calculateRangeNm = useCallback((cruiseKtas: number | null, fuelBurnGph: number | null, usableFuelGal: number | null) => {
    if (!cruiseKtas || !fuelBurnGph || !usableFuelGal || fuelBurnGph <= 0) return null;
    return Number(((usableFuelGal / fuelBurnGph) * cruiseKtas).toFixed(1));
  }, []);

  const { data: types = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
  });

  const { data: profiles = [], isLoading } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
  });

  const typeOptions = useMemo(() => {
    const query = aircraftSearch.trim().toLowerCase();
    if (!query) return types;
    return types.filter((type) => `${type.make} ${type.model} ${type.icaoType || ""}`.toLowerCase().includes(query));
  }, [aircraftSearch, types]);
  const selectedLibraryType = useMemo(
    () => types.find((type) => type.id === form.typeId) || null,
    [form.typeId, types],
  );
  const inferWakeCategory = useCallback((type: AircraftType | null) => {
    const maxGross = Number(type?.max_gross_weight_lb_effective || 0);
    if (maxGross && maxGross <= 15500) return "LIGHT";
    if (maxGross && maxGross > 15500 && maxGross < 300000) return "MEDIUM";
    if (maxGross >= 300000) return "HEAVY";
    return "LIGHT";
  }, []);
  const inferEngineCount = useCallback((type: AircraftType | null) => {
    const text = `${type?.category || ""} ${type?.engineType || ""} ${type?.make || ""} ${type?.model || ""}`.toLowerCase();
    if (/\b(twin|multi|multi-engine|multiengine)\b/.test(text)) return "2";
    if (/\b(single|piston|turboprop|jet)\b/.test(text)) return "1";
    return "";
  }, []);
  const applyAircraftLibraryType = useCallback((typeId: string) => {
    const selected = types.find((type) => type.id === typeId) || null;
    setForm((current) => {
      if (!selected) return { ...current, typeId };
      return {
        ...current,
        typeId,
        name: current.name.trim() ? current.name : `${selected.make} ${selected.model}`.trim(),
        customManufacturer: selected.make || current.customManufacturer,
        customModel: selected.model || current.customModel,
        customIcaoType: selected.icaoType || current.customIcaoType,
        engineTypeOverride: selected.engineType || current.engineTypeOverride,
        engineCountOverride: inferEngineCount(selected) || current.engineCountOverride,
        cruiseKtasOverride: selected.cruise_ktas_effective ? String(selected.cruise_ktas_effective) : current.cruiseKtasOverride,
        fuelBurnDefaultGph: selected.fuel_burn_gph_effective ? String(selected.fuel_burn_gph_effective) : current.fuelBurnDefaultGph,
        fuelBurnOverrideGph: selected.fuel_burn_gph_effective ? String(selected.fuel_burn_gph_effective) : current.fuelBurnOverrideGph,
        usableFuelOverrideGal: selected.usable_fuel_gal_effective ? String(selected.usable_fuel_gal_effective) : current.usableFuelOverrideGal,
        maxGrossWeightOverrideLb: selected.max_gross_weight_lb_effective ? String(selected.max_gross_weight_lb_effective) : current.maxGrossWeightOverrideLb,
        filingWakeTurbulenceDefault: inferWakeCategory(selected),
        filingAltitudePreferenceDefault: selected.defaultAltitudeFt ? String(selected.defaultAltitudeFt) : current.filingAltitudePreferenceDefault,
      };
    });
  }, [inferEngineCount, inferWakeCategory, types]);
  const selectedSurveillanceCodes = useMemo(
    () => parseIcaoSurveillanceCodes(form.filingSurveillanceEquipmentDefault),
    [form.filingSurveillanceEquipmentDefault],
  );
  const setSurveillanceCodes = useCallback((codes: string[]) => {
    setForm((current) => ({ ...current, filingSurveillanceEquipmentDefault: normalizeIcaoSurveillanceCodes(codes) }));
  }, []);
  const [icaoOtherInfoEntries, setIcaoOtherInfoEntriesState] = useState<IcaoOtherInfoEntry[]>([]);
  const lastIcaoOtherInfoRef = useRef("");
  useEffect(() => {
    if (form.filingOtherInfoDefault === lastIcaoOtherInfoRef.current) return;
    lastIcaoOtherInfoRef.current = form.filingOtherInfoDefault;
    setIcaoOtherInfoEntriesState(parseIcaoOtherInfoEntries(form.filingOtherInfoDefault));
  }, [form.filingOtherInfoDefault]);
  const setIcaoOtherInfoEntries = useCallback((entries: IcaoOtherInfoEntry[]) => {
    setIcaoOtherInfoEntriesState(entries);
    const nextOtherInfo = buildIcaoOtherInfo(entries);
    lastIcaoOtherInfoRef.current = nextOtherInfo;
    setForm((current) => ({ ...current, filingOtherInfoDefault: nextOtherInfo }));
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setAircraftSearch("");
    setIsAircraftDialogOpen(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cruiseKtas = numberOrNull(form.cruiseKtasOverride);
      const fuelBurnGph = numberOrNull(form.fuelBurnOverrideGph) ?? numberOrNull(form.fuelBurnDefaultGph);
      const usableFuelGal = numberOrNull(form.usableFuelOverrideGal);
      const aircraftType = (form.customIcaoType || selectedLibraryType?.icaoType || form.name).trim().toUpperCase();
      const wakeCategory = form.filingWakeTurbulenceDefault.trim().toUpperCase();
      const equipmentCodes = form.filingEquipmentDefault.trim().toUpperCase();
      const surveillanceCodes = form.filingSurveillanceEquipmentDefault.trim().toUpperCase();
      const missingRequired: string[] = [];
      if (!form.tailNumber.trim()) missingRequired.push("Tail number");
      if (!aircraftType) missingRequired.push("Aircraft type");
      if (!cruiseKtas) missingRequired.push("Cruise speed");
      if (!fuelBurnGph) missingRequired.push("Fuel burn");
      if (!wakeCategory) missingRequired.push("Wake category");
      if (!equipmentCodes) missingRequired.push("Equipment codes");
      if (!surveillanceCodes) missingRequired.push("Surveillance codes");
      if (missingRequired.includes("Cruise speed")) {
        throw new Error("Cruise speed is required before saving this aircraft profile.");
      }
      if (missingRequired.length) {
        throw new Error(`Complete required aircraft details before saving: ${missingRequired.join(", ")}.`);
      }
      const payload = {
        name: form.name.trim(),
        tailNumber: form.tailNumber || null,
        typeId: form.typeId || null,
        isDefault: form.isDefault,
        customManufacturer: form.customManufacturer.trim() || null,
        customModel: form.customModel.trim() || null,
        customIcaoType: form.customIcaoType.trim().toUpperCase() || null,
        engineTypeOverride: form.engineTypeOverride.trim() || null,
        engineCountOverride: form.engineCountOverride ? Number(form.engineCountOverride) : null,
        aircraftType,
        cruiseKtas,
        fuelBurnGph,
        maxRangeNm: calculateRangeNm(cruiseKtas, fuelBurnGph, usableFuelGal),
        serviceCeilingFt: form.serviceCeilingFt ? Number(form.serviceCeilingFt) : null,
        wakeCategory,
        equipmentCodes,
        surveillanceCodes,
        fuelBurnDefaultGph: form.fuelBurnDefaultGph ? Number(form.fuelBurnDefaultGph) : null,
        notes: form.notes.trim() || null,
        cruiseKtasOverride: form.cruiseKtasOverride ? Number(form.cruiseKtasOverride) : null,
        fuelBurnOverrideGph: form.fuelBurnOverrideGph ? Number(form.fuelBurnOverrideGph) : null,
        usableFuelOverrideGal: form.usableFuelOverrideGal ? Number(form.usableFuelOverrideGal) : null,
        maxGrossWeightOverrideLb: form.maxGrossWeightOverrideLb ? Number(form.maxGrossWeightOverrideLb) : null,
        filingEquipmentDefault: form.filingEquipmentDefault.trim() || null,
        filingSoulsOnBoardDefault: form.filingSoulsOnBoardDefault.trim() || null,
        filingAircraftColorDefault: form.filingAircraftColorDefault.trim() || null,
        filingPilotNameDefault: form.filingPilotNameDefault.trim() || null,
        filingRemarksDefault: form.filingRemarksDefault.trim() || null,
        filingWakeTurbulenceDefault: form.filingWakeTurbulenceDefault.trim() || null,
        filingTypeOfFlightDefault: form.filingTypeOfFlightDefault.trim() || null,
        filingSurveillanceEquipmentDefault: form.filingSurveillanceEquipmentDefault.trim() || null,
        filingOtherInfoDefault: form.filingOtherInfoDefault.trim() || null,
        filingEmergencyEquipmentDefault: form.filingEmergencyEquipmentDefault.trim() || null,
        filingTransponderDefault: form.filingTransponderDefault.trim() || null,
        filingPerformanceCategoryDefault: form.filingPerformanceCategoryDefault.trim() || null,
        filingEltDefault: form.filingEltDefault.trim() || null,
        filingFlightRulesDefault: form.filingFlightRulesDefault.trim() || null,
        filingCruisingSpeedDefault: form.filingCruisingSpeedDefault.trim() || null,
        filingAltitudePreferenceDefault: form.filingAltitudePreferenceDefault.trim() || null,
        filingEnduranceMinutesDefault: form.filingEnduranceMinutesDefault ? Number(form.filingEnduranceMinutesDefault) : null,
      };
      if (editingId) {
        const res = await apiRequest("PUT", `/api/aircraft/profiles/${editingId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/aircraft/profiles", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/profiles"] });
      toast({ title: editingId ? "Profile updated" : "Profile created" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/aircraft/profiles/${id}/default`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/profiles"] });
      toast({ title: "Default aircraft updated" });
    },
    onError: (error: any) => {
      toast({ title: "Cannot make default", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/aircraft/profiles/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/profiles"] });
      toast({ title: "Profile deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">My Aircraft</h1>
            <p className="text-muted-foreground">Save aircraft profiles for faster planning and Flight Service filing.</p>
          </div>
          <Button type="button" onClick={() => { setForm(emptyForm); setEditingId(null); setIsAircraftDialogOpen(true); }}>
            + Add Aircraft
          </Button>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Planning estimates only. Always verify against the aircraft POH/AFM and current conditions.
        </AlertDescription>
      </Alert>

      <Dialog open={isAircraftDialogOpen} onOpenChange={(open) => { setIsAircraftDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Aircraft Profile" : "Add Aircraft"}</DialogTitle>
            <DialogDescription>
              Search the RSF aircraft library or create a custom aircraft profile. Complete ICAO filing defaults before making it your default filing aircraft.
            </DialogDescription>
          </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My 172 at KAUS" />
            </div>
            <div className="space-y-2">
              <Label>Tail Number</Label>
              <Input value={form.tailNumber} onChange={(e) => setForm({ ...form, tailNumber: e.target.value })} placeholder="N12345" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Search Aircraft Library</Label>
              <Input value={aircraftSearch} onChange={(e) => setAircraftSearch(e.target.value)} placeholder="Search Cessna 172S, SR22, PA-28..." />
              <Select value={form.typeId} onValueChange={applyAircraftLibraryType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an aircraft type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.make} {type.model}{type.icaoType ? ` (${type.icaoType})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLibraryType && (
                <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground">Library specs applied</div>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    <span>Manufacturer: {selectedLibraryType.make}</span>
                    <span>Model: {selectedLibraryType.model}</span>
                    <span>ICAO Type: {selectedLibraryType.icaoType || "-"}</span>
                    <span>Engine: {selectedLibraryType.engineType || "-"}</span>
                    <span>Cruise: {selectedLibraryType.cruise_ktas_effective || "-"} KTAS</span>
                    <span>Fuel burn: {selectedLibraryType.fuel_burn_gph_effective || "-"} GPH</span>
                    <span>Usable fuel: {selectedLibraryType.usable_fuel_gal_effective || "-"} gal</span>
                    <span>Max gross: {selectedLibraryType.max_gross_weight_lb_effective || "-"} lb</span>
                  </div>
                </div>
              )}
              {selectedLibraryType && selectedLibraryType.isVerified === false && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertDescription>
                    This library template is still marked as a planning estimate. Confirm its cruise, burn, fuel, and weight values against the aircraft POH/AFM before relying on it.
                    {selectedLibraryType.sourceNote ? ` ${selectedLibraryType.sourceNote}` : ""}
                    {selectedLibraryType.verificationSource ? ` Source: ${selectedLibraryType.verificationSource}.` : ""}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-background p-4">
            <div>
              <div className="font-semibold">Create Custom Aircraft</div>
              <div className="text-sm text-muted-foreground">Use these fields when the aircraft is not in the RSF library.</div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input value={form.customManufacturer} onChange={(e) => setForm({ ...form, customManufacturer: e.target.value })} placeholder="Cessna" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.customModel} onChange={(e) => setForm({ ...form, customModel: e.target.value })} placeholder="172S" />
              </div>
              <div className="space-y-2">
                <Label>ICAO Aircraft Type</Label>
                <Input value={form.customIcaoType} onChange={(e) => setForm({ ...form, customIcaoType: e.target.value.toUpperCase() })} placeholder="C172" />
              </div>
              <div className="space-y-2">
                <Label>Engine Type</Label>
                <Input value={form.engineTypeOverride} onChange={(e) => setForm({ ...form, engineTypeOverride: e.target.value })} placeholder={selectedLibraryType?.engineType || "Piston"} />
              </div>
              <div className="space-y-2">
                <Label>Engine Count</Label>
                <Input value={form.engineCountOverride} onChange={(e) => setForm({ ...form, engineCountOverride: e.target.value })} type="number" placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Default Fuel Burn</Label>
                <Input value={form.fuelBurnDefaultGph} onChange={(e) => setForm({ ...form, fuelBurnDefaultGph: e.target.value })} type="number" placeholder="9.5" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="POH notes, rental notes, or filing caveats" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Cruise KTAS (override)</Label>
              <Input value={form.cruiseKtasOverride} onChange={(e) => setForm({ ...form, cruiseKtasOverride: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Fuel Burn GPH (override)</Label>
              <Input value={form.fuelBurnOverrideGph} onChange={(e) => setForm({ ...form, fuelBurnOverrideGph: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Usable Fuel Gal (override)</Label>
              <Input value={form.usableFuelOverrideGal} onChange={(e) => setForm({ ...form, usableFuelOverrideGal: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Max Gross Weight LB (override)</Label>
              <Input value={form.maxGrossWeightOverrideLb} onChange={(e) => setForm({ ...form, maxGrossWeightOverrideLb: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Service Ceiling FT</Label>
              <Input value={form.serviceCeilingFt} onChange={(e) => setForm({ ...form, serviceCeilingFt: e.target.value })} type="number" />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <div className="font-semibold">ICAO Filing Defaults</div>
              <div className="text-sm text-muted-foreground">
                Save the filing details that usually travel with this aircraft so the flight planner can prefill them automatically.
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Equipment Code</Label>
                <Input value={form.filingEquipmentDefault} onChange={(e) => setForm({ ...form, filingEquipmentDefault: e.target.value.toUpperCase() })} placeholder="S/C" />
              </div>
              <div className="space-y-2">
                <Label>Default Flight Rules</Label>
                <Select value={form.filingFlightRulesDefault} onValueChange={(value) => setForm({ ...form, filingFlightRulesDefault: value })}>
                  <SelectTrigger><SelectValue placeholder="Select rules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VFR">VFR</SelectItem>
                    <SelectItem value="IFR">IFR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Souls On Board</Label>
                <Input value={form.filingSoulsOnBoardDefault} onChange={(e) => setForm({ ...form, filingSoulsOnBoardDefault: e.target.value })} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Aircraft Color</Label>
                <Input value={form.filingAircraftColorDefault} onChange={(e) => setForm({ ...form, filingAircraftColorDefault: e.target.value })} placeholder="White / Blue" />
              </div>
              <div className="space-y-2">
                <Label>Pilot Name Default</Label>
                <Input value={form.filingPilotNameDefault} onChange={(e) => setForm({ ...form, filingPilotNameDefault: e.target.value })} placeholder="Pilot in command" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Default Filing Remarks</Label>
                <Input value={form.filingRemarksDefault} onChange={(e) => setForm({ ...form, filingRemarksDefault: e.target.value })} placeholder="Standard remarks for this aircraft" />
              </div>
              <div className="space-y-2">
                <Label>Wake Turbulence</Label>
                <Input value={form.filingWakeTurbulenceDefault} onChange={(e) => setForm({ ...form, filingWakeTurbulenceDefault: e.target.value.toUpperCase() })} placeholder="MEDIUM" />
              </div>
              <div className="space-y-2">
                <Label>Type Of Flight</Label>
                <Input value={form.filingTypeOfFlightDefault} onChange={(e) => setForm({ ...form, filingTypeOfFlightDefault: e.target.value.toUpperCase() })} placeholder="G" />
              </div>
              <div className="space-y-2">
                <Label>Fuel Endurance Minutes</Label>
                <Input value={form.filingEnduranceMinutesDefault} onChange={(e) => setForm({ ...form, filingEnduranceMinutesDefault: e.target.value })} type="number" placeholder="240" />
              </div>
              <div className="space-y-2">
                <Label>Default Cruising Speed</Label>
                <Input value={form.filingCruisingSpeedDefault} onChange={(e) => setForm({ ...form, filingCruisingSpeedDefault: e.target.value.toUpperCase() })} placeholder="N0120" />
              </div>
              <div className="space-y-2">
                <Label>Default Altitude Preference</Label>
                <Input value={form.filingAltitudePreferenceDefault} onChange={(e) => setForm({ ...form, filingAltitudePreferenceDefault: e.target.value.toUpperCase() })} placeholder="5500" />
              </div>
              <div className="space-y-2">
                <Label>Emergency Equipment</Label>
                <Input value={form.filingEmergencyEquipmentDefault} onChange={(e) => setForm({ ...form, filingEmergencyEquipmentDefault: e.target.value.toUpperCase() })} placeholder="ELT, survival, dinghy..." />
              </div>
              <div className="space-y-2">
                <Label>Transponder</Label>
                <Input value={form.filingTransponderDefault} onChange={(e) => setForm({ ...form, filingTransponderDefault: e.target.value.toUpperCase() })} placeholder="Mode C / ADS-B" />
              </div>
              <div className="space-y-2">
                <Label>Performance Category</Label>
                <Input value={form.filingPerformanceCategoryDefault} onChange={(e) => setForm({ ...form, filingPerformanceCategoryDefault: e.target.value.toUpperCase() })} placeholder="A/B/C" />
              </div>
              <div className="space-y-2">
                <Label>ELT</Label>
                <Input value={form.filingEltDefault} onChange={(e) => setForm({ ...form, filingEltDefault: e.target.value.toUpperCase() })} placeholder="ELT" />
              </div>
              <div className="space-y-2">
                <Label>Surveillance Equipment</Label>
                <Select
                  value=""
                  onValueChange={(code) => {
                    if (!code) return;
                    setSurveillanceCodes(code === "N" ? ["N"] : [...selectedSurveillanceCodes.filter((entry) => entry !== "N"), code]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select surveillance equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICAO_ALL_SURVEILLANCE_OPTIONS.map((entry) => (
                      <SelectItem key={entry.code} value={entry.code}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 text-xs">
                  {selectedSurveillanceCodes.length > 0 ? selectedSurveillanceCodes.map((code) => (
                    <span key={code} className="rounded border bg-background px-2 py-1">
                      {code}
                      <button type="button" className="ml-2 text-muted-foreground" onClick={() => setSurveillanceCodes(selectedSurveillanceCodes.filter((entry) => entry !== code))}>
                        Remove
                      </button>
                    </span>
                  )) : <span className="text-muted-foreground">Select one or more ICAO surveillance codes.</span>}
                </div>
                {selectedSurveillanceCodes.some((code) => !FLIGHT_SERVICE_DIRECT_SURVEILLANCE_CODES.has(code)) && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                    <AlertDescription>
                      Flight Service filing currently accepts N, A, C, or S here. Store ADS-B or ADS-C details in Other ICAO Information using SUR/ when needed.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Other ICAO Information</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setIcaoOtherInfoEntries([...icaoOtherInfoEntries, { prefix: "PBN/", value: "" }])}>
                    Add ICAO Entry
                  </Button>
                </div>
                <div className="space-y-2">
                  {icaoOtherInfoEntries.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Add ICAO Item 18 entries only when normally required for this aircraft.
                    </div>
                  ) : icaoOtherInfoEntries.map((entry, index) => (
                    <div key={`${entry.prefix}-${index}`} className="grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)_auto]">
                      <Select
                        value={entry.prefix}
                        onValueChange={(value) => {
                          const next = [...icaoOtherInfoEntries];
                          next[index] = { ...entry, prefix: value as IcaoOtherInfoPrefix };
                          setIcaoOtherInfoEntries(next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ICAO Prefix" />
                        </SelectTrigger>
                        <SelectContent>
                          {ICAO_OTHER_INFO_PREFIX_OPTIONS.map((option) => (
                            <SelectItem key={option.prefix} value={option.prefix}>
                              {option.label} - {option.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="space-y-2">
                        {ICAO_OTHER_INFO_VALUE_OPTIONS[entry.prefix]?.length ? (
                          <Select
                            value=""
                            onValueChange={(value) => {
                              const next = [...icaoOtherInfoEntries];
                              const optionValue = value.toUpperCase();
                              const currentValue = String(entry.value || "").toUpperCase();
                              const nextValue = entry.prefix === "PBN/" && currentValue && !currentValue.includes(optionValue)
                                ? `${currentValue}${optionValue}`
                                : optionValue;
                              next[index] = { ...entry, value: nextValue };
                              setIcaoOtherInfoEntries(next);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select value" />
                            </SelectTrigger>
                            <SelectContent>
                              {ICAO_OTHER_INFO_VALUE_OPTIONS[entry.prefix]?.map((option) => (
                                <SelectItem key={`${entry.prefix}-${option.value}`} value={option.value}>
                                  {option.label} - {option.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <Input
                          value={entry.value}
                          onChange={(e) => {
                            const next = [...icaoOtherInfoEntries];
                            next[index] = { ...entry, value: e.target.value.toUpperCase() };
                            setIcaoOtherInfoEntries(next);
                          }}
                          placeholder={ICAO_OTHER_INFO_VALUE_OPTIONS[entry.prefix]?.length ? "Selected value or custom entry" : "Enter value"}
                        />
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setIcaoOtherInfoEntries(icaoOtherInfoEntries.filter((_, entryIndex) => entryIndex !== index))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border bg-background p-3 text-xs">
                  <div className="mb-1 font-semibold text-foreground">ICAO Item 18 Preview</div>
                  <div className="break-words font-mono text-muted-foreground">{form.filingOtherInfoDefault.trim() || "-"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>
              {editingId ? "Save Changes" : "Save Profile"}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Clear
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Saved Profiles</CardTitle>
          <CardDescription>Profiles with effective planning values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading profiles...</div>
          ) : profiles.length === 0 ? (
            <Alert>
              <AlertDescription>
                No aircraft profile has been created. Complete your Aircraft Profile to enable Flight Planning and Flight Service filing.
              </AlertDescription>
            </Alert>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{profile.tailNumber || profile.name}</div>
                        {profile.isDefault ? <Badge>Default Aircraft</Badge> : null}
                        {profile.defaultReadiness?.complete ? <Badge variant="outline">Filing Ready</Badge> : <Badge variant="secondary">Needs ICAO Details</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {profile.name} | {profile.type?.make || profile.customManufacturer || "-"} {profile.type?.model || profile.customModel || ""} | Cruise: {profile.cruise_ktas_effective || "-"} KTAS | Burn: {profile.fuel_burn_gph_effective || profile.fuelBurnDefaultGph || "-"} gph
                      </div>
                  </div>
                  <div className="flex gap-2">
                    {!profile.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setDefaultMutation.isPending || !profile.defaultReadiness?.complete}
                        title={profile.defaultReadiness?.complete ? "Use this aircraft by default in Flight Planner" : profile.defaultReadiness?.errors?.[0] || "Complete ICAO defaults before making this aircraft default."}
                        onClick={() => setDefaultMutation.mutate(profile.id)}
                      >
                        Make Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(profile.id);
                        setForm({
                          name: profile.name,
                          tailNumber: profile.tailNumber || "",
                          typeId: profile.typeId || "",
                          isDefault: Boolean(profile.isDefault),
                          customManufacturer: profile.customManufacturer || "",
                          customModel: profile.customModel || "",
                          customIcaoType: profile.customIcaoType || "",
                          engineTypeOverride: profile.engineTypeOverride || "",
                          engineCountOverride: profile.engineCountOverride ? String(profile.engineCountOverride) : "",
                          fuelBurnDefaultGph: profile.fuelBurnDefaultGph ? String(profile.fuelBurnDefaultGph) : "",
                          serviceCeilingFt: profile.serviceCeilingFt ? String(profile.serviceCeilingFt) : "",
                          notes: profile.notes || "",
                          cruiseKtasOverride: profile.cruiseKtasOverride ? String(profile.cruiseKtasOverride) : "",
                          fuelBurnOverrideGph: profile.fuelBurnOverrideGph ? String(profile.fuelBurnOverrideGph) : "",
                          usableFuelOverrideGal: profile.usableFuelOverrideGal ? String(profile.usableFuelOverrideGal) : "",
                          maxGrossWeightOverrideLb: profile.maxGrossWeightOverrideLb ? String(profile.maxGrossWeightOverrideLb) : "",
                          filingEquipmentDefault: profile.filingEquipmentDefault || "",
                          filingSoulsOnBoardDefault: profile.filingSoulsOnBoardDefault || "1",
                          filingAircraftColorDefault: profile.filingAircraftColorDefault || "",
                          filingPilotNameDefault: profile.filingPilotNameDefault || "",
                          filingRemarksDefault: profile.filingRemarksDefault || "",
                          filingWakeTurbulenceDefault: profile.filingWakeTurbulenceDefault || "MEDIUM",
                          filingTypeOfFlightDefault: profile.filingTypeOfFlightDefault || "G",
                          filingSurveillanceEquipmentDefault: profile.filingSurveillanceEquipmentDefault || "",
                          filingOtherInfoDefault: profile.filingOtherInfoDefault || "",
                          filingEmergencyEquipmentDefault: profile.filingEmergencyEquipmentDefault || "",
                          filingTransponderDefault: profile.filingTransponderDefault || "",
                          filingPerformanceCategoryDefault: profile.filingPerformanceCategoryDefault || "",
                          filingEltDefault: profile.filingEltDefault || "",
                          filingFlightRulesDefault: profile.filingFlightRulesDefault || "VFR",
                          filingCruisingSpeedDefault: profile.filingCruisingSpeedDefault || "",
                          filingAltitudePreferenceDefault: profile.filingAltitudePreferenceDefault || "",
                          filingEnduranceMinutesDefault: profile.filingEnduranceMinutesDefault ? String(profile.filingEnduranceMinutesDefault) : "",
                        });
                        setIsAircraftDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(profile.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Usable fuel: {profile.usable_fuel_gal_effective || "-"} gal | Max gross: {profile.max_gross_weight_lb_effective || "-"} lb
                </div>
                <div className="text-xs text-muted-foreground">
                  Filing defaults: Equip {profile.filingEquipmentDefault || "-"} | Souls {profile.filingSoulsOnBoardDefault || "-"} | PIC {profile.filingPilotNameDefault || "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ICAO ops: Wake {profile.filingWakeTurbulenceDefault || "-"} | Type {profile.filingTypeOfFlightDefault || "-"} | Surveillance {profile.filingSurveillanceEquipmentDefault || "-"}
                </div>
                {!profile.defaultReadiness?.complete && profile.defaultReadiness?.errors?.length ? (
                  <div className="rounded-md border border-amber-300/40 bg-amber-50 p-2 text-xs text-amber-900">
                    {profile.defaultReadiness.errors[0]}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
