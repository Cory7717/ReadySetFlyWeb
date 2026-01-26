import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { FlightPlan } from "@shared/schema";

function formatDateTimeInput(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function formatDisplayDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

const emptyForm = {
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
  fuelRequired: "",
  notes: "",
};

export default function FlightPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPro = user?.logbookProStatus === "active";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FlightPlan | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: plans = [], isLoading } = useQuery<FlightPlan[]>({
    queryKey: ["/api/flight-plans"],
    enabled: isPro,
  });

  useEffect(() => {
    if (editingPlan) {
      setForm({
        title: editingPlan.title || "",
        departure: editingPlan.departure || "",
        destination: editingPlan.destination || "",
        route: editingPlan.route || "",
        alternate: editingPlan.alternate || "",
        plannedDepartureAt: formatDateTimeInput(editingPlan.plannedDepartureAt),
        plannedArrivalAt: formatDateTimeInput(editingPlan.plannedArrivalAt),
        aircraftType: editingPlan.aircraftType || "",
        tailNumber: editingPlan.tailNumber || "",
        fuelOnBoard: editingPlan.fuelOnBoard ? String(editingPlan.fuelOnBoard) : "",
        fuelRequired: editingPlan.fuelRequired ? String(editingPlan.fuelRequired) : "",
        notes: editingPlan.notes || "",
      });
      setIsDialogOpen(true);
    }
  }, [editingPlan]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingPlan(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        plannedDepartureAt: form.plannedDepartureAt ? new Date(form.plannedDepartureAt).toISOString() : null,
        plannedArrivalAt: form.plannedArrivalAt ? new Date(form.plannedArrivalAt).toISOString() : null,
        fuelOnBoard: form.fuelOnBoard || null,
        fuelRequired: form.fuelRequired || null,
      };
      const res = await apiRequest("POST", "/api/flight-plans", payload);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save flight plan");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({ title: "Flight plan saved" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingPlan) return null;
      const payload = {
        ...form,
        plannedDepartureAt: form.plannedDepartureAt ? new Date(form.plannedDepartureAt).toISOString() : null,
        plannedArrivalAt: form.plannedArrivalAt ? new Date(form.plannedArrivalAt).toISOString() : null,
        fuelOnBoard: form.fuelOnBoard || null,
        fuelRequired: form.fuelRequired || null,
      };
      const res = await apiRequest("PATCH", `/api/flight-plans/${editingPlan.id}`, payload);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update flight plan");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({ title: "Flight plan updated" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/flight-plans/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete flight plan");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flight-plans"] });
      toast({ title: "Flight plan deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  if (!isPro) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Flight Planner (Logbook Pro)</CardTitle>
            <CardDescription>Upgrade to Logbook Pro to unlock saved flight plans.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Logbook Pro unlocks currency tracking, expirations, and a simple flight planner for saved routes.
            </p>
            <Button asChild>
              <Link href="/logbook/pro">Upgrade to Logbook Pro</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Flight Planner</h1>
          <p className="text-muted-foreground">Create and manage saved flight plans for quick reference.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>New Flight Plan</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Plans</CardTitle>
          <CardDescription>Quick access to your planned routes and fuel notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading flight plans...</div>
          ) : plans.length === 0 ? (
            <div className="text-sm text-muted-foreground">No flight plans yet. Create your first plan.</div>
          ) : (
            plans.map((plan) => (
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
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(plan.id)}
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
                    <div>{formatDisplayDate(plan.plannedDepartureAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Arrival</div>
                    <div>{formatDisplayDate(plan.plannedArrivalAt)}</div>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Aircraft</div>
                    <div>{plan.aircraftType || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tail</div>
                    <div>{plan.tailNumber || "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Fuel (On Board / Required)</div>
                    <div>{plan.fuelOnBoard || "-"} / {plan.fuelRequired || "-"}</div>
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Flight Plan" : "New Flight Plan"}</DialogTitle>
            <DialogDescription>Store the plan details you want to keep on hand.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Aircraft Type</Label>
                <Input value={form.aircraftType} onChange={(e) => setForm({ ...form, aircraftType: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Departure</Label>
                <Input value={form.departure} onChange={(e) => setForm({ ...form, departure: e.target.value })} placeholder="KJFK" />
              </div>
              <div className="space-y-1">
                <Label>Destination</Label>
                <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="KBOS" />
              </div>
              <div className="space-y-1">
                <Label>Route</Label>
                <Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="V1 V3 ABC" />
              </div>
              <div className="space-y-1">
                <Label>Alternate</Label>
                <Input value={form.alternate} onChange={(e) => setForm({ ...form, alternate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Planned Departure</Label>
                <Input
                  type="datetime-local"
                  value={form.plannedDepartureAt}
                  onChange={(e) => setForm({ ...form, plannedDepartureAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Planned Arrival</Label>
                <Input
                  type="datetime-local"
                  value={form.plannedArrivalAt}
                  onChange={(e) => setForm({ ...form, plannedArrivalAt: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tail Number</Label>
                <Input value={form.tailNumber} onChange={(e) => setForm({ ...form, tailNumber: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fuel On Board</Label>
                <Input value={form.fuelOnBoard} onChange={(e) => setForm({ ...form, fuelOnBoard: e.target.value })} placeholder="Gallons" />
              </div>
              <div className="space-y-1">
                <Label>Fuel Required</Label>
                <Input value={form.fuelRequired} onChange={(e) => setForm({ ...form, fuelRequired: e.target.value })} placeholder="Gallons" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
            </div>
            <Button
              onClick={() => (editingPlan ? updateMutation.mutate() : createMutation.mutate())}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingPlan ? "Save Changes" : "Save Flight Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
