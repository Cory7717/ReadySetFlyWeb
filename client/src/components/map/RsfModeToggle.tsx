import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getRsfCockpitToggleClass, type RsfCockpitAccent } from "@/map/rsfMapSpec";

type ToggleOption<T extends string> = {
  value: T;
  label: string;
  accent: RsfCockpitAccent;
  icon?: ReactNode;
};

export function RsfModeToggle<T extends string>({
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: {
  value: T;
  options: ToggleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <div className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-700 bg-slate-900/70 p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition-colors",
            getRsfCockpitToggleClass(value === option.value, option.accent),
            buttonClassName,
          )}
        >
          {option.icon ? <span className="mr-2 inline-flex items-center">{option.icon}</span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
