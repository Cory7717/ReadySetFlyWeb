import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import WeatherBriefingSummarizer from "@/components/ai/WeatherBriefingSummarizer";
import NotamTranslator from "@/components/ai/NotamTranslator";
import { AlertTriangle } from "lucide-react";
import type { KeyboardEvent } from "react";

interface AirportSearchResult {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
}

interface WeatherHazard {
  id: string;
  label: string;
  detail: string;
  tone: "red" | "amber" | "blue";
}

interface LandingCurrentConditionsProps {
  open: boolean;
  icaoInput: string;
  searchIcao: string;
  airportSuggestions: AirportSearchResult[];
  loadingSuggestions: boolean;
  airportMeta: AirportSearchResult | null | undefined;
  airportLocation: string;
  isValidIcao: boolean;
  weather: any;
  runwayBriefing: any;
  notams: any;
  weatherLoading: boolean;
  weatherFetching: boolean;
  runwayLoading: boolean;
  runwayFetching: boolean;
  notamsLoading: boolean;
  notamsFetching: boolean;
  notamsError: boolean;
  conditionsTitle: string;
  weatherUpdatedAt: string | null;
  flightCategory: { category: string; color: string };
  runwayInUseDisplay: string | null;
  atisInfo: string | null;
  weatherHazards: WeatherHazard[];
  showAiWeatherSummary: boolean;
  showAiNotamTranslator: boolean;
  onIcaoInputChange: (value: string) => void;
  onSubmitIcao: () => void;
  onRefresh: () => void;
  onApplySuggestion: (suggestion: AirportSearchResult) => void;
  onToggleAiWeatherSummary: () => void;
  onToggleAiNotamTranslator: () => void;
}

export function LandingCurrentConditions({
  open,
  icaoInput,
  searchIcao,
  airportSuggestions,
  loadingSuggestions,
  airportMeta,
  airportLocation,
  isValidIcao,
  weather,
  runwayBriefing,
  notams,
  weatherLoading,
  weatherFetching,
  runwayLoading,
  runwayFetching,
  notamsLoading,
  notamsFetching,
  notamsError,
  conditionsTitle,
  weatherUpdatedAt,
  flightCategory,
  runwayInUseDisplay,
  atisInfo,
  weatherHazards,
  showAiWeatherSummary,
  showAiNotamTranslator,
  onIcaoInputChange,
  onSubmitIcao,
  onRefresh,
  onApplySuggestion,
  onToggleAiWeatherSummary,
  onToggleAiNotamTranslator,
}: LandingCurrentConditionsProps) {
  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onRefresh();
    }
  };

  return (
    <div id="landing-weather-section" className="hidden pb-10 sm:pb-12 md:block">
      <div className="container mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold">Current Conditions</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Live weather and airport conditions for quick planning context.
          </p>
        </div>

        <Card className="overflow-visible border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.96),rgba(14,22,34,0.92))] text-[#E8EDF4] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.72)]">
          <CardContent className="relative z-30 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <Label htmlFor="landing-icao" className="text-sm font-semibold">
                  Airport ICAO
                </Label>
                <div className="relative w-full sm:max-w-xs">
                  <Input
                    id="landing-icao"
                    value={icaoInput}
                    onChange={(event) => onIcaoInputChange(event.target.value)}
                    onBlur={onSubmitIcao}
                    onKeyDown={onKeyDown}
                    placeholder="KAUS or Austin, TX"
                  />
                  {(loadingSuggestions || airportSuggestions.length > 0) && (
                    <div className="absolute z-20 mt-2 w-full rounded-md border bg-background shadow-sm">
                      {loadingSuggestions ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Searching airports...</div>
                      ) : (
                        <ul className="max-h-56 overflow-auto">
                          {airportSuggestions.map((suggestion) => (
                            <li key={suggestion.icao}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => onApplySuggestion(suggestion)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                              >
                                <div className="font-semibold">{suggestion.icao}</div>
                                <div className="text-xs text-muted-foreground">
                                  {suggestion.name}
                                  {suggestion.city ? ` - ${suggestion.city}` : ""}
                                  {suggestion.state ? `, ${suggestion.state}` : ""}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {airportMeta && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {airportMeta.name ?? "Unknown airport"}
                      {airportLocation ? ` (${airportLocation})` : ""}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={!isValidIcao}
                className="w-full sm:w-auto"
              >
                {weatherFetching || runwayFetching || notamsFetching ? "Refreshing..." : "Update conditions"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card id="airport-weather" className="border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(12,22,34,0.96))] text-[#E8EDF4] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.76)]">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-[#F1F5FA]">{conditionsTitle}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={`text-white ${
                      flightCategory.color === "green"
                        ? "bg-green-600"
                        : flightCategory.color === "blue"
                          ? "bg-blue-600"
                          : flightCategory.color === "red"
                            ? "bg-red-600"
                            : "bg-purple-600"
                    }`}
                  >
                    {flightCategory.category}
                  </Badge>
                  {runwayInUseDisplay && (
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      Active RWY: {runwayInUseDisplay}
                    </Badge>
                  )}
                  {atisInfo && (
                    <Badge variant="outline" className="bg-sky-100 text-sky-800">
                      ATIS: {atisInfo}
                    </Badge>
                  )}
                  {weatherHazards.map((hazard) => (
                    <Badge
                      key={hazard.id}
                      variant="outline"
                      className={
                        hazard.tone === "red"
                          ? "border-red-300 bg-red-50 text-red-800"
                          : hazard.tone === "amber"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-sky-300 bg-sky-50 text-sky-800"
                      }
                    >
                      {hazard.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <CardDescription className="flex items-center gap-2 flex-wrap text-[#7A9BB8]">
                {weatherUpdatedAt && <span className="text-xs">Updated: {weatherUpdatedAt}</span>}
                {weather?.cached && <Badge variant="secondary" className="border-[#29415e] bg-[#0f1a28] text-[#D7E1EC] text-xs">Cached</Badge>}
                {(weatherLoading || weatherFetching) && <Badge variant="secondary" className="border-[#29415e] bg-[#0f1a28] text-[#D7E1EC]">Loading</Badge>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className={weatherHazards.length > 0 ? "border-[#6d5520] bg-[#271d0b]" : "border-[#365478] bg-[#10253b]"}>
                <AlertTriangle className={`h-4 w-4 ${weatherHazards.some((hazard) => hazard.tone === "red") ? "text-[#ff8c84]" : weatherHazards.length > 0 ? "text-[#ffd278]" : "text-[#8FC7FF]"}`} />
                <AlertDescription className="text-xs text-[#E8EDF4] sm:text-sm">
                  <strong>{flightCategory.category} is ceiling/visibility only.</strong>{" "}
                  {weatherHazards.length > 0
                    ? weatherHazards.map((hazard) => hazard.detail).join(" ")
                    : "No additional precipitation, convective, or runway-surface hazards are currently flagged from the METAR/TAF/NOTAM summary."}
                </AlertDescription>
              </Alert>
              {weather?.metar ? (
                <div>
                  <Label className="text-sm font-semibold text-[#DCE6F2]">METAR</Label>
                  <p className="mt-1 rounded-md border border-[#203249] bg-[#0d1622] p-3 text-sm text-[#F5A623]" style={{ fontFamily: "var(--font-mono)" }}>
                    {weather.metar.rawOb}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[#7A9BB8]">No METAR data available.</p>
              )}

              <Separator className="bg-[#1d3045]" />

              {weather?.taf ? (
                <div>
                  <Label className="text-sm font-semibold text-[#DCE6F2]">TAF (Forecast)</Label>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border border-[#203249] bg-[#0d1622] p-3 text-sm text-[#A9C7E6]" style={{ fontFamily: "var(--font-mono)" }}>
                    {weather.taf.rawTAF}
                  </p>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-semibold text-[#DCE6F2]">TAF (Forecast)</Label>
                  <p className="mt-1 text-sm text-[#7A9BB8]">No TAF data available.</p>
                </div>
              )}

              <div className="rounded-lg border border-[#203249] bg-[linear-gradient(180deg,#0d1622,#0a111a)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[#E8EDF4]">AI weather briefing</div>
                    <div className="text-xs text-[#7A9BB8]">
                      Summarize METAR and TAF into a plain-English briefing for this airport.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onToggleAiWeatherSummary}
                    className="w-full border-[#2a425f] bg-[#0f1825] text-[#D8E2ED] hover:bg-[#122033] hover:text-[#F2F6FB] sm:w-auto"
                  >
                    {showAiWeatherSummary ? "Hide AI summary" : "Open AI summary"}
                  </Button>
                </div>
                {showAiWeatherSummary && (
                  <div className="mt-3">
                    <WeatherBriefingSummarizer
                      metar={weather?.metar?.rawOb ?? ""}
                      taf={weather?.taf?.rawTAF ?? ""}
                      origin={searchIcao}
                    />
                  </div>
                )}
              </div>

              <Alert className="border-[#203249] bg-[#0d1622]">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs text-[#B9C9DA]">
                  <strong>Disclaimer:</strong> Planning use only. Always obtain an official weather briefing before flight.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card id="airport-briefing" className="border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(15,23,35,0.96))] text-[#E8EDF4] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.76)]">
            <CardHeader>
              <CardTitle className="text-[#F1F5FA]">Airport Briefing</CardTitle>
              <CardDescription className="text-[#7A9BB8]">Runway guidance and live NOTAMs for {searchIcao}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-semibold text-[#DCE6F2]">Runway Advisory</Label>
                  {runwayLoading && <Badge variant="secondary" className="border-[#29415e] bg-[#0f1a28] text-[#D7E1EC]">Loading runways</Badge>}
                </div>
                {(runwayInUseDisplay || atisInfo) && (
                  <div className="flex flex-wrap gap-2">
                    {runwayInUseDisplay && (
                      <Badge variant="outline" className="border-[#365478] bg-[#10253b] text-[#8FC7FF]">
                        Active RWY: {runwayInUseDisplay}
                      </Badge>
                    )}
                    {atisInfo && (
                      <Badge variant="outline" className="border-[#365478] bg-[#10253b] text-[#8FC7FF]">
                        ATIS: {atisInfo}
                      </Badge>
                    )}
                  </div>
                )}
                {runwayBriefing?.advisory ? (
                  <div className="rounded-lg border border-[#203249] bg-[#0d1622] p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#365478] bg-[#10253b] text-[#8FC7FF]">Recommended: {runwayBriefing.advisory.runway}</Badge>
                      <span className="text-[#B9C9DA]">
                        Headwind {runwayBriefing.advisory.headwind} kt - Crosswind {runwayBriefing.advisory.crosswind} kt
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#7A9BB8]">
                      Advisory only. ATC assigns runways; verify with ATIS and tower.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[#7A9BB8]">
                    Runway advisory unavailable. Check ATIS or tower for active runway.
                  </p>
                )}

                {runwayBriefing?.runways?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {runwayBriefing.runways.slice(0, 6).map((runway: any, index: number) => (
                      <div key={`${runway.leIdent}-${runway.heIdent}-${index}`} className="rounded-lg border border-[#203249] bg-[#0d1622] p-2 text-xs">
                        <div className="font-semibold text-[#E8EDF4]" style={{ fontFamily: "var(--font-mono)" }}>
                          {runway.leIdent || "--"} / {runway.heIdent || "--"}
                        </div>
                        <div className="text-[#7A9BB8]">
                          {runway.surface || "Surface N/A"} - {runway.lengthFt ? `${runway.lengthFt} ft` : "Length N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7A9BB8]">Runway details not available.</p>
                )}
              </div>

              <Separator className="bg-[#1d3045]" />

              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-sm font-semibold text-[#DCE6F2]">NOTAMs</Label>
                  {notamsLoading && <Badge variant="secondary" className="border-[#29415e] bg-[#0f1a28] text-[#D7E1EC]">Loading NOTAMs</Badge>}
                </div>
                {notamsError ? (
                  <p className="text-sm text-[#7A9BB8]">NOTAM feed unavailable.</p>
                ) : notams?.notams?.length ? (
                  <div className="space-y-2">
                    {notams.notams.slice(0, 6).map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-[#203249] bg-[#0d1622] p-3 text-xs space-y-1">
                        <div className="font-semibold text-[#E8EDF4]">{item.text}</div>
                        {(item.effective || item.expires) && (
                          <div className="text-[#7A9BB8]">
                            {item.effective ? `Effective ${item.effective}` : ""}{" "}
                            {item.expires ? `- Expires ${item.expires}` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#7A9BB8]">No active NOTAMs.</p>
                )}
                <p className="text-xs text-[#7A9BB8]">NOTAMs powered by FAA SWIM.</p>
              </div>

              <div className="rounded-lg border border-[#203249] bg-[linear-gradient(180deg,#0d1622,#0a111a)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[#E8EDF4]">AI NOTAM translator</div>
                    <div className="text-xs text-[#7A9BB8]">
                      Translate raw NOTAMs into plain-English operational and legality impacts.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onToggleAiNotamTranslator}
                    className="w-full border-[#2a425f] bg-[#0f1825] text-[#D8E2ED] hover:bg-[#122033] hover:text-[#F2F6FB] sm:w-auto"
                  >
                    {showAiNotamTranslator ? "Hide AI translator" : "Open AI translator"}
                  </Button>
                </div>
                {showAiNotamTranslator && (
                  <div className="mt-3">
                    <NotamTranslator
                      notams={notams?.notams?.map((item: any) => item.text ?? "").filter(Boolean).join("\n\n") ?? ""}
                      airport={searchIcao}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
