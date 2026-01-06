import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Cloud, Search, ExternalLink, AlertTriangle, FileText, Radio, Loader2, CloudSun } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface WeatherData {
  icao: string;
  metar: any;
  taf: any;
  timestamp: number;
  cached: boolean;
}

function parseFlightCategory(metar: any): { category: string; color: string } {
  if (!metar) return { category: "UNKNOWN", color: "gray" };

  // Extract ceiling and visibility from rawOb
  const raw = metar.rawOb || "";
  
  // Simple heuristic for flight category based on common METAR patterns
  // VFR: ceiling > 3000 ft, vis > 5 mi
  // MVFR: ceiling 1000-3000 ft or vis 3-5 mi
  // IFR: ceiling 500-1000 ft or vis 1-3 mi
  // LIFR: ceiling < 500 ft or vis < 1 mi

  const visMatch = raw.match(/\s(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1]) : 10;

  const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
  const ceiling = ceilingMatch ? parseInt(ceilingMatch[2]) * 100 : 10000;

  if (ceiling >= 3000 && visibility > 5) {
    return { category: "VFR", color: "green" };
  } else if (ceiling >= 1000 && visibility >= 3) {
    return { category: "MVFR", color: "blue" };
  } else if (ceiling >= 500 && visibility >= 1) {
    return { category: "IFR", color: "red" };
  } else {
    return { category: "LIFR", color: "purple" };
  }
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export default function PilotTools() {
  const [icao, setIcao] = useState("KAUS");
  const [searchIcao, setSearchIcao] = useState("KAUS");

  const { data: weather, isLoading, error, refetch } = useQuery<WeatherData>({
    queryKey: [`/api/aviation-weather/${searchIcao}`],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/aviation-weather/${searchIcao}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch weather data");
      return res.json();
    },
    enabled: !!searchIcao,
  });

  const handleSearch = () => {
    if (icao.trim().length >= 3) {
      setSearchIcao(icao.toUpperCase().trim());
    }
  };

  const flightCategory = parseFlightCategory(weather?.metar);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <CloudSun className="h-8 w-8" />
            Pilot Tools
          </h1>
          <p className="text-muted-foreground">
            Aviation weather, NOTAMs, and airport information
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Airport Weather</CardTitle>
            <CardDescription>Enter an ICAO code (e.g., KAUS, KJFK, KDFW)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="icao" className="sr-only">ICAO Code</Label>
                <Input
                  id="icao"
                  value={icao}
                  onChange={(e) => setIcao(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="ICAO (e.g., KAUS)"
                  maxLength={4}
                  className="uppercase"
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to fetch weather data. Please check the ICAO code and try again.
            </AlertDescription>
          </Alert>
        )}

        {weather && (
          <>
            {/* Flight Category & Quick Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    {weather.icao} - Current Conditions
                  </CardTitle>
                  <Badge 
                    variant="outline" 
                    className={`text-white ${
                      flightCategory.color === "green" ? "bg-green-600" :
                      flightCategory.color === "blue" ? "bg-blue-600" :
                      flightCategory.color === "red" ? "bg-red-600" :
                      "bg-purple-600"
                    }`}
                  >
                    {flightCategory.category}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  {weather.metar && (
                    <span className="text-xs">
                      Updated: {formatTimeAgo(new Date(weather.metar.obsTime).getTime())}
                    </span>
                  )}
                  {weather.cached && (
                    <Badge variant="secondary" className="text-xs">Cached</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {weather.metar ? (
                  <>
                    <div>
                      <Label className="text-sm font-semibold">METAR</Label>
                      <p className="font-mono text-sm bg-muted p-3 rounded-md mt-1">
                        {weather.metar.rawOb}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No METAR data available</p>
                )}

                <Separator />

                {weather.taf ? (
                  <div>
                    <Label className="text-sm font-semibold">TAF (Forecast)</Label>
                    <p className="font-mono text-sm bg-muted p-3 rounded-md mt-1 whitespace-pre-wrap">
                      {weather.taf.rawTAF}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label className="text-sm font-semibold">TAF (Forecast)</Label>
                    <p className="text-sm text-muted-foreground mt-1">No TAF data available</p>
                  </div>
                )}

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Disclaimer:</strong> This information is for planning purposes only and is not for official flight briefings. 
                    Always obtain an official weather briefing before flight.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* External Resources */}
            <Card>
              <CardHeader>
                <CardTitle>Aviation Resources</CardTitle>
                <CardDescription>Official sources for flight planning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button variant="outline" className="justify-start" asChild>
                    <a
                      href={`https://www.aviationweather.gov/metar/data?ids=${weather.icao}&format=decoded`}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      <Cloud className="h-4 w-4 mr-2" />
                      View METAR/TAF
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://notams.aim.faa.gov/notamSearch/nsapp.html#/`, '_blank')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    NOTAMs
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://tfr.faa.gov/tfr2/list.html`, '_blank')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    TFRs
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/`, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Chart Supplement
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://www.1800wxbrief.com/`, '_blank')}
                  >
                    <Radio className="h-4 w-4 mr-2" />
                    1800WXBRIEF
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => window.open(`https://skyvector.com/airport/${weather.icao}`, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    SkyVector
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>
                </div>

                <Separator className="my-4" />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>METAR:</strong> Current observed weather conditions</p>
                  <p><strong>TAF:</strong> Terminal Aerodrome Forecast (6-30 hour forecast)</p>
                  <p><strong>NOTAMs:</strong> Notices to Airmen (runway closures, navaid outages, etc.)</p>
                  <p><strong>TFRs:</strong> Temporary Flight Restrictions</p>
                  <p><strong>Chart Supplement:</strong> Airport/facility directory with frequencies and procedures</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
