import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const certifications = ["PPL", "IR", "CPL", "Multi-Engine", "ATP"];
const categories = ["Single-Engine", "Multi-Engine", "Jet", "Turboprop", "Helicopter"];
const avionicsSuites = ["Garmin G1000", "Garmin G500", "Aspen", "Steam Gauges"];

export function AircraftFilters() {
  const [priceRange, setPriceRange] = useState([50, 500]);
  const [hourRequirements, setHourRequirements] = useState([0, 5000]);

  return (
    <div className="space-y-6" data-testid="aircraft-filters">
      <div>
        <h3 className="font-semibold mb-4">Filters</h3>
        <Button variant="outline" className="w-full" data-testid="button-clear-filters">
          Clear All
        </Button>
      </div>

      <Separator />

      {/* Price Range */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold">Price Range ($/hour)</Label>
          <div className="flex justify-between text-sm text-muted-foreground mt-2 mb-3">
            <span data-testid="text-price-min">${priceRange[0]}</span>
            <span data-testid="text-price-max">${priceRange[1]}</span>
          </div>
          <Slider
            value={priceRange}
            onValueChange={setPriceRange}
            min={50}
            max={1000}
            step={10}
            className="w-full"
            data-testid="slider-price"
          />
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

      {/* Hour Requirements */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold">Maximum Hour Requirements</Label>
          <div className="flex justify-between text-sm text-muted-foreground mt-2 mb-3">
            <span data-testid="text-hours-min">{hourRequirements[0]}</span>
            <span data-testid="text-hours-max">{hourRequirements[1]}+</span>
          </div>
          <Slider
            value={hourRequirements}
            onValueChange={setHourRequirements}
            min={0}
            max={5000}
            step={100}
            className="w-full"
            data-testid="slider-hours"
          />
        </div>
      </div>

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
