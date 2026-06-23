import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import {
  ICAO_OTHER_INFO_PREFIXES,
  ICAO_OTHER_INFO_VALUE_OPTIONS,
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
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
};

const emptyForm = {
  name: "",
  tailNumber: "",
  typeId: "",
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
};

export default function MyAircraft() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: types = [] } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types"],
  });

  const { data: profiles = [], isLoading } = useQuery<AircraftProfile[]>({
    queryKey: ["/api/aircraft/profiles"],
  });

  const typeOptions = useMemo(() => types, [types]);
  const selectedLibraryType = useMemo(
    () => typeOptions.find((type) => type.id === form.typeId) || null,
    [form.typeId, typeOptions],
  );
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
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        tailNumber: form.tailNumber || null,
        typeId: form.typeId || null,
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
        <h1 className="text-3xl font-bold">My Aircraft</h1>
        <p className="text-muted-foreground">Save aircraft profiles for faster planning.</p>
      </div>

      <Alert>
        <AlertDescription>
          Planning estimates only. Always verify against the aircraft POH/AFM and current conditions.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Profile" : "New Profile"}</CardTitle>
          <CardDescription>Create a profile and optionally override planning values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Aircraft Type (RSF library)</Label>
              <Select value={form.typeId} onValueChange={(value) => setForm({ ...form, typeId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an aircraft type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.make} {type.model}{type.icaoType ? ` (${type.icaoType})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    {ICAO_SURVEILLANCE_OPTIONS.map((entry) => (
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
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Other ICAO Information</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setIcaoOtherInfoEntries([...icaoOtherInfoEntries, { prefix: "RMK/", value: "" }])}>
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
                          {ICAO_OTHER_INFO_PREFIXES.map((prefix) => (
                            <SelectItem key={prefix} value={prefix}>
                              {prefix}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Profiles</CardTitle>
          <CardDescription>Profiles with effective planning values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading profiles...</div>
          ) : profiles.length === 0 ? (
            <div className="text-sm text-muted-foreground">No profiles yet.</div>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-semibold">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Tail: {profile.tailNumber || "-"} | Cruise: {profile.cruise_ktas_effective || "-"} KTAS | Burn: {profile.fuel_burn_gph_effective || "-"} gph
                      </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(profile.id);
                        setForm({
                          name: profile.name,
                          tailNumber: profile.tailNumber || "",
                          typeId: profile.typeId || "",
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
                        });
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
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
