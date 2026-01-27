import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";

type AircraftType = {
  id: string;
  make: string;
  model: string;
  icaoType?: string | null;
  category: string;
  engineType: string;
  cruiseKtas: number;
  fuelBurnGph: number;
  usableFuelGal: number;
  maxGrossWeightLb: number;
  defaultAltitudeFt?: number | null;
  isVerified?: boolean | null;
  sourceNote?: string | null;
};

const emptyForm = {
  make: "",
  model: "",
  icaoType: "",
  category: "trainer",
  engineType: "piston",
  cruiseKtas: "",
  fuelBurnGph: "",
  usableFuelGal: "",
  maxGrossWeightLb: "",
  defaultAltitudeFt: "",
  isVerified: true,
  sourceNote: "Typical planning estimates; verify POH/AFM.",
};

export default function AdminAircraftLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const { data: types = [], isLoading } = useQuery<AircraftType[]>({
    queryKey: ["/api/aircraft/types", query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(apiUrl(`/api/aircraft/types?${params.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load types");
      return res.json();
    },
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        make: form.make.trim(),
        model: form.model.trim(),
        icaoType: form.icaoType || null,
        category: form.category,
        engineType: form.engineType,
        cruiseKtas: Number(form.cruiseKtas),
        fuelBurnGph: Number(form.fuelBurnGph),
        usableFuelGal: Number(form.usableFuelGal),
        maxGrossWeightLb: Number(form.maxGrossWeightLb),
        defaultAltitudeFt: form.defaultAltitudeFt ? Number(form.defaultAltitudeFt) : null,
        isVerified: Boolean(form.isVerified),
        sourceNote: form.sourceNote || null,
      };
      if (editingId) {
        const res = await apiRequest("PUT", `/api/aircraft/types/${editingId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/aircraft/types", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/types"] });
      toast({ title: editingId ? "Aircraft type updated" : "Aircraft type added" });
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/aircraft/types/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aircraft/types"] });
      toast({ title: "Aircraft type deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredTypes = useMemo(() => types, [types]);

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Only admins can manage the aircraft library.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aircraft Library (Admin)</h1>
        <p className="text-muted-foreground">Manage RSF aircraft templates.</p>
      </div>

      <Alert>
        <AlertDescription>
          Planning estimates only. Always verify against the aircraft POH/AFM and current conditions.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Aircraft Type" : "Add Aircraft Type"}</CardTitle>
          <CardDescription>Keep seed values conservative and verified.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Make</Label>
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Cessna" />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="172S" />
            </div>
            <div className="space-y-2">
              <Label>ICAO Type</Label>
              <Input value={form.icaoType} onChange={(e) => setForm({ ...form, icaoType: e.target.value })} placeholder="C172" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="trainer" />
            </div>
            <div className="space-y-2">
              <Label>Engine Type</Label>
              <Input value={form.engineType} onChange={(e) => setForm({ ...form, engineType: e.target.value })} placeholder="piston" />
            </div>
            <div className="space-y-2">
              <Label>Cruise KTAS</Label>
              <Input value={form.cruiseKtas} onChange={(e) => setForm({ ...form, cruiseKtas: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Fuel Burn GPH</Label>
              <Input value={form.fuelBurnGph} onChange={(e) => setForm({ ...form, fuelBurnGph: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Usable Fuel Gal</Label>
              <Input value={form.usableFuelGal} onChange={(e) => setForm({ ...form, usableFuelGal: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Max Gross Weight LB</Label>
              <Input value={form.maxGrossWeightLb} onChange={(e) => setForm({ ...form, maxGrossWeightLb: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Default Altitude FT</Label>
              <Input value={form.defaultAltitudeFt} onChange={(e) => setForm({ ...form, defaultAltitudeFt: e.target.value })} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Source Note</Label>
              <Input value={form.sourceNote} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                checked={form.isVerified}
                onCheckedChange={(checked) => setForm({ ...form, isVerified: Boolean(checked) })}
              />
              <span className="text-sm">Verified</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.make || !form.model}>
              {editingId ? "Save Changes" : "Add Aircraft Type"}
            </Button>
            <Button variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aircraft Types</CardTitle>
          <CardDescription>Search and manage the library.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search make, model, ICAO" />
          </div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading types...</div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-sm text-muted-foreground">No aircraft types found.</div>
          ) : (
            filteredTypes.map((type) => (
              <div key={type.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-semibold">
                      {type.make} {type.model} {type.icaoType ? `(${type.icaoType})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cruise {type.cruiseKtas} KTAS | Burn {type.fuelBurnGph} gph | Fuel {type.usableFuelGal} gal | MGW {type.maxGrossWeightLb} lb
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(type.id);
                        setForm({
                          make: type.make,
                          model: type.model,
                          icaoType: type.icaoType || "",
                          category: type.category,
                          engineType: type.engineType,
                          cruiseKtas: String(type.cruiseKtas),
                          fuelBurnGph: String(type.fuelBurnGph),
                          usableFuelGal: String(type.usableFuelGal),
                          maxGrossWeightLb: String(type.maxGrossWeightLb),
                          defaultAltitudeFt: type.defaultAltitudeFt ? String(type.defaultAltitudeFt) : "",
                          isVerified: Boolean(type.isVerified),
                          sourceNote: type.sourceNote || "Typical planning estimates; verify POH/AFM.",
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(type.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
