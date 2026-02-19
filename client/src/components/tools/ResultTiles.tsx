import { Card } from "@/components/ui/card";

export type ResultTile = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  helper?: string;
};

type ResultTilesProps = {
  results: ResultTile[];
};

export function ResultTiles({ results }: ResultTilesProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {results.map((result) => (
        <Card key={result.id} className="p-4">
          <div className="text-xs text-muted-foreground">{result.label}</div>
          <div className="mt-1 text-2xl font-semibold">
            {result.value} {result.unit ? <span className="text-base font-medium text-muted-foreground">{result.unit}</span> : null}
          </div>
          {result.helper ? <div className="mt-1 text-xs text-muted-foreground">{result.helper}</div> : null}
        </Card>
      ))}
    </div>
  );
}
