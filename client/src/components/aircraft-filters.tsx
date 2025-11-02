import { useState } from "react";
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

export function AircraftFilters() {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState("100");

  return (
    <div className="space-y-6" data-testid="aircraft-filters">
      <div>
        <h3 className="font-semibold mb-4">Filters</h3>
        <Button 
          variant="outline" 
          className="w-full" 
          data-testid="button-clear-filters"
          onClick={() => {
            setKeyword("");
            setCity("");
            setState("");
            setRadius("100");
          }}
        >
          Clear All
        </Button>
      </div>

      <Separator />

      {/* Keyword Search */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Search Aircraft</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="e.g., Cessna 172, Piper Archer"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-10"
            data-testid="input-keyword-search"
          />
        </div>
      </div>

      <Separator />

      {/* Location Filter */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">Location</Label>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">City</Label>
            <Input
              placeholder="Enter city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              data-testid="input-city"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">State</Label>
            <Input
              placeholder="e.g., CA, TX, FL"
              value={state}
              onChange={(e) => setState(e.target.value)}
              maxLength={2}
              data-testid="input-state"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Radius</Label>
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

      <Separator />

      {/* Certifications */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="text-sm font-semibold cursor-pointer">Certifications Required</Label>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {certifications.map((cert) => (
            <div key={cert} className="flex items-center space-x-2">
              <Checkbox id={`cert-${cert}`} data-testid={`checkbox-cert-${cert}`} />
              <label
                htmlFor={`cert-${cert}`}
                className="text-sm cursor-pointer"
              >
                {cert}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Aircraft Category */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="text-sm font-semibold cursor-pointer">Aircraft Category</Label>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {categories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox id={`cat-${category}`} data-testid={`checkbox-category-${category}`} />
              <label
                htmlFor={`cat-${category}`}
                className="text-sm cursor-pointer"
              >
                {category}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Avionics Suite */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <Label className="text-sm font-semibold cursor-pointer">Avionics Suite</Label>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-3">
          {avionicsSuites.map((avionics) => (
            <div key={avionics} className="flex items-center space-x-2">
              <Checkbox id={`avionics-${avionics}`} data-testid={`checkbox-avionics-${avionics}`} />
              <label
                htmlFor={`avionics-${avionics}`}
                className="text-sm cursor-pointer"
              >
                {avionics}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Additional Options */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Additional Options</Label>
        <div className="flex items-center space-x-2">
          <Checkbox id="insurance" data-testid="checkbox-insurance" />
          <label htmlFor="insurance" className="text-sm cursor-pointer">
            Insurance Included
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="wet-rate" data-testid="checkbox-wet-rate" />
          <label htmlFor="wet-rate" className="text-sm cursor-pointer">
            Wet Rate (Fuel Included)
          </label>
        </div>
      </div>
    </div>
  );
}
