import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Plane, Lock, Edit, Trash2, Download, TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LogbookEntry, InsertLogbookEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Helper function to calculate totals from entries
function calculateTotals(entries: LogbookEntry[]) {
  const totals = {
    totalTime: 0,
    pic: 0,
    sic: 0,
    dual: 0,
    night: 0,
    day: 0,
    instrumentActual: 0,
    crossCountry: 0, // Will need XC field in schema later
    approaches: 0,
    landings: 0,
  };

  entries.forEach((entry) => {
    const pic = parseFloat(entry.pic || "0");
    const sic = parseFloat(entry.sic || "0");
    const dual = parseFloat(entry.dual || "0");
    const night = parseFloat(entry.timeNight || "0");
    const day = parseFloat(entry.timeDay || "0");
    const inst = parseFloat(entry.instrumentActual || "0");

    totals.totalTime += pic + sic;
    totals.pic += pic;
    totals.sic += sic;
    totals.dual += dual;
    totals.night += night;
    totals.day += day;
    totals.instrumentActual += inst;
    totals.approaches += entry.approaches || 0;
    totals.landings += (entry.landingsDay || 0) + (entry.landingsNight || 0);
  });

  return totals;
}

// Export to CSV
function exportToCSV(entries: LogbookEntry[]) {
  const headers = [
    "Date",
    "Tail Number",
    "Aircraft Type",
    "Route",
    "Time Day",
    "Time Night",
    "PIC",
    "SIC",
    "Dual",
    "Instrument",
    "Approaches",
    "Landings Day",
    "Landings Night",
    "Holds",
    "Remarks",
  ];

  const rows = entries.map((e) => [
    e.flightDate,
    e.tailNumber || "",
    e.aircraftType || "",
    e.route || "",
    e.timeDay || "0",
    e.timeNight || "0",
    e.pic || "0",
    e.sic || "0",
    e.dual || "0",
    e.instrumentActual || "0",
    e.approaches || "0",
    e.landingsDay || "0",
    e.landingsNight || "0",
    e.holds || "0",
    e.remarks || "",
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logbook-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
      const res = await apiRequest("POST", "/api/logbook", data);
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
      const res = await apiRequest("PATCH", `/api/logbook/${id}`, data);
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
      const res = await apiRequest("DELETE", `/api/logbook/${id}`);
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
      const res = await apiRequest("POST", `/api/logbook/${id}/lock`, { signatureDataUrl, signedByName });
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
  const totals = calculateTotals(entries);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* FREE FOREVER Badge */}
      <div className="text-center mb-6">
        <Badge variant="outline" className="text-sm px-4 py-2 bg-green-50 border-green-200">
          ✈️ FREE Digital Logbook - No Credit Card Required
        </Badge>
        <p className="text-xs text-muted-foreground mt-2">
          Your data, always accessible. Export anytime.
        </p>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.totalTime.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Total Time</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.pic.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">PIC</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.night.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Night</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{totals.instrumentActual.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Instrument</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Totals */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Flight Time Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">SIC</p>
              <p className="font-semibold">{totals.sic.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dual Received</p>
              <p className="font-semibold">{totals.dual.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Day</p>
              <p className="font-semibold">{totals.day.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Approaches</p>
              <p className="font-semibold">{totals.approaches}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Landings</p>
              <p className="font-semibold">{totals.landings}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-6 w-6" />
                Flight Entries
              </CardTitle>
              <CardDescription>
                Track your flights and build your experience
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(entries)}
                disabled={entries.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
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
          </div>
        </CardHeader>
        <CardContent>
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

      {/* Premium Features Teaser - Future Paid Tier */}
      <Card className="mt-6 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Coming Soon: Pro Features
          </CardTitle>
          <CardDescription>
            Enhanced tools to advance your aviation career
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Currency Tracking</p>
                <p className="text-xs text-muted-foreground">90-day landings, night, IFR alerts</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Endorsement Tracking</p>
                <p className="text-xs text-muted-foreground">Instructor sign-offs & CFI workflows</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Expiration Alerts</p>
                <p className="text-xs text-muted-foreground">Medical, BFR, IPC reminders</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">ATP/Airline Reports</p>
                <p className="text-xs text-muted-foreground">Export to airline application formats</p>
              </div>
            </div>
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground text-center">
            💡 <strong>Your logbook data will always be free and exportable.</strong> Premium features add intelligence and automation.
          </p>
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
    initialData ? {
      flightDate: typeof initialData.flightDate === 'string' 
        ? new Date(initialData.flightDate)
        : initialData.flightDate,
      tailNumber: initialData.tailNumber,
      aircraftType: initialData.aircraftType,
      route: initialData.route,
      timeDay: initialData.timeDay?.toString() || "0",
      timeNight: initialData.timeNight?.toString() || "0",
      pic: initialData.pic?.toString() || "0",
      sic: initialData.sic?.toString() || "0",
      dual: initialData.dual?.toString() || "0",
      instrumentActual: initialData.instrumentActual?.toString() || "0",
      approaches: initialData.approaches || 0,
      landingsDay: initialData.landingsDay || 0,
      landingsNight: initialData.landingsNight || 0,
      holds: initialData.holds || 0,
      remarks: initialData.remarks,
      hobbsStart: initialData.hobbsStart?.toString(),
      hobbsEnd: initialData.hobbsEnd?.toString(),
    } : {
      flightDate: new Date(),
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
            value={formData.flightDate instanceof Date ? formData.flightDate.toISOString().split("T")[0] : ""}
            onChange={(e) => setFormData({ ...formData, flightDate: new Date(e.target.value) })}
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
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // Resize canvas to container width for crisp signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = canvas.parentElement?.clientWidth || 600;
      canvas.width = width;
      canvas.height = 220;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getDrawnDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const getTypedDataUrl = () => {
    if (!typedSignature.trim()) return "";
    const temp = document.createElement("canvas");
    temp.width = 800;
    temp.height = 200;
    const ctx = temp.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, temp.width, temp.height);
    ctx.fillStyle = "#111827";
    ctx.font = "48px 'Segoe Script', 'Pacifico', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typedSignature.trim(), 40, temp.height / 2);
    return temp.toDataURL("image/png");
  };

  const handleSign = () => {
    if (!signedByName.trim()) {
      alert("Please enter the signer name/title");
      return;
    }

    const dataUrl = mode === "draw" ? getDrawnDataUrl() : getTypedDataUrl();
    if (!dataUrl || (mode === "draw" && !hasDrawn)) {
      alert("Please add a signature first");
      return;
    }

    onSign(dataUrl, signedByName.trim());
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sign and Lock Entry</DialogTitle>
        <DialogDescription>Draw on phone/tablet or type a signature from desktop.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="signedByName">Signer name & title</Label>
          <Input
            id="signedByName"
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            placeholder="e.g. Jane Smith, CFI"
          />
        </div>

        <div className="flex gap-2 text-sm">
          <Button
            type="button"
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => setMode("draw")}
          >
            Draw Signature
          </Button>
          <Button
            type="button"
            variant={mode === "type" ? "default" : "outline"}
            onClick={() => setMode("type")}
          >
            Type Signature
          </Button>
        </div>

        {mode === "draw" ? (
          <div className="space-y-2">
            <div className="border rounded-md overflow-hidden touch-none">
              <canvas
                ref={canvasRef}
                className="w-full h-52 bg-white"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={endDrawing}
                onPointerLeave={endDrawing}
              />
            </div>
            <div className="flex gap-2 text-sm">
              <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                Clear
              </Button>
              <p className="text-xs text-muted-foreground self-center">Use finger/stylus on mobile or mouse on desktop.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="typedSignature">Type your name</Label>
            <Input
              id="typedSignature"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
            <p className="text-xs text-muted-foreground">A styled signature image will be generated.</p>
          </div>
        )}
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
