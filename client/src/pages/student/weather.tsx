import { useEffect, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trackEvent } from "@/lib/analytics";
import { NextStepCTA } from "@/components/student/NextStepCTA";
import { apiUrl } from "@/lib/api";

export default function StudentWeather() {
  const [icao, setIcao] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("student_page_view", { page: "weather" });
  }, []);

  const fetchWeather = async () => {
    if (!icao) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/aviation-weather/${icao.toUpperCase()}`));
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Unable to fetch weather." });
    } finally {
      setLoading(false);
    }
  };

  const status = result?.metar?.flight_category || "UNKNOWN";
  const trainingLabel =
    status === "VFR" ? "Good for training" : status === "MVFR" ? "Marginal" : "No-go";

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

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Enter ICAO (e.g., KJFK)"
          value={icao}
          onChange={(e) => setIcao(e.target.value)}
        />
        <Button onClick={fetchWeather} disabled={loading}>
          {loading ? "Loading..." : "Check Weather"}
        </Button>
      </Card>

      {result && !result.error && (
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Flight category</div>
          <div className="text-2xl font-semibold">{status}</div>
          <div className="text-sm text-muted-foreground">{trainingLabel}</div>
          <div className="text-xs text-muted-foreground">METAR: {result?.metar?.raw || "Unavailable"}</div>
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
