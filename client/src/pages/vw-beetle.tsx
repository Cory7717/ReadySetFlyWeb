import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Camera, Car, CheckCircle2, Copy, DollarSign, Mail, Phone, Sparkles, Upload, X } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type VehiclePhoto = { id: string; url: string; caption?: string; category?: string };
type VehicleListing = {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  bodyStyle?: string | null;
  windshieldType?: string | null;
  transmission?: string | null;
  mileage?: string | null;
  vin?: string | null;
  vinPublic?: boolean;
  location?: string | null;
  askingPrice?: string | null;
  priceType: string;
  status: "available" | "pending" | "sold";
  story?: string | null;
  description?: string | null;
  conditionSummary?: string | null;
  knownIssues?: string | null;
  specsJson?: Record<string, any>;
  marketValueRangesJson?: Array<Record<string, any>>;
  aiValuationJson?: Record<string, any>;
  photosJson?: VehiclePhoto[];
  heroPhotoUrl?: string | null;
  sellerContactJson?: Record<string, any>;
  aiListingDraftsJson?: Record<string, any>;
};

const C = {
  page: "min-h-screen bg-[#f5efe7] !text-[#251914] [&_.text-card-foreground]:!text-[#251914] [&_.text-muted-foreground]:!text-[#67564a]",
  shell: "!border-[#dcc8aa] !bg-[#fffaf3] !bg-none !text-[#251914] shadow-[0_18px_45px_rgba(69,45,25,0.13)]",
  dark: "!border-[#3f3128] !bg-[#251914] !bg-none !text-white shadow-[0_18px_45px_rgba(37,25,20,0.25)]",
  field: "!border-[#cdb894] !bg-white !text-[#251914]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#264d38]",
  amber: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#966928]",
  outline: "!border-[#cdb894] !bg-white !bg-none !text-[#251914] hover:!bg-[#f8ead8]",
  muted: "!text-[#67564a]",
};

const comparison = [
  ["Windshield", "Flat", "Curved Panoramic"],
  ["Front Suspension", "Torsion Bar", "MacPherson Strut"],
  ["Ride Quality", "Good", "Improved"],
  ["Front Storage", "Smaller", "Larger"],
  ["Collector Appeal", "Strong", "Stronger"],
];

const repairs = [
  { repair: "Replace windshield seals", costLow: 200, costHigh: 500, valueLow: 500, valueHigh: 1000 },
  { repair: "Treat surface rust", costLow: 300, costHigh: 1500, valueLow: 500, valueHigh: 2500 },
  { repair: "Interior detailing", costLow: 150, costHigh: 500, valueLow: 300, valueHigh: 1000 },
  { repair: "Paint correction", costLow: 500, costHigh: 2000, valueLow: 500, valueHigh: 3000 },
];

const mintPrep = [
  { item: "Windshield seals", scope: "Replace dry seals and confirm no surrounding corrosion", cost: "$200-$500" },
  { item: "Surface rust correction", scope: "Treat visible surface rust and protect affected areas", cost: "$300-$1,500" },
  { item: "Interior/exterior detailing", scope: "Deep detail interior, trim, engine bay, and convertible presentation", cost: "$250-$700" },
  { item: "Paint correction", scope: "Polish/correct paint where practical without full repaint", cost: "$500-$2,000" },
  { item: "Documentation/photos", scope: "Document restored engine, floor boards, undercarriage, and known needs", cost: "$0-$300" },
];

function money(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "Accepting Offers";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function publicPhotoUrl(url?: string | null) {
  if (!url) return "";
  const vehiclePhotoPath = (value: string) => {
    try {
      const parsed = /^https?:\/\//i.test(value) ? new URL(value) : null;
      const pathname = parsed ? parsed.pathname : value;
      const match = pathname.match(/\/(?:uploads\/vw-beetle|api\/vehicle-listings\/vw-beetle\/photos)\/([^/?#]+)$/i);
      return match ? `/api/vehicle-listings/vw-beetle/photos/${encodeURIComponent(decodeURIComponent(match[1]))}` : "";
    } catch {
      return "";
    }
  };

  const normalizedVehiclePhoto = vehiclePhotoPath(url);
  if (normalizedVehiclePhoto) return apiUrl(normalizedVehiclePhoto);

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (
        (parsed.hostname === "readysetfly.us" || parsed.hostname === "www.readysetfly.us") &&
        parsed.pathname.startsWith("/uploads/")
      ) {
        return apiUrl(`${parsed.pathname}${parsed.search}`);
      }
    } catch {
      return url;
    }
    return url;
  }
  return apiUrl(url);
}

function spec(label: string, value?: unknown) {
  return { label, value: value == null || value === "" ? "TBD" : String(value) };
}

function draftToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(draftToText).filter(Boolean).join("\n\n");
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["text", "copy", "listing", "description", "body", "content", "draft"]) {
      const text = draftToText(obj[key]);
      if (text) return text;
    }
    return Object.entries(obj)
      .map(([key, nested]) => {
        const text = draftToText(nested);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

export default function VwBeetlePage() {
  const [location] = useLocation();
  const isAdminPage = location.startsWith("/vw-beetle/admin");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", interestType: "general_inquiry", offerAmount: "", preferredContactMethod: "email", message: "", website: "" });
  const [edit, setEdit] = useState<Partial<VehicleListing>>({});
  const [selectedPhotos, setSelectedPhotos] = useState<FileList | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const hadLight = root.classList.contains("light");
    const previousColorScheme = root.style.colorScheme;

    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";

    return () => {
      root.classList.toggle("dark", hadDark);
      root.classList.toggle("light", hadLight);
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  const listingQuery = useQuery<{ listing: VehicleListing }>({
    queryKey: ["/api/vehicle-listings/vw-beetle"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/vehicle-listings/vw-beetle"), { credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const listing = listingQuery.data?.listing;
  const photos = listing?.photosJson || [];
  const savedHeroIndex = photos.findIndex((photo) => photo.url === listing?.heroPhotoUrl);
  const heroUrl = publicPhotoUrl(listing?.heroPhotoUrl || photos[0]?.url);
  const previewUrl = publicPhotoUrl(photos[activePhoto]?.url || listing?.heroPhotoUrl || photos[0]?.url);
  const specs = listing?.specsJson || {};
  const valuation = listing?.aiValuationJson || {};
  const ranges = listing?.marketValueRangesJson || [];
  const draftValue = useMemo(() => ({ ...listing, ...edit }), [listing, edit]);

  useEffect(() => {
    if (!photos.length) return;
    setActivePhoto(Math.max(savedHeroIndex, 0));
  }, [listing?.heroPhotoUrl, photos.length]);

  useEffect(() => {
    if (photos.length <= 1 || lightbox != null) return;
    const timer = window.setInterval(() => {
      setActivePhoto((current) => (current + 1) % photos.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [photos.length, lightbox]);

  const submitLead = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/vehicle-listings/vw-beetle/leads", lead),
    onSuccess: () => {
      setLead({ name: "", email: "", phone: "", interestType: "general_inquiry", offerAmount: "", preferredContactMethod: "email", message: "", website: "" });
      toast({ title: "Message sent", description: "Your inquiry was sent to the seller." });
    },
    onError: (error: Error) => toast({ title: "Unable to send", description: error.message, variant: "destructive" }),
  });

  const saveListing = useMutation({
    mutationFn: async (override?: Partial<VehicleListing>) => {
      const response = await apiRequest("PUT", "/api/vehicle-listings/vw-beetle/admin", override || edit);
      return response.json();
    },
    onSuccess: (_data, override) => {
      if (!override) setEdit({});
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-listings/vw-beetle"] });
      toast({ title: override?.heroPhotoUrl ? "Hero image updated" : "Listing saved" });
    },
    onError: (error: Error) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
  });

  const uploadPhotos = useMutation({
    mutationFn: async () => {
      if (!selectedPhotos?.length) throw new Error("Choose photos first.");
      const form = new FormData();
      Array.from(selectedPhotos).forEach((file) => form.append("photos", file));
      const response = await fetch(apiUrl("/api/vehicle-listings/vw-beetle/admin/photos"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      setSelectedPhotos(null);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-listings/vw-beetle"] });
      toast({ title: "Photos uploaded" });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const clearPhotos = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/vehicle-listings/vw-beetle/admin/photos");
      return response.json();
    },
    onSuccess: (data) => {
      setActivePhoto(0);
      setLightbox(null);
      setSelectedPhotos(null);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-listings/vw-beetle"] });
      toast({ title: "Photos cleared", description: `${data.deletedCount || 0} stored photo reference${data.deletedCount === 1 ? "" : "s"} removed.` });
    },
    onError: (error: Error) => toast({ title: "Clear photos failed", description: error.message, variant: "destructive" }),
  });

  const aiValuation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/vehicle-listings/vw-beetle/admin/ai/valuation", { notes: edit.conditionSummary || listing?.conditionSummary });
      return response.json();
    },
    onSuccess: (data) => {
      setEdit((current) => ({ ...current, aiValuationJson: data.valuation }));
      toast({ title: "AI valuation generated", description: "Review and save before publishing." });
    },
    onError: (error: Error) => toast({ title: "AI valuation failed", description: error.message, variant: "destructive" }),
  });

  const aiListing = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/vehicle-listings/vw-beetle/admin/ai/listing", {});
      return response.json();
    },
    onSuccess: (data) => {
      const drafts = Object.fromEntries(
        Object.entries(data.drafts || {}).map(([key, value]) => [key, draftToText(value)])
      );
      const professional = draftToText((drafts as any).professional);
      setEdit((current) => ({
        ...current,
        aiListingDraftsJson: drafts,
        description: professional || current.description,
      }));
      toast({ title: "AI listing drafts generated", description: "The professional draft has been placed into the Description field. Review, edit, then save." });
    },
    onError: (error: Error) => toast({ title: "AI draft failed", description: error.message, variant: "destructive" }),
  });

  const repairTotals = repairs.reduce((sum, item) => ({
    costLow: sum.costLow + item.costLow,
    costHigh: sum.costHigh + item.costHigh,
    valueLow: sum.valueLow + item.valueLow,
    valueHigh: sum.valueHigh + item.valueHigh,
  }), { costLow: 0, costHigh: 0, valueLow: 0, valueHigh: 0 });
  const currentLow = Number(valuation.suggestedLowValue || 13000);
  const currentHigh = Number(valuation.suggestedHighValue || 19000);
  const excellentLow = 25000;
  const excellentHigh = 35000;
  const prepCostLow = repairTotals.costLow;
  const prepCostHigh = repairTotals.costHigh + 300;

  if (listingQuery.isLoading) return <div className={`${C.page} p-8`}>Loading Volkswagen listing...</div>;
  if (!listing) return <div className={`${C.page} p-8`}>Listing unavailable.</div>;

  return (
    <div className={C.page}>
      <title>1974 Volkswagen Super Beetle Convertible For Sale</title>
      <meta name="description" content="Classic 1974 Volkswagen Super Beetle Convertible, curved windshield model, manual transmission, restored engine, drivable, good body and interior condition." />

      <header className="border-b border-[#dcc8aa] bg-[#fffaf3]/95 px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6532]">Private Vehicle Listing</div>
            <h1 className="text-2xl font-bold tracking-tight">1974 Volkswagen Super Beetle Convertible</h1>
            <div className="mt-2 text-3xl font-bold text-[#2f5f46]">{listing.askingPrice ? money(listing.askingPrice) : "Accepting Offers"}</div>
          </div>
          <div className="flex gap-2">
            {isAdminPage && <Badge className="bg-[#251914]">Admin edit mode</Badge>}
            <Badge variant="outline" className={listing.status === "sold" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>{listing.status}</Badge>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-6 overflow-hidden px-4 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="min-w-0 space-y-3">
            <div className="relative overflow-hidden rounded-3xl border border-[#d7c2a0] bg-[#120d0b]">
              {listing.status === "sold" && <div className="absolute left-4 top-4 z-10 rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white">SOLD</div>}
              {heroUrl ? (
                <button className="block h-[42vh] min-h-[300px] w-full cursor-zoom-in bg-[#120d0b] md:min-h-[380px]" onClick={() => setLightbox(Math.max(savedHeroIndex, 0))} aria-label="Open hero VW Beetle photo full screen">
                  <img
                    key={heroUrl}
                    src={heroUrl}
                    className="h-full w-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    alt={listing.title}
                  />
                </button>
              ) : (
                <div className="flex h-[42vh] min-h-[300px] items-center justify-center text-[#f1dfca]"><Camera className="mr-2 h-6 w-6" /> Photos coming soon</div>
              )}
              <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl bg-black/55 p-4 text-white backdrop-blur">
                <Badge className="mb-3 bg-[#b98435]">Curved Windshield Super Beetle</Badge>
                <h2 className="text-3xl font-bold md:text-5xl">{listing.title}</h2>
                <p className="mt-2 max-w-3xl text-sm text-[#f4e4d2] md:text-base">Curved windshield model, manual transmission, restored engine, drivable condition</p>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="rounded-2xl border border-[#dcc8aa] bg-[#fffaf3] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[#251914]">Photo Gallery</div>
                  <div className="text-xs text-[#67564a]">Click any photo to view full screen</div>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id || photo.url}
                    className={`group relative aspect-[4/3] min-w-0 overflow-hidden rounded-xl border-2 bg-[#120d0b] ${activePhoto === index ? "border-[#b98435]" : "border-[#d7c2a0]"}`}
                    onClick={() => {
                      setActivePhoto(index);
                      setLightbox(index);
                    }}
                    aria-label={`Open VW Beetle photo ${index + 1}`}
                  >
                    <img
                      src={publicPhotoUrl(photo.url)}
                      className="h-full w-full object-cover"
                      loading={index < 6 ? "eager" : "lazy"}
                      fetchPriority={index < 2 ? "high" : "low"}
                      decoding="async"
                      alt={photo.caption || `VW Beetle photo ${index + 1}`}
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">View full screen</span>
                  </button>
                ))}
                </div>
                {previewUrl && (
                  <button
                    className="mt-3 block h-64 w-full cursor-zoom-in overflow-hidden rounded-2xl border border-[#dcc8aa] bg-[#120d0b] md:h-72"
                    onClick={() => setLightbox(activePhoto)}
                    aria-label="Open rotating gallery preview full screen"
                  >
                    <img
                      key={previewUrl}
                      src={previewUrl}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      decoding="async"
                      alt={photos[activePhoto]?.caption || `Selected VW Beetle photo ${activePhoto + 1}`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <Card className={C.dark}>
              <CardHeader>
                <CardTitle className="text-3xl">{listing.askingPrice ? money(listing.askingPrice) : "Accepting Offers"}</CardTitle>
                <CardDescription className="!text-[#eadfce]">{listing.location || "Location TBD"} | Manual | Drivable</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Button className={C.amber} onClick={() => document.getElementById("contact-seller")?.scrollIntoView({ behavior: "smooth" })}><Mail className="mr-2 h-4 w-4" />Contact Seller</Button>
                  <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => setLead((v) => ({ ...v, interestType: "request_more_photos" }))}>Request More Photos</Button>
                  <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => setLead((v) => ({ ...v, interestType: "make_an_offer" }))}><DollarSign className="mr-2 h-4 w-4" />Make an Offer</Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Copy className="mr-2 h-4 w-4" />Copy Link</Button>
                  {listing.sellerContactJson?.showPhone && listing.sellerContactJson?.phone && <Button asChild variant="ghost" className="text-white hover:bg-white/10"><a href={`tel:${listing.sellerContactJson.phone}`}><Phone className="mr-2 h-4 w-4" />Call/Text</a></Button>}
                </div>
              </CardContent>
            </Card>
            <SpecGrid listing={listing} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl space-y-6 px-4 pb-10">
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle>Why This Beetle Is Different</CardTitle>
              <CardDescription>1974 Super Beetle Convertible values should be compared against 1973-1979 curved windshield convertibles, not earlier flat windshield hardtops or project cars.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3 text-sm leading-7 text-[#4d3d32]">
                {["Curved panoramic windshield", "MacPherson strut front suspension", "Improved handling and ride quality", "Larger front cargo area", "More desirable collector variant", "One of the final years of convertible Beetle production"].map((item) => <div key={item} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 text-[#2f5f46]" />{item}</div>)}
              </div>
              <div className="hidden md:block">
                <table className="w-full overflow-hidden rounded-xl border border-[#dcc8aa] text-sm">
                  <thead><tr className="bg-[#251914] text-white"><th className="p-3 text-left">Feature</th><th className="p-3 text-left">Standard Beetle</th><th className="p-3 text-left">Super Beetle Convertible</th></tr></thead>
                  <tbody>{comparison.map((row) => <tr key={row[0]} className="odd:bg-white even:bg-[#fbf1e4]"><td className="p-3 font-semibold text-[#251914]">{row[0]}</td><td className="p-3 text-[#4d3d32]">{row[1]}</td><td className="p-3 font-semibold text-[#2f5f46]">{row[2]}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="grid gap-3 md:hidden">
                {comparison.map((row) => (
                  <div key={row[0]} className="rounded-xl border border-[#dcc8aa] bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#8a6532]">{row[0]}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-[#67564a]">Standard</div><div className="font-semibold text-[#251914]">{row[1]}</div></div>
                      <div><div className="text-[#67564a]">Super Convertible</div><div className="font-semibold text-[#2f5f46]">{row[2]}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className={C.shell}>
              <CardHeader><CardTitle>Market Value Ranges</CardTitle><CardDescription>General private-party guide. Verify with current curved windshield Super Beetle Convertible comps.</CardDescription></CardHeader>
              <CardContent>
                <table className="hidden w-full table-fixed text-sm leading-5 md:table">
                  <thead><tr className="bg-[#251914] text-white"><th className="w-[21%] p-2 text-left">Condition</th><th className="w-[27%] p-2 text-left">Description</th><th className="w-[26%] p-2">Range</th><th className="w-[26%] p-2 text-left">Notes</th></tr></thead>
                  <tbody>{ranges.map((row) => {
                    const isCurrent = (row.condition || "").includes("Good Driver");
                    return (
                      <tr key={row.condition} className={isCurrent ? "bg-[#dff0e5] outline outline-2 outline-[#2f5f46]" : "odd:bg-white even:bg-[#fbf1e4]"}>
                        <td className="break-words p-2 align-top font-semibold">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.condition}
                            {isCurrent && <Badge className="bg-[#2f5f46] text-white">This car</Badge>}
                          </div>
                        </td>
                        <td className="break-words p-2 align-top">{row.description}</td>
                        <td className="whitespace-nowrap p-2 text-center align-top font-semibold tabular-nums">{row.range}</td>
                        <td className="break-words p-2 align-top">{isCurrent ? "Current category: restored engine, drivable, good body/interior, minor needs." : row.notes}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
                <div className="grid gap-3 md:hidden">
                  {ranges.map((row) => {
                    const isCurrent = (row.condition || "").includes("Good Driver");
                    return (
                      <div key={row.condition} className={`rounded-xl border p-4 ${isCurrent ? "border-[#2f5f46] bg-[#dff0e5]" : "border-[#dcc8aa] bg-white"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-[#251914]">{row.condition}</div>
                          {isCurrent && <Badge className="bg-[#2f5f46] text-white">This car</Badge>}
                        </div>
                        <div className="mt-2 text-2xl font-bold tabular-nums text-[#2f5f46]">{row.range}</div>
                        <p className="mt-2 text-sm leading-6 text-[#4d3d32]">{row.description}</p>
                        <p className="mt-2 text-sm leading-6 text-[#67564a]">{isCurrent ? "Current category: restored engine, drivable, good body/interior, minor needs." : row.notes}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-xl border border-[#2f5f46]/30 bg-[#edf7f0] p-3 text-sm leading-6 text-[#244b37]">
                  <strong>Estimated current position:</strong> Good Driver / Good Condition with minor needs. Current AI-supported range: <strong>{money(currentLow)}-{money(currentHigh)}</strong>.
                </div>
              </CardContent>
            </Card>
            <Card className={C.shell}>
              <CardHeader><CardTitle>Our Super Beetle’s Current Condition</CardTitle><CardDescription>{listing.conditionSummary}</CardDescription></CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {[spec("Drivable", specs.drivable), spec("Transmission", listing.transmission), spec("Engine", specs.engine), spec("Body", specs.exterior), spec("Interior", specs.interior), spec("Windshield", listing.windshieldType), spec("Known needs", listing.knownIssues), spec("Suggested range", `${money(valuation.suggestedLowValue)}-${money(valuation.suggestedHighValue)}`)].map((item) => <div key={item.label} className="flex justify-between gap-4 rounded-lg border border-[#ead9bf] bg-white px-3 py-2"><span className="font-semibold">{item.label}</span><span className="text-right text-[#5d4c40]">{item.value}</span></div>)}
              </CardContent>
            </Card>
          </div>

          <Card className={C.shell}>
            <CardHeader><CardTitle>Current Value vs. Mint-Condition Path</CardTitle><CardDescription>What it may take to move from current good-driver condition toward a higher-end presentation.</CardDescription></CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <table className="hidden w-full text-sm md:table">
                <thead><tr className="bg-[#251914] text-white"><th className="p-2 text-left">Improvement</th><th className="p-2 text-left">Scope</th><th className="p-2">Estimated Cost</th></tr></thead>
                <tbody>{mintPrep.map((item) => <tr key={item.item} className="odd:bg-white even:bg-[#fbf1e4]"><td className="p-2 font-semibold text-[#251914]">{item.item}</td><td className="p-2 text-[#4d3d32]">{item.scope}</td><td className="p-2 text-center font-semibold text-[#251914]">{item.cost}</td></tr>)}</tbody>
              </table>
              <div className="grid gap-3 md:hidden">
                {mintPrep.map((item) => (
                  <div key={item.item} className="rounded-xl border border-[#dcc8aa] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-[#251914]">{item.item}</div>
                      <div className="whitespace-nowrap font-semibold text-[#2f5f46]">{item.cost}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#4d3d32]">{item.scope}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-[#dcc8aa] bg-white p-4">
                <div className="text-sm font-semibold text-[#67564a]">Current estimated value</div>
                <div className="mt-1 text-3xl font-bold text-[#2f5f46]">{money(currentLow)} - {money(currentHigh)}</div>
                <div className="mt-4 text-sm font-semibold text-[#67564a]">Excellent / mint-presentation market</div>
                <div className="mt-1 text-2xl font-bold text-[#251914]">{money(excellentLow)} - {money(excellentHigh)}+</div>
                <div className="mt-4 text-sm font-semibold text-[#67564a]">Estimated prep investment</div>
                <div className="mt-1 text-xl font-bold text-[#8a6532]">{money(prepCostLow)} - {money(prepCostHigh)}</div>
                <p className="mt-3 text-sm leading-6 text-[#5d4c40]">This does not guarantee show-level value. The most practical lift is addressing seals, surface rust, detailing, paint correction, and documentation before marketing the car broadly.</p>
              </div>
            </CardContent>
          </Card>

          <Card id="contact-seller" className={C.dark}>
            <CardHeader><CardTitle>Contact Seller</CardTitle><CardDescription className="!text-[#eadfce]">Ask a question, request photos, schedule a viewing, or make an offer.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <input className="hidden" value={lead.website} onChange={(event) => setLead({ ...lead, website: event.target.value })} tabIndex={-1} autoComplete="off" />
              <div><Label>Name</Label><Input className={C.field} value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input className={C.field} type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input className={C.field} value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} /></div>
              <div><Label>Interest</Label><Select value={lead.interestType} onValueChange={(interestType) => setLead({ ...lead, interestType })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general_inquiry">General inquiry</SelectItem><SelectItem value="request_more_photos">Request more photos</SelectItem><SelectItem value="schedule_viewing">Schedule viewing</SelectItem><SelectItem value="make_an_offer">Make an offer</SelectItem></SelectContent></Select></div>
              <div><Label>Offer amount</Label><Input className={C.field} value={lead.offerAmount} onChange={(e) => setLead({ ...lead, offerAmount: e.target.value })} /></div>
              <div><Label>Preferred contact</Label><Select value={lead.preferredContactMethod} onValueChange={(preferredContactMethod) => setLead({ ...lead, preferredContactMethod })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="text">Text</SelectItem></SelectContent></Select></div>
              <div className="md:col-span-2"><Label>Message</Label><Textarea className={`${C.field} min-h-28`} value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} /></div>
              <div className="md:col-span-2"><Button className={C.amber} disabled={submitLead.isPending || !lead.name || !lead.email} onClick={() => submitLead.mutate()}>{submitLead.isPending ? "Sending..." : "Send Inquiry"}</Button></div>
            </CardContent>
          </Card>

          {isAdminPage && (
            <AdminPanel
              listing={draftValue as VehicleListing}
              edit={edit}
              setEdit={setEdit}
              selectedPhotos={selectedPhotos}
              setSelectedPhotos={setSelectedPhotos}
              activeHeroUrl={listing.heroPhotoUrl || ""}
              setHeroPhoto={(url) => {
                const nextIndex = photos.findIndex((photo) => photo.url === url);
                if (nextIndex >= 0) setActivePhoto(nextIndex);
                saveListing.mutate({ heroPhotoUrl: url } as any);
              }}
              saveListing={() => saveListing.mutate(undefined)}
              saving={saveListing.isPending}
              uploadPhotos={() => uploadPhotos.mutate()}
              uploading={uploadPhotos.isPending}
              clearPhotos={() => {
                if (window.confirm("Remove all current VW Beetle photos from this listing? You can re-upload after this clears.")) {
                  clearPhotos.mutate();
                }
              }}
              clearingPhotos={clearPhotos.isPending}
              generateValuation={() => aiValuation.mutate()}
              generateListing={() => aiListing.mutate()}
              aiBusy={aiValuation.isPending || aiListing.isPending}
            />
          )}
        </section>
      </main>

      <Dialog open={lightbox != null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-6xl border-0 bg-black p-0 text-white">
          <DialogHeader className="sr-only"><DialogTitle>Vehicle photo viewer</DialogTitle></DialogHeader>
          {lightbox != null && photos[lightbox] && (
            <div className="relative flex h-[88vh] items-center justify-center">
              <Button size="icon" variant="ghost" className="absolute right-3 top-3 z-10 text-white" onClick={() => setLightbox(null)}><X /></Button>
              <Button size="icon" variant="ghost" className="absolute left-3 z-10 text-white" onClick={() => setLightbox((i) => i == null ? 0 : Math.max(0, i - 1))}><ArrowLeft /></Button>
              <img src={publicPhotoUrl(photos[lightbox].url)} className="max-h-full max-w-full touch-pan-x object-contain" alt={`VW Beetle ${lightbox + 1}`} />
              <Button size="icon" variant="ghost" className="absolute right-3 z-10 text-white" onClick={() => setLightbox((i) => i == null ? 0 : Math.min(photos.length - 1, i + 1))}><ArrowRight /></Button>
              <div className="absolute bottom-4 rounded-full bg-black/70 px-4 py-2 text-sm">{lightbox + 1} of {photos.length}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpecGrid({ listing }: { listing: VehicleListing }) {
  const specs = listing.specsJson || {};
  const rows = [
    spec("Year", listing.year),
    spec("Make", listing.make),
    spec("Model", listing.model),
    spec("Windshield", listing.windshieldType),
    spec("Transmission", listing.transmission),
    spec("Drivable", specs.drivable),
    spec("Engine", specs.engine),
    spec("Interior", specs.interior),
    spec("Exterior/body", specs.exterior),
    spec("Title status", specs.titleStatus),
    spec("Mileage", listing.mileage),
    spec("Convertible top", specs.convertibleTop),
    spec("Floor pans / structure", specs.floorPans),
    spec("Undercarriage", specs.undercarriage),
    spec("Restoration docs", specs.restorationDocumentation),
    ...(listing.vinPublic ? [spec("VIN", listing.vin)] : []),
  ];
  return (
    <Card className={C.shell}>
      <CardHeader><CardTitle className="flex items-center gap-2"><Car className="h-5 w-5" />Vehicle Details</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => <div key={row.label} className="rounded-lg border border-[#ead9bf] bg-white p-3"><div className="text-xs uppercase tracking-wide text-[#8a6532]">{row.label}</div><div className="font-semibold">{row.value}</div></div>)}
      </CardContent>
    </Card>
  );
}

function AdminPanel(props: {
  listing: VehicleListing;
  edit: Partial<VehicleListing>;
  setEdit: (value: Partial<VehicleListing> | ((current: Partial<VehicleListing>) => Partial<VehicleListing>)) => void;
  selectedPhotos: FileList | null;
  setSelectedPhotos: (files: FileList | null) => void;
  activeHeroUrl: string;
  setHeroPhoto: (url: string) => void;
  saveListing: () => void;
  saving: boolean;
  uploadPhotos: () => void;
  uploading: boolean;
  clearPhotos: () => void;
  clearingPhotos: boolean;
  generateValuation: () => void;
  generateListing: () => void;
  aiBusy: boolean;
}) {
  const { listing, edit, setEdit } = props;
  const set = (patch: Partial<VehicleListing>) => setEdit((current) => ({ ...current, ...patch }));
  const contact = listing.sellerContactJson || {};
  const specs = listing.specsJson || {};
  const setSpec = (patch: Record<string, unknown>) => set({ specsJson: { ...specs, ...patch } });
  const valuation = listing.aiValuationJson || {};
  const hasValuation = Object.keys(valuation).length > 0;
  const listItems = (value: unknown) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  return (
    <Card className={C.shell}>
      <CardHeader><CardTitle>Admin Listing Tools</CardTitle><CardDescription>Edit content, upload photos, and generate AI drafts. Save before public changes are final.</CardDescription></CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Status</Label><Select value={listing.status} onValueChange={(status: any) => set({ status })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="sold">Sold</SelectItem></SelectContent></Select></div>
          <div><Label>Asking price</Label><Input className={C.field} value={String(listing.askingPrice || "")} onChange={(e) => set({ askingPrice: e.target.value as any })} /></div>
          <div><Label>Mileage</Label><Input className={C.field} value={listing.mileage || ""} onChange={(e) => set({ mileage: e.target.value })} /></div>
          <div><Label>Location</Label><Input className={C.field} value={listing.location || ""} onChange={(e) => set({ location: e.target.value })} /></div>
        </div>
        <div className="rounded-xl border border-[#dcc8aa] bg-white p-4">
          <Label>Condition and confidence details</Label>
          <p className="mt-1 text-sm text-[#67564a]">These details improve the AI valuation confidence and populate the public Vehicle Details card.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div><Label>Title status</Label><Input className={C.field} placeholder="Clean, unknown, bonded, rebuilt..." value={String(specs.titleStatus || "")} onChange={(e) => setSpec({ titleStatus: e.target.value })} /></div>
            <div><Label>Convertible top</Label><Input className={C.field} placeholder="Good, needs inspection, replaced..." value={String(specs.convertibleTop || "")} onChange={(e) => setSpec({ convertibleTop: e.target.value })} /></div>
            <div><Label>Floor pans / structure</Label><Input className={C.field} placeholder="Solid, surface rust only, unknown..." value={String(specs.floorPans || "")} onChange={(e) => setSpec({ floorPans: e.target.value })} /></div>
            <div><Label>Undercarriage</Label><Input className={C.field} placeholder="Good, needs photos, unknown..." value={String(specs.undercarriage || "")} onChange={(e) => setSpec({ undercarriage: e.target.value })} /></div>
            <div><Label>Engine documentation</Label><Input className={C.field} placeholder="Receipts, photos, verbal only..." value={String(specs.restorationDocumentation || "")} onChange={(e) => setSpec({ restorationDocumentation: e.target.value })} /></div>
            <div><Label>VIN</Label><Input className={C.field} value={listing.vin || ""} onChange={(e) => set({ vin: e.target.value })} /></div>
            <div><Label>Show VIN publicly</Label><Select value={String(Boolean(listing.vinPublic))} onValueChange={(v) => set({ vinPublic: v === "true" })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">Hidden</SelectItem><SelectItem value="true">Public</SelectItem></SelectContent></Select></div>
          </div>
        </div>
        <div><Label>Description</Label><Textarea className={`${C.field} min-h-36`} value={listing.description || ""} onChange={(e) => set({ description: e.target.value })} /></div>
        <div><Label>Known issues</Label><Textarea className={`${C.field} min-h-20`} value={listing.knownIssues || ""} onChange={(e) => set({ knownIssues: e.target.value })} /></div>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Seller email</Label><Input className={C.field} value={contact.email || ""} onChange={(e) => set({ sellerContactJson: { ...contact, email: e.target.value } })} /></div>
          <div><Label>Seller phone</Label><Input className={C.field} value={contact.phone || ""} onChange={(e) => set({ sellerContactJson: { ...contact, phone: e.target.value } })} /></div>
          <div><Label>Show email</Label><Select value={String(Boolean(contact.showEmail))} onValueChange={(v) => set({ sellerContactJson: { ...contact, showEmail: v === "true" } })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">Hidden</SelectItem><SelectItem value="true">Public</SelectItem></SelectContent></Select></div>
          <div><Label>Show phone</Label><Select value={String(Boolean(contact.showPhone))} onValueChange={(v) => set({ sellerContactJson: { ...contact, showPhone: v === "true" } })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">Hidden</SelectItem><SelectItem value="true">Public</SelectItem></SelectContent></Select></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className={C.green} disabled={props.saving || Object.keys(edit).length === 0} onClick={props.saveListing}>{props.saving ? "Saving..." : "Save Listing"}</Button>
          <Button variant="outline" className={C.outline} disabled={props.aiBusy} onClick={props.generateValuation}><Sparkles className="mr-2 h-4 w-4" />Generate AI Valuation</Button>
          <Button variant="outline" className={C.outline} disabled={props.aiBusy} onClick={props.generateListing}><Sparkles className="mr-2 h-4 w-4" />Generate Listing Text</Button>
        </div>
        {hasValuation && (
          <div className="rounded-xl border border-[#dcc8aa] bg-[#fff7ea] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Label>AI Valuation Results</Label>
                <p className="mt-1 text-sm text-[#67564a]">Review these results, edit the listing if needed, then click Save Listing to publish them.</p>
              </div>
              <Badge className="bg-[#251914] text-white">
                {valuation.imagesAnalyzed ?? 0} image{valuation.imagesAnalyzed === 1 ? "" : "s"} analyzed
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-[#ead9bf] bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-[#8a6532]">Condition</div>
                <div className="mt-1 font-semibold">{valuation.estimatedConditionCategory || "Not provided"}</div>
              </div>
              <div className="rounded-lg border border-[#ead9bf] bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-[#8a6532]">Suggested Range</div>
                <div className="mt-1 font-semibold">{money(valuation.suggestedLowValue)} - {money(valuation.suggestedHighValue)}</div>
              </div>
              <div className="rounded-lg border border-[#ead9bf] bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-[#8a6532]">Suggested Ask</div>
                <div className="mt-1 font-semibold">{money(valuation.suggestedAskingPrice)}</div>
              </div>
              <div className="rounded-lg border border-[#ead9bf] bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-[#8a6532]">Confidence</div>
                <div className="mt-1 font-semibold">{valuation.confidence || "Not provided"}</div>
              </div>
            </div>
            {!!valuation.photoConditionSummary && (
              <div className="mt-4 rounded-lg border border-[#ead9bf] bg-white p-3 text-sm leading-6 text-[#4d3d32]">
                <div className="font-semibold text-[#251914]">Photo-based condition analysis</div>
                <p className="mt-1">{String(valuation.photoConditionSummary)}</p>
              </div>
            )}
            {!!valuation.confidenceReason && (
              <div className="mt-3 rounded-lg border border-[#ead9bf] bg-white p-3 text-sm leading-6 text-[#4d3d32]">
                <div className="font-semibold text-[#251914]">Why confidence is {String(valuation.confidence || "not provided").toLowerCase()}</div>
                <p className="mt-1">{String(valuation.confidenceReason)}</p>
              </div>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-[#251914]">Visible strengths</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4d3d32]">
                  {listItems(valuation.visibleStrengths).map((item) => <li key={item}>{item}</li>)}
                  {!listItems(valuation.visibleStrengths).length && <li>No strengths returned.</li>}
                </ul>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#251914]">Visible concerns</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4d3d32]">
                  {listItems(valuation.visibleConcerns).map((item) => <li key={item}>{item}</li>)}
                  {!listItems(valuation.visibleConcerns).length && <li>No concerns returned.</li>}
                </ul>
              </div>
            </div>
            {!!valuation.curvedWindshieldValueImpact && (
              <p className="mt-4 rounded-lg border border-[#ead9bf] bg-white p-3 text-sm text-[#4d3d32]">
                <span className="font-semibold">Curved windshield impact: </span>{String(valuation.curvedWindshieldValueImpact)}
              </p>
            )}
            {!!valuation.disclaimer && <p className="mt-3 text-xs text-[#67564a]">{String(valuation.disclaimer)}</p>}
          </div>
        )}
        {listing.aiListingDraftsJson && Object.keys(listing.aiListingDraftsJson).length > 0 && (
          <div className="grid gap-2">
            <Label>AI listing drafts</Label>
            <p className="text-sm text-[#67564a]">The professional draft is copied into Description above. Use the other versions for Facebook Marketplace or collector-focused listings.</p>
            {Object.entries(listing.aiListingDraftsJson).map(([key, value]) => (
              <div key={key} className="grid gap-1">
                <Label className="capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                <Textarea className={`${C.field} min-h-28`} value={draftToText(value)} readOnly />
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-[#dcc8aa] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Label>Upload photos</Label>
              <p className="mt-1 text-sm text-[#67564a]">Clear the current local/broken photo references before re-uploading a fresh gallery.</p>
            </div>
            <Button
              variant="outline"
              className="!border-red-300 !bg-red-50 !text-red-800 hover:!bg-red-100"
              disabled={props.clearingPhotos || !(listing.photosJson || []).length}
              onClick={props.clearPhotos}
            >
              {props.clearingPhotos ? "Clearing..." : "Clear Current Photos"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input className={C.field} type="file" accept="image/*" multiple onChange={(e) => props.setSelectedPhotos(e.target.files)} />
            <Button className={C.amber} disabled={props.uploading || !props.selectedPhotos?.length} onClick={props.uploadPhotos}><Upload className="mr-2 h-4 w-4" />{props.uploading ? "Uploading..." : "Upload Photos"}</Button>
          </div>
          {!!(listing.photosJson || []).length && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(listing.photosJson || []).map((photo, index) => {
                const isHero = photo.url === props.activeHeroUrl || (!props.activeHeroUrl && index === 0);
                return (
                  <div key={photo.id || photo.url} className={`overflow-hidden rounded-xl border ${isHero ? "border-[#b98435] ring-2 ring-[#b98435]/30" : "border-[#dcc8aa]"} bg-[#fffaf3]`}>
                    <img src={publicPhotoUrl(photo.url)} className="h-28 w-full object-cover" alt={photo.caption || `VW Beetle photo ${index + 1}`} />
                    <div className="flex items-center justify-between gap-2 p-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isHero ? "bg-[#b98435] text-white" : "bg-[#ead9bf] text-[#4d3d32]"}`}>
                        {isHero ? "Hero image" : `Photo ${index + 1}`}
                      </span>
                      <Button size="sm" variant="outline" className={C.outline} disabled={isHero || props.saving} onClick={() => props.setHeroPhoto(photo.url)}>
                        Use as Hero
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
