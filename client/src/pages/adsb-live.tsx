import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plane, RefreshCcw, Search, Globe2 } from "lucide-react";
import { apiUrl } from "@/lib/api";

type AdsbAircraft = {
  icao?: string;
  hex?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  alt_geom?: number;
  gs?: number;
  track?: number;
  flight?: string;
  r?: string;
  t?: string;
};

type AdsbExchangeResponse = {
  ac?: AdsbAircraft[];
  now?: number;
};

type MapView = {
  lat: number;
  lon: number;
  distNm: number;
};

type TrackPoint = {
  lat: number;
  lon: number;
  ts: number;
};

const DEFAULT_VIEW: MapView = { lat: 39.5, lon: -98.35, distNm: 250 };
const REFRESH_MS = 2000;
const MAX_TRACK_POINTS = 120;
const NM_PER_METER = 1 / 1852;

const buildPlaneIcon = (heading?: number) =>
  L.divIcon({
    className: "adsb-plane-icon",
    html: `<div style="transform: rotate(${heading ?? 0}deg); font-size: 16px; line-height: 16px;">\u2708</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const normalizeCallsign = (value?: string) => (value || "").trim();

export default function AdsbLive() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const mapRef = useRef<L.Map | null>(null);
  const [trackHistory, setTrackHistory] = useState<Record<string, TrackPoint[]>>({});

  const { data, isLoading, error, refetch, isFetching } = useQuery<AdsbExchangeResponse>({
    queryKey: ["/api/adsb/aircraft", view.lat, view.lon, view.distNm],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: view.lat.toFixed(4),
        lon: view.lon.toFixed(4),
        dist: Math.round(view.distNm).toString(),
      });
      const res = await fetch(apiUrl(`/api/adsb/aircraft?${params.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ADS-B traffic");
      return res.json();
    },
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: false,
  });

  const aircraft = useMemo(() => {
    const list = data?.ac ?? [];
    return list.filter((item) => typeof item.lat === "number" && typeof item.lon === "number");
  }, [data]);

  useEffect(() => {
    if (!aircraft.length) return;
    const timestamp = Date.now();
    setTrackHistory((prev) => {
      const next = { ...prev };
      aircraft.forEach((item) => {
        const id = (item.icao || item.hex || normalizeCallsign(item.flight) || "unknown").toUpperCase();
        if (id === "UNKNOWN") return;
        const current = next[id] ? [...next[id]] : [];
        current.push({ lat: item.lat as number, lon: item.lon as number, ts: timestamp });
        if (current.length > MAX_TRACK_POINTS) {
          current.splice(0, current.length - MAX_TRACK_POINTS);
        }
        next[id] = current;
      });
      return next;
    });
  }, [aircraft]);

  const filtered = useMemo(() => {
    if (!query.trim()) return aircraft;
    const needle = query.trim().toLowerCase();
    return aircraft.filter((item) => {
      const callsign = normalizeCallsign(item.flight).toLowerCase();
      const reg = (item.r || "").toLowerCase();
      const type = (item.t || "").toLowerCase();
      const hex = (item.icao || item.hex || "").toLowerCase();
      return callsign.includes(needle) || reg.includes(needle) || type.includes(needle) || hex.includes(needle);
    });
  }, [aircraft, query]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return aircraft.find((item) =>
      [item.icao, item.hex, normalizeCallsign(item.flight)].filter(Boolean).some((value) =>
        String(value).toUpperCase() === selectedId
      )
    );
  }, [aircraft, selectedId]);

  const selectedTrack = selectedId ? trackHistory[selectedId] : undefined;

  const handleMapMove = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const bounds = mapRef.current.getBounds();
    const corner = bounds.getNorthEast();
    const distanceMeters = center.distanceTo(corner);
    const distNm = Math.max(25, Math.min(500, distanceMeters * NM_PER_METER));
    setView({ lat: center.lat, lon: center.lng, distNm });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const visibleCount = filtered.length;
  const updatedAt = data?.now ? new Date(data.now * 1000) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plane className="h-6 w-6 text-sky-600" />
            RSF Live Traffic
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Global ADS-B traffic powered by ADSBExchange. Pan/zoom to scan any region and click an aircraft for details.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            Data coverage depends on ADS-B reception. Some aircraft may be blocked or delayed. Not for operational use.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Live Traffic Controls
            </CardTitle>
            <CardDescription>Search by callsign, tail number, type, or hex ID.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label className="sr-only" htmlFor="adsb-search">Search</Label>
              <Input
                id="adsb-search"
                placeholder="DAL123, N123AB, A320..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Badge variant="outline">
              {isFetching ? "Updating..." : `${visibleCount} aircraft`}
            </Badge>
            {updatedAt && (
              <Badge variant="secondary">Updated {updatedAt.toLocaleTimeString()}</Badge>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4" />
                  Live Map
                </CardTitle>
                <CardDescription>
                  Coverage radius: {Math.round(view.distNm)} nm. Pan to explore global traffic.
                </CardDescription>
              </div>
              <Badge variant="outline">ADSBExchange</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[520px]">
                <MapContainer
                  center={[view.lat, view.lon]}
                  zoom={6}
                  whenReady={(event: L.LeafletEvent) => {
                    const map = event.target as L.Map;
                    mapRef.current = map;
                    map.on("moveend", handleMapMove);
                  }}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filtered.map((item) => {
                    const id = (item.icao || item.hex || normalizeCallsign(item.flight) || "unknown").toUpperCase();
                    if (!item.lat || !item.lon) return null;
                    return (
                      <Marker
                        key={id}
                        position={[item.lat, item.lon]}
                        icon={buildPlaneIcon(item.track)}
                        eventHandlers={{
                          click: () => handleSelect(id),
                        }}
                      >
                        <Popup>
                          <div className="space-y-1 text-sm">
                            <div className="font-semibold">{normalizeCallsign(item.flight) || "Unknown"}</div>
                            <div>Hex: {item.icao || item.hex || "—"}</div>
                            <div>Alt: {item.alt_baro ?? item.alt_geom ?? "—"} ft</div>
                            <div>GS: {item.gs ?? "—"} kt</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  {selectedTrack && selectedTrack.length > 1 && (
                    <Polyline
                      positions={selectedTrack.map((point) => [point.lat, point.lon])}
                      pathOptions={{ color: "#0ea5e9", weight: 3, opacity: 0.8 }}
                    />
                  )}
                </MapContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aircraft Details</CardTitle>
              <CardDescription>
                {selected ? "Live telemetry from ADS-B" : "Select an aircraft from the map or list."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>Unable to load live traffic. Check the ADSBExchange API key.</AlertDescription>
                </Alert>
              )}

              {selected ? (
                <div className="space-y-2">
                  <div className="text-lg font-semibold">
                    {normalizeCallsign(selected.flight) || selected.r || "Unknown"}
                  </div>
                  <div className="text-sm text-muted-foreground">Hex: {selected.icao || selected.hex || "—"}</div>
                  <div className="grid gap-2 text-sm">
                    <div>Altitude: {selected.alt_baro ?? selected.alt_geom ?? "—"} ft</div>
                    <div>Ground speed: {selected.gs ?? "—"} kt</div>
                    <div>Heading: {selected.track ?? "—"} deg</div>
                    <div>Type: {selected.t || "—"}</div>
                    <div>Registration: {selected.r || "—"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Track points stored: {selectedTrack?.length ?? 0}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Pick a target to view details and track history.</div>
              )}

              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground mb-2">Visible aircraft</div>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {filtered.slice(0, 200).map((item) => {
                    const id = (item.icao || item.hex || normalizeCallsign(item.flight) || "unknown").toUpperCase();
                    const label = normalizeCallsign(item.flight) || item.r || id;
                    return (
                      <button
                        key={id}
                        className={`w-full text-left text-sm border rounded-md px-3 py-2 hover:bg-muted ${
                          selectedId === id ? "border-primary" : "border-border"
                        }`}
                        onClick={() => handleSelect(id)}
                      >
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">
                          Alt {item.alt_baro ?? item.alt_geom ?? "—"} ft · GS {item.gs ?? "—"} kt
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && !isLoading && (
                    <div className="text-xs text-muted-foreground">No aircraft match your search.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
