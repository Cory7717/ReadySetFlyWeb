import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Share2,
  Trash2,
  Upload,
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
  const b = r.status === 204 ? {} : await r.json();
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
const eventDayCount = (value: any) => {
  if (!value?.eventDate || !value?.eventEndDate) return 1;
  const start = new Date(`${value.eventDate}T12:00:00Z`), end = new Date(`${value.eventEndDate}T12:00:00Z`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
};
const cateringValue = (value: any) => value?.eventEndDate !== undefined
  ? Number(value?.attendance || 0) * eventDayCount(value) * (Number(value?.breakfastPerPerson || 0) + Number(value?.lunchDinnerPerPerson || 0))
  : Number(value?.cateringRevenue || 0);
const roomTaxValue = (value: any) => Number(value?.roomRentalRevenue || 0) * 0.06;
const roomServiceFeeValue = (value: any) => Number(value?.roomRentalRevenue || 0) * 0.21;
const fbSubtotal = (value: any) => cateringValue(value) + Number(value?.otherRevenue || 0);
const fbTaxValue = (value: any) => fbSubtotal(value) * 0.0825;
const fbGratuityValue = (value: any) => fbSubtotal(value) * 0.18;
const eventRevenueTotal = (value: any) => Number(value?.roomRentalRevenue || 0) + roomTaxValue(value) + roomServiceFeeValue(value) + fbSubtotal(value) + fbTaxValue(value) + fbGratuityValue(value) + Number(value?.avRevenue || 0);
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
  avRevenue: "",
  cateringRevenue: "",
  breakfastPerPerson: "",
  lunchDinnerPerPerson: "",
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
const emptyGroupRoom = {
  groupName: "", projectName: "", arrivalDate: "", departureDate: "", status: "prospect",
  peakRooms: "", totalRoomNights: "", roomTypeMix: "", groupRate: "", bookingMethod: "reservation_link",
  cutoffDate: "", groupCode: "", taxExempt: false, primaryContactName: "", primaryContactEmail: "", primaryContactPhone: "", salesOwner: "",
  billingInstructions: "", depositDueDate: "", depositAmount: "", arrivalNotes: "", vipNotes: "", transportationNotes: "", breakfastNotes: "",
  frontDeskNotes: "", housekeepingNotes: "", internalNotes: "",
};
const groupStatusColors: any = { prospect: "bg-slate-100 text-slate-800", tentative: "bg-sky-100 text-sky-900", definite: "bg-blue-700 text-white", in_house: "bg-violet-700 text-white", completed: "bg-gray-200 text-gray-800", cancelled: "bg-red-100 text-red-900" };
const groupNights = (block: any) => block?.arrivalDate && block?.departureDate ? Math.max(0, Math.round((new Date(`${block.departureDate}T12:00:00Z`).getTime() - new Date(`${block.arrivalDate}T12:00:00Z`).getTime()) / 86400000)) : 0;

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
  const [calendarLayer, setCalendarLayer] = useState("all");
  const [groupRoomOpen, setGroupRoomOpen] = useState(false);
  const [groupRoomForm, setGroupRoomForm] = useState<any>(emptyGroupRoom);
  const [editingGroupRoomId, setEditingGroupRoomId] = useState<string | null>(null);
  const [selectedGroupRoom, setSelectedGroupRoom] = useState<any>(null);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractPreview, setContractPreview] = useState<any>(null);
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
          avRevenue: Number(body.avRevenue || 0),
          breakfastPerPerson: Number(body.breakfastPerPerson || 0),
          lunchDinnerPerPerson: Number(body.lunchDinnerPerPerson || 0),
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
  const saveGroupRoom = useMutation({
    mutationFn: (body: any) => request(editingGroupRoomId ? `/api/courtyard/sales-intelligence/meeting-calendar/group-rooms/${editingGroupRoomId}` : "/api/courtyard/sales-intelligence/meeting-calendar/group-rooms", {
      method: editingGroupRoomId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, ...body, peakRooms: body.peakRooms === "" ? null : Number(body.peakRooms), totalRoomNights: body.totalRoomNights === "" ? null : Number(body.totalRoomNights), groupRate: body.groupRate === "" ? null : Number(body.groupRate), depositAmount: body.depositAmount === "" ? null : Number(body.depositAmount) }),
    }),
    onSuccess: () => { setGroupRoomOpen(false); setSelectedGroupRoom(null); setEditingGroupRoomId(null); setGroupRoomForm(emptyGroupRoom); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: editingGroupRoomId ? "Group room block updated" : "Group room block added" }); },
    onError: (error: Error) => toast({ title: "Could not save group room block", description: error.message, variant: "destructive" }),
  });
  const previewContract = useMutation({
    mutationFn: async () => { const data = new FormData(); data.append("hotelId", hotelId); data.append("file", contractFile!); return request("/api/courtyard/sales-intelligence/meeting-calendar/contracts/preview", { method: "POST", body: data }); },
    onSuccess: (result: any) => setContractPreview(result),
    onError: (error: Error) => toast({ title: "Could not read contract", description: error.message, variant: "destructive" }),
  });
  const importContract = useMutation<any, any, boolean>({
    mutationFn: async (mergeExisting) => { const data = new FormData(); data.append("hotelId", hotelId); data.append("file", contractFile!); data.append("draft", JSON.stringify(contractPreview.draft)); data.append("mergeExisting", String(mergeExisting)); return request("/api/courtyard/sales-intelligence/meeting-calendar/contracts/import", { method: "POST", body: data }); },
    onSuccess: (result: any) => { setContractOpen(false); setContractFile(null); setContractPreview(null); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: "Linked group booking imported", description: `Saved the room block and ${result.count} meeting-space dates.` }); },
    onError: (error: any) => { if (error.code === "MATCHING_GROUP_EXISTS") { if (window.confirm(`${error.message}\n\nMerge the uploaded contract into the existing group and meeting-space entries?`)) importContract.mutate(true); return; } toast({ title: "Could not import contract", description: error.message, variant: "destructive" }); },
  });
  const deleteGroupRoom = useMutation({
    mutationFn: (block: any) => request(`/api/courtyard/sales-intelligence/meeting-calendar/group-rooms/${block.id}`, { method: "DELETE" }),
    onSuccess: () => { setSelectedGroupRoom(null); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: "Group removed from the calendar" }); },
    onError: (error: Error) => toast({ title: "Could not delete group", description: error.message, variant: "destructive" }),
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
  const groupRoomBlocks = cal.data?.groupRoomBlocks || [];
  const openNewGroupRoom = (arrivalDate = "") => { setEditingGroupRoomId(null); setGroupRoomForm({ ...emptyGroupRoom, arrivalDate }); setGroupRoomOpen(true); };
  const openEditGroupRoom = (block: any) => { setSelectedGroupRoom(null); setEditingGroupRoomId(block.id); setGroupRoomForm({ ...emptyGroupRoom, ...block, peakRooms: block.peakRooms ?? "", totalRoomNights: block.totalRoomNights ?? "", groupRate: block.groupRate ?? "", depositAmount: block.depositAmount ?? "" }); setGroupRoomOpen(true); };
  const todayKey = key(new Date());
  const upcomingGroups = groupRoomBlocks.filter((block: any) => block.departureDate >= todayKey && !["completed", "cancelled"].includes(block.status)).sort((a: any, b: any) => a.arrivalDate.localeCompare(b.arrivalDate)).slice(0, 5);
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
    let seriesEvents = event.bookingSeriesId
      ? events.filter((candidate: any) => candidate.bookingSeriesId === event.bookingSeriesId)
      : events.filter((candidate: any) => candidate.spaceId === event.spaceId && candidate.groupName === event.groupName && candidate.eventName === event.eventName).sort((a: any, b: any) => a.eventDate.localeCompare(b.eventDate));
    if (!event.bookingSeriesId && seriesEvents.length > 1) {
      const selectedIndex = seriesEvents.findIndex((candidate: any) => candidate.id === event.id);
      let firstIndex = selectedIndex, lastIndex = selectedIndex;
      const dayGap = (left: string, right: string) => Math.round((new Date(`${right}T12:00:00Z`).getTime() - new Date(`${left}T12:00:00Z`).getTime()) / 86400000);
      while (firstIndex > 0 && dayGap(seriesEvents[firstIndex - 1].eventDate, seriesEvents[firstIndex].eventDate) <= 1) firstIndex -= 1;
      while (lastIndex < seriesEvents.length - 1 && dayGap(seriesEvents[lastIndex].eventDate, seriesEvents[lastIndex + 1].eventDate) <= 1) lastIndex += 1;
      seriesEvents = seriesEvents.slice(firstIndex, lastIndex + 1);
    }
    if (!seriesEvents.length) seriesEvents = [event];
    const seriesDates = seriesEvents.map((candidate: any) => candidate.eventDate).sort();
    setSelectedEvent(null);
    setEditingEventId(event.id);
    setForm({
      ...empty,
      ...event,
      eventDate: seriesDates[0] || event.eventDate,
      eventEndDate: seriesDates.length > 1 ? seriesDates[seriesDates.length - 1] : "",
      holdExpiresAt: event.holdExpiresAt ? new Date(event.holdExpiresAt).toISOString().slice(0, 16) : "",
      attendance: event.attendance ?? "",
      squareFeetRequired: event.squareFeetRequired ?? "",
      expectedRoomNights: event.expectedRoomNights ?? "",
      expectedRevenue: event.expectedRevenue ?? "",
      roomRentalRevenue: event.roomRentalRevenue ?? "",
      avRevenue: event.avRevenue ?? "",
      cateringRevenue: event.cateringRevenue ?? "",
      breakfastPerPerson: event.breakfastPerPerson ?? "",
      lunchDinnerPerPerson: event.lunchDinnerPerPerson ?? "",
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
            <Button className="bg-[#315f86] text-white hover:bg-[#244966]" onClick={() => openNewGroupRoom()}>
              <BedDouble className="mr-2 h-4 w-4" />Add group rooms
            </Button>
            <Button variant="outline" onClick={() => setContractOpen(true)}><Upload className="mr-2 h-4 w-4" />Import contract</Button>
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
            <Select value={calendarLayer} onValueChange={setCalendarLayer}>
              <SelectTrigger className="w-[175px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All calendar items</SelectItem><SelectItem value="meetings">Meeting space only</SelectItem><SelectItem value="groups">Group rooms only</SelectItem></SelectContent>
            </Select>
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
        <Card className="border-[#bfd0df] bg-white text-[#201814]">
          <CardHeader className="pb-2"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><BedDouble className="h-5 w-5 text-[#315f86]" />Upcoming Groups</CardTitle><CardDescription>Next five active room blocks for front desk and operations.</CardDescription></div><Button size="sm" variant="outline" onClick={() => openNewGroupRoom()}><Plus className="mr-1 h-4 w-4" />Add group</Button></div></CardHeader>
          <CardContent>
            {upcomingGroups.length ? <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">{upcomingGroups.map((block: any) => <button key={block.id} className="rounded-lg border border-[#bfd0df] bg-[#f4f8fb] p-3 text-left hover:border-[#315f86]" onClick={() => setSelectedGroupRoom(block)}><div className="truncate font-semibold">{block.groupName}</div><div className="text-xs text-[#4c6478]">{block.arrivalDate} – {block.departureDate}</div><div className="mt-1 text-sm">{block.peakRooms || 0} peak rooms · {block.totalRoomNights || 0} nights</div></button>)}</div> : <p className="text-sm text-[#5f5247]">No upcoming group room blocks in this calendar range.</p>}
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
                  rows = calendarLayer === "groups" ? [] : events.filter((x: any) => x.eventDate === date),
                  groupRows = calendarLayer === "meetings" ? [] : groupRoomBlocks.filter((x: any) => x.arrivalDate <= date && x.departureDate >= date && x.status !== "cancelled");
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
                    {groupRows.map((block: any) => {
                      const marker = date === block.arrivalDate ? "ARRIVAL" : date === block.departureDate ? "DEPARTURE" : "IN HOUSE";
                      return <div key={block.id} className={`mt-1 cursor-pointer rounded border border-blue-200 p-1 text-xs hover:ring-2 hover:ring-[#315f86] ${groupStatusColors[block.status] || groupStatusColors.prospect}`} onClick={(event) => { event.stopPropagation(); setSelectedGroupRoom(block); }}><b>{marker}</b> · {block.groupName}<div>{date === block.departureDate ? "Checks out" : `${block.peakRooms || 0} rooms`}</div></div>;
                    })}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4">
              {calendarLayer !== "groups" && events.map((x: any) => (
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
              {calendarLayer !== "meetings" && groupRoomBlocks.map((block: any) => <div key={block.id} role="button" tabIndex={0} className="flex cursor-pointer flex-wrap justify-between gap-2 rounded border border-blue-200 bg-[#f4f8fb] p-3 text-left hover:border-[#315f86]" onClick={() => setSelectedGroupRoom(block)}><div><b>{block.arrivalDate}–{block.departureDate} · {block.groupName}</b><div className="text-sm">{groupNights(block)} nights · {block.peakRooms || 0} peak rooms · {block.totalRoomNights || 0} total room nights</div></div><Badge className={groupStatusColors[block.status]}>{block.status.replaceAll("_", " ")}</Badge></div>)}
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
              <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Event revenue</h3><p className="text-xs text-[#5f5247]">Meeting-room and food-and-beverage charges are calculated separately.</p></div><div className="text-2xl font-bold text-[#2f5f46]">{money(eventRevenueTotal(form))}</div></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[["Room rental", "roomRentalRevenue"], ["AV add-ons", "avRevenue"], ["Drink, coffee & incidental add-ons", "otherRevenue"]].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type="number" min="0" step="0.01" value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></div>)}
                <div><Label>Breakfast per person</Label><Input type="number" min="0" step="0.01" value={form.breakfastPerPerson} onChange={(event) => setForm({ ...form, breakfastPerPerson: event.target.value })} /></div>
                <div><Label>Lunch / dinner per person</Label><Input type="number" min="0" step="0.01" value={form.lunchDinnerPerPerson} onChange={(event) => setForm({ ...form, lunchDinnerPerPerson: event.target.value })} /><p className="mt-1 text-xs text-[#5f5247]">Catering: {form.attendance || 0} attendees × {eventDayCount(form)} day{eventDayCount(form) === 1 ? "" : "s"} = {money(cateringValue(form))}</p></div>
                <div className="rounded-lg border border-[#deceba] bg-white p-3"><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Meeting room charges</div><div className="mt-1 text-sm">6% room tax: <strong>{money(roomTaxValue(form))}</strong></div><div className="text-sm">21% service fee: <strong>{money(roomServiceFeeValue(form))}</strong></div><p className="mt-1 text-xs text-[#5f5247]">Applied only to room rental.</p></div>
                <div className="rounded-lg border border-[#deceba] bg-white p-3"><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Food & beverage charges</div><div className="mt-1 text-sm">8.25% F&amp;B tax: <strong>{money(fbTaxValue(form))}</strong></div><div className="text-sm">18% gratuity: <strong>{money(fbGratuityValue(form))}</strong></div><p className="mt-1 text-xs text-[#5f5247]">Applied only to catering and drink/coffee incidentals.</p></div>
                <div className="sm:col-span-2 lg:col-span-3"><Label>Catering and incidental service details</Label><Textarea placeholder="Example: coffee service for 20, assorted sodas, bottled water, delivery timing, dietary notes…" value={form.cateringNotes} onChange={(event) => setForm({ ...form, cateringNotes: event.target.value })} /></div>
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
                  {[["Room rental", selectedEvent.roomRentalRevenue], ["Meeting room tax (6%)", roomTaxValue(selectedEvent)], ["Room service fee (21%)", roomServiceFeeValue(selectedEvent)], [`Breakfast (${money(selectedEvent.breakfastPerPerson)}/person)`, Number(selectedEvent.attendance || 0) * Number(selectedEvent.breakfastPerPerson || 0)], [`Lunch / dinner (${money(selectedEvent.lunchDinnerPerPerson)}/person)`, Number(selectedEvent.attendance || 0) * Number(selectedEvent.lunchDinnerPerPerson || 0)], ["Total in-house catering", selectedEvent.cateringRevenue], ["Drink, coffee & incidental add-ons", selectedEvent.otherRevenue], ["F&B tax (8.25%)", fbTaxValue(selectedEvent)], ["F&B gratuity (18%)", fbGratuityValue(selectedEvent)], ["AV add-ons", selectedEvent.avRevenue]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-lg border border-[#deceba] bg-[#fffaf2] p-3"><span className="text-sm text-[#5f5247]">{label}</span><strong>{money(value)}</strong></div>)}
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
              {selectedEvent.groupBookingId && groupRoomBlocks.some((block: any) => block.groupBookingId === selectedEvent.groupBookingId) && <section className="rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><div className="text-xs font-bold uppercase text-[#315f86]">Linked group rooms</div>{groupRoomBlocks.filter((block: any) => block.groupBookingId === selectedEvent.groupBookingId).map((block: any) => <button key={block.id} className="mt-2 w-full rounded-lg border bg-white p-3 text-left hover:border-[#315f86]" onClick={() => { setSelectedEvent(null); setSelectedGroupRoom(block); }}><b>{block.groupName}</b><div className="text-sm">{block.arrivalDate}–{block.departureDate} · {block.totalRoomNights || 0} room nights</div></button>)}</section>}

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
                <Button asChild variant="outline"><a href={apiUrl(`/api/courtyard/sales-intelligence/meeting-calendar/events/${selectedEvent.id}/beo.pdf`)} target="_blank" rel="noreferrer"><Printer className="mr-2 h-4 w-4" />Print BEO</a></Button>
                <Button className="bg-[#2f5f46] text-white hover:bg-[#244b37]" onClick={() => openEdit(selectedEvent)}>Edit event</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={groupRoomOpen} onOpenChange={(isOpen) => { setGroupRoomOpen(isOpen); if (!isOpen) setEditingGroupRoomId(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto border-[#cdbda8] bg-white text-[#201814] dark:border-[#cdbda8] dark:bg-white dark:text-[#201814] [&_input]:!border-[#cdbda8] [&_input]:!bg-white [&_input]:!text-[#201814] [&_textarea]:!border-[#cdbda8] [&_textarea]:!bg-white [&_textarea]:!text-[#201814]">
          <DialogHeader><DialogTitle>{editingGroupRoomId ? "Edit group room block" : "Add group room block"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Group/company *</Label><Input value={groupRoomForm.groupName} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, groupName: e.target.value })} /></div>
            <div><Label>Project / program name</Label><Input value={groupRoomForm.projectName} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, projectName: e.target.value })} /></div>
            <div><Label>Arrival date *</Label><Input type="date" value={groupRoomForm.arrivalDate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, arrivalDate: e.target.value })} /></div>
            <div><Label>Departure date *</Label><Input type="date" min={groupRoomForm.arrivalDate || undefined} value={groupRoomForm.departureDate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, departureDate: e.target.value })} /></div>
            <div><Label>Status</Label><Select value={groupRoomForm.status} onValueChange={(status) => setGroupRoomForm({ ...groupRoomForm, status })}><SelectTrigger className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectValue /></SelectTrigger><SelectContent className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]">{["prospect", "tentative", "definite", "in_house", "completed", "cancelled"].map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Booking method</Label><Select value={groupRoomForm.bookingMethod} onValueChange={(bookingMethod) => setGroupRoomForm({ ...groupRoomForm, bookingMethod })}><SelectTrigger className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectValue /></SelectTrigger><SelectContent className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectItem value="reservation_link">Reservation link</SelectItem><SelectItem value="rooming_list">Rooming list</SelectItem><SelectItem value="call_in">Call-in</SelectItem><SelectItem value="individual_pay">Individual pay</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div className="md:col-span-2 rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><h3 className="mb-3 font-semibold text-[#315f86]">Room block</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><Label>Peak rooms per night</Label><Input type="number" min="0" value={groupRoomForm.peakRooms} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, peakRooms: e.target.value })} /></div>
              <div><Label>Total room nights</Label><Input type="number" min="0" value={groupRoomForm.totalRoomNights} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, totalRoomNights: e.target.value })} /></div>
              <div><Label>Group rate</Label><Input type="number" min="0" step="0.01" value={groupRoomForm.groupRate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, groupRate: e.target.value })} /></div>
              <div><Label>Estimated room revenue</Label><div className="mt-2 text-xl font-bold text-[#315f86]">{money(Number(groupRoomForm.totalRoomNights || 0) * Number(groupRoomForm.groupRate || 0))}</div></div>
              <div className="sm:col-span-2"><Label>Room types and quantities</Label><Input placeholder="Example: 12 kings, 8 double queens" value={groupRoomForm.roomTypeMix} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, roomTypeMix: e.target.value })} /></div>
              <div><Label>Group code</Label><Input value={groupRoomForm.groupCode} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, groupCode: e.target.value })} /></div>
              <div><Label>Cutoff date</Label><Input type="date" value={groupRoomForm.cutoffDate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, cutoffDate: e.target.value })} /></div>
            </div></div>
            {[['Primary contact','primaryContactName'],['Contact email','primaryContactEmail'],['Contact phone','primaryContactPhone'],['Sales owner','salesOwner']].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type={field === 'primaryContactEmail' ? 'email' : 'text'} value={groupRoomForm[field]} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, [field]: e.target.value })} /></div>)}
            <div><Label>Deposit due date</Label><Input type="date" value={groupRoomForm.depositDueDate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, depositDueDate: e.target.value })} /></div>
            <div><Label>Deposit amount</Label><Input type="number" min="0" step="0.01" value={groupRoomForm.depositAmount} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, depositAmount: e.target.value })} /></div>
            <label className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" checked={groupRoomForm.taxExempt} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, taxExempt: e.target.checked })} />Tax-exempt group</label>
            <div className="md:col-span-2"><Label>Billing instructions</Label><Textarea value={groupRoomForm.billingInstructions} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, billingInstructions: e.target.value })} /></div>
            {[['Arrival and check-in notes','arrivalNotes'],['VIP / accommodations','vipNotes'],['Transportation','transportationNotes'],['Breakfast','breakfastNotes'],['Front desk instructions','frontDeskNotes'],['Housekeeping instructions','housekeepingNotes'],['Internal notes','internalNotes']].map(([label, field]) => <div className={field === 'internalNotes' ? 'md:col-span-2' : ''} key={field}><Label>{label}</Label><Textarea value={groupRoomForm[field]} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, [field]: e.target.value })} /></div>)}
            <Button className="bg-[#315f86] text-white md:col-span-2 hover:bg-[#244966]" disabled={saveGroupRoom.isPending} onClick={() => saveGroupRoom.mutate(groupRoomForm)}>{saveGroupRoom.isPending ? "Saving…" : editingGroupRoomId ? "Save group changes" : "Add group to calendar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedGroupRoom)} onOpenChange={(isOpen) => { if (!isOpen) setSelectedGroupRoom(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto bg-white text-[#201814]">
          {selectedGroupRoom && <><DialogHeader><div className="flex items-start justify-between gap-3 pr-7"><div><DialogTitle className="text-2xl">{selectedGroupRoom.groupName}</DialogTitle><p className="text-[#5f5247]">{selectedGroupRoom.projectName || "Group room block"}</p></div><Badge className={groupStatusColors[selectedGroupRoom.status]}>{selectedGroupRoom.status.replaceAll("_", " ")}</Badge></div></DialogHeader>
            <section className="rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><div className="grid gap-3 sm:grid-cols-4"><div><div className="text-xs font-bold uppercase text-[#315f86]">Arrival</div>{selectedGroupRoom.arrivalDate}</div><div><div className="text-xs font-bold uppercase text-[#315f86]">Departure</div>{selectedGroupRoom.departureDate}</div><div><div className="text-xs font-bold uppercase text-[#315f86]">Stay</div>{groupNights(selectedGroupRoom)} nights</div><div><div className="text-xs font-bold uppercase text-[#315f86]">Peak rooms</div>{selectedGroupRoom.peakRooms || 0}</div></div></section>
            <section><h3 className="mb-2 font-semibold">Room block and revenue</h3><div className="grid gap-2 sm:grid-cols-2">{[["Total room nights", selectedGroupRoom.totalRoomNights || 0],["Room types", selectedGroupRoom.roomTypeMix || "Not specified"],["Group rate", money(selectedGroupRoom.groupRate)],["Estimated room revenue", money(selectedGroupRoom.estimatedRoomRevenue)],["Group code", selectedGroupRoom.groupCode || "Not specified"],["Cutoff date", selectedGroupRoom.cutoffDate || "Not specified"],["Booking method", selectedGroupRoom.bookingMethod?.replaceAll("_", " ") || "Not specified"],["Tax status", selectedGroupRoom.taxExempt ? "Tax exempt" : "Standard tax"]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><div className="text-xs font-bold uppercase text-[#315f86]">{label}</div><div className="capitalize">{value}</div></div>)}</div></section>
            {(selectedGroupRoom.primaryContactName || selectedGroupRoom.salesOwner) && <section><h3 className="mb-2 font-semibold">Contacts</h3><div className="rounded-lg border p-4"><div><b>Primary contact:</b> {selectedGroupRoom.primaryContactName || "Not specified"}</div><div>{selectedGroupRoom.primaryContactEmail} {selectedGroupRoom.primaryContactPhone}</div><div><b>Sales owner:</b> {selectedGroupRoom.salesOwner || "Not specified"}</div></div></section>}
            {selectedGroupRoom.groupBookingId && events.some((event: any) => event.groupBookingId === selectedGroupRoom.groupBookingId) && <section className="rounded-xl border border-[#b9d0c2] bg-[#f3f8f4] p-4"><div className="text-xs font-bold uppercase text-[#2f5f46]">Linked meeting space</div>{Array.from(new Map(events.filter((event: any) => event.groupBookingId === selectedGroupRoom.groupBookingId).map((event: any) => [event.bookingSeriesId || event.id, event])).values()).map((event: any) => <button key={event.id} className="mt-2 w-full rounded-lg border bg-white p-3 text-left hover:border-[#2f5f46]" onClick={() => { setSelectedGroupRoom(null); setSelectedEvent(event); }}><b>{event.eventName}</b><div className="text-sm">Beginning {event.bookingStartDate || event.eventDate} · {event.meetingRoom?.replaceAll('_',' ')}</div></button>)}</section>}
            {selectedGroupRoom.groupBookingId && (cal.data?.groupBookingDocuments || []).some((document: any) => document.groupBookingId === selectedGroupRoom.groupBookingId) && <section><h3 className="mb-2 font-semibold">Original contract</h3>{(cal.data?.groupBookingDocuments || []).filter((document: any) => document.groupBookingId === selectedGroupRoom.groupBookingId).map((document: any) => <a key={document.id} className="block rounded-lg border p-3 text-blue-700 underline hover:bg-[#f4f8fb]" href={apiUrl(`/api/courtyard/sales-intelligence/meeting-calendar/group-bookings/${selectedGroupRoom.groupBookingId}/documents/${document.id}`)}>{document.filename}</a>)}</section>}
            <section><h3 className="mb-2 font-semibold">Operational preparation</h3><div className="space-y-2">{[["Arrival",selectedGroupRoom.arrivalNotes],["VIP / accommodations",selectedGroupRoom.vipNotes],["Transportation",selectedGroupRoom.transportationNotes],["Breakfast",selectedGroupRoom.breakfastNotes],["Front desk",selectedGroupRoom.frontDeskNotes],["Housekeeping",selectedGroupRoom.housekeepingNotes],["Billing",selectedGroupRoom.billingInstructions],["Internal",selectedGroupRoom.internalNotes]].filter(([,value]) => value).map(([label,value]) => <div key={String(label)} className="rounded-lg border bg-[#f4f8fb] p-3"><div className="text-xs font-bold uppercase text-[#315f86]">{label}</div><p className="whitespace-pre-wrap text-sm">{value}</p></div>)}</div></section>
            <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deleteGroupRoom.isPending} onClick={() => { const linked = Boolean(selectedGroupRoom.groupBookingId); const message = linked ? `Delete ${selectedGroupRoom.groupName}, its linked meeting-space dates, and its stored contract? This cannot be undone.` : `Delete ${selectedGroupRoom.groupName} and matching meeting-space dates during this stay? This cannot be undone.`; if (window.confirm(message)) deleteGroupRoom.mutate(selectedGroupRoom); }}><Trash2 className="mr-2 h-4 w-4" />{deleteGroupRoom.isPending ? "Deleting…" : "Delete group"}</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setSelectedGroupRoom(null)}>Close</Button><Button className="bg-[#315f86] text-white" onClick={() => openEditGroupRoom(selectedGroupRoom)}>Edit group</Button></div></div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={contractOpen} onOpenChange={(isOpen) => { setContractOpen(isOpen); if (!isOpen) { setContractFile(null); setContractPreview(null); } }}>
        <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto border-[#cdbda8] bg-white text-[#201814] dark:border-[#cdbda8] dark:bg-white dark:text-[#201814] [&_input]:!border-[#cdbda8] [&_input]:!bg-white [&_input]:!text-[#201814] [&_textarea]:!border-[#cdbda8] [&_textarea]:!bg-white [&_textarea]:!text-[#201814]">
          <DialogHeader><DialogTitle>Import group contract</DialogTitle></DialogHeader>
          {!contractPreview ? <div className="space-y-4"><div className="rounded-xl border-2 border-dashed border-[#bfd0df] bg-[#f4f8fb] p-8 text-center"><Upload className="mx-auto mb-3 h-9 w-9 text-[#315f86]" /><Label htmlFor="group-contract" className="text-base font-semibold">Choose a DOCX or PDF contract</Label><Input id="group-contract" className="mx-auto mt-3 max-w-lg bg-white" type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setContractFile(event.target.files?.[0] || null)} /><p className="mt-2 text-sm text-[#5f5247]">DOCX provides the most reliable table extraction. The original file will be stored with the linked group booking.</p></div><Button className="w-full bg-[#315f86] text-white" disabled={!contractFile || previewContract.isPending} onClick={() => previewContract.mutate()}>{previewContract.isPending ? "Reading contract…" : "Review extracted information"}</Button></div> : <div className="space-y-5">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-[#201814] dark:border-amber-300 dark:bg-amber-50 dark:text-[#201814]"><div className="font-semibold">Review required before import</div>{contractPreview.draft.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{contractPreview.draft.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-1 text-sm">No extraction warnings were found.</p>}</div>
            <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><BedDouble className="h-5 w-5 text-[#315f86]" />Group Rooms</h3><div className="grid gap-3 md:grid-cols-3">
              {[['Group/company','groupName','text'],['Project','projectName','text'],['Arrival','arrivalDate','date'],['Departure','departureDate','date'],['Peak rooms','peakRooms','number'],['Total room nights','totalRoomNights','number'],['Lodging rate','groupRate','number'],['Room type mix','roomTypeMix','text'],['Primary contact','primaryContactName','text'],['Email','primaryContactEmail','email'],['Phone','primaryContactPhone','text']].map(([label,field,type]) => <div key={field}><Label>{label}</Label><Input type={type} value={contractPreview.draft.groupRoom[field] ?? ''} onChange={(event) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, groupRoom: { ...contractPreview.draft.groupRoom, [field]: event.target.value } } })} /></div>)}
              <div className="rounded-lg border bg-[#f4f8fb] p-3"><div className="text-xs font-bold uppercase text-[#315f86]">Estimated lodging revenue</div><div className="text-xl font-bold">{money(Number(contractPreview.draft.groupRoom.totalRoomNights || 0) * Number(contractPreview.draft.groupRoom.groupRate || 0))}</div></div>
            </div></section>
            {contractPreview.draft.meeting && <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-[#2f5f46]" />Linked Meeting Space</h3><div className="grid gap-3 md:grid-cols-3">
              {[['Event name','eventName','text'],['Start date','eventDate','date'],['End date','eventEndDate','date'],['Attendance','attendance','number'],['Room rental total','roomRentalRevenue','number'],['Setup begins','setupStartTime','time'],['Guests begin','guestStartTime','time'],['Guests end','guestEndTime','time'],['Breakdown complete','breakdownEndTime','time']].map(([label,field,type]) => <div key={field}><Label>{label}</Label><Input type={type} value={contractPreview.draft.meeting[field] ?? ''} onChange={(event) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, meeting: { ...contractPreview.draft.meeting, [field]: event.target.value } } })} /></div>)}
              <div><Label>Meeting room</Label><Select value={contractPreview.draft.meeting.meetingRoom} onValueChange={(meetingRoom) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, meeting: { ...contractPreview.draft.meeting, meetingRoom } } })}><SelectTrigger className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectValue /></SelectTrigger><SelectContent className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectItem value="pecan">Pecan</SelectItem><SelectItem value="cedar">Cedar</SelectItem><SelectItem value="full_room">Full room · Cedar & Pecan</SelectItem></SelectContent></Select></div>
              <div><Label>Setup style</Label><Select value={contractPreview.draft.meeting.roomSetup} onValueChange={(roomSetup) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, meeting: { ...contractPreview.draft.meeting, roomSetup } } })}><SelectTrigger className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectValue /></SelectTrigger><SelectContent className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]">{['classroom','theater','u_shape','conference','banquet','reception','custom'].map((setup) => <SelectItem key={setup} value={setup}>{setup.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
            </div></section>}
            <div className="rounded-lg border bg-[#fffaf2] p-3 text-sm"><b>Revenue allocation:</b> The lodging rate is kept separate from breakfast and meeting-space revenue so a packaged rate is not counted twice.</div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContractPreview(null)}>Choose another file</Button><Button className="bg-[#315f86] text-white" disabled={importContract.isPending} onClick={() => importContract.mutate(false)}>{importContract.isPending ? "Creating linked booking…" : "Confirm and create linked booking"}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
