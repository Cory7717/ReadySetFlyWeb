import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/api";

export type CabinBriefAirportOption = {
  icao: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
};

type CabinBriefSearchPayload = {
  from: CabinBriefAirportOption;
  to: CabinBriefAirportOption;
  date: string;
};

type CabinBriefSearchFormProps = {
  initialFrom?: CabinBriefAirportOption | null;
  initialTo?: CabinBriefAirportOption | null;
  initialDate?: string;
  submitLabel?: string;
  theme?: "light" | "dark";
  onSubmit: (payload: CabinBriefSearchPayload) => void;
  className?: string;
};

function formatAirportOption(option: CabinBriefAirportOption) {
  const place = [option.city, option.state].filter(Boolean).join(", ");
  const name = option.name || option.icao;
  return place ? `${place} - ${name} (${option.icao})` : `${name} (${option.icao})`;
}

async function lookupAirports(query: string) {
  const res = await fetch(apiUrl(`/api/airports/search?q=${encodeURIComponent(query)}`));
  if (!res.ok) return [] as CabinBriefAirportOption[];
  return (await res.json()) as CabinBriefAirportOption[];
}

export default function CabinBriefSearchForm({
  initialFrom = null,
  initialTo = null,
  initialDate,
  submitLabel = "Get My Cabin Brief",
  theme = "light",
  onSubmit,
  className = "",
}: CabinBriefSearchFormProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fromInput, setFromInput] = useState(initialFrom ? formatAirportOption(initialFrom) : "");
  const [toInput, setToInput] = useState(initialTo ? formatAirportOption(initialTo) : "");
  const [selectedFrom, setSelectedFrom] = useState<CabinBriefAirportOption | null>(initialFrom);
  const [selectedTo, setSelectedTo] = useState<CabinBriefAirportOption | null>(initialTo);
  const [fromSuggestions, setFromSuggestions] = useState<CabinBriefAirportOption[]>([]);
  const [toSuggestions, setToSuggestions] = useState<CabinBriefAirportOption[]>([]);
  const [loadingFrom, setLoadingFrom] = useState(false);
  const [loadingTo, setLoadingTo] = useState(false);
  const [date, setDate] = useState(initialDate || today);

  useEffect(() => {
    if (!initialFrom) return;
    setSelectedFrom(initialFrom);
    setFromInput(formatAirportOption(initialFrom));
  }, [initialFrom]);

  useEffect(() => {
    if (!initialTo) return;
    setSelectedTo(initialTo);
    setToInput(formatAirportOption(initialTo));
  }, [initialTo]);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const isDark = theme === "dark";
  const labelClassName = isDark
    ? "text-xs font-semibold uppercase tracking-[0.18em] text-[#8FB7DA]"
    : "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground";
  const inputClassName = isDark
    ? "border-[#29415e] bg-[#0f1825] pr-10 text-[#E8EDF4] placeholder:text-[#6D88A6] focus-visible:border-[#3a638f] focus-visible:ring-[#3a638f]/30"
    : "pr-10";
  const searchIconClassName = isDark
    ? "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7EA8CC]"
    : "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground";
  const menuClassName = isDark
    ? "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-xl border border-[#29415e] bg-[#0c1520]/98 p-1 shadow-lg backdrop-blur"
    : "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-xl border border-white/10 bg-background/95 p-1 shadow-lg backdrop-blur";
  const menuItemClassName = isDark
    ? "flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#D9E3EE] transition-colors hover:bg-[#132234]"
    : "flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted";
  const hintClassName = isDark ? "mt-2 text-xs text-[#6D88A6]" : "mt-2 text-xs text-muted-foreground";
  const buttonClassName = isDark
    ? "w-full bg-[#1E57C8] text-white hover:bg-[#2966df]"
    : "w-full";

  useEffect(() => {
    const query = fromInput.trim();
    if (query.length < 2 || (selectedFrom && query === formatAirportOption(selectedFrom))) {
      setFromSuggestions([]);
      setLoadingFrom(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoadingFrom(true);
      try {
        const results = await lookupAirports(query);
        setFromSuggestions(results.slice(0, 6));
      } finally {
        setLoadingFrom(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [fromInput, selectedFrom]);

  useEffect(() => {
    const query = toInput.trim();
    if (query.length < 2 || (selectedTo && query === formatAirportOption(selectedTo))) {
      setToSuggestions([]);
      setLoadingTo(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoadingTo(true);
      try {
        const results = await lookupAirports(query);
        setToSuggestions(results.slice(0, 6));
      } finally {
        setLoadingTo(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [toInput, selectedTo]);

  const canSubmit = Boolean(selectedFrom?.icao && selectedTo?.icao);

  return (
    <div className={className}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
        <div className="space-y-2">
          <Label className={labelClassName}>
            Flying from
          </Label>
          <div className="relative">
            <Input
              value={fromInput}
              onChange={(event) => {
                setFromInput(event.target.value);
                setSelectedFrom(null);
              }}
              placeholder="Flying from - city or airport"
              className={inputClassName}
            />
            <Search className={searchIconClassName} />
            {(loadingFrom || fromSuggestions.length > 0) && (
              <div className={menuClassName}>
                {loadingFrom ? (
                  <div className={`px-3 py-2 text-sm ${isDark ? "text-[#8FB7DA]" : "text-muted-foreground"}`}>Searching airports...</div>
                ) : (
                  fromSuggestions.map((option) => (
                    <button
                      key={`from-${option.icao}`}
                      type="button"
                      className={menuItemClassName}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSelectedFrom(option);
                        setFromInput(formatAirportOption(option));
                        setFromSuggestions([]);
                      }}
                    >
                      {formatAirportOption(option)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className={labelClassName}>
            Flying to
          </Label>
          <div className="relative">
            <Input
              value={toInput}
              onChange={(event) => {
                setToInput(event.target.value);
                setSelectedTo(null);
              }}
              placeholder="Flying to - city or airport"
              className={inputClassName}
            />
            <Search className={searchIconClassName} />
            {(loadingTo || toSuggestions.length > 0) && (
              <div className={menuClassName}>
                {loadingTo ? (
                  <div className={`px-3 py-2 text-sm ${isDark ? "text-[#8FB7DA]" : "text-muted-foreground"}`}>Searching airports...</div>
                ) : (
                  toSuggestions.map((option) => (
                    <button
                      key={`to-${option.icao}`}
                      type="button"
                      className={menuItemClassName}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSelectedTo(option);
                        setToInput(formatAirportOption(option));
                        setToSuggestions([]);
                      }}
                    >
                      {formatAirportOption(option)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className={labelClassName}>
            Date
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value || today)}
            className={isDark ? "border-[#29415e] bg-[#0f1825] text-[#E8EDF4] focus-visible:border-[#3a638f] focus-visible:ring-[#3a638f]/30" : undefined}
          />
        </div>

        <div className="flex items-end">
          <Button
            className={buttonClassName}
            disabled={!canSubmit}
            onClick={() => {
              if (!selectedFrom || !selectedTo) return;
              onSubmit({
                from: selectedFrom,
                to: selectedTo,
                date: date || today,
              });
            }}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
      <div className={hintClassName}>
        Start with city names or airport names. Pick the airport you mean from the list so the briefing uses the right route.
      </div>
    </div>
  );
}
