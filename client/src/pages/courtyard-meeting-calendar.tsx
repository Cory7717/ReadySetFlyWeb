import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

async function request(url: string, init?: RequestInit) {
  const r = await fetch(apiUrl(url), { credentials: "include", ...init });
  const b = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(b.error || "Request failed"), {
      code: b.code,
      status: r.status,
    });
  return b;
}
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const money = (value: unknown) => Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const revenueSubtotal = (value: any) => ["roomRentalRevenue", "avRevenue", "cateringRevenue", "otherRevenue"].reduce((sum, field) => sum + Number(value?.[field] || 0), 0);
const serviceFeeValue = (value: any) => revenueSubtotal(value) * Number(value?.serviceFeePercent || 0) / 100;
const gratuityValue = (value: any) => revenueSubtotal(value) * Number(value?.gratuityPercent || 0) / 100;
const eventRevenueTotal = (value: any) => revenueSubtotal(value) + Number(value?.taxAmount || 0) + serviceFeeValue(value) + gratuityValue(value);
const colors: any = {
  inquiry: "bg-slate-100 text-slate-800",
  courtesy_hold: "bg-amber-100 text-amber-900",
  tentative: "bg-orange-100 text-orange-900",
  contract_sent: "bg-blue-100 text-blue-900",
  definite: "bg-emerald-100 text-emerald-900",
  completed: "bg-gray-200 text-gray-800",
  cancelled: "bg-red-100 text-red-900",
  expired: "bg-red-50 text-red-700",
};
const empty = {
  spaceId: "",
  groupName: "",
  eventName: "",
  eventDate: "",
  eventEndDate: "",
  setupStartTime: "08:00",
  guestStartTime: "09:00",
  guestEndTime: "17:00",
  breakdownEndTime: "18:00",
  status: "inquiry",
  holdExpiresAt: "",
  attendance: "",
  squareFeetRequired: "2000",
  meetingRoom: "full_room",
  roomSetup: "classroom",
  salesOwner: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  expectedRevenue: "",
  roomRentalRevenue: "",
  taxAmount: "",
  serviceFeePercent: "",
  gratuityPercent: "",
  avRevenue: "",
  cateringRevenue: "",
  otherRevenue: "",
  expectedRoomNights: "",
  cateringNotes: "",
  avNotes: "",
  accessibilityNotes: "",
  internalNotes: "",
  accountKey: "",
  opportunityId: "",
  conflictOverrideReason: "",
};

export default function CourtyardMeetingCalendar() {
  const { toast } = useToast(),
    qc = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [view, setView] = useState("month");
  const [accessPin, setAccessPin] = useState("");
  const me = useQuery({
    queryKey: ["sales-meeting-me"],
    queryFn: () => request("/api/courtyard/sales-intelligence/me"),
    retry: false,
  });
  const hotelId = me.data?.hotels?.[0]?.id || "";
  const pinLogin = useMutation({
    mutationFn: () =>
      request("/api/courtyard/sales-intelligence/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: accessPin }),
      }),
    onSuccess: () => {
      setAccessPin("");
      qc.invalidateQueries({ queryKey: ["sales-meeting-me"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not unlock the calendar", description: error.message, variant: "destructive" }),
  });
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + 6 - last.getDay());
  const cal = useQuery({
    queryKey: ["meeting-calendar", hotelId, key(start), key(end)],
    queryFn: () =>
      request(
        `/api/courtyard/sales-intelligence/meeting-calendar?hotelId=${hotelId}&start=${key(start)}&end=${key(end)}`,
      ),
    enabled: !!hotelId,
  });
  const save = useMutation({
    mutationFn: (body: any) =>
      request(editingEventId ? `/api/courtyard/sales-intelligence/meeting-calendar/events/${editingEventId}` : "/api/courtyard/sales-intelligence/meeting-calendar/events", {
        method: editingEventId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          ...body,
          attendance: body.attendance ? Number(body.attendance) : null,
          squareFeetRequired: body.squareFeetRequired
            ? Number(body.squareFeetRequired)
            : null,
          expectedRoomNights: body.expectedRoomNights
            ? Number(body.expectedRoomNights)
            : null,
          roomRentalRevenue: Number(body.roomRentalRevenue || 0),
          taxAmount: Number(body.taxAmount || 0),
          serviceFeePercent: Number(body.serviceFeePercent || 0),
          gratuityPercent: Number(body.gratuityPercent || 0),
          avRevenue: Number(body.avRevenue || 0),
          cateringRevenue: Number(body.cateringRevenue || 0),
          otherRevenue: Number(body.otherRevenue || 0),
        }),
      }),
    onSuccess: (result: any) => {
      setOpen(false);
      const wasEditing = Boolean(editingEventId);
      setEditingEventId(null);
      setSelectedEvent(null);
      setForm({ ...empty, spaceId: cal.data?.spaces?.[0]?.id || "" });
      qc.invalidateQueries({ queryKey: ["meeting-calendar"] });
      toast({
        title: result?.count > 1 ? `${result.count} meeting-space dates saved` : wasEditing ? "Meeting-space event updated" : "Meeting-space event saved",
        description: result?.count > 1 ? "The event was added to every date in the selected range." : undefined,
      });
    },
    onError: (e: any) => {
      if (e.code === "MEETING_SPACE_CONFLICT" && cal.data?.user?.isAdmin) {
        const reason = prompt(
          `${e.message}\n\nEnter the override reason:`,
        );
        if (reason) save.mutate({ ...form, conflictOverrideReason: reason });
        return;
      }
      toast({
        title: "Could not save event",
        description: e.message,
        variant: "destructive",
      });
    },
  });
  const days = useMemo(
    () =>
      Array.from(
        {
          length: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
        },
        (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return d;
        },
      ),
    [key(start), key(end)],
  );
  if (me.isLoading)
    return (
      <div className="min-h-screen bg-[#f7f1e7] p-8">
        Loading meeting calendar…
      </div>
    );
  if (me.error && [401, 403].includes((me.error as any).status))
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f1e7]">
        <Card className="w-full max-w-md border-[#deceba] bg-white text-[#201814]">
          <CardHeader>
            <CardTitle>Meeting Calendar</CardTitle>
            <CardDescription>Enter the shared five-digit PIN used for Sales Intelligence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shared PIN</Label>
              <Input type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={5} value={accessPin} onChange={(event) => setAccessPin(event.target.value.replace(/\D/g, "").slice(0, 5))} onKeyDown={(event) => { if (event.key === "Enter" && accessPin.length === 5) pinLogin.mutate(); }} />
            </div>
            <Button className="w-full bg-[#2f5f46] text-white hover:bg-[#244b37]" disabled={accessPin.length !== 5 || pinLogin.isPending} onClick={() => pinLogin.mutate()}>
              {pinLogin.isPending ? "Unlocking…" : "Open Meeting Calendar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  if (me.error)
    return <div className="min-h-screen bg-[#f7f1e7] p-8 text-[#201814]">{(me.error as Error).message}</div>;
  const events = cal.data?.events || [];
  const monthlyEvents = Array.from(new Map(
    events
      .filter((event: any) => {
        const revenueDate = event.bookingStartDate || event.eventDate;
        return revenueDate >= key(first) && revenueDate <= key(last) && !["cancelled", "expired"].includes(event.status);
      })
      .map((event: any) => [event.bookingSeriesId || event.id, event]),
  ).values()) as any[];
  const monthlyRevenue = monthlyEvents.reduce((sum, event) => sum + Number(event.expectedRevenue || 0), 0);
  const openNew = (date = "") => {
    setEditingEventId(null);
    setForm({
      ...empty,
      spaceId: cal.data?.spaces?.[0]?.id || "",
      eventDate: date,
    });
    setOpen(true);
  };
  const openEdit = (event: any) => {
    setSelectedEvent(null);
    setEditingEventId(event.id);
    setForm({
      ...empty,
      ...event,
      eventEndDate: "",
      holdExpiresAt: event.holdExpiresAt ? new Date(event.holdExpiresAt).toISOString().slice(0, 16) : "",
      attendance: event.attendance ?? "",
      squareFeetRequired: event.squareFeetRequired ?? "",
      expectedRoomNights: event.expectedRoomNights ?? "",
      expectedRevenue: event.expectedRevenue ?? "",
      roomRentalRevenue: event.roomRentalRevenue ?? "",
      taxAmount: event.taxAmount ?? "",
      serviceFeePercent: event.serviceFeePercent ?? "",
      gratuityPercent: event.gratuityPercent ?? "",
      avRevenue: event.avRevenue ?? "",
      cateringRevenue: event.cateringRevenue ?? "",
      otherRevenue: event.otherRevenue ?? "",
    });
    setOpen(true);
  };
  return (
    <div className="min-h-screen bg-[#f7f1e7] text-[#201814]">
      <header className="border-b border-[#deceba] bg-[#fffaf2] px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.2em] text-[#8a6b3f]">
              Courtyard Austin Lakeline
            </div>
            <h1 className="text-3xl font-semibold">Meeting Space Calendar</h1>
            <p className="text-[#5f5247]">
              Operational availability for the hotel’s 2,000 sq. ft. meeting
              space.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/courtyard/sales-intelligence">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Sales Intelligence
              </Link>
            </Button>
            <Button
              className="bg-[#2f5f46] text-white"
              onClick={() => openNew()}
            >
              <Plus className="mr-2 h-4 w-4" />
              New event
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft />
            </Button>
            <h2 className="min-w-48 text-center text-xl font-semibold">
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <Button
              size="icon"
              variant="outline"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={view === "month" ? "default" : "outline"}
              onClick={() => setView("month")}
            >
              Month
            </Button>
            <Button
              variant={view === "agenda" ? "default" : "outline"}
              onClick={() => setView("agenda")}
            >
              Agenda
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const recipientName =
                  prompt("Recipient name:") || "Calendar recipient";
                const r = await request(
                  "/api/courtyard/sales-intelligence/meeting-calendar/shares",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      hotelId,
                      recipientName,
                      rangeStart: key(first),
                      rangeEnd: key(last),
                      expiresInDays: 7,
                    }),
                  },
                );
                await navigator.clipboard.writeText(r.url);
                toast({
                  title: "View-only calendar link copied",
                  description: r.url,
                });
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share month
            </Button>
          </div>
        </div>
        <Card className="border-[#cdbda8] bg-[#fffaf2] text-[#201814] dark:border-[#cdbda8] dark:bg-[#fffaf2] dark:text-[#201814]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 bg-[#fffaf2] p-4 text-[#201814] dark:bg-[#fffaf2] dark:text-[#201814]">
            <div><div className="text-xs font-bold uppercase tracking-[.16em] text-[#8a6b3f]">Monthly event revenue</div><div className="text-sm text-[#5f5247]">Active bookings beginning in {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div></div>
            <div className="text-3xl font-bold text-[#2f5f46]">{money(monthlyRevenue)}</div>
          </CardContent>
        </Card>
        {view === "month" ? (
          <div className="overflow-hidden rounded-xl border border-[#cdbda8] bg-white">
            <div className="grid grid-cols-7 bg-[#eadfce] text-center text-sm font-semibold">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
                <div className="p-2" key={x}>
                  {x}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const date = key(d),
                  rows = events.filter((x: any) => x.eventDate === date);
                return (
                  <button
                    key={date}
                    className={`min-h-32 border-t border-r p-2 text-left align-top hover:bg-[#fffaf2] ${d.getMonth() !== month.getMonth() ? "bg-slate-50 text-slate-400" : ""}`}
                    onClick={() => openNew(date)}
                  >
                    <div className="font-semibold">{d.getDate()}</div>
                    {rows.map((x: any) => (
                      <div
                        key={x.id}
                        className={`mt-1 cursor-pointer rounded p-1 text-xs hover:ring-2 hover:ring-[#8a6b3f] ${colors[x.status] || colors.inquiry}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(x);
                        }}
                      >
                        <b>{x.guestStartTime.slice(0, 5)}</b> {x.groupName}
                        <div>{x.status.replaceAll("_", " ")}</div>
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4">
              {events.map((x: any) => (
                <div
                  key={x.id}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer flex-wrap justify-between gap-2 rounded border p-3 text-left hover:border-[#8a6b3f] hover:bg-[#fffaf2]"
                  onClick={() => setSelectedEvent(x)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedEvent(x);
                  }}
                >
                  <div>
                    <b>
                      {x.eventDate} · {x.groupName} — {x.eventName}
                    </b>
                    <div className="text-sm">
                      Occupied {x.setupStartTime.slice(0, 5)}–
                      {x.breakdownEndTime.slice(0, 5)} · Guests{" "}
                      {x.guestStartTime.slice(0, 5)}–
                      {x.guestEndTime.slice(0, 5)} · {x.roomSetup}
                    </div>
                  </div>
                  <Badge className={colors[x.status]}>
                    {x.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setEditingEventId(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto bg-white text-[#201814]">
          <DialogHeader>
            <DialogTitle>{editingEventId ? "Edit meeting-space event" : "New meeting-space event"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Group/company</Label>
              <Input
                value={form.groupName}
                onChange={(e) =>
                  setForm({ ...form, groupName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Event name</Label>
              <Input
                value={form.eventName}
                onChange={(e) =>
                  setForm({ ...form, eventName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.eventDate}
                onChange={(e) =>
                  setForm({ ...form, eventDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label>End date <span className="font-normal text-[#5f5247]">(optional)</span></Label>
              <Input
                type="date"
                min={form.eventDate || undefined}
                value={form.eventEndDate}
                onChange={(e) => setForm({ ...form, eventEndDate: e.target.value })}
              />
              <p className="mt-1 text-xs text-[#5f5247]">Use for consecutive multi-day events. Leave blank for one day.</p>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(status) => setForm({ ...form, status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "inquiry",
                    "courtesy_hold",
                    "tentative",
                    "contract_sent",
                    "definite",
                  ].map((x) => (
                    <SelectItem value={x} key={x}>
                      {x.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {[
              ["Setup start", "setupStartTime"],
              ["Guest start", "guestStartTime"],
              ["Guest end", "guestEndTime"],
              ["Breakdown end", "breakdownEndTime"],
            ].map(([label, k]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Input
                  type="time"
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <Label>Attendance</Label>
              <Input
                type="number"
                value={form.attendance}
                onChange={(e) =>
                  setForm({ ...form, attendance: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Meeting room</Label>
              <Select value={form.meetingRoom} onValueChange={(meetingRoom) => setForm({ ...form, meetingRoom, squareFeetRequired: meetingRoom === "pecan" ? "560" : meetingRoom === "cedar" ? "1575" : "2135" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pecan">Pecan · 560 sq. ft.</SelectItem>
                  <SelectItem value="cedar">Cedar · 1,575 sq. ft.</SelectItem>
                  <SelectItem value="full_room">Full room · 2,135 sq. ft.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room setup</Label>
              <Select
                value={form.roomSetup}
                onValueChange={(roomSetup) => setForm({ ...form, roomSetup })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "classroom",
                    "theater",
                    "u_shape",
                    "conference",
                    "banquet",
                    "reception",
                    "custom",
                  ].map((x) => (
                    <SelectItem value={x} key={x}>
                      {x.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Sales owner"
              value={form.salesOwner}
              onChange={(e) => setForm({ ...form, salesOwner: e.target.value })}
            />
            <Input
              placeholder="Client contact"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            />
            <Input
              type="email"
              placeholder="Client email"
              value={form.clientEmail}
              onChange={(e) =>
                setForm({ ...form, clientEmail: e.target.value })
              }
            />
            <Input
              placeholder="Client phone"
              value={form.clientPhone}
              onChange={(e) =>
                setForm({ ...form, clientPhone: e.target.value })
              }
            />
            <Input
              type="number"
              placeholder="Expected room nights"
              value={form.expectedRoomNights}
              onChange={(e) =>
                setForm({ ...form, expectedRoomNights: e.target.value })
              }
            />
            <div className="md:col-span-2 rounded-xl border border-[#deceba] bg-[#fffaf2] p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Event revenue</h3><p className="text-xs text-[#5f5247]">Service fee and gratuity are percentages of the revenue subtotal. Tax is entered as a dollar amount.</p></div><div className="text-2xl font-bold text-[#2f5f46]">{money(eventRevenueTotal(form))}</div></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[["Room rental", "roomRentalRevenue"], ["Tax amount", "taxAmount"], ["AV add-ons", "avRevenue"], ["In-house catering revenue", "cateringRevenue"], ["Other add-ons", "otherRevenue"]].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type="number" min="0" step="0.01" value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></div>)}
                {[["Service fee %", "serviceFeePercent"], ["Gratuity %", "gratuityPercent"]].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type="number" min="0" max="100" step="0.001" value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /><p className="mt-1 text-xs text-[#5f5247]">Calculated: {money(field === "serviceFeePercent" ? serviceFeeValue(form) : gratuityValue(form))}</p></div>)}
              </div>
            </div>
            {form.status === "courtesy_hold" && (
              <div>
                <Label>Hold expires</Label>
                <Input
                  type="datetime-local"
                  value={form.holdExpiresAt}
                  onChange={(e) =>
                    setForm({ ...form, holdExpiresAt: e.target.value })
                  }
                />
              </div>
            )}
            <Textarea
              className="md:col-span-2"
              placeholder="Catering, AV, accessibility, and internal notes"
              value={form.internalNotes}
              onChange={(e) =>
                setForm({ ...form, internalNotes: e.target.value })
              }
            />
            <Button
              className="bg-[#2f5f46] text-white md:col-span-2"
              disabled={save.isPending}
              onClick={() => save.mutate(form)}
            >
              {save.isPending ? "Saving…" : editingEventId ? "Save changes" : "Save event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(isOpen) => { if (!isOpen) setSelectedEvent(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto bg-white text-[#201814]">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
                  <div>
                    <DialogTitle className="text-2xl">{selectedEvent.eventName}</DialogTitle>
                    <p className="mt-1 text-base text-[#5f5247]">{selectedEvent.groupName}</p>
                  </div>
                  <Badge className={colors[selectedEvent.status] || colors.inquiry}>
                    {selectedEvent.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </DialogHeader>

              <section className="rounded-xl border border-[#deceba] bg-[#fffaf2] p-4">
                <div className="text-sm font-semibold uppercase tracking-[.14em] text-[#8a6b3f]">Event day</div>
                <div className="mt-1 text-xl font-semibold">
                  {new Date(`${selectedEvent.eventDate}T12:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="mt-1 text-sm text-[#5f5247]">
                  {(cal.data?.spaces || []).find((space: any) => space.id === selectedEvent.spaceId)?.name || "Meeting Space"}
                </div>
              </section>

              <section>
                <h3 className="mb-2 font-semibold">Setup and breakdown timeline</h3>
                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    ["Setup begins", selectedEvent.setupStartTime],
                    ["Guests arrive", selectedEvent.guestStartTime],
                    ["Event ends", selectedEvent.guestEndTime],
                    ["Breakdown complete", selectedEvent.breakdownEndTime],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#deceba] bg-white p-3">
                      <div className="text-xs font-semibold uppercase text-[#8a6b3f]">{label}</div>
                      <div className="mt-1 text-lg font-bold">{String(value || "").slice(0, 5)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 rounded-xl border border-[#deceba] p-4 sm:grid-cols-4">
                <div><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Meeting room</div><div>{selectedEvent.meetingRoom === "pecan" ? "Pecan · 560 sq. ft." : selectedEvent.meetingRoom === "cedar" ? "Cedar · 1,575 sq. ft." : selectedEvent.meetingRoom === "full_room" ? "Full room · 2,135 sq. ft." : "Not specified"}</div></div>
                <div><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Room setup</div><div className="capitalize">{selectedEvent.roomSetup?.replaceAll("_", " ") || "Not specified"}</div></div>
                <div><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Attendance</div><div>{selectedEvent.attendance ?? "Not specified"}</div></div>
                <div><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Space required</div><div>{selectedEvent.squareFeetRequired ? `${selectedEvent.squareFeetRequired.toLocaleString()} sq. ft.` : "Not specified"}</div></div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-semibold">Event revenue</h3><div className="text-2xl font-bold text-[#2f5f46]">{money(selectedEvent.expectedRevenue)}</div></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[["Room rental", selectedEvent.roomRentalRevenue], ["Tax", selectedEvent.taxAmount], [`Service fee (${Number(selectedEvent.serviceFeePercent || 0)}%)`, serviceFeeValue(selectedEvent)], [`Gratuity (${Number(selectedEvent.gratuityPercent || 0)}%)`, gratuityValue(selectedEvent)], ["AV add-ons", selectedEvent.avRevenue], ["In-house catering", selectedEvent.cateringRevenue], ["Other add-ons", selectedEvent.otherRevenue]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-lg border border-[#deceba] bg-[#fffaf2] p-3"><span className="text-sm text-[#5f5247]">{label}</span><strong>{money(value)}</strong></div>)}
                </div>
              </section>

              {(selectedEvent.salesOwner || selectedEvent.clientName || selectedEvent.clientEmail || selectedEvent.clientPhone) && (
                <section>
                  <h3 className="mb-2 font-semibold">Contacts</h3>
                  <div className="grid gap-2 rounded-xl border border-[#deceba] p-4 sm:grid-cols-2">
                    {selectedEvent.salesOwner && <div><span className="font-semibold">Sales owner:</span> {selectedEvent.salesOwner}</div>}
                    {selectedEvent.clientName && <div><span className="font-semibold">Client:</span> {selectedEvent.clientName}</div>}
                    {selectedEvent.clientEmail && <div><span className="font-semibold">Email:</span> <a className="text-blue-700 underline" href={`mailto:${selectedEvent.clientEmail}`}>{selectedEvent.clientEmail}</a></div>}
                    {selectedEvent.clientPhone && <div><span className="font-semibold">Phone:</span> <a className="text-blue-700 underline" href={`tel:${selectedEvent.clientPhone}`}>{selectedEvent.clientPhone}</a></div>}
                  </div>
                </section>
              )}

              {(selectedEvent.cateringNotes || selectedEvent.avNotes || selectedEvent.accessibilityNotes || selectedEvent.internalNotes) && (
                <section>
                  <h3 className="mb-2 font-semibold">Operational notes</h3>
                  <div className="space-y-2">
                    {[["Catering", selectedEvent.cateringNotes], ["Audio / visual", selectedEvent.avNotes], ["Accessibility", selectedEvent.accessibilityNotes], ["Internal notes", selectedEvent.internalNotes]].filter(([, value]) => value).map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-[#deceba] bg-[#fffaf2] p-3">
                        <div className="text-xs font-semibold uppercase text-[#8a6b3f]">{label}</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(cal.data?.documents || []).some((document: any) => document.eventId === selectedEvent.id) && (
                <section>
                  <h3 className="mb-2 font-semibold">Event documents</h3>
                  <div className="space-y-2">
                    {(cal.data?.documents || []).filter((document: any) => document.eventId === selectedEvent.id).map((document: any) => (
                      <a key={document.id} className="flex items-center justify-between rounded-lg border border-[#deceba] p-3 text-blue-700 hover:bg-[#fffaf2]" href={apiUrl(`/api/courtyard/sales-intelligence/meeting-calendar/events/${selectedEvent.id}/documents/${document.id}`)}>
                        <span className="font-medium underline">{document.filename}</span>
                        <span className="text-xs text-[#5f5247]">{document.category}</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
                <Button className="bg-[#2f5f46] text-white hover:bg-[#244b37]" onClick={() => openEdit(selectedEvent)}>Edit event</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
