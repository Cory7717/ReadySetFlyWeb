import { useEffect, useMemo, useState } from "react";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/analytics";

type AbbreviationEntry = {
  term: string;
  meaning: string;
  category: string;
  note?: string;
};

const abbreviations: AbbreviationEntry[] = [
  { term: "A/C", meaning: "Aircraft", category: "Aircraft & Maintenance" },
  { term: "ACFT", meaning: "Aircraft", category: "Aircraft & Maintenance" },
  { term: "AD", meaning: "Airworthiness Directive", category: "Aircraft & Maintenance" },
  { term: "AFM", meaning: "Aircraft Flight Manual", category: "Aircraft & Maintenance" },
  { term: "AOG", meaning: "Aircraft on Ground", category: "Aircraft & Maintenance" },
  { term: "MEL", meaning: "Minimum Equipment List", category: "Aircraft & Maintenance" },
  { term: "MRO", meaning: "Maintenance, Repair, Overhaul", category: "Aircraft & Maintenance" },
  { term: "POH", meaning: "Pilot's Operating Handbook", category: "Aircraft & Maintenance" },
  { term: "STC", meaning: "Supplemental Type Certificate", category: "Aircraft & Maintenance" },
  { term: "TBO", meaning: "Time Between Overhaul", category: "Aircraft & Maintenance" },
  { term: "ADS-B", meaning: "Automatic Dependent Surveillance-Broadcast", category: "Avionics & Instruments" },
  { term: "CDI", meaning: "Course Deviation Indicator", category: "Avionics & Instruments" },
  { term: "EFIS", meaning: "Electronic Flight Instrument System", category: "Avionics & Instruments" },
  { term: "ELT", meaning: "Emergency Locator Transmitter", category: "Avionics & Instruments" },
  { term: "FIS-B", meaning: "Flight Information Service-Broadcast", category: "Avionics & Instruments" },
  { term: "HSI", meaning: "Horizontal Situation Indicator", category: "Avionics & Instruments" },
  { term: "MFD", meaning: "Multi-Function Display", category: "Avionics & Instruments" },
  { term: "OBS", meaning: "Omni Bearing Selector", category: "Avionics & Instruments" },
  { term: "PFD", meaning: "Primary Flight Display", category: "Avionics & Instruments" },
  { term: "PAPI", meaning: "Precision Approach Path Indicator", category: "Avionics & Instruments" },
  { term: "TAWS", meaning: "Terrain Awareness and Warning System", category: "Avionics & Instruments" },
  { term: "TCAS", meaning: "Traffic Collision Avoidance System", category: "Avionics & Instruments" },
  { term: "TIS-B", meaning: "Traffic Information Service-Broadcast", category: "Avionics & Instruments" },
  { term: "VASI", meaning: "Visual Approach Slope Indicator", category: "Avionics & Instruments" },
  { term: "AGL", meaning: "Above Ground Level", category: "Performance & Planning" },
  { term: "CG", meaning: "Center of Gravity", category: "Performance & Planning" },
  { term: "GS", meaning: "Ground Speed", category: "Performance & Planning" },
  { term: "IAS", meaning: "Indicated Airspeed", category: "Performance & Planning" },
  { term: "ISA", meaning: "International Standard Atmosphere", category: "Performance & Planning" },
  { term: "MSL", meaning: "Mean Sea Level", category: "Performance & Planning" },
  { term: "MTOW", meaning: "Maximum Takeoff Weight", category: "Performance & Planning" },
  { term: "OAT", meaning: "Outside Air Temperature", category: "Performance & Planning" },
  { term: "TAS", meaning: "True Airspeed", category: "Performance & Planning" },
  { term: "AWOS", meaning: "Automated Weather Observing System", category: "Weather" },
  { term: "ASOS", meaning: "Automated Surface Observing System", category: "Weather" },
  { term: "AIRMET", meaning: "Airmen's Meteorological Information", category: "Weather" },
  { term: "CAVU", meaning: "Ceiling and Visibility Unlimited", category: "Weather" },
  { term: "IFR", meaning: "Instrument Flight Rules", category: "Weather" },
  { term: "IMC", meaning: "Instrument Meteorological Conditions", category: "Weather" },
  { term: "LIFR", meaning: "Low Instrument Flight Rules", category: "Weather" },
  { term: "METAR", meaning: "Meteorological Aerodrome Report", category: "Weather" },
  { term: "MVFR", meaning: "Marginal Visual Flight Rules", category: "Weather" },
  { term: "PIREP", meaning: "Pilot Report", category: "Weather" },
  { term: "RVR", meaning: "Runway Visual Range", category: "Weather" },
  { term: "SIGMET", meaning: "Significant Meteorological Information", category: "Weather" },
  { term: "TAF", meaning: "Terminal Aerodrome Forecast", category: "Weather" },
  { term: "VFR", meaning: "Visual Flight Rules", category: "Weather" },
  { term: "VMC", meaning: "Visual Meteorological Conditions", category: "Weather" },
  { term: "ADF", meaning: "Automatic Direction Finder", category: "Navigation" },
  { term: "DA", meaning: "Decision Altitude", category: "Navigation" },
  { term: "DME", meaning: "Distance Measuring Equipment", category: "Navigation" },
  { term: "FAF", meaning: "Final Approach Fix", category: "Navigation" },
  { term: "G/S", meaning: "Glide Slope", category: "Navigation" },
  { term: "GPS", meaning: "Global Positioning System", category: "Navigation" },
  { term: "IAF", meaning: "Initial Approach Fix", category: "Navigation" },
  { term: "ILS", meaning: "Instrument Landing System", category: "Navigation" },
  { term: "LOC", meaning: "Localizer", category: "Navigation" },
  { term: "MAP", meaning: "Missed Approach Point", category: "Navigation" },
  { term: "MDA", meaning: "Minimum Descent Altitude", category: "Navigation" },
  { term: "MEA", meaning: "Minimum Enroute Altitude", category: "Navigation" },
  { term: "MOCA", meaning: "Minimum Obstruction Clearance Altitude", category: "Navigation" },
  { term: "MSA", meaning: "Minimum Safe Altitude", category: "Navigation" },
  { term: "MVA", meaning: "Minimum Vectoring Altitude", category: "Navigation" },
  { term: "NDB", meaning: "Non-Directional Beacon", category: "Navigation" },
  { term: "ODP", meaning: "Obstacle Departure Procedure", category: "Navigation" },
  { term: "RNAV", meaning: "Area Navigation", category: "Navigation" },
  { term: "RNP", meaning: "Required Navigation Performance", category: "Navigation" },
  { term: "SID", meaning: "Standard Instrument Departure", category: "Navigation" },
  { term: "STAR", meaning: "Standard Terminal Arrival Route", category: "Navigation" },
  { term: "VOR", meaning: "VHF Omnidirectional Range", category: "Navigation" },
  { term: "WAAS", meaning: "Wide Area Augmentation System", category: "Navigation" },
  { term: "ATC", meaning: "Air Traffic Control", category: "Airspace & ATC" },
  { term: "ATIS", meaning: "Automatic Terminal Information Service", category: "Airspace & ATC" },
  { term: "CTAF", meaning: "Common Traffic Advisory Frequency", category: "Airspace & ATC" },
  { term: "FDC", meaning: "Flight Data Center (NOTAMs)", category: "Airspace & ATC" },
  { term: "FSS", meaning: "Flight Service Station", category: "Airspace & ATC" },
  { term: "MOA", meaning: "Military Operations Area", category: "Airspace & ATC" },
  { term: "NOTAM", meaning: "Notice to Air Missions", category: "Airspace & ATC" },
  { term: "SFRA", meaning: "Special Flight Rules Area", category: "Airspace & ATC" },
  { term: "SUA", meaning: "Special Use Airspace", category: "Airspace & ATC" },
  { term: "TFR", meaning: "Temporary Flight Restriction", category: "Airspace & ATC" },
  { term: "TRACON", meaning: "Terminal Radar Approach Control", category: "Airspace & ATC" },
  { term: "TRSA", meaning: "Terminal Radar Service Area", category: "Airspace & ATC" },
  { term: "UNICOM", meaning: "Aeronautical advisory frequency", category: "Airspace & ATC" },
  { term: "AIM", meaning: "Aeronautical Information Manual", category: "Regulations & Training" },
  { term: "ACS", meaning: "Airman Certification Standards", category: "Regulations & Training" },
  { term: "ATP", meaning: "Airline Transport Pilot", category: "Regulations & Training" },
  { term: "CFR", meaning: "Code of Federal Regulations", category: "Regulations & Training" },
  { term: "CFI", meaning: "Certified Flight Instructor", category: "Regulations & Training" },
  { term: "CFII", meaning: "Certified Flight Instructor - Instrument", category: "Regulations & Training" },
  { term: "CPL", meaning: "Commercial Pilot License", category: "Regulations & Training" },
  { term: "DPE", meaning: "Designated Pilot Examiner", category: "Regulations & Training" },
  { term: "FAA", meaning: "Federal Aviation Administration", category: "Regulations & Training" },
  { term: "FAR", meaning: "Federal Aviation Regulations", category: "Regulations & Training" },
  { term: "ICAO", meaning: "International Civil Aviation Organization", category: "Regulations & Training" },
  { term: "MEI", meaning: "Multi-Engine Instructor", category: "Regulations & Training" },
  { term: "PPL", meaning: "Private Pilot License", category: "Regulations & Training" },
  { term: "PTS", meaning: "Practical Test Standards (legacy)", category: "Regulations & Training" },
  { term: "Part 61", meaning: "Certification: pilots and instructors", category: "Regulations & Training" },
  { term: "Part 91", meaning: "General operating and flight rules", category: "Regulations & Training" },
  { term: "Part 121", meaning: "Scheduled air carrier operations", category: "Regulations & Training" },
  { term: "Part 135", meaning: "Commuter and on-demand operations", category: "Regulations & Training" },
  { term: "Part 141", meaning: "Pilot schools", category: "Regulations & Training" },
  { term: "Part 145", meaning: "Repair stations", category: "Regulations & Training" },
  { term: "Part 147", meaning: "Aviation maintenance technician schools", category: "Regulations & Training" },
  { term: "AIP", meaning: "Aeronautical Information Publication", category: "Regulations & Training" },
  { term: "AFD", meaning: "Chart Supplement (formerly Airport/Facility Directory)", category: "Regulations & Training" },
  { term: "CRM", meaning: "Crew Resource Management", category: "Operations & Safety" },
  { term: "FOD", meaning: "Foreign Object Debris/Damage", category: "Operations & Safety" },
  { term: "LAHSO", meaning: "Land and Hold Short Operations", category: "Operations & Safety" },
  { term: "PIC", meaning: "Pilot in Command", category: "Operations & Safety" },
  { term: "RFFS", meaning: "Rescue and Fire Fighting Services", category: "Operations & Safety" },
  { term: "RESA", meaning: "Runway End Safety Area", category: "Operations & Safety" },
  { term: "RVSM", meaning: "Reduced Vertical Separation Minimum", category: "Operations & Safety" },
  { term: "SIC", meaning: "Second in Command", category: "Operations & Safety" },
  { term: "SMS", meaning: "Safety Management System", category: "Operations & Safety" },
  { term: "SOP", meaning: "Standard Operating Procedure", category: "Operations & Safety" },
];

const SORTED_ABBREVIATIONS = [...abbreviations].sort((a, b) => a.term.localeCompare(b.term));

export default function StudentAbbreviations() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<"study" | "quiz">("study");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    trackEvent("student_page_view", { page: "abbreviations" });
  }, []);

  const categories = useMemo(() => {
    const set = new Set(SORTED_ABBREVIATIONS.map((item) => item.category));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return SORTED_ABBREVIATIONS.filter((item) => {
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!normalized) return true;
      return (
        item.term.toLowerCase().includes(normalized) ||
        item.meaning.toLowerCase().includes(normalized) ||
        (item.note && item.note.toLowerCase().includes(normalized))
      );
    });
  }, [query, selectedCategory]);

  const toggleReveal = (term: string) => {
    setRevealed((prev) => ({ ...prev, [term]: !prev[term] }));
  };

  const revealAll = () => {
    const next: Record<string, boolean> = {};
    filtered.forEach((item) => {
      next[item.term] = true;
    });
    setRevealed(next);
  };

  const resetQuiz = () => setRevealed({});

  return (
    <StudentLayout
      title="Aviation Abbreviations Trainer"
      subtitle="RSF-built glossary for student pilots. Use study mode for reference or quiz mode to test yourself."
    >
      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search abbreviations or definitions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="outline" onClick={() => setQuery("")} className="sm:w-auto">
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Filter by category:</span>
          {categories.map((category) => (
            <Button
              key={category}
              size="sm"
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory((prev) => (prev === category ? null : category))}
            >
              {category}
            </Button>
          ))}
          {selectedCategory && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedCategory(null)}>
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Mode:</span>
          <Button size="sm" variant={mode === "study" ? "default" : "outline"} onClick={() => setMode("study")}>
            Study
          </Button>
          <Button size="sm" variant={mode === "quiz" ? "default" : "outline"} onClick={() => setMode("quiz")}>
            Quiz
          </Button>
          {mode === "quiz" && (
            <>
              <Button size="sm" variant="outline" onClick={revealAll}>
                Reveal all
              </Button>
              <Button size="sm" variant="ghost" onClick={resetQuiz}>
                Reset
              </Button>
            </>
          )}
          <Badge variant="outline">{filtered.length} items</Badge>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((item) => {
          const showDefinition = mode === "study" || revealed[item.term];
          return (
            <Card
              key={`${item.term}-${item.meaning}`}
              className={`p-4 space-y-2 ${mode === "quiz" ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (mode === "quiz") toggleReveal(item.term);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-lg font-semibold">{item.term}</div>
                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
              </div>
              {showDefinition ? (
                <div className="text-sm text-muted-foreground">{item.meaning}</div>
              ) : (
                <div className="text-sm text-muted-foreground italic">Tap to reveal definition.</div>
              )}
              {item.note && showDefinition && (
                <div className="text-xs text-muted-foreground">{item.note}</div>
              )}
            </Card>
          );
        })}
      </div>
    </StudentLayout>
  );
}
