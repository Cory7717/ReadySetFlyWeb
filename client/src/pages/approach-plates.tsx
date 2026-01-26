import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Search } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface PlateRecord {
  id: string;
  icao?: string | null;
  airportName?: string | null;
  procedureName: string;
  plateType?: string | null;
  fileName: string;
  cycle: string;
}

export default function ApproachPlates() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery<{ plates: PlateRecord[]; cycle?: string | null }>(
    {
      queryKey: ["/api/approach-plates/search", searchTerm],
      queryFn: async () => {
        const url = apiUrl(`/api/approach-plates/search?q=${encodeURIComponent(searchTerm)}`);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load approach plates");
        return res.json();
      },
    }
  );

  const plates = data?.plates || [];
  const cycle = data?.cycle || "";

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Approach Plates</h1>
        <p className="text-muted-foreground">
          Search IFR approach plates by airport identifier or procedure name. All charts are hosted by ReadySetFly.
        </p>
        {cycle && (
          <Badge variant="outline">Current FAA cycle: {cycle}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Enter an ICAO code (e.g., KJFK) or a procedure keyword.</CardDescription>
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
          <CardDescription>{plates.length} plates found</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading plates...</div>
          ) : plates.length === 0 ? (
            <div className="text-sm text-muted-foreground">No plates found. Try another airport code.</div>
          ) : (
            plates.map((plate) => (
              <div key={plate.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-base font-semibold">{plate.procedureName}</div>
                    <div className="text-xs text-muted-foreground">
                      {plate.icao || "Unknown"} {plate.plateType ? `? ${plate.plateType}` : ""}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={apiUrl(`/api/approach-plates/${plate.id}/file`)} target="_blank" rel="noreferrer">
                      <FileText className="h-4 w-4 mr-2" />
                      View Plate
                    </a>
                  </Button>
                </div>
                {plate.fileName && (
                  <div className="text-xs text-muted-foreground">{plate.fileName}</div>
                )}
                <Separator />
                <div className="text-xs text-muted-foreground">Cycle: {plate.cycle}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
