import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Eb6OutputMode } from "@/lib/prefs/eb6Prefs";

export type OutputDefinition = {
  id: string;
  label: string;
  group: string;
};

type OutputModeSelectorProps = {
  mode: Eb6OutputMode;
  selectedOutputs: string[];
  outputGroups: Array<{ title: string; outputs: OutputDefinition[] }>;
  onModeChange: (mode: Eb6OutputMode) => void;
  onOutputsChange: (outputs: string[]) => void;
  onSelectAll: () => void;
  onResetQuick: () => void;
};

export function OutputModeSelector({
  mode,
  selectedOutputs,
  outputGroups,
  onModeChange,
  onOutputsChange,
  onSelectAll,
  onResetQuick,
}: OutputModeSelectorProps) {
  const selectedCount = selectedOutputs.length;
  const outputMap = useMemo(() => {
    return outputGroups.flatMap((group) => group.outputs).reduce<Record<string, OutputDefinition>>((acc, output) => {
      acc[output.id] = output;
      return acc;
    }, {});
  }, [outputGroups]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => {
          if (!value) return;
          onModeChange(value as Eb6OutputMode);
        }}
      >
        <ToggleGroupItem value="quick">Quick</ToggleGroupItem>
        <ToggleGroupItem value="advanced">Advanced</ToggleGroupItem>
        <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
      </ToggleGroup>

      {mode === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">Custom outputs ({selectedCount})</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Select outputs</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onSelectAll}>Select all</Button>
                  <Button variant="ghost" size="sm" onClick={onResetQuick}>Reset to Quick</Button>
                </div>
              </div>
              {outputGroups.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </div>
                  <div className="space-y-2">
                    {group.outputs.map((output) => (
                      <Label key={output.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedOutputs.includes(output.id)}
                          onCheckedChange={(checked) => {
                            const isChecked = Boolean(checked);
                            if (isChecked) {
                              onOutputsChange([...selectedOutputs, output.id]);
                            } else {
                              onOutputsChange(selectedOutputs.filter((item) => item !== output.id));
                            }
                          }}
                        />
                        {outputMap[output.id]?.label || output.label}
                      </Label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
