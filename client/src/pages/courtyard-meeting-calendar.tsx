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
  if (!value?.eventDate || !value?.eventEndDate) return Math.max(1, Number(value?.bookingSeriesDayCount || 1));
  const start = new Date(`${value.eventDate}T12:00:00Z`), end = new Date(`${value.eventEndDate}T12:00:00Z`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
};
const cateringValue = (value: any) => value?.eventEndDate !== undefined
  ? Number(value?.attendance || 0) * eventDayCount(value) * (Number(value?.breakfastPerPerson || 0) + Number(value?.lunchDinnerPerPerson || 0))
  : Number(value?.cateringRevenue || 0);
const roomTaxValue = (value: any) => Number(value?.roomRentalRevenue || 0) * Number(value?.roomTaxPercent ?? 6) / 100;
const roomServiceFeeValue = (value: any) => Number(value?.roomRentalRevenue || 0) * Number(value?.roomServiceFeePercent ?? 21) / 100;
const serviceItemAmount = (item: any, value: any) => item.chargeMethod === "complimentary" ? 0 : item.chargeMethod === "per_person" ? Number(value?.attendance || 0) * Number(item.unitPrice || 0) : item.chargeMethod === "per_person_per_day" ? Number(value?.attendance || 0) * eventDayCount(value) * Number(item.unitPrice || 0) : item.chargeMethod === "per_day" ? Number(item.quantity || 0) * eventDayCount(value) * Number(item.unitPrice || 0) : Number(item.quantity || 0) * Number(item.unitPrice || 0);
const serviceItemsValue = (value: any) => Array.isArray(value?.serviceItemsJson) && value.serviceItemsJson.length ? value.serviceItemsJson.reduce((sum: number, item: any) => sum + serviceItemAmount(item, value), 0) : Number(value?.otherRevenue || 0);
const fbSubtotal = (value: any) => cateringValue(value) + serviceItemsValue(value);
const fbTaxValue = (value: any) => fbSubtotal(value) * Number(value?.fbTaxPercent ?? 8.25) / 100;
const fbGratuityValue = (value: any) => fbSubtotal(value) * Number(value?.fbGratuityPercent ?? 18) / 100;
const eventRevenueTotal = (value: any) => Number(value?.roomRentalRevenue || 0) + roomTaxValue(value) + roomServiceFeeValue(value) + fbSubtotal(value) + fbTaxValue(value) + fbGratuityValue(value) + Number(value?.avRevenue || 0);
const colors: any = {
  inquiry: "bg-slate-100 text-slate-800",
  courtesy_hold: "bg-amber-100 text-amber-900",
  tentative: "bg-[#eadfce] text-[#4a3828]",
  contract_sent: "bg-blue-100 text-blue-900",
  definite: "bg-emerald-100 text-emerald-900",
  in_house: "bg-violet-100 text-violet-900",
  completed: "bg-slate-200 text-slate-800",
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
  roomTaxPercent: "6",
  roomServiceFeePercent: "21",
  fbTaxPercent: "8.25",
  fbGratuityPercent: "18",
  setupOrientation: "lengthwise",
  setupLayoutJson: [] as any[],
  serviceItemsJson: [] as any[],
  gratuityAllocationsJson: [] as any[],
  billingInstructions: "",
  setupNotes: "",
  decorNotes: "",
  damageNotes: "",
};
const emptyGroupRoom = {
  groupName: "", projectName: "", arrivalDate: "", departureDate: "", status: "prospect",
  peakRooms: "", totalRoomNights: "", roomTypeMix: "", groupRate: "", bookingMethod: "reservation_link",
  cutoffDate: "", groupCode: "", taxExempt: false, primaryContactName: "", primaryContactEmail: "", primaryContactPhone: "", salesOwner: "",
  billingInstructions: "", depositDueDate: "", depositAmount: "", arrivalNotes: "", vipNotes: "", transportationNotes: "", breakfastNotes: "",
  frontDeskNotes: "", housekeepingNotes: "", internalNotes: "", roomAllocations: [] as any[],
};
const groupStatusColors: any = { prospect: "bg-slate-100 text-slate-800", tentative: "bg-[#eadfce] text-[#4a3828]", definite: "bg-emerald-100 text-emerald-900", in_house: "bg-violet-100 text-violet-900", completed: "bg-slate-200 text-slate-800", cancelled: "bg-red-100 text-red-900" };
const statusLegend = [
  ["Inquiry / prospect", "bg-slate-100 border-slate-300"], ["Tentative", "bg-[#eadfce] border-[#cdbda8]"], ["Courtesy hold", "bg-amber-100 border-amber-300"],
  ["Contract sent", "bg-blue-100 border-blue-300"], ["Definite", "bg-emerald-100 border-emerald-300"], ["In house", "bg-violet-100 border-violet-300"],
  ["Completed", "bg-slate-200 border-slate-400"], ["Cancelled / expired", "bg-red-100 border-red-300"],
];
const groupNights = (block: any) => block?.arrivalDate && block?.departureDate ? Math.max(0, Math.round((new Date(`${block.departureDate}T12:00:00Z`).getTime() - new Date(`${block.arrivalDate}T12:00:00Z`).getTime()) / 86400000)) : 0;
const roomAllocationsFor = (value: any): any[] => { if (Array.isArray(value?.roomAllocations)) return value.roomAllocations; try { return value?.roomAllocationsJson ? JSON.parse(value.roomAllocationsJson) : []; } catch { return []; } };
const allocationRevenue = (value: any) => roomAllocationsFor(value).reduce((sum: number, item: any) => sum + Number(item.roomNights || 0) * Number(item.rate || 0), 0);
function BookingTypeBadge({ type }: { type: "rooms" | "event" | "both" }) {
  const styles = type === "both" ? "border-violet-300 bg-violet-100 text-violet-900" : type === "rooms" ? "border-blue-300 bg-blue-100 text-blue-900" : "border-[#343a40] bg-[#343a40] text-white";
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${styles}`}>{type}</span>;
}
function CalendarLegend() {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#4f443b]">{statusLegend.map(([label, swatch]) => <span key={label} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm border ${swatch}`} />{label}</span>)}<span className="mx-1 hidden h-4 border-l border-[#cdbda8] lg:block" /><BookingTypeBadge type="rooms" /><BookingTypeBadge type="event" /><BookingTypeBadge type="both" /></div>;
}

const ROOM_LAYOUTS: Record<string, { name: string; squareFeet: number; widthFeet: number; lengthFeet: number }> = {
  pecan: { name: "Pecan", squareFeet: 560, widthFeet: 14, lengthFeet: 40 },
  cedar: { name: "Cedar", squareFeet: 1575, widthFeet: 35, lengthFeet: 45 },
  full_room: { name: "Full Room", squareFeet: 2135, widthFeet: 49, lengthFeet: 43.6 },
};
function MeetingSetupDiagram({ meetingRoom, roomSetup, attendance, orientation = "lengthwise", layout = [], onLayoutChange }: { meetingRoom: string; roomSetup: string; attendance: number | string; orientation?: string; layout?: any[]; onLayoutChange?: (layout: any[]) => void }) {
  const room = ROOM_LAYOUTS[meetingRoom] || ROOM_LAYOUTS.full_room, guests = Math.max(1, Number(attendance || 1));
  const chairs = Math.min(guests, 120), elements: any[] = [];
  // The usable drawing area represents the physical room: length on the x-axis and width on the y-axis.
  const feetToCanvas = Math.min(490 / room.lengthFeet, 220 / room.widthFeet);
  const roundTableRadius = 2.5 * feetToCanvas; // 60-inch diameter
  const rectangleLong = 6 * feetToCanvas, rectangleShort = 2.5 * feetToCanvas; // 72 x 30 inches
  const position = (id: string, x: number, y: number) => { const saved = layout.find((item:any) => item.id === id); return saved ? { x: 55 + Number(saved.x) * 490, y: 72 + Number(saved.y) * 220 } : { x, y }; };
  const drag = (id: string) => onLayoutChange ? { style: { cursor: "grab" }, onPointerDown: (event:any) => event.currentTarget.setPointerCapture(event.pointerId), onPointerMove: (event:any) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const svg = event.currentTarget.ownerSVGElement, bounds = svg.getBoundingClientRect(); const x = Math.max(0, Math.min(1, ((event.clientX-bounds.left)/bounds.width*600-55)/490)), y = Math.max(0, Math.min(1, ((event.clientY-bounds.top)/bounds.height*350-72)/220)); const existing=layout.find((item:any)=>item.id===id)||{id}; onLayoutChange([...layout.filter((item:any)=>item.id!==id),{...existing,id,x,y}]); }, onPointerUp: (event:any) => event.currentTarget.releasePointerCapture(event.pointerId) } : {};
  if (roomSetup === "banquet") {
    const tables = Math.ceil(guests / 8), cols = Math.ceil(Math.sqrt(tables * 1.5));
    for (let i=0;i<tables;i++){const id=`table-${i}`,p=position(id,105+(i%cols)*(390/Math.max(1,cols-1)),85+Math.floor(i/cols)*70);elements.push(<g key={i} {...drag(id)}><circle cx={p.x} cy={p.y} r={roundTableRadius} fill="#eadfce" stroke="#7b684f" strokeWidth="2"/><text x={p.x} y={p.y+4} textAnchor="middle" fontSize="10" fill="#201814">60&quot; round</text></g>);}
  } else if (roomSetup === "classroom") {
    const tables=Math.ceil(guests/3),cols=orientation==="lengthwise"?Math.min(4,Math.max(1,Math.ceil(Math.sqrt(tables)))):Math.min(8,Math.max(1,Math.ceil(Math.sqrt(tables*1.7))));for(let i=0;i<tables;i++){const id=`table-${i}`,p=position(id,orientation==="lengthwise"?180+(i%cols)*85:85+(i%cols)*60,orientation==="lengthwise"?95+Math.floor(i/cols)*78:90+Math.floor(i/cols)*50),tw=orientation==="lengthwise"?rectangleShort:rectangleLong,th=orientation==="lengthwise"?rectangleLong:rectangleShort;elements.push(<g key={i} {...drag(id)}><rect x={p.x-tw/2} y={p.y-th/2} width={tw} height={th} rx="2" fill="#eadfce" stroke="#7b684f"/>{orientation==="lengthwise"?<><circle cx={p.x-tw/2-7} cy={p.y-th*.3} r="3.5" fill="#315f86"/><circle cx={p.x-tw/2-7} cy={p.y} r="3.5" fill="#315f86"/><circle cx={p.x-tw/2-7} cy={p.y+th*.3} r="3.5" fill="#315f86"/></>:<><circle cx={p.x-tw*.3} cy={p.y+th/2+7} r="3.5" fill="#315f86"/><circle cx={p.x} cy={p.y+th/2+7} r="3.5" fill="#315f86"/><circle cx={p.x+tw*.3} cy={p.y+th/2+7} r="3.5" fill="#315f86"/></>}</g>);}
  } else if (roomSetup === "theater") {
    const cols=Math.min(12,Math.ceil(Math.sqrt(chairs*1.8)));for(let i=0;i<chairs;i++){elements.push(<circle key={i} cx={90+(i%cols)*(410/Math.max(1,cols-1))} cy={80+Math.floor(i/cols)*24} r="5" fill="#315f86"/>);}
  } else if (roomSetup === "u_shape") {
    elements.push(<path key="u" d="M145 90 L145 260 L455 260 L455 90" fill="none" stroke="#7b684f" strokeWidth="24"/>);for(let i=0;i<Math.min(chairs,30);i++){const side=i%3,pos=Math.floor(i/3);elements.push(<circle key={i} cx={side===0?120:side===1?480:170+pos*28} cy={side===2?290:105+pos*20} r="5" fill="#315f86"/>);}
  } else if (roomSetup === "conference") {
    const p=position("table-0",300,190), count=Math.min(chairs,24), endSeats=count>=4?2:0, sideSeats=count-endSeats, firstSide=Math.ceil(sideSeats/2), secondSide=Math.floor(sideSeats/2), conferenceLength=Math.min(room.lengthFeet-4,Math.max(6,Math.ceil(Math.max(2,sideSeats)/4)*6))*feetToCanvas,conferenceWidth=5*feetToCanvas,tw=orientation==="lengthwise"?conferenceWidth:conferenceLength, th=orientation==="lengthwise"?conferenceLength:conferenceWidth;
    const distributedChairs=[] as any[];
    for(let i=0;i<firstSide;i++){const fraction=(i+1)/(firstSide+1);distributedChairs.push(orientation==="lengthwise"?<circle key={`a-${i}`} cx={p.x-tw/2-14} cy={p.y-th/2+fraction*th} r="5" fill="#315f86"/>:<circle key={`a-${i}`} cx={p.x-tw/2+fraction*tw} cy={p.y-th/2-14} r="5" fill="#315f86"/>);}
    for(let i=0;i<secondSide;i++){const fraction=(i+1)/(secondSide+1);distributedChairs.push(orientation==="lengthwise"?<circle key={`b-${i}`} cx={p.x+tw/2+14} cy={p.y-th/2+fraction*th} r="5" fill="#315f86"/>:<circle key={`b-${i}`} cx={p.x-tw/2+fraction*tw} cy={p.y+th/2+14} r="5" fill="#315f86"/>);}
    if(endSeats){distributedChairs.push(orientation==="lengthwise"?<circle key="head-a" cx={p.x} cy={p.y-th/2-14} r="5" fill="#315f86"/>:<circle key="head-a" cx={p.x-tw/2-14} cy={p.y} r="5" fill="#315f86"/>);distributedChairs.push(orientation==="lengthwise"?<circle key="head-b" cx={p.x} cy={p.y+th/2+14} r="5" fill="#315f86"/>:<circle key="head-b" cx={p.x+tw/2+14} cy={p.y} r="5" fill="#315f86"/>);}
    elements.push(<g key="conference" {...drag("table-0")}><rect x={p.x-tw/2} y={p.y-th/2} width={tw} height={th} rx="10" fill="#eadfce" stroke="#7b684f" strokeWidth="2"/>{distributedChairs}</g>);
  } else if (roomSetup === "reception") {
    const tables=Math.max(3,Math.ceil(guests/12));for(let i=0;i<tables;i++){const id=`table-${i}`,p=position(id,105+(i%5)*98,95+Math.floor(i/5)*82);elements.push(<circle key={i} {...drag(id)} cx={p.x} cy={p.y} r="15" fill="#eadfce" stroke="#7b684f"/>);}
  }
  const presentation=position("presentation",300,55),presentationItem=layout.find((item:any)=>item.id==="presentation"),presentationRotation=Number(presentationItem?.rotation||0);
  const entry=position("entry",62,290),entryItem=layout.find((item:any)=>item.id==="entry"),entryRotation=Number(entryItem?.rotation||0);
  const equipment=layout.filter((item:any)=>item.type&&!["presentation","entry"].includes(item.type));
  const setupLabel=String(roomSetup||"custom").replaceAll("_"," ");
  const equipmentSummary = roomSetup === "banquet" ? `${Math.ceil(guests/8)} rounds · up to 8 seats each` : roomSetup === "classroom" ? `${Math.ceil(guests/3)} classroom tables · up to 3 seats each` : roomSetup === "theater" ? `${guests} theater chairs` : roomSetup === "u_shape" ? `U-shape tables · ${guests} chairs` : roomSetup === "conference" ? `Conference table · ${guests} chairs` : roomSetup === "reception" ? `${Math.max(3,Math.ceil(guests/12))} cocktail tables` : "Equipment placement defined in setup notes";
  return <div className="rounded-xl border border-[#deceba] bg-[#fffaf2] p-4"><div className="mb-2 flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold capitalize">{setupLabel} setup plan</h3><p className="text-xs text-[#5f5247]">{room.name} · approximately {room.widthFeet}' × {room.lengthFeet}' · {room.squareFeet.toLocaleString()} sq. ft. · {orientation}</p><p className="text-xs font-semibold text-[#315f86]">{equipmentSummary}</p></div><Badge variant="outline">{guests} guests</Badge></div><svg viewBox="0 0 600 350" className="w-full touch-none select-none rounded-lg bg-white" role="img" aria-label={`${setupLabel} overhead room setup for ${guests} guests`}><rect x="35" y="35" width="530" height="280" rx="4" fill="#faf8f4" stroke="#243746" strokeWidth="4"/>{elements}<g {...drag("presentation")} transform={`rotate(${presentationRotation} ${presentation.x} ${presentation.y})`}><rect x={presentation.x-62} y={presentation.y-13} width="124" height="26" rx="3" fill="#243746"/><text x={presentation.x} y={presentation.y+4} textAnchor="middle" fontSize="10" fill="white">PRESENTATION / FRONT</text></g><g {...drag("entry")} transform={`rotate(${entryRotation} ${entry.x} ${entry.y})`}><path d={`M${entry.x-15} ${entry.y-22} h30 v44`} fill="none" stroke="#2f5f46" strokeWidth="5"/><text x={entry.x+22} y={entry.y+4} fontSize="9" fill="#2f5f46">ENTRY / EXIT</text></g>{equipment.map((item:any)=>{const p=position(item.id,300,175),rotation=Number(item.rotation||0);return <g key={item.id} {...drag(item.id)} transform={`rotate(${rotation} ${p.x} ${p.y})`}>{item.type==="podium"?<path d={`M${p.x-14} ${p.y+16} L${p.x-10} ${p.y-16} L${p.x+10} ${p.y-16} L${p.x+14} ${p.y+16} Z`} fill="#a98254" stroke="#5f4025"/>:item.type==="tv"?<><rect x={p.x-27} y={p.y-20} width="54" height="32" rx="2" fill="#243746"/><line x1={p.x} y1={p.y+12} x2={p.x} y2={p.y+27} stroke="#5f5247" strokeWidth="3"/><line x1={p.x-15} y1={p.y+27} x2={p.x+15} y2={p.y+27} stroke="#5f5247" strokeWidth="3"/></>:<rect x={p.x-rectangleLong/2} y={p.y-rectangleShort/2} width={rectangleLong} height={rectangleShort} rx="3" fill="#eadfce" stroke="#7b684f"/>}<text x={p.x} y={p.y+(item.type==="tv"?-5:4)} textAnchor="middle" fontSize="8" fill={item.type==="tv"?"white":"#201814"}>{item.label}</text></g>})}{roomSetup === "custom"&&<text x="300" y="175" textAnchor="middle" fontSize="18" fill="#5f5247">Custom setup — refer to setup notes</text>}</svg><p className="mt-2 text-xs text-[#5f5247]">{onLayoutChange ? "Drag tables, equipment, presentation marker, and entry/exit to place them manually. " : ""}Table sizes are drawn to room scale (60-inch rounds and 72 × 30-inch rectangles). Confirm measurements, accessibility, fire-code capacity, and unobstructed exits onsite before setup.</p></div>;
}

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
  const [contractMergeMessage, setContractMergeMessage] = useState("");
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
  const deleteMeetingEvent = useMutation({
    mutationFn: (event: any) => request(`/api/courtyard/sales-intelligence/meeting-calendar/events/${event.id}`, { method: "DELETE" }),
    onSuccess: () => { setSelectedEvent(null); setOpen(false); setEditingEventId(null); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: "Meeting-space event removed", description: "The associated Group Rooms booking was left unchanged." }); },
    onError: (error: Error) => toast({ title: "Could not delete meeting-space event", description: error.message, variant: "destructive" }),
  });
  const confirmDeleteMeetingEvent = (event: any) => {
    if (window.confirm(`Delete ${event.eventName || "this meeting-space event"} from every date in its series? Group Rooms and the stored contract will not be deleted.`)) deleteMeetingEvent.mutate(event);
  };
  const previewContract = useMutation({
    mutationFn: async () => { const data = new FormData(); data.append("hotelId", hotelId); data.append("file", contractFile!); return request("/api/courtyard/sales-intelligence/meeting-calendar/contracts/preview", { method: "POST", body: data }); },
    onSuccess: (result: any) => { setContractMergeMessage(""); setContractPreview(result); },
    onError: (error: Error) => toast({ title: "Could not read contract", description: error.message, variant: "destructive" }),
  });
  const importContract = useMutation<any, any, boolean>({
    mutationFn: async (mergeExisting) => { const data = new FormData(); data.append("hotelId", hotelId); data.append("file", contractFile!); data.append("draft", JSON.stringify(contractPreview.draft)); data.append("mergeExisting", String(mergeExisting)); return request("/api/courtyard/sales-intelligence/meeting-calendar/contracts/import", { method: "POST", body: data }); },
    onSuccess: (result: any) => { const importedArrival = contractPreview?.draft?.groupRoom?.arrivalDate; if (importedArrival) { const [year, monthNumber] = String(importedArrival).split("-").map(Number); if (year && monthNumber) setMonth(new Date(year, monthNumber - 1, 1)); } setCalendarLayer(result.count ? "all" : "groups"); setView("month"); setContractOpen(false); setContractFile(null); setContractPreview(null); setContractMergeMessage(""); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: result.count ? "Linked group booking imported" : "Group Rooms booking imported", description: result.count ? `Saved the room block and ${result.count} meeting-space date${result.count === 1 ? "" : "s"}. The calendar was moved to the imported dates.` : "Saved the rooms-only contract and moved the calendar to its arrival month." }); },
    onError: (error: any) => { if (error.code === "MATCHING_GROUP_EXISTS") { setContractMergeMessage(error.message); return; } toast({ title: "Could not import contract", description: error.message, variant: "destructive" }); },
  });
  const deleteGroupRoom = useMutation({
    mutationFn: (block: any) => request(`/api/courtyard/sales-intelligence/meeting-calendar/group-rooms/${block.id}`, { method: "DELETE" }),
    onSuccess: () => { setSelectedGroupRoom(null); setSelectedEvent(null); setGroupRoomOpen(false); setEditingGroupRoomId(null); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: "Group removed from the calendar" }); },
    onError: (error: Error) => toast({ title: "Could not delete group", description: error.message, variant: "destructive" }),
  });
  const linkMatchingGroup = useMutation({
    mutationFn: (block: any) => request(`/api/courtyard/sales-intelligence/meeting-calendar/group-rooms/${block.id}/link-matching`, { method: "POST" }),
    onSuccess: (result: any) => { setSelectedGroupRoom(null); qc.invalidateQueries({ queryKey: ["meeting-calendar"] }); toast({ title: "Group entries linked", description: `${result.count} meeting-space date${result.count === 1 ? "" : "s"} connected to the room block.` }); },
    onError: (error: Error) => toast({ title: "Could not link entries", description: error.message, variant: "destructive" }),
  });
  const confirmDeleteGroup = (block: any) => {
    const linked = Boolean(block.groupBookingId);
    const message = linked ? `Delete ${block.groupName}, its linked meeting-space dates, and its stored contract? This cannot be undone.` : `Delete ${block.groupName} and matching meeting-space dates during this stay? This cannot be undone.`;
    if (window.confirm(message)) deleteGroupRoom.mutate(block);
  };
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
  const groupBookingType = (block: any): "rooms" | "both" => block.groupBookingId && events.some((event: any) => event.groupBookingId === block.groupBookingId) ? "both" : "rooms";
  const meetingBookingType = (event: any): "event" | "both" => event.groupBookingId && groupRoomBlocks.some((block: any) => block.groupBookingId === event.groupBookingId) ? "both" : "event";
  const openNewGroupRoom = (arrivalDate = "") => { setEditingGroupRoomId(null); setGroupRoomForm({ ...emptyGroupRoom, arrivalDate }); setGroupRoomOpen(true); };
  const openEditGroupRoom = (block: any) => { setSelectedGroupRoom(null); setEditingGroupRoomId(block.id); setGroupRoomForm({ ...emptyGroupRoom, ...block, peakRooms: block.peakRooms ?? "", totalRoomNights: block.totalRoomNights ?? "", groupRate: block.groupRate ?? "", depositAmount: block.depositAmount ?? "", roomAllocations: roomAllocationsFor(block) }); setGroupRoomOpen(true); };
  const updateGroupRoomAllocations = (roomAllocations: any[]) => setGroupRoomForm((current: any) => ({ ...current, roomAllocations, roomTypeMix: roomAllocations.length ? roomAllocations.map((item) => `${item.roomsPerNight || 0} ${item.roomType || "room"} @ ${money(item.rate)}`).join("; ") : "", peakRooms: roomAllocations.length ? roomAllocations.reduce((sum, item) => sum + Number(item.roomsPerNight || 0), 0) : current.peakRooms, totalRoomNights: roomAllocations.length ? roomAllocations.reduce((sum, item) => sum + Number(item.roomNights || 0), 0) : current.totalRoomNights, groupRate: roomAllocations.length === 1 ? roomAllocations[0].rate : roomAllocations.length > 1 ? "" : current.groupRate }));
  const todayKey = key(new Date());
  const upcomingGroups = groupRoomBlocks.filter((block: any) => block.departureDate >= todayKey && !["completed", "cancelled"].includes(block.status)).sort((a: any, b: any) => a.arrivalDate.localeCompare(b.arrivalDate)).slice(0, 5);
  const displayedMonthStart = key(first), displayedMonthEnd = key(last);
  const dateInDisplayedMonth = (date: string) => date >= displayedMonthStart && date <= displayedMonthEnd;
  const monthlyRevenue = events.filter((event: any) => dateInDisplayedMonth(event.eventDate) && !["cancelled", "expired"].includes(event.status)).reduce((sum: number, event: any) => sum + Number(event.expectedRevenue || 0) / Math.max(1, Number(event.bookingSeriesDayCount || 1)), 0);
  const monthlyGroupRoomMetrics = groupRoomBlocks.filter((block: any) => block.status !== "cancelled").reduce((totals: { revenue: number; roomNights: number }, block: any) => {
    const stayNights = Math.max(1, groupNights(block));
    let monthNights = 0;
    const cursor = new Date(`${block.arrivalDate}T12:00:00Z`), departure = new Date(`${block.departureDate}T12:00:00Z`);
    while (cursor < departure) { if (dateInDisplayedMonth(cursor.toISOString().slice(0, 10))) monthNights += 1; cursor.setUTCDate(cursor.getUTCDate() + 1); }
    if (!monthNights) return totals;
    const share = monthNights / stayNights, totalRevenue = Number(block.estimatedRoomRevenue || 0) || allocationRevenue(block);
    totals.revenue += totalRevenue * share;
    totals.roomNights += Number(block.totalRoomNights || 0) * share;
    return totals;
  }, { revenue: 0, roomNights: 0 });
  const monthlyGroupRoomRevenue = monthlyGroupRoomMetrics.revenue;
  const combinedMonthlyRevenue = monthlyRevenue + monthlyGroupRoomRevenue;
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
      roomTaxPercent: event.roomTaxPercent ?? "6",
      roomServiceFeePercent: event.roomServiceFeePercent ?? "21",
      fbTaxPercent: event.fbTaxPercent ?? "8.25",
      fbGratuityPercent: event.fbGratuityPercent ?? "18",
      setupOrientation: event.setupOrientation || "lengthwise",
      setupLayoutJson: Array.isArray(event.setupLayoutJson) ? event.setupLayoutJson : [],
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
            <h1 className="text-2xl font-semibold sm:text-3xl">Meeting Space Calendar</h1>
            <p className="text-[#5f5247]">
              Operational availability for the hotel’s 2,000 sq. ft. meeting
              space.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
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
      <main className="mx-auto max-w-7xl space-y-3 p-2 sm:space-y-4 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              size="icon"
              variant="outline"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft />
            </Button>
            <h2 className="min-w-0 flex-1 text-center text-lg font-semibold sm:min-w-48 sm:flex-none sm:text-xl">
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
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Select value={calendarLayer} onValueChange={setCalendarLayer}>
              <SelectTrigger className="min-w-[165px] flex-1 bg-white sm:w-[175px] sm:flex-none"><SelectValue /></SelectTrigger>
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
        <div className="hidden rounded-lg border border-[#d8cbb9] bg-white px-3 py-2 text-[#201814] dark:border-[#d8cbb9] dark:bg-white dark:text-[#201814] md:block"><div className="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6b3f]">Calendar legend</div><CalendarLegend /></div>
        <details className="rounded-lg border border-[#d8cbb9] bg-white px-3 py-2 text-[#201814] dark:border-[#d8cbb9] dark:bg-white dark:text-[#201814] md:hidden"><summary className="cursor-pointer text-xs font-bold uppercase tracking-[.14em] text-[#8a6b3f]">Calendar legend</summary><div className="mt-3"><CalendarLegend /></div></details>
        <Card className="border-[#cdbda8] bg-[#fffaf2] text-[#201814] dark:border-[#cdbda8] dark:bg-[#fffaf2] dark:text-[#201814]">
          <CardContent className="bg-[#fffaf2] p-0 text-[#201814] dark:bg-[#fffaf2] dark:text-[#201814]">
            <div className="border-b border-[#deceba] px-4 py-3"><div className="text-xs font-bold uppercase tracking-[.16em] text-[#8a6b3f]">Monthly booking revenue</div><div className="text-sm text-[#5f5247]">Active bookings arriving or beginning in {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div></div>
            <div className="grid sm:grid-cols-3">
              <div className="border-b border-[#deceba] p-4 sm:border-b-0 sm:border-r"><div className="text-xs font-bold uppercase tracking-[.12em] text-[#8a6b3f]">Meeting / event revenue</div><div className="mt-1 text-2xl font-bold text-[#2f5f46]">{money(monthlyRevenue)}</div></div>
              <div className="border-b border-[#deceba] p-4 sm:border-b-0 sm:border-r"><div className="text-xs font-bold uppercase tracking-[.12em] text-[#315f86]">Group Room revenue</div><div className="mt-1 text-2xl font-bold text-[#315f86]">{money(monthlyGroupRoomRevenue)}</div><div className="mt-1 text-xs text-[#4c6478]">{Math.round(monthlyGroupRoomMetrics.roomNights).toLocaleString()} room nights in this month</div></div>
              <div className="bg-[#f1e6d4] p-4 dark:bg-[#f1e6d4]"><div className="text-xs font-bold uppercase tracking-[.12em] text-[#5d4529]">Combined monthly revenue</div><div className="mt-1 text-3xl font-bold text-[#201814]">{money(combinedMonthlyRevenue)}</div></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#bfd0df] bg-white text-[#201814]">
          <CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><BedDouble className="h-5 w-5 text-[#315f86]" />Upcoming Groups</CardTitle><CardDescription>Next five active room blocks for front desk and operations.</CardDescription></div><Button size="sm" variant="outline" onClick={() => openNewGroupRoom()}><Plus className="mr-1 h-4 w-4" />Add group</Button></div></CardHeader>
          <CardContent>
            {upcomingGroups.length ? <div className="flex snap-x gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-5">{upcomingGroups.map((block: any) => <button key={block.id} className="min-w-[235px] snap-start rounded-lg border border-[#bfd0df] bg-[#f4f8fb] p-3 text-left hover:border-[#315f86] md:min-w-0" onClick={() => setSelectedGroupRoom(block)}><div className="flex items-center gap-1.5"><div className="min-w-0 flex-1 truncate font-semibold">{block.groupName}</div><BookingTypeBadge type={groupBookingType(block)} /></div><div className="text-xs text-[#4c6478]">{block.arrivalDate} – {block.departureDate}</div><div className="mt-1 text-sm">{block.peakRooms || 0} peak rooms · {block.totalRoomNights || 0} nights</div></button>)}</div> : <p className="text-sm text-[#5f5247]">No upcoming group room blocks in this calendar range.</p>}
          </CardContent>
        </Card>
        {view === "month" ? (
          <><div className="hidden overflow-hidden rounded-xl border border-[#cdbda8] bg-white md:block">
            <div className="grid grid-cols-7 bg-[#eadfce] text-center text-sm font-semibold">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
                <div className="p-2" key={x}>
                  {x}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const date = key(d), inDisplayedMonth = dateInDisplayedMonth(date),
                  rows = !inDisplayedMonth || calendarLayer === "groups" ? [] : events.filter((x: any) => x.eventDate === date),
                  groupRows = !inDisplayedMonth || calendarLayer === "meetings" ? [] : groupRoomBlocks.filter((x: any) => x.arrivalDate <= date && x.departureDate >= date && x.status !== "cancelled");
                return (
                  <button
                    key={date}
                    className={`min-h-32 border-t border-r p-2 text-left align-top ${inDisplayedMonth ? "hover:bg-[#fffaf2]" : "cursor-default bg-slate-50 text-slate-400"}`}
                    onClick={() => { if (inDisplayedMonth) openNew(date); }}
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
                        <div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate"><b>{x.guestStartTime.slice(0, 5)}</b> {x.groupName}</span><BookingTypeBadge type={meetingBookingType(x)} /></div>
                        <div>{x.status.replaceAll("_", " ")}</div>
                      </div>
                    ))}
                    {groupRows.map((block: any) => {
                      const marker = date === block.arrivalDate ? "ARRIVAL" : date === block.departureDate ? "DEPARTURE" : "IN HOUSE";
                      return <div key={block.id} className={`mt-1 cursor-pointer rounded border border-blue-200 p-1 text-xs hover:ring-2 hover:ring-[#315f86] ${groupStatusColors[block.status] || groupStatusColors.prospect}`} onClick={(event) => { event.stopPropagation(); setSelectedGroupRoom(block); }}><div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate"><b>{marker}</b> · {block.groupName}</span><BookingTypeBadge type={groupBookingType(block)} /></div><div>{date === block.departureDate ? "Checks out" : `${block.peakRooms || 0} rooms`}</div></div>;
                    })}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2 md:hidden">
            {days.filter((day) => {
              if (!dateInDisplayedMonth(key(day))) return false;
              const date = key(day);
              const hasEvents = calendarLayer !== "groups" && events.some((event: any) => event.eventDate === date);
              const hasGroups = calendarLayer !== "meetings" && groupRoomBlocks.some((block: any) => block.arrivalDate <= date && block.departureDate >= date && block.status !== "cancelled");
              return hasEvents || hasGroups;
            }).map((day) => {
              const date = key(day), mobileEvents = calendarLayer === "groups" ? [] : events.filter((event: any) => event.eventDate === date), mobileGroups = calendarLayer === "meetings" ? [] : groupRoomBlocks.filter((block: any) => block.arrivalDate <= date && block.departureDate >= date && block.status !== "cancelled");
              return <section key={date} className="overflow-hidden rounded-xl border border-[#cdbda8] bg-white text-[#201814]"><button className="flex w-full items-center justify-between bg-[#eadfce] px-3 py-2 text-left" onClick={() => openNew(date)}><span className="font-semibold">{day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span><Plus className="h-4 w-4" /></button><div className="space-y-2 p-2">{mobileEvents.map((event: any) => <button key={event.id} className={`w-full rounded-lg p-3 text-left ${colors[event.status] || colors.inquiry}`} onClick={() => setSelectedEvent(event)}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{event.groupName} · {event.eventName}</div><div className="text-xs">{event.guestStartTime.slice(0, 5)}–{event.guestEndTime.slice(0, 5)} · {event.status.replaceAll("_", " ")}</div></div><BookingTypeBadge type={meetingBookingType(event)} /></div></button>)}{mobileGroups.map((block: any) => { const marker = date === block.arrivalDate ? "ARRIVAL" : date === block.departureDate ? "DEPARTURE" : "IN HOUSE"; return <button key={block.id} className={`w-full rounded-lg border border-blue-200 p-3 text-left ${groupStatusColors[block.status] || groupStatusColors.prospect}`} onClick={() => setSelectedGroupRoom(block)}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{marker} · {block.groupName}</div><div className="text-xs">{date === block.departureDate ? "Checks out" : `${block.peakRooms || 0} rooms`} · {block.status.replaceAll("_", " ")}</div></div><BookingTypeBadge type={groupBookingType(block)} /></div></button>; })}</div></section>;
            })}
            {!days.some((day) => { const date = key(day); return dateInDisplayedMonth(date) && ((calendarLayer !== "groups" && events.some((event: any) => event.eventDate === date)) || (calendarLayer !== "meetings" && groupRoomBlocks.some((block: any) => block.arrivalDate <= date && block.departureDate >= date && block.status !== "cancelled"))); }) && <div className="rounded-xl border border-dashed border-[#cdbda8] bg-white p-6 text-center text-sm text-[#5f5247]">No calendar entries this month.</div>}
          </div></>
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4">
              {calendarLayer !== "groups" && events.filter((event: any) => dateInDisplayedMonth(event.eventDate)).map((x: any) => (
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
                      {x.eventDate} · {x.groupName} — {x.eventName} <BookingTypeBadge type={meetingBookingType(x)} />
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
              {calendarLayer !== "meetings" && groupRoomBlocks.filter((block: any) => block.arrivalDate <= displayedMonthEnd && block.departureDate >= displayedMonthStart).map((block: any) => <div key={block.id} role="button" tabIndex={0} className="flex cursor-pointer flex-wrap justify-between gap-2 rounded border border-blue-200 bg-[#f4f8fb] p-3 text-left hover:border-[#315f86]" onClick={() => setSelectedGroupRoom(block)}><div><div className="flex items-center gap-2"><b>{block.arrivalDate}–{block.departureDate} · {block.groupName}</b><BookingTypeBadge type={groupBookingType(block)} /></div><div className="text-sm">{groupNights(block)} nights · {block.peakRooms || 0} peak rooms · {block.totalRoomNights || 0} total room nights</div></div><Badge className={groupStatusColors[block.status]}>{block.status.replaceAll("_", " ")}</Badge></div>)}
            </CardContent>
          </Card>
        )}
      </main>
      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setEditingEventId(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto bg-white text-[#201814]">
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
              <Select value={form.meetingRoom} onValueChange={(meetingRoom) => setForm({ ...form, meetingRoom, squareFeetRequired: meetingRoom === "pecan" ? "560" : meetingRoom === "cedar" ? "1575" : "2135", setupLayoutJson: (form.setupLayoutJson || []).filter((item:any)=>!String(item.id).startsWith("table-")) })}>
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
                onValueChange={(roomSetup) => setForm({ ...form, roomSetup, setupLayoutJson: (form.setupLayoutJson || []).filter((item:any)=>!String(item.id).startsWith("table-")) })}
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
            <div className="flex flex-wrap items-end gap-2 md:col-span-2"><div className="min-w-48"><Label>Table orientation</Label><Select value={form.setupOrientation} onValueChange={(setupOrientation)=>setForm({...form,setupOrientation,setupLayoutJson:(form.setupLayoutJson || []).filter((item:any)=>!String(item.id).startsWith("table-"))})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lengthwise">Lengthwise</SelectItem><SelectItem value="widthwise">Widthwise</SelectItem></SelectContent></Select></div><Button type="button" variant="outline" onClick={()=>setForm({...form,setupLayoutJson:(form.setupLayoutJson || []).filter((item:any)=>!String(item.id).startsWith("table-"))})}>Reset automatic layout</Button></div>
            <div className="md:col-span-2 rounded-lg border border-[#deceba] bg-[#fffaf2] p-3"><Label>Place equipment and room markers</Label><div className="mt-2 flex flex-wrap gap-2">{[["podium","Podium"],["tv","80-inch TV"],["small_table","Small table"],["buffet_table","Breakfast buffet"]].map(([type,label])=><Button key={type} type="button" size="sm" variant="outline" onClick={()=>setForm({...form,setupLayoutJson:[...(form.setupLayoutJson||[]),{id:`equipment-${Date.now()}-${type}`,type,label,x:.5,y:.5,rotation:0}]})}><Plus className="mr-1 h-3.5 w-3.5" />{label}</Button>)}<Button type="button" size="sm" variant="outline" onClick={()=>{const existing=(form.setupLayoutJson||[]).find((item:any)=>item.id==="presentation")||{id:"presentation",type:"presentation",x:.5,y:0,rotation:0};setForm({...form,setupLayoutJson:[...(form.setupLayoutJson||[]).filter((item:any)=>item.id!=="presentation"),{...existing,rotation:(Number(existing.rotation||0)+90)%360}]})}}>Rotate presentation</Button><Button type="button" size="sm" variant="outline" onClick={()=>{const existing=(form.setupLayoutJson||[]).find((item:any)=>item.id==="entry")||{id:"entry",type:"entry",x:0,y:1,rotation:0};setForm({...form,setupLayoutJson:[...(form.setupLayoutJson||[]).filter((item:any)=>item.id!=="entry"),{...existing,rotation:(Number(existing.rotation||0)+90)%360}]})}}>Rotate entry/exit</Button></div>{(form.setupLayoutJson||[]).filter((item:any)=>item.type&&!['presentation','entry'].includes(item.type)).map((item:any)=><div key={item.id} className="mt-2 flex items-center gap-2"><Input className="h-8 flex-1" value={item.label||""} onChange={(e)=>setForm({...form,setupLayoutJson:form.setupLayoutJson.map((candidate:any)=>candidate.id===item.id?{...candidate,label:e.target.value}:candidate)})}/><Button type="button" size="sm" variant="outline" onClick={()=>setForm({...form,setupLayoutJson:form.setupLayoutJson.map((candidate:any)=>candidate.id===item.id?{...candidate,rotation:(Number(candidate.rotation||0)+90)%360}:candidate)})}>Rotate</Button><Button type="button" size="icon" variant="outline" className="h-8 w-8 border-red-200 text-red-700" onClick={()=>setForm({...form,setupLayoutJson:form.setupLayoutJson.filter((candidate:any)=>candidate.id!==item.id)})}><Trash2 className="h-3.5 w-3.5"/></Button></div>)}</div>
            <div className="md:col-span-2"><MeetingSetupDiagram meetingRoom={form.meetingRoom} roomSetup={form.roomSetup} attendance={form.attendance} orientation={form.setupOrientation} layout={form.setupLayoutJson||[]} onLayoutChange={(setupLayoutJson)=>setForm((current:any)=>({...current,setupLayoutJson}))} /></div>
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
                {[["Room rental", "roomRentalRevenue"], ["AV add-ons", "avRevenue"]].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type="number" min="0" step="0.01" value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></div>)}
                <div><Label>Breakfast per person</Label><Input type="number" min="0" step="0.01" value={form.breakfastPerPerson} onChange={(event) => setForm({ ...form, breakfastPerPerson: event.target.value })} /></div>
                <div><Label>Lunch / dinner per person</Label><Input type="number" min="0" step="0.01" value={form.lunchDinnerPerPerson} onChange={(event) => setForm({ ...form, lunchDinnerPerPerson: event.target.value })} /><p className="mt-1 text-xs text-[#5f5247]">Catering: {form.attendance || 0} attendees × {eventDayCount(form)} day{eventDayCount(form) === 1 ? "" : "s"} = {money(cateringValue(form))}</p></div>
                <div className="rounded-lg border border-[#deceba] bg-white p-3"><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Meeting room charges</div><div className="mt-2 grid grid-cols-2 gap-2"><div><Label className="text-xs">Room tax %</Label><Input type="number" min="0" max="100" step="0.01" value={form.roomTaxPercent} onChange={(e)=>setForm({...form,roomTaxPercent:e.target.value})}/></div><div><Label className="text-xs">Service fee %</Label><Input type="number" min="0" max="100" step="0.01" value={form.roomServiceFeePercent} onChange={(e)=>setForm({...form,roomServiceFeePercent:e.target.value})}/></div></div><div className="mt-2 text-sm">Tax: <strong>{money(roomTaxValue(form))}</strong> · Service fee: <strong>{money(roomServiceFeeValue(form))}</strong></div><p className="mt-1 text-xs text-[#5f5247]">Applied only to room rental.</p></div>
                <div className="rounded-lg border border-[#deceba] bg-white p-3"><div className="text-xs font-semibold uppercase text-[#8a6b3f]">Food & beverage charges</div><div className="mt-2 grid grid-cols-2 gap-2"><div><Label className="text-xs">F&amp;B tax %</Label><Input type="number" min="0" max="100" step="0.01" value={form.fbTaxPercent} onChange={(e)=>setForm({...form,fbTaxPercent:e.target.value})}/></div><div><Label className="text-xs">Gratuity %</Label><Input type="number" min="0" max="100" step="0.01" value={form.fbGratuityPercent} onChange={(e)=>setForm({...form,fbGratuityPercent:e.target.value})}/></div></div><div className="mt-2 text-sm">Tax: <strong>{money(fbTaxValue(form))}</strong> · Gratuity: <strong>{money(fbGratuityValue(form))}</strong></div><p className="mt-1 text-xs text-[#5f5247]">Applied only to catering and itemized F&amp;B services.</p></div>
                <div className="sm:col-span-2 lg:col-span-3"><Label>Catering and incidental service details</Label><Textarea placeholder="Example: coffee service for 20, assorted sodas, bottled water, delivery timing, dietary notes…" value={form.cateringNotes} onChange={(event) => setForm({ ...form, cateringNotes: event.target.value })} /></div>
              </div>
            </div>
            <div className="md:col-span-2 rounded-xl border border-[#deceba] bg-[#fffaf2] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Itemized F&amp;B services</h3><p className="text-xs text-[#5f5247]">Coffee, drinks, snacks, refills, and consumption-based services print as separate BEO charges.</p></div><Button type="button" variant="outline" onClick={() => setForm({ ...form, serviceItemsJson: [...(form.serviceItemsJson || []), { name: "", serviceDates: "All event dates", chargeMethod: "per_event", quantity: 1, unitPrice: 0, includedQuantity: 0, refillPrice: 0, instructions: "" }] })}><Plus className="mr-2 h-4 w-4" />Add service</Button></div>
              <div className="space-y-3">{(form.serviceItemsJson || []).map((item: any, index: number) => <div key={index} className="rounded-lg border border-[#deceba] bg-white p-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"><div className="lg:col-span-2"><Label>Service</Label><Input placeholder="Fresh coffee service" value={item.name} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,name:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div><div><Label>Charge method</Label><Select value={item.chargeMethod} onValueChange={(chargeMethod) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,chargeMethod}; setForm({...form,serviceItemsJson:rows}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[["per_event","Per event"],["per_day","Per day"],["per_person","Per person"],["per_person_per_day","Per person/day"],["per_unit","Per unit"],["actual_consumption","Actual consumption"],["complimentary","Complimentary"]].map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>Quantity</Label><Input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,quantity:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div><div><Label>Unit price</Label><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,unitPrice:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div><div className="flex items-end justify-between gap-2"><strong className="pb-2">{money(serviceItemAmount(item, form))}</strong><Button type="button" size="icon" variant="outline" className="border-red-200 text-red-700" onClick={() => setForm({...form,serviceItemsJson:form.serviceItemsJson.filter((_:any,rowIndex:number)=>rowIndex!==index)})}><Trash2 className="h-4 w-4" /></Button></div><div className="sm:col-span-2"><Label>Service dates</Label><Input placeholder="All event dates or selected dates" value={item.serviceDates} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,serviceDates:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div><div><Label>Included qty</Label><Input type="number" min="0" value={item.includedQuantity || ""} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,includedQuantity:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div><div><Label>Refill/unit price</Label><Input type="number" min="0" step="0.01" value={item.refillPrice || ""} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,refillPrice:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div><div className="sm:col-span-2"><Label>Service instructions</Label><Input placeholder="One fresh pot; refill as requested" value={item.instructions} onChange={(e) => { const rows=[...form.serviceItemsJson]; rows[index]={...item,instructions:e.target.value}; setForm({...form,serviceItemsJson:rows}); }} /></div></div></div>)}</div>
              <div className="mt-3 text-right font-semibold">Itemized service total: {money(serviceItemsValue(form))}</div>
            </div>
            <div className="md:col-span-2 rounded-xl border border-[#deceba] bg-white p-4"><h3 className="font-semibold">BEO operational details</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label>Setup and breakdown instructions</Label><Textarea value={form.setupNotes} onChange={(e)=>setForm({...form,setupNotes:e.target.value})} /></div><div><Label>Billing instructions</Label><Textarea value={form.billingInstructions} onChange={(e)=>setForm({...form,billingInstructions:e.target.value})} /></div><div><Label>Event décor / restrictions</Label><Textarea value={form.decorNotes} onChange={(e)=>setForm({...form,decorNotes:e.target.value})} /></div><div><Label>Damage / condition notes</Label><Textarea value={form.damageNotes} onChange={(e)=>setForm({...form,damageNotes:e.target.value})} /></div></div></div>
            <div className="md:col-span-2 rounded-xl border border-[#deceba] bg-[#f4f8fb] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Internal gratuity closeout</h3><p className="text-xs text-[#5f5247]">Associate allocations print on the internal closeout page. Percentages should total 100%.</p></div><Button type="button" variant="outline" onClick={()=>setForm({...form,gratuityAllocationsJson:[...(form.gratuityAllocationsJson||[]),{associateName:"",workPerformed:"",percentage:0}]})}><Plus className="mr-2 h-4 w-4" />Add associate</Button></div>{(form.gratuityAllocationsJson||[]).map((item:any,index:number)=><div key={index} className="mb-2 grid gap-2 sm:grid-cols-12"><Input className="sm:col-span-3" placeholder="Associate" value={item.associateName} onChange={(e)=>{const rows=[...form.gratuityAllocationsJson];rows[index]={...item,associateName:e.target.value};setForm({...form,gratuityAllocationsJson:rows})}}/><Input className="sm:col-span-5" placeholder="Work performed" value={item.workPerformed} onChange={(e)=>{const rows=[...form.gratuityAllocationsJson];rows[index]={...item,workPerformed:e.target.value};setForm({...form,gratuityAllocationsJson:rows})}}/><Input className="sm:col-span-2" type="number" min="0" max="100" placeholder="%" value={item.percentage} onChange={(e)=>{const rows=[...form.gratuityAllocationsJson];rows[index]={...item,percentage:e.target.value};setForm({...form,gratuityAllocationsJson:rows})}}/><div className="flex items-center justify-between sm:col-span-2"><strong>{money(fbGratuityValue(form)*Number(item.percentage||0)/100)}</strong><Button type="button" size="icon" variant="outline" className="border-red-200 text-red-700" onClick={()=>setForm({...form,gratuityAllocationsJson:form.gratuityAllocationsJson.filter((_:any,rowIndex:number)=>rowIndex!==index)})}><Trash2 className="h-4 w-4" /></Button></div></div>)}<div className="mt-2 text-right text-sm font-semibold">Allocation total: {(form.gratuityAllocationsJson||[]).reduce((sum:number,item:any)=>sum+Number(item.percentage||0),0)}% · F&amp;B gratuity pool {money(fbGratuityValue(form))}</div></div>
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
            <div className="flex flex-wrap justify-between gap-2 md:col-span-2">{editingEventId ? <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deleteMeetingEvent.isPending} onClick={() => confirmDeleteMeetingEvent({ ...form, id: editingEventId })}><Trash2 className="mr-2 h-4 w-4" />{deleteMeetingEvent.isPending ? "Deleting…" : "Delete event"}</Button> : <span />}<Button className="min-w-48 bg-[#2f5f46] text-white" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : editingEventId ? "Save changes" : "Save event"}</Button></div>
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
                    <div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-2xl">{selectedEvent.eventName}</DialogTitle><BookingTypeBadge type={meetingBookingType(selectedEvent)} /></div>
                    <p className="mt-1 text-base text-[#5f5247]">{selectedEvent.groupName}</p>
                  </div>
                  <Badge className={colors[selectedEvent.status] || colors.inquiry}>
                    {selectedEvent.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="flex pt-2"><Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deleteMeetingEvent.isPending} onClick={() => confirmDeleteMeetingEvent(selectedEvent)}><Trash2 className="mr-2 h-4 w-4" />{deleteMeetingEvent.isPending ? "Deleting…" : "Delete event"}</Button></div>
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

              <MeetingSetupDiagram meetingRoom={selectedEvent.meetingRoom} roomSetup={selectedEvent.roomSetup} attendance={selectedEvent.attendance} orientation={selectedEvent.setupOrientation} layout={selectedEvent.setupLayoutJson||[]} />

              <section>
                <div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-semibold">Event revenue</h3><div className="text-2xl font-bold text-[#2f5f46]">{money(selectedEvent.expectedRevenue)}</div></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[["Room rental", selectedEvent.roomRentalRevenue], [`Meeting room tax (${Number(selectedEvent.roomTaxPercent ?? 6)}%)`, roomTaxValue(selectedEvent)], [`Room service fee (${Number(selectedEvent.roomServiceFeePercent ?? 21)}%)`, roomServiceFeeValue(selectedEvent)], [`Breakfast (${money(selectedEvent.breakfastPerPerson)}/person)`, Number(selectedEvent.attendance || 0) * Number(selectedEvent.breakfastPerPerson || 0)], [`Lunch / dinner (${money(selectedEvent.lunchDinnerPerPerson)}/person)`, Number(selectedEvent.attendance || 0) * Number(selectedEvent.lunchDinnerPerPerson || 0)], ["Total in-house catering", selectedEvent.cateringRevenue], ["Drink, coffee & incidental add-ons", selectedEvent.otherRevenue], [`F&B tax (${Number(selectedEvent.fbTaxPercent ?? 8.25)}%)`, fbTaxValue(selectedEvent)], [`F&B gratuity (${Number(selectedEvent.fbGratuityPercent ?? 18)}%)`, fbGratuityValue(selectedEvent)], ["AV add-ons", selectedEvent.avRevenue]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-lg border border-[#deceba] bg-[#fffaf2] p-3"><span className="text-sm text-[#5f5247]">{label}</span><strong>{money(value)}</strong></div>)}
                </div>
              </section>

              {Array.isArray(selectedEvent.serviceItemsJson) && selectedEvent.serviceItemsJson.length > 0 && <section><h3 className="mb-2 font-semibold">Itemized F&amp;B services</h3><div className="space-y-2">{selectedEvent.serviceItemsJson.map((item:any,index:number)=><div key={`${item.name}-${index}`} className="rounded-lg border border-[#deceba] bg-[#fffaf2] p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{item.name}</strong><strong>{money(serviceItemAmount(item, selectedEvent))}</strong></div><div className="mt-1 text-sm text-[#5f5247]">{item.serviceDates} · {String(item.chargeMethod).replaceAll("_"," ")} · Qty {item.quantity} @ {money(item.unitPrice)}</div>{(item.instructions||item.refillPrice)&&<div className="mt-1 text-sm">{item.instructions}{item.refillPrice ? ` Additional refill/unit: ${money(item.refillPrice)}` : ""}</div>}</div>)}</div></section>}

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
              {selectedEvent.groupBookingId && groupRoomBlocks.some((block: any) => block.groupBookingId === selectedEvent.groupBookingId) && <section className="rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><div className="text-xs font-bold uppercase text-[#315f86]">Linked group rooms</div>{groupRoomBlocks.filter((block: any) => block.groupBookingId === selectedEvent.groupBookingId).map((block: any) => <div key={block.id} className="mt-2 flex flex-wrap gap-2"><button className="min-w-56 flex-1 rounded-lg border bg-white p-3 text-left hover:border-[#315f86]" onClick={() => { setSelectedEvent(null); setSelectedGroupRoom(block); }}><b>{block.groupName}</b><div className="text-sm">{block.arrivalDate}–{block.departureDate} · {block.totalRoomNights || 0} room nights</div></button><Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => confirmDeleteGroup(block)}><Trash2 className="mr-2 h-4 w-4" />Delete group</Button></div>)}</section>}

              {(selectedEvent.setupNotes || selectedEvent.cateringNotes || selectedEvent.avNotes || selectedEvent.decorNotes || selectedEvent.damageNotes || selectedEvent.billingInstructions || selectedEvent.accessibilityNotes || selectedEvent.internalNotes) && (
                <section>
                  <h3 className="mb-2 font-semibold">Operational notes</h3>
                  <div className="space-y-2">
                    {[["Setup / breakdown", selectedEvent.setupNotes], ["Catering", selectedEvent.cateringNotes], ["Audio / visual", selectedEvent.avNotes], ["Event décor", selectedEvent.decorNotes], ["Damage / condition", selectedEvent.damageNotes], ["Billing", selectedEvent.billingInstructions], ["Accessibility", selectedEvent.accessibilityNotes], ["Internal notes", selectedEvent.internalNotes]].filter(([, value]) => value).map(([label, value]) => (
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
              <div><Label>{roomAllocationsFor(groupRoomForm).length ? "Single/default rate" : "Group rate"}</Label><Input type="number" min="0" step="0.01" disabled={roomAllocationsFor(groupRoomForm).length > 1} value={groupRoomForm.groupRate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, groupRate: e.target.value })} /></div>
              <div><Label>Estimated room revenue</Label><div className="mt-2 text-xl font-bold text-[#315f86]">{money(roomAllocationsFor(groupRoomForm).length ? allocationRevenue(groupRoomForm) : Number(groupRoomForm.totalRoomNights || 0) * Number(groupRoomForm.groupRate || 0))}</div></div>
              <div className="sm:col-span-2"><Label>Room types and quantities</Label><Input placeholder="Example: 12 kings, 8 double queens" value={groupRoomForm.roomTypeMix} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, roomTypeMix: e.target.value })} /></div>
              <div><Label>Group code</Label><Input value={groupRoomForm.groupCode} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, groupCode: e.target.value })} /></div>
              <div><Label>Cutoff date</Label><Input type="date" value={groupRoomForm.cutoffDate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, cutoffDate: e.target.value })} /></div>
            </div></div>
            <div className="md:col-span-2 rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#315f86]">Room types and rates</h3><p className="text-xs text-[#4c6478]">Edit each room type separately. Peak rooms, total room nights, and revenue recalculate automatically.</p></div><Button size="sm" variant="outline" onClick={() => updateGroupRoomAllocations([...roomAllocationsFor(groupRoomForm), { roomType: "", roomsPerNight: 0, roomNights: 0, rate: 0 }])}><Plus className="mr-1 h-4 w-4" />Add room type</Button></div>{roomAllocationsFor(groupRoomForm).length ? <div className="space-y-2">{roomAllocationsFor(groupRoomForm).map((item: any, index: number) => <div key={index} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto]"><div><Label>Room type</Label><Input value={item.roomType} onChange={(event) => { const next = [...roomAllocationsFor(groupRoomForm)]; next[index] = { ...item, roomType: event.target.value }; updateGroupRoomAllocations(next); }} /></div>{[["Peak/night","roomsPerNight"],["Room nights","roomNights"],["Rate","rate"]].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type="number" min="0" step={field === "rate" ? "0.01" : "1"} value={item[field]} onChange={(event) => { const next = [...roomAllocationsFor(groupRoomForm)]; next[index] = { ...item, [field]: Number(event.target.value) }; updateGroupRoomAllocations(next); }} /></div>)}<div className="flex items-end"><Button size="icon" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" aria-label={`Remove ${item.roomType || "room type"}`} onClick={() => updateGroupRoomAllocations(roomAllocationsFor(groupRoomForm).filter((_: any, itemIndex: number) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div><div className="text-sm font-semibold text-[#315f86] sm:col-span-5">Revenue: {money(Number(item.roomNights || 0) * Number(item.rate || 0))}</div></div>)}</div> : <p className="rounded-lg border border-dashed border-[#bfd0df] bg-white p-4 text-sm text-[#5f5247]">No detailed room types yet. Add one to track different inventory and rates.</p>}</div>
            {[['Primary contact','primaryContactName'],['Contact email','primaryContactEmail'],['Contact phone','primaryContactPhone'],['Sales owner','salesOwner']].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type={field === 'primaryContactEmail' ? 'email' : 'text'} value={groupRoomForm[field]} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, [field]: e.target.value })} /></div>)}
            <div><Label>Deposit due date</Label><Input type="date" value={groupRoomForm.depositDueDate} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, depositDueDate: e.target.value })} /></div>
            <div><Label>Deposit amount</Label><Input type="number" min="0" step="0.01" value={groupRoomForm.depositAmount} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, depositAmount: e.target.value })} /></div>
            <label className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" checked={groupRoomForm.taxExempt} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, taxExempt: e.target.checked })} />Tax-exempt group</label>
            <div className="md:col-span-2"><Label>Billing instructions</Label><Textarea value={groupRoomForm.billingInstructions} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, billingInstructions: e.target.value })} /></div>
            {[['Arrival and check-in notes','arrivalNotes'],['VIP / accommodations','vipNotes'],['Transportation','transportationNotes'],['Breakfast','breakfastNotes'],['Front desk instructions','frontDeskNotes'],['Housekeeping instructions','housekeepingNotes'],['Internal notes','internalNotes']].map(([label, field]) => <div className={field === 'internalNotes' ? 'md:col-span-2' : ''} key={field}><Label>{label}</Label><Textarea value={groupRoomForm[field]} onChange={(e) => setGroupRoomForm({ ...groupRoomForm, [field]: e.target.value })} /></div>)}
            <div className="flex flex-wrap justify-between gap-2 md:col-span-2">{editingGroupRoomId ? <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deleteGroupRoom.isPending} onClick={() => confirmDeleteGroup({ ...groupRoomForm, id: editingGroupRoomId })}><Trash2 className="mr-2 h-4 w-4" />Delete group</Button> : <span />}<Button className="min-w-48 bg-[#315f86] text-white hover:bg-[#244966]" disabled={saveGroupRoom.isPending} onClick={() => saveGroupRoom.mutate(groupRoomForm)}>{saveGroupRoom.isPending ? "Saving…" : editingGroupRoomId ? "Save group changes" : "Add group to calendar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedGroupRoom)} onOpenChange={(isOpen) => { if (!isOpen) setSelectedGroupRoom(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto bg-white text-[#201814]">
          {selectedGroupRoom && <><DialogHeader><div className="flex items-start justify-between gap-3 pr-7"><div><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-2xl">{selectedGroupRoom.groupName}</DialogTitle><BookingTypeBadge type={groupBookingType(selectedGroupRoom)} /></div><p className="text-[#5f5247]">{selectedGroupRoom.projectName || "Group room block"}</p></div><Badge className={groupStatusColors[selectedGroupRoom.status]}>{selectedGroupRoom.status.replaceAll("_", " ")}</Badge></div><div className="flex flex-wrap gap-2 pt-2"><Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={deleteGroupRoom.isPending} onClick={() => confirmDeleteGroup(selectedGroupRoom)}><Trash2 className="mr-2 h-4 w-4" />Delete group</Button><Button size="sm" variant="outline" className="border-[#bfd0df] text-[#315f86] hover:bg-[#f4f8fb]" disabled={linkMatchingGroup.isPending} onClick={() => linkMatchingGroup.mutate(selectedGroupRoom)}>{linkMatchingGroup.isPending ? "Linking…" : "Link matching entries"}</Button></div></DialogHeader>
            <section className="rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><div className="grid gap-3 sm:grid-cols-4"><div><div className="text-xs font-bold uppercase text-[#315f86]">Arrival</div>{selectedGroupRoom.arrivalDate}</div><div><div className="text-xs font-bold uppercase text-[#315f86]">Departure</div>{selectedGroupRoom.departureDate}</div><div><div className="text-xs font-bold uppercase text-[#315f86]">Stay</div>{groupNights(selectedGroupRoom)} nights</div><div><div className="text-xs font-bold uppercase text-[#315f86]">Peak rooms</div>{selectedGroupRoom.peakRooms || 0}</div></div></section>
            <section><h3 className="mb-2 font-semibold">Room block and revenue</h3><div className="grid gap-2 sm:grid-cols-2">{[["Total room nights", selectedGroupRoom.totalRoomNights || 0],["Room types", selectedGroupRoom.roomTypeMix || "Not specified"],["Group rate", roomAllocationsFor(selectedGroupRoom).length > 1 ? "Mixed rates — see below" : money(selectedGroupRoom.groupRate)],["Estimated room revenue", money(selectedGroupRoom.estimatedRoomRevenue)],["Group code", selectedGroupRoom.groupCode || "Not specified"],["Cutoff date", selectedGroupRoom.cutoffDate || "Not specified"],["Booking method", selectedGroupRoom.bookingMethod?.replaceAll("_", " ") || "Not specified"],["Tax status", selectedGroupRoom.taxExempt ? "Tax exempt" : "Standard tax"]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><div className="text-xs font-bold uppercase text-[#315f86]">{label}</div><div className="capitalize">{value}</div></div>)}</div></section>
            {roomAllocationsFor(selectedGroupRoom).length > 0 && <section><h3 className="mb-2 font-semibold">Room types and rates</h3><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-sm"><thead className="bg-[#e8f0f6] text-left text-[#315f86]"><tr><th className="p-2">Room type</th><th className="p-2 text-right">Peak/night</th><th className="p-2 text-right">Room nights</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Revenue</th></tr></thead><tbody>{roomAllocationsFor(selectedGroupRoom).map((item: any, index: number) => <tr key={`${item.roomType}-${index}`} className="border-t"><td className="p-2 font-medium">{item.roomType}</td><td className="p-2 text-right">{item.roomsPerNight}</td><td className="p-2 text-right">{item.roomNights}</td><td className="p-2 text-right">{money(item.rate)}</td><td className="p-2 text-right font-semibold">{money(Number(item.roomNights || 0) * Number(item.rate || 0))}</td></tr>)}</tbody><tfoot className="border-t bg-[#f4f8fb] font-bold"><tr><td className="p-2" colSpan={4}>Total room revenue</td><td className="p-2 text-right">{money(allocationRevenue(selectedGroupRoom))}</td></tr></tfoot></table></div></section>}
            {(selectedGroupRoom.primaryContactName || selectedGroupRoom.salesOwner) && <section><h3 className="mb-2 font-semibold">Contacts</h3><div className="rounded-lg border p-4"><div><b>Primary contact:</b> {selectedGroupRoom.primaryContactName || "Not specified"}</div><div>{selectedGroupRoom.primaryContactEmail} {selectedGroupRoom.primaryContactPhone}</div><div><b>Sales owner:</b> {selectedGroupRoom.salesOwner || "Not specified"}</div></div></section>}
            {selectedGroupRoom.groupBookingId && events.some((event: any) => event.groupBookingId === selectedGroupRoom.groupBookingId) && <section className="rounded-xl border border-[#b9d0c2] bg-[#f3f8f4] p-4"><div className="text-xs font-bold uppercase text-[#2f5f46]">Linked meeting space</div>{Array.from(new Map(events.filter((event: any) => event.groupBookingId === selectedGroupRoom.groupBookingId).map((event: any) => [event.bookingSeriesId || event.id, event])).values()).map((event: any) => <button key={event.id} className="mt-2 w-full rounded-lg border bg-white p-3 text-left hover:border-[#2f5f46]" onClick={() => { setSelectedGroupRoom(null); setSelectedEvent(event); }}><b>{event.eventName}</b><div className="text-sm">Beginning {event.bookingStartDate || event.eventDate} · {event.meetingRoom?.replaceAll('_',' ')}</div></button>)}</section>}
            {selectedGroupRoom.groupBookingId && (cal.data?.groupBookingDocuments || []).some((document: any) => document.groupBookingId === selectedGroupRoom.groupBookingId) && <section><h3 className="mb-2 font-semibold">Original contract</h3>{(cal.data?.groupBookingDocuments || []).filter((document: any) => document.groupBookingId === selectedGroupRoom.groupBookingId).map((document: any) => <a key={document.id} className="block rounded-lg border p-3 text-blue-700 underline hover:bg-[#f4f8fb]" href={apiUrl(`/api/courtyard/sales-intelligence/meeting-calendar/group-bookings/${selectedGroupRoom.groupBookingId}/documents/${document.id}`)}>{document.filename}</a>)}</section>}
            <section><h3 className="mb-2 font-semibold">Operational preparation</h3><div className="space-y-2">{[["Arrival",selectedGroupRoom.arrivalNotes],["VIP / accommodations",selectedGroupRoom.vipNotes],["Transportation",selectedGroupRoom.transportationNotes],["Breakfast",selectedGroupRoom.breakfastNotes],["Front desk",selectedGroupRoom.frontDeskNotes],["Housekeeping",selectedGroupRoom.housekeepingNotes],["Billing",selectedGroupRoom.billingInstructions],["Internal",selectedGroupRoom.internalNotes]].filter(([,value]) => value).map(([label,value]) => <div key={String(label)} className="rounded-lg border bg-[#f4f8fb] p-3"><div className="text-xs font-bold uppercase text-[#315f86]">{label}</div><p className="whitespace-pre-wrap text-sm">{value}</p></div>)}</div></section>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedGroupRoom(null)}>Close</Button><Button className="bg-[#315f86] text-white" onClick={() => openEditGroupRoom(selectedGroupRoom)}>Edit group</Button></div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={contractOpen} onOpenChange={(isOpen) => { setContractOpen(isOpen); if (!isOpen) { setContractFile(null); setContractPreview(null); setContractMergeMessage(""); } }}>
        <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto border-[#cdbda8] bg-white text-[#201814] dark:border-[#cdbda8] dark:bg-white dark:text-[#201814] [&_input]:!border-[#cdbda8] [&_input]:!bg-white [&_input]:!text-[#201814] [&_textarea]:!border-[#cdbda8] [&_textarea]:!bg-white [&_textarea]:!text-[#201814]">
          <DialogHeader><DialogTitle>Import group contract</DialogTitle></DialogHeader>
          {!contractPreview ? <div className="space-y-4"><div className="rounded-xl border-2 border-dashed border-[#bfd0df] bg-[#f4f8fb] p-8 text-center"><Upload className="mx-auto mb-3 h-9 w-9 text-[#315f86]" /><Label htmlFor="group-contract" className="text-base font-semibold">Choose a DOCX or PDF contract</Label><Input id="group-contract" className="mx-auto mt-3 max-w-lg bg-white" type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setContractFile(event.target.files?.[0] || null)} /><p className="mt-2 text-sm text-[#5f5247]">DOCX provides the most reliable table extraction. The original file will be stored with the linked group booking.</p></div><Button className="w-full bg-[#315f86] text-white" disabled={!contractFile || previewContract.isPending} onClick={() => previewContract.mutate()}>{previewContract.isPending ? "Reading contract…" : "Review extracted information"}</Button></div> : <div className="space-y-5">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-[#201814] dark:border-amber-300 dark:bg-amber-50 dark:text-[#201814]"><div className="font-semibold">Review required before import</div>{contractPreview.draft.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{contractPreview.draft.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-1 text-sm">No extraction warnings were found.</p>}</div>
            <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><BedDouble className="h-5 w-5 text-[#315f86]" />Group Rooms</h3><div className="grid gap-3 md:grid-cols-3">
              {[['Group/company','groupName','text'],['Project','projectName','text'],['Arrival','arrivalDate','date'],['Departure','departureDate','date'],['Peak rooms','peakRooms','number'],['Total room nights','totalRoomNights','number'],['Lodging rate','groupRate','number'],['Room type mix','roomTypeMix','text'],['Reservation method','bookingMethod','text'],['Cutoff date','cutoffDate','date'],['Primary contact','primaryContactName','text'],['Email','primaryContactEmail','email'],['Phone','primaryContactPhone','text'],['Sales owner','salesOwner','text'],['Billing instructions','billingInstructions','text']].map(([label,field,type]) => <div key={field}><Label>{label}</Label><Input type={type} value={contractPreview.draft.groupRoom[field] ?? ''} onChange={(event) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, groupRoom: { ...contractPreview.draft.groupRoom, [field]: event.target.value } } })} /></div>)}
              <div className="rounded-lg border bg-[#f4f8fb] p-3"><div className="text-xs font-bold uppercase text-[#315f86]">Estimated lodging revenue</div><div className="text-xl font-bold">{money(roomAllocationsFor(contractPreview.draft.groupRoom).length ? allocationRevenue(contractPreview.draft.groupRoom) : Number(contractPreview.draft.groupRoom.totalRoomNights || 0) * Number(contractPreview.draft.groupRoom.groupRate || 0))}</div></div>
            </div></section>
            {roomAllocationsFor(contractPreview.draft.groupRoom).length > 0 && <section className="rounded-xl border border-[#bfd0df] bg-[#f4f8fb] p-4"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-semibold text-[#315f86]">Room types and rates</h3><p className="text-xs text-[#4c6478]">Each rate is calculated against only that room type’s room nights.</p></div><Button size="sm" variant="outline" onClick={() => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, groupRoom: { ...contractPreview.draft.groupRoom, roomAllocations: [...roomAllocationsFor(contractPreview.draft.groupRoom), { roomType: "", roomsPerNight: 0, roomNights: 0, rate: 0 }] } } })}><Plus className="mr-1 h-4 w-4" />Room type</Button></div><div className="space-y-2">{roomAllocationsFor(contractPreview.draft.groupRoom).map((item: any, index: number) => <div key={index} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-4"><div><Label>Room type</Label><Input value={item.roomType} onChange={(event) => { const next = [...roomAllocationsFor(contractPreview.draft.groupRoom)]; next[index] = { ...item, roomType: event.target.value }; setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, groupRoom: { ...contractPreview.draft.groupRoom, roomAllocations: next } } }); }} /></div>{[["Peak/night","roomsPerNight"],["Room nights","roomNights"],["Rate","rate"]].map(([label, field]) => <div key={field}><Label>{label}</Label><Input type="number" min="0" step={field === "rate" ? "0.01" : "1"} value={item[field]} onChange={(event) => { const next = [...roomAllocationsFor(contractPreview.draft.groupRoom)]; next[index] = { ...item, [field]: Number(event.target.value) }; setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, groupRoom: { ...contractPreview.draft.groupRoom, roomAllocations: next } } }); }} /></div>)}</div>)}</div></section>}
            {contractPreview.draft.meeting && <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-[#2f5f46]" />Linked Meeting Space</h3><div className="grid gap-3 md:grid-cols-3">
              {[['Event name','eventName','text'],['Start date','eventDate','date'],['End date','eventEndDate','date'],['Attendance','attendance','number'],['Room rental total','roomRentalRevenue','number'],['Setup begins','setupStartTime','time'],['Guests begin','guestStartTime','time'],['Guests end','guestEndTime','time'],['Breakdown complete','breakdownEndTime','time']].map(([label,field,type]) => <div key={field}><Label>{label}</Label><Input type={type} value={contractPreview.draft.meeting[field] ?? ''} onChange={(event) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, meeting: { ...contractPreview.draft.meeting, [field]: event.target.value } } })} /></div>)}
              <div><Label>Meeting room</Label><Select value={contractPreview.draft.meeting.meetingRoom} onValueChange={(meetingRoom) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, meeting: { ...contractPreview.draft.meeting, meetingRoom } } })}><SelectTrigger className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectValue /></SelectTrigger><SelectContent className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectItem value="pecan">Pecan</SelectItem><SelectItem value="cedar">Cedar</SelectItem><SelectItem value="full_room">Full room · Cedar & Pecan</SelectItem></SelectContent></Select></div>
              <div><Label>Setup style</Label><Select value={contractPreview.draft.meeting.roomSetup} onValueChange={(roomSetup) => setContractPreview({ ...contractPreview, draft: { ...contractPreview.draft, meeting: { ...contractPreview.draft.meeting, roomSetup } } })}><SelectTrigger className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]"><SelectValue /></SelectTrigger><SelectContent className="border-[#cdbda8] bg-white text-[#201814] dark:bg-white dark:text-[#201814]">{['classroom','theater','u_shape','conference','banquet','reception','custom'].map((setup) => <SelectItem key={setup} value={setup}>{setup.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
            </div></section>}
            <div className="rounded-lg border bg-[#fffaf2] p-3 text-sm"><b>Revenue allocation:</b> The lodging rate is kept separate from breakfast and meeting-space revenue so a packaged rate is not counted twice.</div>
            {contractMergeMessage && <div className="rounded-lg border-2 border-[#315f86] bg-[#f4f8fb] p-4 text-[#201814] dark:bg-[#f4f8fb] dark:text-[#201814]"><div className="font-semibold text-[#315f86]">Matching calendar entries found</div><p className="mt-1 text-sm">{contractMergeMessage}</p><Button className="mt-3 bg-[#315f86] text-white" disabled={importContract.isPending} onClick={() => importContract.mutate(true)}>{importContract.isPending ? "Merging…" : "Merge with existing entries"}</Button></div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setContractPreview(null); setContractMergeMessage(""); }}>Choose another file</Button><Button className="bg-[#315f86] text-white" disabled={importContract.isPending} onClick={() => importContract.mutate(false)}>{importContract.isPending ? "Creating linked booking…" : "Confirm and create linked booking"}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
