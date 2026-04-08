import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const certifications = ["PPL", "IR", "CPL", "Multi-Engine", "ATP"];
const categories = ["Single-Engine", "Multi-Engine", "Jet", "Turboprop", "Helicopter"];
const avionicsSuites = ["Garmin G1000", "Garmin G500", "Aspen", "Steam Gauges"];

interface AircraftFiltersProps {
  keyword: string;
  setKeyword: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  state: string;
  setState: (value: string) => void;
  radius: string;
  setRadius: (value: string) => void;
  selectedCertifications: string[];
  onCertificationsChange: (values: string[]) => void;
  selectedCategories: string[];
  onCategoriesChange: (values: string[]) => void;
  selectedAvionics: string[];
  onAvionicsChange: (values: string[]) => void;
  insuranceIncluded: boolean;
  onInsuranceIncludedChange: (value: boolean) => void;
  wetRateOnly: boolean;
  onWetRateOnlyChange: (value: boolean) => void;
  onClearAll: () => void;
}

export function AircraftFilters({
  keyword,
  setKeyword,
  city,
  setCity,
  state,
  setState,
  radius,
  setRadius,
  selectedCertifications,
  onCertificationsChange,
  selectedCategories,
  onCategoriesChange,
  selectedAvionics,
  onAvionicsChange,
  insuranceIncluded,
  onInsuranceIncludedChange,
  wetRateOnly,
  onWetRateOnlyChange,
  onClearAll,
}: AircraftFiltersProps) {
  const toggleValue = (
    value: string,
    selectedValues: string[],
    onChange: (values: string[]) => void,
    checked: boolean,
  ) => {
    if (checked) {
      if (!selectedValues.includes(value)) {
        onChange([...selectedValues, value]);
      }
      return;
    }
    onChange(selectedValues.filter((entry) => entry !== value));
  };

  return (
    <div className="rsf-metal-panel space-y-6 rounded-[1.35rem] p-5 text-[#E8EDF4]" data-testid="aircraft-filters">
      <div>
        <h3 className="mb-4 font-semibold">Filters</h3>
        <Button 
          variant="outline" 
          className="rsf-metal-button-secondary w-full" 
          data-testid="button-clear-filters"
          onClick={onClearAll}
        >
          Clear All
        </Button>
      </div>

      <Separator className="bg-white/10" />

      {/* Keyword Search */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-[#F5F8FC]">Search Aircraft</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa6c0]" />
          <Input
            placeholder="e.g., Cessna 172, Piper Archer"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-10"
            data-testid="input-keyword-search"
          />
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Location Filter */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold text-[#F5F8FC]">Location</Label>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs text-[#8fa6c0]">City</Label>
            <Input
              placeholder="Enter city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              data-testid="input-city"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-[#8fa6c0]">State</Label>
            <Input
              placeholder="e.g., CA, TX, FL"
              value={state}
              onChange={(e) => setState(e.target.value)}
              maxLength={2}
              data-testid="input-state"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-[#8fa6c0]">Radius</Label>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger data-testid="select-radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 miles</SelectItem>
                <SelectItem value="50">50 miles</SelectItem>
                <SelectItem value="100">100 miles</SelectItem>
                <SelectItem value="200">200 miles</SelectItem>
                <SelectItem value="500">500 miles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Certifications */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="cursor-pointer text-sm font-semibold text-[#F5F8FC]">Certifications Required</Label>
          <ChevronDown className="h-4 w-4 text-[#8fa6c0]" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {certifications.map((cert) => (
            <div key={cert} className="flex items-center space-x-2">
              <Checkbox
                id={`cert-${cert}`}
                checked={selectedCertifications.includes(cert)}
                onCheckedChange={(checked) =>
                  toggleValue(cert, selectedCertifications, onCertificationsChange, checked === true)
                }
                data-testid={`checkbox-cert-${cert}`}
              />
              <label
                htmlFor={`cert-${cert}`}
                className="cursor-pointer text-sm text-[#DCE6F2]"
              >
                {cert}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-white/10" />

      {/* Aircraft Category */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="cursor-pointer text-sm font-semibold text-[#F5F8FC]">Aircraft Category</Label>
          <ChevronDown className="h-4 w-4 text-[#8fa6c0]" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {categories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`cat-${category}`}
                checked={selectedCategories.includes(category)}
                onCheckedChange={(checked) =>
                  toggleValue(category, selectedCategories, onCategoriesChange, checked === true)
                }
                data-testid={`checkbox-category-${category}`}
              />
              <label
                htmlFor={`cat-${category}`}
                className="cursor-pointer text-sm text-[#DCE6F2]"
              >
                {category}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-white/10" />

      {/* Avionics Suite */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="cursor-pointer text-sm font-semibold text-[#F5F8FC]">Avionics Suite</Label>
          <ChevronDown className="h-4 w-4 text-[#8fa6c0]" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {avionicsSuites.map((avionics) => (
            <div key={avionics} className="flex items-center space-x-2">
              <Checkbox
                id={`avionics-${avionics}`}
                checked={selectedAvionics.includes(avionics)}
                onCheckedChange={(checked) =>
                  toggleValue(avionics, selectedAvionics, onAvionicsChange, checked === true)
                }
                data-testid={`checkbox-avionics-${avionics}`}
              />
              <label
                htmlFor={`avionics-${avionics}`}
                className="cursor-pointer text-sm text-[#DCE6F2]"
              >
                {avionics}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-white/10" />

      {/* Additional Options */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-[#F5F8FC]">Additional Options</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="insurance"
            checked={insuranceIncluded}
            onCheckedChange={(checked) => onInsuranceIncludedChange(checked === true)}
            data-testid="checkbox-insurance"
          />
          <label htmlFor="insurance" className="cursor-pointer text-sm text-[#DCE6F2]">
            Insurance Included
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="wet-rate"
            checked={wetRateOnly}
            onCheckedChange={(checked) => onWetRateOnlyChange(checked === true)}
            data-testid="checkbox-wet-rate"
          />
          <label htmlFor="wet-rate" className="cursor-pointer text-sm text-[#DCE6F2]">
            Wet Rate (Fuel Included)
          </label>
        </div>
      </div>
    </div>
  );
}
