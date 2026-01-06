import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Plane, Lock, Edit, Trash2 } from "lucide-react";
import type { LogbookEntry, InsertLogbookEntry } from "@shared/schema";

export default function Logbook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogbookEntry | null>(null);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery<LogbookEntry[]>({
    queryKey: ["/api/logbook"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertLogbookEntry) => {
      const res = await fetch("/api/logbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Entry created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create entry", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertLogbookEntry> }) => {
      const res = await fetch(`/api/logbook/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setEditingEntry(null);
      toast({ title: "Entry updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update entry", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/logbook/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      toast({ title: "Entry deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete entry", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async ({ id, signatureDataUrl, signedByName }: { id: string; signatureDataUrl: string; signedByName: string }) => {
      const res = await fetch(`/api/logbook/${id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ signatureDataUrl, signedByName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logbook"] });
      setIsSignDialogOpen(false);
      setSelectedEntryId(null);
      toast({ title: "Entry locked and signed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to lock entry", description: error.message, variant: "destructive" });
    },
  });

  const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.pic || "0") + parseFloat(e.sic || "0"), 0).toFixed(1);

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-6 w-6" />
                My Pilot Logbook
              </CardTitle>
              <CardDescription>
                Track your flight hours and progress
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <LogbookEntryForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  isPending={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Total Hours (PIC + SIC): <strong>{totalHours}</strong>
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logbook entries yet. Add your first flight!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Tail #</TableHead>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>SIC</TableHead>
                  <TableHead>Dual</TableHead>
                  <TableHead>Inst</TableHead>
                  <TableHead>Ldg</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.flightDate).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.tailNumber || "-"}</TableCell>
                    <TableCell>{entry.aircraftType || "-"}</TableCell>
                    <TableCell>{entry.route || "-"}</TableCell>
                    <TableCell>{entry.pic || "0"}</TableCell>
                    <TableCell>{entry.sic || "0"}</TableCell>
                    <TableCell>{entry.dual || "0"}</TableCell>
                    <TableCell>{entry.instrumentActual || "0"}</TableCell>
                    <TableCell>{(entry.landingsDay || 0) + (entry.landingsNight || 0)}</TableCell>
                    <TableCell>
                      {entry.isLocked ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Lock className="h-3 w-3" />
                          Signed
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Draft</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!entry.isLocked && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setEditingEntry(entry)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEntryId(entry.id);
                                setIsSignDialogOpen(true);
                              }}
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Delete this entry?")) deleteMutation.mutate(entry.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingEntry && (
        <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <LogbookEntryForm
              initialData={editingEntry}
              onSubmit={(data) => updateMutation.mutate({ id: editingEntry.id, data })}
              isPending={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {isSignDialogOpen && selectedEntryId && (
        <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
          <DialogContent>
            <SignatureDialog
              onSign={(signatureDataUrl, signedByName) => {
                lockMutation.mutate({ id: selectedEntryId, signatureDataUrl, signedByName });
              }}
              isPending={lockMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LogbookEntryForm({
  initialData,
  onSubmit,
  isPending,
}: {
  initialData?: LogbookEntry;
  onSubmit: (data: InsertLogbookEntry) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState<Partial<InsertLogbookEntry>>(
    initialData || {
      flightDate: new Date().toISOString().split("T")[0],
      tailNumber: "",
      aircraftType: "",
      route: "",
      timeDay: "0",
      timeNight: "0",
      pic: "0",
      sic: "0",
      dual: "0",
      instrumentActual: "0",
      approaches: 0,
      landingsDay: 0,
      landingsNight: 0,
      holds: 0,
      remarks: "",
      hobbsStart: "",
      hobbsEnd: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as InsertLogbookEntry);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? "Edit Entry" : "New Logbook Entry"}</DialogTitle>
        <DialogDescription>Fill in the flight details</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 py-4">
        <div>
          <Label htmlFor="flightDate">Flight Date</Label>
          <Input
            id="flightDate"
            type="date"
            value={formData.flightDate as string}
            onChange={(e) => setFormData({ ...formData, flightDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="tailNumber">Tail Number</Label>
          <Input
            id="tailNumber"
            value={formData.tailNumber || ""}
            onChange={(e) => setFormData({ ...formData, tailNumber: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="aircraftType">Aircraft Type</Label>
          <Input
            id="aircraftType"
            value={formData.aircraftType || ""}
            onChange={(e) => setFormData({ ...formData, aircraftType: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="route">Route</Label>
          <Input
            id="route"
            value={formData.route || ""}
            onChange={(e) => setFormData({ ...formData, route: e.target.value })}
            placeholder="e.g. KDEN-KCOS"
          />
        </div>
        <div>
          <Label htmlFor="pic">PIC (hours)</Label>
          <Input
            id="pic"
            type="number"
            step="0.1"
            value={formData.pic || "0"}
            onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="sic">SIC (hours)</Label>
          <Input
            id="sic"
            type="number"
            step="0.1"
            value={formData.sic || "0"}
            onChange={(e) => setFormData({ ...formData, sic: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="dual">Dual (hours)</Label>
          <Input
            id="dual"
            type="number"
            step="0.1"
            value={formData.dual || "0"}
            onChange={(e) => setFormData({ ...formData, dual: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="instrumentActual">Instrument (hours)</Label>
          <Input
            id="instrumentActual"
            type="number"
            step="0.1"
            value={formData.instrumentActual || "0"}
            onChange={(e) => setFormData({ ...formData, instrumentActual: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="landingsDay">Day Landings</Label>
          <Input
            id="landingsDay"
            type="number"
            value={formData.landingsDay || 0}
            onChange={(e) => setFormData({ ...formData, landingsDay: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="landingsNight">Night Landings</Label>
          <Input
            id="landingsNight"
            type="number"
            value={formData.landingsNight || 0}
            onChange={(e) => setFormData({ ...formData, landingsNight: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="approaches">Approaches</Label>
          <Input
            id="approaches"
            type="number"
            value={formData.approaches || 0}
            onChange={(e) => setFormData({ ...formData, approaches: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="holds">Holds</Label>
          <Input
            id="holds"
            type="number"
            value={formData.holds || 0}
            onChange={(e) => setFormData({ ...formData, holds: parseInt(e.target.value) })}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea
            id="remarks"
            value={formData.remarks || ""}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initialData ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SignatureDialog({
  onSign,
  isPending,
}: {
  onSign: (signatureDataUrl: string, signedByName: string) => void;
  isPending: boolean;
}) {
  const [signedByName, setSignedByName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");

  const handleSign = () => {
    if (!signedByName || !signatureDataUrl) {
      alert("Please provide your name and signature");
      return;
    }
    onSign(signatureDataUrl, signedByName);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sign and Lock Entry</DialogTitle>
        <DialogDescription>Once signed, this entry cannot be edited.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="signedByName">Your Name</Label>
          <Input
            id="signedByName"
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            placeholder="e.g. John Doe, CFI"
          />
        </div>
        <div>
          <Label htmlFor="signature">Signature (base64 data URL)</Label>
          <Textarea
            id="signature"
            value={signatureDataUrl}
            onChange={(e) => setSignatureDataUrl(e.target.value)}
            placeholder="Paste signature data URL here (future: signature pad)"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            For now, paste a base64 data URL. Future: signature canvas.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSign} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Sign & Lock
        </Button>
      </DialogFooter>
    </>
  );
}
