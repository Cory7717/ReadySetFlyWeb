import { useMemo, useState } from "react";
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

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  cruise_ktas_effective?: number | null;
  fuel_burn_gph_effective?: number | null;
  usable_fuel_gal_effective?: number | null;
  max_gross_weight_lb_effective?: number | null;
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
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
