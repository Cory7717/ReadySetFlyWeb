import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Search } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface PlateRecord {
  name: string;
  type: string;
  effectiveDate?: string | null;
  url: string;
}

export default function ApproachPlates() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("approaches");

  const { data, isLoading } = useQuery<{ plates: PlateRecord[]; icao?: string }>(
    {
      queryKey: ["/api/plates", searchTerm],
      queryFn: async () => {
        if (!searchTerm) {
          return { plates: [] };
        }
        const url = apiUrl(`/api/plates/${encodeURIComponent(searchTerm)}`);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load approach plates");
        return res.json();
      },
    }
  );

  const plates = data?.plates || [];
  const normalizedQuery = searchTerm.trim().toUpperCase();

  const categorizePlate = (plate: PlateRecord) => {
    const type = (plate.type || "").toUpperCase();
    const name = (plate.name || "").toUpperCase();

    if (["SID", "DP"].includes(type) || name.includes("SID") || name.includes("DEPARTURE")) {
      return "departures";
    }
    if (type.includes("STAR") || name.includes("STAR") || name.includes("ARRIVAL")) {
      return "arrivals";
    }
    if (
      type.includes("AIRPORT") ||
      ["APD", "DIAGRAM", "HOT", "LAHSO", "PARKING"].some((token) => type.includes(token)) ||
      name.includes("AIRPORT DIAGRAM") ||
      name.includes("AIRPORT")
    ) {
      return "airport";
    }
    if (
      ["IAP", "APP", "APCH"].some((token) => type.includes(token)) ||
      ["ILS", "RNAV", "VOR", "LOC", "LDA", "NDB", "TACAN", "GPS"].some((token) => name.includes(token))
    ) {
      return "approaches";
    }
    return "other";
  };

  const groupedPlates = useMemo(() => {
    const grouped = {
      approaches: [] as PlateRecord[],
      departures: [] as PlateRecord[],
      arrivals: [] as PlateRecord[],
      airport: [] as PlateRecord[],
      other: [] as PlateRecord[],
    };
    plates.forEach((plate) => {
      grouped[categorizePlate(plate) as keyof typeof grouped].push(plate);
    });
    Object.values(grouped).forEach((group) =>
      group.sort((a, b) => a.name.localeCompare(b.name))
    );
    return grouped;
  }, [plates]);

  const categoryConfig = [
    { id: "approaches", label: "Approaches" },
    { id: "departures", label: "Departures" },
    { id: "arrivals", label: "Arrivals" },
    { id: "airport", label: "Airport Info" },
    { id: "other", label: "Other" },
  ];

  const visibleCategories = categoryConfig.filter(
    (category) => category.id !== "other" || groupedPlates.other.length > 0
  );

  useEffect(() => {
    if (!plates.length) return;
    const ordered = ["approaches", "departures", "arrivals", "airport", "other"];
    const hasActive = groupedPlates[activeCategory as keyof typeof groupedPlates]?.length > 0;
    if (hasActive) return;
    const next = ordered.find((key) => groupedPlates[key as keyof typeof groupedPlates].length > 0);
    if (next && next !== activeCategory) {
      setActiveCategory(next);
    }
  }, [plates.length, groupedPlates, activeCategory]);

  const renderPlateList = (items: PlateRecord[]) => {
    if (items.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          No plates found in this category.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((plate) => (
          <div key={plate.url} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-base font-semibold">{plate.name}</div>
                <div className="text-xs text-muted-foreground">
                  {plate.type}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={apiUrl(`/api/plates/proxy?url=${encodeURIComponent(plate.url)}`)} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  View Plate
                </a>
              </Button>
            </div>
            {plate.effectiveDate && (
              <div className="text-xs text-muted-foreground">Effective: {plate.effectiveDate}</div>
            )}
            <Separator />
            <div className="text-xs text-muted-foreground">Source: FAA AeroNav</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Approach Plates</h1>
        <p className="text-muted-foreground">
          Search IFR approach plates by airport identifier. Charts are provided by FAA (AeroNav).
        </p>
        {data?.icao && (
          <Badge variant="outline">ICAO: {data.icao}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Enter an ICAO code (e.g., KJFK).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plates"
          />
          <Button onClick={() => setSearchTerm(query)}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {plates.length} plates found{normalizedQuery ? ` for ${normalizedQuery}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading plates...</div>
          ) : plates.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No plates found. Try another airport code.
            </div>
          ) : (
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="flex flex-wrap">
                {visibleCategories.map((category) => {
                  const count = groupedPlates[category.id as keyof typeof groupedPlates].length;
                  return (
                    <TabsTrigger key={category.id} value={category.id} disabled={count === 0}>
                      {category.label} ({count})
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {visibleCategories.map((category) => (
                <TabsContent key={category.id} value={category.id} className="mt-4">
                  {renderPlateList(groupedPlates[category.id as keyof typeof groupedPlates])}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
