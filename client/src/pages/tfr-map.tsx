import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, useMap, WMSTileLayer } from "react-leaflet";
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
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Navigation, Search } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

type TfrFeatureCollection = FeatureCollection & {
  updatedAt?: string;
  stale?: boolean;
};

type SuaFeatureCollection = FeatureCollection & {
  updatedAt?: string;
  stale?: boolean;
};

type TfrGeoJsonLayerProps = {
  data: FeatureCollection;
  selectedId: string | null;
  onSelect: (feature: any) => void;
};

const TfrGeoJsonLayer = ({ data, selectedId, onSelect }: TfrGeoJsonLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) return undefined;
    const layer = L.geoJSON(data, {
      style: (feature: any) => {
        const featureId = feature?.properties?.notamId;
        const isSelected = selectedId && featureId === selectedId;
        return {
          color: isSelected ? "#0ea5e9" : "#f97316",
          weight: isSelected ? 3 : 2,
          fillColor: isSelected ? "#0ea5e9" : "#f97316",
          fillOpacity: isSelected ? 0.35 : 0.25,
        };
      },
      onEachFeature: (feature, layerInstance) => {
        const notamId = (feature as any)?.properties?.notamId;
        if (notamId) {
          layerInstance.bindTooltip(String(notamId), { sticky: true });
        }
        layerInstance.on({
          click: () => onSelect(feature),
        });
      },
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [data, map, onSelect, selectedId]);

  return null;
};

type SuaGeoJsonLayerProps = {
  data: FeatureCollection;
};

const SuaGeoJsonLayer = ({ data }: SuaGeoJsonLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) return undefined;
    const layer = L.geoJSON(data, {
      style: (feature: any) => {
        const rawType = String(feature?.properties?.type || feature?.properties?.raw?.SPECIALUSEAIRSPACETYPE || "").toLowerCase();
        const type = rawType.replace(/[^a-z]/g, "");
        let color = "#0f766e";
        if (type.includes("restricted")) color = "#ef4444";
        if (type.includes("prohibited")) color = "#b91c1c";
        if (type.includes("warning")) color = "#f59e0b";
        if (type.includes("alert")) color = "#facc15";
        if (type.includes("moa")) color = "#2563eb";
        if (type.includes("danger")) color = "#f97316";
        return {
          color,
          weight: 1,
          dashArray: "4 3",
          fillColor: color,
          fillOpacity: 0.08,
        };
      },
      onEachFeature: (feature, layerInstance) => {
        const name = feature?.properties?.name || feature?.properties?.raw?.FEATURENAME || "SUA";
        const type = feature?.properties?.type || feature?.properties?.raw?.SPECIALUSEAIRSPACETYPE || "";
        layerInstance.bindTooltip(`${name}${type ? ` (${type})` : ""}`, { sticky: true });
      },
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [data, map]);

  return null;
};

const MapBoundsTracker = ({ enabled, onBoundsChange }: { enabled: boolean; onBoundsChange: (bounds: L.LatLngBounds) => void }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      onBoundsChange(map.getBounds());
    };
    handler();
    map.on("moveend", handler);
    return () => {
      map.off("moveend", handler);
    };
  }, [enabled, map, onBoundsChange]);

  return null;
};

const MapInstanceBridge = ({ onReady }: { onReady: (map: L.Map) => void }) => {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
};

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;
type BasemapMode = "standard" | "sectional" | "ifr";

const FAA_WMS_URL = apiUrl("/api/tiles/faa/wms");

const AviationBasemapLayer = ({ mode }: { mode: BasemapMode }) => {
  const map = useMap();
  const [ifrLayer, setIfrLayer] = useState<"SUA:ifr_enroute_low" | "SUA:ifr_enroute_high">(
    map.getZoom() >= 7 ? "SUA:ifr_enroute_low" : "SUA:ifr_enroute_high"
  );

  useEffect(() => {
    if (mode !== "ifr") return;
    const onZoom = () => {
      setIfrLayer(map.getZoom() >= 7 ? "SUA:ifr_enroute_low" : "SUA:ifr_enroute_high");
    };
    onZoom();
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map, mode]);

  if (mode === "sectional") {
    return (
      <>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <WMSTileLayer
          url={FAA_WMS_URL}
          layers="SUA:us_sectionals"
          format="image/png"
          transparent
          version="1.1.1"
          attribution='FAA SUA Geoserver Charts'
          zIndex={500}
        />
      </>
    );
  }

  if (mode === "ifr") {
    return (
      <>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <WMSTileLayer
          key={ifrLayer}
          url={FAA_WMS_URL}
          layers={ifrLayer}
          format="image/png"
          transparent
          version="1.1.1"
          attribution='FAA SUA Geoserver Charts'
          zIndex={500}
        />
      </>
    );
  }

  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
};

export default function TfrMap() {
  const initialIcao =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("icao") || ""
      : "";
  const [query, setQuery] = useState("");
  const [icaoFilter, setIcaoFilter] = useState(initialIcao.toUpperCase());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeBbox, setActiveBbox] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSUA, setShowSUA] = useState(false);
  const [suaBbox, setSuaBbox] = useState<string | null>(null);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("standard");
  const mapRef = useRef<L.Map | null>(null);

  const normalizedIcao = icaoFilter.trim().toUpperCase();
  const activeIcao = ICAO_REGEX.test(normalizedIcao) ? normalizedIcao : "";

  const { data, isLoading, error, refetch } = useQuery<TfrFeatureCollection>({
    queryKey: ["/api/tfrs", activeIcao, activeBbox],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeIcao) params.set("icao", activeIcao);
      if (activeBbox) params.set("bbox", activeBbox);
      const url = params.toString() ? `/api/tfrs?${params}` : "/api/tfrs";
      const res = await fetch(apiUrl(url), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch TFRs");
      return res.json();
    },
    refetchInterval: 1000 * 60 * 60,
    refetchIntervalInBackground: true,
  });

  const {
    data: suaData,
    isLoading: suaLoading,
    error: suaError,
    refetch: refetchSua,
  } = useQuery<SuaFeatureCollection>({
    queryKey: ["/api/airspace/sua", suaBbox],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (suaBbox) params.set("bbox", suaBbox);
      const url = params.toString() ? `/api/airspace/sua?${params}` : "/api/airspace/sua";
      const res = await fetch(apiUrl(url), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch special use airspace");
      return res.json();
    },
    enabled: showSUA && Boolean(suaBbox),
    staleTime: 1000 * 60 * 60 * 6,
    refetchOnWindowFocus: false,
  });

  const features = data?.features ?? [];
  const suaFeatures = suaData?.features ?? [];
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

  const selectedFeature = useMemo(() => {
    if (!selectedId) return null;
    return filtered.find((feature: any) => feature?.properties?.notamId === selectedId) || null;
  }, [filtered, selectedId]);

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

  const handleRefresh = () => {
    trackEvent("tfr_map_refresh");
    refetch();
    if (showSUA) {
      refetchSua();
    }
  };

  const handleSearchArea = () => {
    if (!mapRef.current) return;
    const mapBounds = mapRef.current.getBounds();
    const bbox = [
      mapBounds.getWest().toFixed(5),
      mapBounds.getSouth().toFixed(5),
      mapBounds.getEast().toFixed(5),
      mapBounds.getNorth().toFixed(5),
    ].join(",");
    setActiveBbox(bbox);
    trackEvent("tfr_bbox_search", { bbox });
  };

  const clearAreaFilter = () => {
    setActiveBbox(null);
  };

  const handleFeatureClick = (feature: any) => {
    const featureId = feature?.properties?.notamId || null;
    if (!featureId) return;
    setSelectedId(featureId);
    trackEvent("tfr_selected", { tfr_id: featureId });
    if (mapRef.current) {
      const layer = L.geoJSON(feature);
      const featureBounds = layer.getBounds();
      if (featureBounds.isValid()) {
        mapRef.current.fitBounds(featureBounds.pad(0.2));
      }
    }
  };

  useEffect(() => {
    trackEvent("tfr_map_view");
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    if (!showSUA) {
      setSuaBbox(null);
    }
  }, [showSUA]);

  const handleSuaBounds = useCallback((bounds: L.LatLngBounds) => {
    const bbox = [
      bounds.getWest().toFixed(5),
      bounds.getSouth().toFixed(5),
      bounds.getEast().toFixed(5),
      bounds.getNorth().toFixed(5),
    ].join(",");
    setSuaBbox(bbox);
  }, []);

  const handleMapReady = useCallback(
    (map: L.Map) => {
      mapRef.current = map;
      if (bounds) {
        map.fitBounds(bounds.pad(0.2));
      }
    },
    [bounds]
  );

  const suaGeoJson: FeatureCollection = {
    type: "FeatureCollection",
    features: suaFeatures,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            TFR Map (RSF)
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Live Temporary Flight Restrictions powered by the FAA NOTAM Management Service (US-only). Always verify with official sources before flight.
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
            <Button variant="outline" onClick={handleRefresh}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={handleSearchArea}>
              Search this map area
            </Button>
            {activeBbox && (
              <Button variant="ghost" onClick={clearAreaFilter}>
                Clear area filter
              </Button>
            )}
            <Badge variant="outline" title="Direct from the FAA NOTAM Management Service (NMS).">
              NOTAMs powered by FAA NMS
            </Badge>
            <div className="flex items-center gap-2 pl-1">
              <Switch checked={showSUA} onCheckedChange={(checked) => setShowSUA(checked)} />
              <span className="text-sm text-muted-foreground">Show special-use airspace (MOA / Restricted)</span>
            </div>
            {showSUA && (
              <Badge variant="secondary">
                {suaLoading ? "Loading SUA..." : `${suaFeatures.length} areas`}
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="tfr-basemap" className="text-sm text-muted-foreground">
                Basemap
              </Label>
              <select
                id="tfr-basemap"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={basemapMode}
                onChange={(e) => {
                  const next = e.target.value as BasemapMode;
                  setBasemapMode(next);
                  trackEvent("tfr_basemap_changed", { basemap: next });
                }}
              >
                <option value="standard">Standard</option>
                <option value="sectional">FAA Sectional</option>
                <option value="ifr">IFR Enroute (Low/High)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {data?.stale && (
          <Alert>
            <AlertDescription>Data may be up to 1 hour old while we reconnect to the upstream feed.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Unable to load TFR data. Try again shortly.</AlertDescription>
          </Alert>
        )}

        {suaError && (
          <Alert variant="destructive">
            <AlertDescription>Unable to load special-use airspace. Try again shortly.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className={isFullscreen ? "overflow-hidden fixed inset-0 z-[1000] bg-background" : "overflow-hidden"}>
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
              <div className={isFullscreen ? "relative h-[calc(100vh-120px)] rounded-xl overflow-hidden" : "relative h-[520px] rounded-xl overflow-hidden"}>
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="absolute right-3 top-3 z-[1100] rounded-md border bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900 shadow hover:bg-white"
                >
                  {isFullscreen ? "Close full screen" : "Full screen"}
                </button>
                <MapContainer
                  center={[39.5, -98.35]}
                  zoom={4}
                  scrollWheelZoom
                  className="h-full w-full"
                >
                  <MapInstanceBridge onReady={handleMapReady} />
                  <AviationBasemapLayer mode={basemapMode} />
                  <TfrGeoJsonLayer data={geoJson} selectedId={selectedId} onSelect={handleFeatureClick} />
                  {showSUA && <SuaGeoJsonLayer data={suaGeoJson} />}
                  <MapBoundsTracker enabled={showSUA} onBoundsChange={handleSuaBounds} />
                </MapContainer>
              </div>
              {showSUA && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Special-use airspace boundaries are static; activation times vary. Always verify with official sources before flight.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Data: FAA NMS</span>
                <span>Updated every 3 min</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>TFR Details</CardTitle>
              <CardDescription>Quick reference list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedFeature && (
                <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/30">
                  <div className="font-semibold">{selectedFeature.properties?.notamId}</div>
                  {selectedFeature.properties?.title && (
                    <div className="text-muted-foreground">{selectedFeature.properties.title}</div>
                  )}
                  {selectedFeature.properties?.legal && (
                    <div className="text-xs text-muted-foreground">Legal: {selectedFeature.properties.legal}</div>
                  )}
                  {selectedFeature.properties?.notamKey && (
                    <div className="text-xs text-muted-foreground">NOTAM Key: {selectedFeature.properties.notamKey}</div>
                  )}
                  {selectedFeature.properties?.location && (
                    <div className="text-muted-foreground">{selectedFeature.properties.location}</div>
                  )}
                  {selectedFeature.properties?.reason && (
                    <div className="text-muted-foreground">{selectedFeature.properties.reason}</div>
                  )}
                  {selectedFeature.properties?.altitude && (
                    <div className="text-muted-foreground">Altitude: {selectedFeature.properties.altitude}</div>
                  )}
                  {selectedFeature.properties?.effectiveAt && (
                    <div className="text-xs text-muted-foreground">Effective: {selectedFeature.properties.effectiveAt}</div>
                  )}
                  {selectedFeature.properties?.expiresAt && (
                    <div className="text-xs text-muted-foreground">Expires: {selectedFeature.properties.expiresAt}</div>
                  )}
                  {selectedFeature.properties?.lastUpdatedAt && (
                    <div className="text-xs text-muted-foreground">Last updated: {selectedFeature.properties.lastUpdatedAt}</div>
                  )}
                  {selectedFeature.properties?.text && (
                    <details className="text-xs text-muted-foreground pt-1">
                      <summary className="cursor-pointer">View full NOTAM text</summary>
                      <div className="mt-2 whitespace-pre-wrap">{selectedFeature.properties.text}</div>
                    </details>
                  )}
                </div>
              )}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No TFRs match this filter.</p>
              )}
              {filtered.slice(0, 6).map((feature: any) => (
                <div
                  key={feature.properties?.notamId}
                  className="rounded-lg border p-3 text-sm space-y-1 cursor-pointer hover:border-primary/40"
                  onClick={() => handleFeatureClick(feature)}
                >
                  <div className="font-semibold">{feature.properties?.notamId}</div>
                  {feature.properties?.title && (
                    <div className="text-muted-foreground">{feature.properties.title}</div>
                  )}
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
