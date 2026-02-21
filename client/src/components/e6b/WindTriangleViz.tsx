import { cn } from "@/lib/utils";
import type { WindTriangleResult } from "@/lib/e6b/windTriangle";

type WindTriangleVizProps = {
  data: WindTriangleResult;
  className?: string;
};

const formatNumber = (value: number | null, digits = 1) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
};

const formatHeading = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  const rounded = Math.round(value) % 360;
  return rounded.toString().padStart(3, "0");
};

const formatWca = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "--";
  const direction = value > 0 ? "R" : value < 0 ? "L" : "";
  return `${Math.abs(value).toFixed(1)} deg${direction ? ` ${direction}` : ""}`;
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const vectorFromDegrees = (deg: number, length: number, cx: number, cy: number) => {
  const rad = toRadians(deg);
  return {
    x: cx + Math.sin(rad) * length,
    y: cy - Math.cos(rad) * length,
  };
};

export default function WindTriangleViz({ data, className }: WindTriangleVizProps) {
  const size = 240;
  const center = size / 2;
  const baseLength = 90;

  const tas = data.tasKt ?? null;
  const windSpeed = data.windSpeedKt ?? null;
  const groundSpeed = data.groundSpeedKt ?? null;

  const scaleBase = tas && tas > 0 ? tas : 100;
  const windLength = windSpeed ? Math.min(baseLength * 0.9, baseLength * (windSpeed / scaleBase)) : 0;
  const groundLength = groundSpeed && tas ? baseLength * (groundSpeed / tas) : baseLength;

  const courseDeg = data.courseDeg;
  const headingDeg = data.headingDeg;
  const windDirDeg = data.windDirDeg;
  const windToDeg = windDirDeg !== null ? (windDirDeg + 180) % 360 : null;

  const courseVector = courseDeg !== null ? vectorFromDegrees(courseDeg, baseLength, center, center) : null;
  const headingVector = headingDeg !== null ? vectorFromDegrees(headingDeg, baseLength, center, center) : null;
  const windVector = windToDeg !== null ? vectorFromDegrees(windToDeg, windLength, center, center) : null;
  const groundVector = courseDeg !== null ? vectorFromDegrees(courseDeg, groundLength, center, center) : null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border bg-muted/20 p-4">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-auto"
          role="img"
          aria-label="Interactive wind triangle visualization"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <circle cx={center} cy={center} r={2} className="fill-muted-foreground/60" />
          <circle cx={center} cy={center} r={baseLength} className="stroke-muted-foreground/20 fill-none" />
          {courseVector && (
            <line
              x1={center}
              y1={center}
              x2={courseVector.x}
              y2={courseVector.y}
              className="stroke-sky-500"
              strokeWidth="3"
              markerEnd="url(#arrow)"
            />
          )}
          {headingVector && (
            <line
              x1={center}
              y1={center}
              x2={headingVector.x}
              y2={headingVector.y}
              className="stroke-amber-500"
              strokeWidth="3"
              markerEnd="url(#arrow)"
            />
          )}
          {windVector && (
            <line
              x1={center}
              y1={center}
              x2={windVector.x}
              y2={windVector.y}
              className="stroke-emerald-500"
              strokeWidth="2.5"
              markerEnd="url(#arrow)"
            />
          )}
          {groundVector && (
            <line
              x1={center}
              y1={center}
              x2={groundVector.x}
              y2={groundVector.y}
              className="stroke-indigo-500"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              markerEnd="url(#arrow)"
            />
          )}
        </svg>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Course
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Heading (air vector)
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Wind (to)
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Ground track
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-lg border bg-background p-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">WCA</div>
          <div className="text-lg font-semibold">{formatWca(data.wcaDeg)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Heading</div>
          <div className="text-lg font-semibold">{formatHeading(data.headingDeg)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Ground Speed</div>
          <div className="text-lg font-semibold">{formatNumber(data.groundSpeedKt, 1)} kt</div>
        </div>
      </div>
    </div>
  );
}
