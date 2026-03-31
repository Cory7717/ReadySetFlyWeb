import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

export type LandingModuleChooserId = "conditions" | "cfi" | "partner" | "events";

interface LandingModuleDescriptor {
  id: LandingModuleChooserId;
  title: string;
  description: string;
}

interface LandingModuleChooserProps {
  modules: LandingModuleDescriptor[];
  openModules: LandingModuleChooserId[];
  onToggle: (moduleId: LandingModuleChooserId) => void;
}

export function LandingModuleChooser({
  modules,
  openModules,
  onToggle,
}: LandingModuleChooserProps) {
  return (
    <div className="hidden py-10 sm:py-12 md:block">
      <div className="container mx-auto px-4">
        <Card className="overflow-hidden border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] text-slate-100 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.78)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <span className="rsf-kicker border-[#29415e] bg-[#102236] text-[#9FC6EA]">More to Explore</span>
                <h2 className="text-2xl sm:text-3xl font-semibold text-[#F1F5FA]">Choose the next briefing module</h2>
                <p className="max-w-3xl text-sm text-[#7A9BB8] sm:text-base">
                  Current conditions, instructor setup, featured tools, and community events stay available below as optional briefing modules instead of generic homepage filler.
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#9FC6EA]">Choose a module</div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => {
                const isOpen = openModules.includes(module.id);
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => onToggle(module.id)}
                    className="rounded-[1rem] border border-[#29415e] bg-[#0f1a28] p-4 text-left transition-colors hover:bg-[#15283d]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-[#F1F5FA]">{module.title}</div>
                        <div className="text-xs text-[#7A9BB8]">{module.description}</div>
                      </div>
                      {isOpen ? <ChevronUp className="mt-0.5 h-4 w-4 text-[#9FC6EA]" /> : <ChevronDown className="mt-0.5 h-4 w-4 text-[#9FC6EA]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
