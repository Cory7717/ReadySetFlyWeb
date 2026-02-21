import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { OutputModeSelector, type OutputDefinition } from "@/components/tools/OutputModeSelector";
import { ResultTiles, type ResultTile } from "@/components/tools/ResultTiles";
import {
  calcDensityAltitude,
  calcEnduranceHours,
  calcGroundSpeed,
  calcPressureAltitude,
  calcRangeNm,
  calcTAS,
  calcTrueHeading,
  calcWindComponents,
  calcWca,
} from "@/lib/calculators/eb6";
import {
  type Eb6OutputMode,
  readLocalEb6Prefs,
  writeLocalEb6Prefs,
  fetchEb6Prefs,
  saveEb6Prefs,
} from "@/lib/prefs/eb6Prefs";

const QUICK_OUTPUTS = [
  "pressure_altitude",
  "density_altitude",
  "tas",
  "gs",
  "wind_components",
  "endurance",
];

const ADVANCED_OUTPUTS = [
  ...QUICK_OUTPUTS,
  "wca",
  "true_heading",
  "range",
];

const OUTPUT_GROUPS: Array<{ title: string; outputs: OutputDefinition[] }> = [
  {
    title: "Altitude",
    outputs: [
      { id: "pressure_altitude", label: "Pressure Altitude (PA)", group: "Altitude" },
      { id: "density_altitude", label: "Density Altitude (DA)", group: "Altitude" },
    ],
  },
  {
    title: "Speed",
    outputs: [
      { id: "tas", label: "True Airspeed (TAS)", group: "Speed" },
      { id: "gs", label: "Groundspeed (GS)", group: "Speed" },
    ],
  },
  {
    title: "Wind / Nav",
    outputs: [
      { id: "wind_components", label: "Headwind / Crosswind", group: "Wind" },
      { id: "wca", label: "Wind Correction Angle (WCA)", group: "Wind" },
      { id: "true_heading", label: "True Heading (TH)", group: "Wind" },
    ],
  },
  {
    title: "Fuel",
    outputs: [
      { id: "endurance", label: "Endurance", group: "Fuel" },
      { id: "range", label: "Range", group: "Fuel" },
    ],
  },
];

const ALL_OUTPUTS = OUTPUT_GROUPS.flatMap((group) => group.outputs.map((output) => output.id));

const toNumber = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
};

const formatValue = (value: number | null, digits = 1) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
};

const formatValueInt = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString();
};

export default function Eb6Calculator() {
  const { isAuthenticated } = useAuth();
  const [altimeter, setAltimeter] = useState("29.92");
  const [fieldElevation, setFieldElevation] = useState("0");
  const [oat, setOat] = useState("15");
  const [kias, setKias] = useState("110");
  const [windDirection, setWindDirection] = useState("180");
  const [windSpeed, setWindSpeed] = useState("10");
  const [trueCourse, setTrueCourse] = useState("180");
  const [fuelBurn, setFuelBurn] = useState("10");
  const [fuelAvailable, setFuelAvailable] = useState("30");
  const [outputMode, setOutputMode] = useState<Eb6OutputMode>("quick");
  const [customOutputs, setCustomOutputs] = useState<string[]>(QUICK_OUTPUTS);
  const [loadedPrefs, setLoadedPrefs] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const debouncedInputs = useDebouncedValue(
    {
      altimeter,
      fieldElevation,
      oat,
      kias,
      windDirection,
      windSpeed,
      trueCourse,
      fuelBurn,
      fuelAvailable,
    },
    250
  );

  useEffect(() => {
    trackEvent("tool_view", { tool: "e6b" });
  }, []);

  useEffect(() => {
    if (!loadedPrefs) return;
    trackEvent("tool_setting_change", { tool: "e6b", setting: "mode", value: outputMode });
  }, [outputMode, loadedPrefs]);

  useEffect(() => {
    if (!loadedPrefs || outputMode !== "custom") return;
    const handle = window.setTimeout(() => {
      trackEvent("tool_setting_change", {
        tool: "e6b",
        setting: "custom_outputs",
        value: customOutputs.length,
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [customOutputs, outputMode, loadedPrefs]);

  useEffect(() => {
    let isMounted = true;

    const loadPrefs = async () => {
      let prefs = readLocalEb6Prefs();
      if (isAuthenticated) {
        const apiPrefs = await fetchEb6Prefs();
        if (apiPrefs) prefs = apiPrefs;
      }
      if (prefs && isMounted) {
        const sanitized = prefs.outputs.filter((output) => ALL_OUTPUTS.includes(output));
        setOutputMode(prefs.mode);
        setCustomOutputs(sanitized.length ? sanitized : QUICK_OUTPUTS);
      }
      if (isMounted) setLoadedPrefs(true);
    };

    loadPrefs();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!loadedPrefs) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const prefs = { mode: outputMode, outputs: customOutputs };
      writeLocalEb6Prefs(prefs);
      if (isAuthenticated) {
        try {
          await saveEb6Prefs(prefs);
        } catch {
          writeLocalEb6Prefs(prefs);
        }
      }
    }, 500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [outputMode, customOutputs, isAuthenticated, loadedPrefs]);

  const selectedOutputs = outputMode === "quick"
    ? QUICK_OUTPUTS
    : outputMode === "advanced"
      ? ADVANCED_OUTPUTS
      : customOutputs;

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    const altimeterValue = toNumber(debouncedInputs.altimeter);
    if (altimeterValue === null) next.altimeter = "Required";
    else if (altimeterValue < 27 || altimeterValue > 32) next.altimeter = "Use 27.00 - 32.00 inHg";

    const elevationValue = toNumber(debouncedInputs.fieldElevation);
    if (elevationValue === null) next.fieldElevation = "Required";
    else if (elevationValue < -1000 || elevationValue > 20000) next.fieldElevation = "Use -1000 to 20000 ft";

    const oatValue = toNumber(debouncedInputs.oat);
    if (oatValue === null) next.oat = "Required";
    else if (oatValue < -60 || oatValue > 60) next.oat = "Use -60 to 60 C";

    const kiasValue = toNumber(debouncedInputs.kias);
    if (kiasValue === null) next.kias = "Required";
    else if (kiasValue < 40 || kiasValue > 300) next.kias = "Use 40 to 300 KIAS";

    const windDirValue = toNumber(debouncedInputs.windDirection);
    if (windDirValue === null) next.windDirection = "Required";
    else if (windDirValue < 0 || windDirValue > 360) next.windDirection = "Use 0 to 360";

    const windSpeedValue = toNumber(debouncedInputs.windSpeed);
    if (windSpeedValue === null) next.windSpeed = "Required";
    else if (windSpeedValue < 0 || windSpeedValue > 100) next.windSpeed = "Use 0 to 100 kt";

    const courseValue = toNumber(debouncedInputs.trueCourse);
    if (courseValue === null) next.trueCourse = "Required";
    else if (courseValue < 0 || courseValue > 360) next.trueCourse = "Use 0 to 360";

    const fuelBurnValue = toNumber(debouncedInputs.fuelBurn);
    if (fuelBurnValue !== null && (fuelBurnValue < 0 || fuelBurnValue > 100)) next.fuelBurn = "Use 0 to 100 GPH";

    const fuelAvailableValue = toNumber(debouncedInputs.fuelAvailable);
    if (fuelAvailableValue !== null && (fuelAvailableValue < 0 || fuelAvailableValue > 200)) next.fuelAvailable = "Use 0 to 200 gal";

    return next;
  }, [debouncedInputs]);

  const hasRequiredInputs = !errors.altimeter && !errors.fieldElevation && !errors.oat && !errors.kias && !errors.windDirection && !errors.windSpeed && !errors.trueCourse;

  const results = useMemo(() => {
    if (!hasRequiredInputs) return [] as ResultTile[];

    const altimeterValue = toNumber(debouncedInputs.altimeter) ?? 0;
    const elevationValue = toNumber(debouncedInputs.fieldElevation) ?? 0;
    const oatValue = toNumber(debouncedInputs.oat) ?? 0;
    const kiasValue = toNumber(debouncedInputs.kias) ?? 0;
    const windDirValue = toNumber(debouncedInputs.windDirection) ?? 0;
    const windSpeedValue = toNumber(debouncedInputs.windSpeed) ?? 0;
    const courseValue = toNumber(debouncedInputs.trueCourse) ?? 0;
    const fuelBurnValue = toNumber(debouncedInputs.fuelBurn) ?? null;
    const fuelAvailableValue = toNumber(debouncedInputs.fuelAvailable) ?? null;

    const pressureAltitude = calcPressureAltitude(altimeterValue, elevationValue);
    const densityAltitude = calcDensityAltitude(pressureAltitude, oatValue, elevationValue);
    const tas = calcTAS(kiasValue, densityAltitude);
    const wind = calcWindComponents(windDirValue, windSpeedValue, courseValue);
    const gs = calcGroundSpeed(tas, wind.headwind);
    const wca = calcWca(wind.crosswind, tas);
    const trueHeading = calcTrueHeading(courseValue, wca);
    const endurance = fuelBurnValue !== null && fuelAvailableValue !== null ? calcEnduranceHours(fuelAvailableValue, fuelBurnValue) : null;
    const range = calcRangeNm(gs, endurance);

    const crosswindDir = wind.crosswind > 0 ? "from right" : wind.crosswind < 0 ? "from left" : "calm";
    const headwindLabel = wind.headwind >= 0 ? "headwind" : "tailwind";

    const map: Record<string, ResultTile> = {
      pressure_altitude: {
        id: "pressure_altitude",
        label: "Pressure Altitude",
        value: formatValueInt(pressureAltitude),
        unit: "ft",
      },
      density_altitude: {
        id: "density_altitude",
        label: "Density Altitude",
        value: formatValueInt(densityAltitude),
        unit: "ft",
        helper: "Estimate",
      },
      tas: {
        id: "tas",
        label: "True Airspeed",
        value: formatValue(tas, 1),
        unit: "kt",
        helper: "Estimate",
      },
      gs: {
        id: "gs",
        label: "Groundspeed",
        value: formatValue(gs, 1),
        unit: "kt",
      },
      wind_components: {
        id: "wind_components",
        label: "Wind Components",
        value: `H ${formatValue(Math.abs(wind.headwind), 1)} / X ${formatValue(Math.abs(wind.crosswind), 1)}`,
        unit: "kt",
        helper: `${headwindLabel} · crosswind ${crosswindDir}`,
      },
      wca: {
        id: "wca",
        label: "Wind Correction Angle",
        value: formatValue(wca, 1),
        unit: "deg",
      },
      true_heading: {
        id: "true_heading",
        label: "True Heading",
        value: formatValue(trueHeading, 0),
        unit: "deg",
      },
      endurance: {
        id: "endurance",
        label: "Endurance",
        value: endurance === null ? "--" : formatValue(endurance, 2),
        unit: "hrs",
        helper: endurance === null ? "Add fuel available + burn" : undefined,
      },
      range: {
        id: "range",
        label: "Range",
        value: range === null ? "--" : formatValue(range, 1),
        unit: "nm",
        helper: range === null ? "Requires endurance" : undefined,
      },
    };

    return selectedOutputs.filter((output) => map[output]).map((output) => map[output]);
  }, [debouncedInputs, hasRequiredInputs, selectedOutputs]);

  const missingMessage = !hasRequiredInputs ? "Enter required fields to compute results." : null;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">e6b advanced</h1>
        <p className="text-muted-foreground">Performance + wind + fuel - fast answers with configurable outputs.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Required fields drive the core e6b outputs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Altimeter setting (inHg)</Label>
                <Input value={altimeter} onChange={(event) => setAltimeter(event.target.value)} />
                {errors.altimeter && <div className="text-xs text-destructive">{errors.altimeter}</div>}
              </div>
              <div className="space-y-1">
                <Label>Field elevation (ft)</Label>
                <Input value={fieldElevation} onChange={(event) => setFieldElevation(event.target.value)} />
                {errors.fieldElevation && <div className="text-xs text-destructive">{errors.fieldElevation}</div>}
              </div>
              <div className="space-y-1">
                <Label>OAT (C)</Label>
                <Input value={oat} onChange={(event) => setOat(event.target.value)} />
                {errors.oat && <div className="text-xs text-destructive">{errors.oat}</div>}
              </div>
              <div className="space-y-1">
                <Label>Indicated airspeed (KIAS)</Label>
                <Input value={kias} onChange={(event) => setKias(event.target.value)} />
                {errors.kias && <div className="text-xs text-destructive">{errors.kias}</div>}
              </div>
              <div className="space-y-1">
                <Label>Wind direction (deg)</Label>
                <Input value={windDirection} onChange={(event) => setWindDirection(event.target.value)} />
                {errors.windDirection && <div className="text-xs text-destructive">{errors.windDirection}</div>}
              </div>
              <div className="space-y-1">
                <Label>Wind speed (kt)</Label>
                <Input value={windSpeed} onChange={(event) => setWindSpeed(event.target.value)} />
                {errors.windSpeed && <div className="text-xs text-destructive">{errors.windSpeed}</div>}
              </div>
              <div className="space-y-1">
                <Label>True course (deg)</Label>
                <Input value={trueCourse} onChange={(event) => setTrueCourse(event.target.value)} />
                {errors.trueCourse && <div className="text-xs text-destructive">{errors.trueCourse}</div>}
              </div>
              <div className="space-y-1">
                <Label>Fuel burn (GPH)</Label>
                <Input value={fuelBurn} onChange={(event) => setFuelBurn(event.target.value)} />
                {errors.fuelBurn && <div className="text-xs text-destructive">{errors.fuelBurn}</div>}
              </div>
              <div className="space-y-1">
                <Label>Fuel available (gal)</Label>
                <Input value={fuelAvailable} onChange={(event) => setFuelAvailable(event.target.value)} />
                {errors.fuelAvailable && <div className="text-xs text-destructive">{errors.fuelAvailable}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Choose Quick, Advanced, or Custom outputs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OutputModeSelector
              mode={outputMode}
              selectedOutputs={customOutputs}
              outputGroups={OUTPUT_GROUPS}
              onModeChange={setOutputMode}
              onOutputsChange={setCustomOutputs}
              onSelectAll={() => setCustomOutputs(ALL_OUTPUTS)}
              onResetQuick={() => setCustomOutputs(QUICK_OUTPUTS)}
            />

            {missingMessage && (
              <Alert>
                <AlertDescription>{missingMessage}</AlertDescription>
              </Alert>
            )}

            {!missingMessage && results.length === 0 && (
              <Alert>
                <AlertDescription>Select outputs to view results.</AlertDescription>
              </Alert>
            )}

            {!missingMessage && results.length > 0 && <ResultTiles results={results} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
