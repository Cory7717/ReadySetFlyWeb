import { useEffect, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { apiUrl } from "@/lib/api";

type AirportSearchResult = {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number;
  lon?: number;
};

const ICAO_REGEX = /^[A-Z0-9]{3,4}$/;

export default function StudentWeather() {
  const [icao, setIcao] = useState("");
  const [airportSuggestions, setAirportSuggestions] = useState<AirportSearchResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("student_page_view", { page: "weather" });
  }, []);

  const fetchWeather = async (override?: string) => {
    const target = (override ?? icao).trim();
    if (!target) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/aviation-weather/${target.toUpperCase()}`));
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Unable to fetch weather." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const trimmed = icao.trim();
    const normalized = trimmed.toUpperCase();
    if (trimmed.length < 2 || ICAO_REGEX.test(normalized)) {
      setAirportSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(trimmed)}`));
        if (!res.ok) throw new Error("Failed to search airports");
        const results = (await res.json()) as AirportSearchResult[];
        setAirportSuggestions(results.slice(0, 8));
      } catch {
        setAirportSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [icao]);

  const handleSelectAirport = (airport: AirportSearchResult) => {
    const next = airport.icao.toUpperCase();
    setIcao(next);
    setAirportSuggestions([]);
    fetchWeather(next);
  };

  const handleSearch = () => {
    const trimmed = icao.trim();
    if (!trimmed) return;
    const normalized = trimmed.toUpperCase();
    if (ICAO_REGEX.test(normalized)) {
      fetchWeather(normalized);
      return;
    }
    if (airportSuggestions.length > 0) {
      const next = airportSuggestions[0].icao.toUpperCase();
      setIcao(next);
      setAirportSuggestions([]);
      fetchWeather(next);
    }
  };

  const status = (() => {
    const raw = result?.metar?.rawOb || "";
    if (!raw) return "UNKNOWN";
    const visMatch = raw.match(/\s(\d{1,2})SM/);
    const visibility = visMatch ? parseInt(visMatch[1], 10) : 10;
    const ceilingMatch = raw.match(/(BKN|OVC)(\d{3})/);
    const ceiling = ceilingMatch ? parseInt(ceilingMatch[2], 10) * 100 : 10000;
    if (ceiling >= 3000 && visibility > 5) return "VFR";
    if (ceiling >= 1000 && visibility >= 3) return "MVFR";
    if (ceiling >= 500 && visibility >= 1) return "IFR";
    return "LIFR";
  })();
  const trainingLabel = status === "VFR" ? "Good for training" : status === "MVFR" ? "Marginal" : "No-go";

  return (
    <StudentLayout
      title="Student Weather"
      subtitle="Simplified weather view for training decisions (always consult an instructor)."
    >
      <Alert>
        <AlertTitle>Training disclaimer</AlertTitle>
        <AlertDescription>
          This tool is informational only. Always follow your instructor and official sources.
        </AlertDescription>
      </Alert>

      <Card className="p-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="ICAO or city (e.g., KJFK or Dallas, TX)"
              value={icao}
              onChange={(e) => setIcao(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            {loadingSuggestions && (
              <div className="text-xs text-muted-foreground">Searching airports...</div>
            )}
            {airportSuggestions.length > 0 && (
              <div className="rounded-lg border bg-background shadow-sm">
                {airportSuggestions.map((airport) => (
                  <button
                    key={`${airport.icao}-${airport.name ?? ""}`}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handleSelectAirport(airport)}
                  >
                    <div className="font-medium">{airport.icao}</div>
                    <div className="text-xs text-muted-foreground">
                      {airport.name || "Unknown airport"}
                      {airport.city ? ` - ${airport.city}` : ""}
                      {airport.state ? `, ${airport.state}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? "Loading..." : "Check Weather"}
          </Button>
        </div>
      </Card>

      {result && !result.error && (
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Flight category</div>
          <div className="text-2xl font-semibold">{status}</div>
          <div className="text-sm text-muted-foreground">{trainingLabel}</div>
          <div className="text-xs text-muted-foreground">METAR: {result?.metar?.rawOb || "Unavailable"}</div>
        </Card>
      )}

      {result?.error && (
        <Card className="p-4 text-sm text-muted-foreground">
          {result.error}
        </Card>
      )}

      <NextStepCTA label="Find a flight school near this airport" type="flight-school" location={icao} />
    </StudentLayout>
  );
}
