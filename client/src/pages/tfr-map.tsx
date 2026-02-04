import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Navigation, Search } from "lucide-react";
import { apiUrl } from "@/lib/api";

type TfrFeatureCollection = FeatureCollection & {
  updatedAt?: string;
};

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;

export default function TfrMap() {
  const initialIcao =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("icao") || ""
      : "";
  const [query, setQuery] = useState("");
  const [icaoFilter, setIcaoFilter] = useState(initialIcao.toUpperCase());

  const normalizedIcao = icaoFilter.trim().toUpperCase();
  const activeIcao = ICAO_REGEX.test(normalizedIcao) ? normalizedIcao : "";

  const { data, isLoading, error, refetch } = useQuery<TfrFeatureCollection>({
    queryKey: ["/api/tfrs", activeIcao],
    queryFn: async () => {
      const url = activeIcao ? `/api/tfrs?icao=${activeIcao}` : "/api/tfrs";
      const res = await fetch(apiUrl(url), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch TFRs");
      return res.json();
    },
  });

  const features = data?.features ?? [];
  const filtered = useMemo(() => {
    if (!query.trim()) return features;
    const needle = query.trim().toLowerCase();
    return features.filter((feature: any) => {
      const props = feature.properties || {};
      return (
        String(props.notamId || "").toLowerCase().includes(needle) ||
        String(props.location || "").toLowerCase().includes(needle) ||
        String(props.reason || "").toLowerCase().includes(needle)
      );
    });
  }, [features, query]);

  const geoJson: FeatureCollection = {
    type: "FeatureCollection",
    features: filtered,
  };

  const bounds = useMemo(() => {
    if (!filtered.length) return null;
    const allCoords: [number, number][] = [];
    filtered.forEach((feature: any) => {
      const coords = feature?.geometry?.coordinates?.[0] || [];
      coords.forEach((pair: [number, number]) => {
        allCoords.push([pair[1], pair[0]]);
      });
    });
    if (!allCoords.length) return null;
    return L.latLngBounds(allCoords);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            TFR Map (RSF)
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Live Temporary Flight Restrictions powered by FAA SWIM. Always verify with official sources before flight.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search TFRs</CardTitle>
            <CardDescription>Filter by ICAO, NOTAM number, location, or reason.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="sr-only" htmlFor="tfr-icao">ICAO Filter</Label>
              <Input
                id="tfr-icao"
                value={icaoFilter}
                onChange={(e) => setIcaoFilter(e.target.value.toUpperCase())}
                placeholder="ICAO (KAUS)"
              />
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label className="sr-only" htmlFor="tfr-search">Search TFRs</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tfr-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="FDC 6/9895, Cape Canaveral..."
                  className="pl-9"
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
            <Badge variant="outline">NOTAMs powered by FAA SWIM</Badge>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Unable to load TFR data. Try again shortly.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                TFR Map
              </CardTitle>
              <CardDescription>
                {isLoading ? "Loading TFRs..." : `${filtered.length} active TFRs`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[520px] rounded-xl overflow-hidden">
                <MapContainer
                  center={[39.5, -98.35]}
                  zoom={4}
                  scrollWheelZoom
                  className="h-full w-full"
                  whenReady={(map) => {
                    if (bounds) {
                      map.target.fitBounds(bounds.pad(0.2));
                    }
                  }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <GeoJSON
                    data={geoJson}
                    style={() => ({
                      color: "#f97316",
                      weight: 2,
                      fillColor: "#f97316",
                      fillOpacity: 0.25,
                    })}
                  />
                </MapContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>TFR Details</CardTitle>
              <CardDescription>Quick reference list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No TFRs match this filter.</p>
              )}
              {filtered.slice(0, 6).map((feature: any) => (
                <div key={feature.properties?.notamId} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="font-semibold">{feature.properties?.notamId}</div>
                  {feature.properties?.location && (
                    <div className="text-muted-foreground">{feature.properties.location}</div>
                  )}
                  {feature.properties?.reason && (
                    <div className="text-muted-foreground">{feature.properties.reason}</div>
                  )}
                  {feature.properties?.altitude && (
                    <div className="text-muted-foreground">Altitude: {feature.properties.altitude}</div>
                  )}
                  <Separator className="my-2" />
                  <div className="text-xs text-muted-foreground">
                    {feature.properties?.effectiveAt ? `Effective: ${feature.properties.effectiveAt}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {feature.properties?.expiresAt ? `Expires: ${feature.properties.expiresAt}` : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
