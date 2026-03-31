import { AlertTriangle, Calculator, DollarSign, FileText, MapPin, UserPlus } from "lucide-react";

export type LandingMobileTab = "weather" | "find" | "plan" | "log" | "pricing";

interface MobileLandingNavProps {
  activeTab: LandingMobileTab;
  isAuthenticated: boolean;
  isPaidUser: boolean;
  onSelectTab: (tab: LandingMobileTab) => void;
  onJoin: () => void;
}

export function MobilePillNav({
  activeTab,
  isAuthenticated,
  isPaidUser,
  onSelectTab,
}: Omit<MobileLandingNavProps, "onJoin">) {
  return (
    <div className="sticky top-0 z-40 border-b border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.94))] px-3 py-2 backdrop-blur md:hidden">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {[
          { id: "weather" as LandingMobileTab, label: "Weather" },
          { id: "find" as LandingMobileTab, label: "Explore" },
          { id: "plan" as LandingMobileTab, label: "Planner" },
          ...(isAuthenticated ? [{ id: "log" as LandingMobileTab, label: "Logbook" }] : []),
          ...(!isPaidUser ? [{ id: "pricing" as LandingMobileTab, label: "RSF Pro" }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              onSelectTab(tab.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-[#5b4520] bg-[#271d0b] text-[#ffd278] shadow-sm"
                : "border-[#29415e] bg-[#102236] text-[#9FC6EA] hover:bg-[#15304b]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MobileBottomNav({
  activeTab,
  isAuthenticated,
  isPaidUser,
  onSelectTab,
  onJoin,
}: MobileLandingNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#203249] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(14,22,34,0.96))] pb-safe backdrop-blur-md md:hidden">
      <div className={`grid ${!isAuthenticated || !isPaidUser ? "grid-cols-5" : "grid-cols-4"}`}>
        {[
          {
            key: "weather",
            label: "Wx",
            icon: AlertTriangle,
            onClick: () => onSelectTab("weather"),
            active: activeTab === "weather",
          },
          {
            key: "find",
            label: "Find",
            icon: MapPin,
            onClick: () => onSelectTab("find"),
            active: activeTab === "find",
          },
          {
            key: "plan",
            label: "Plan",
            icon: Calculator,
            onClick: () => onSelectTab("plan"),
            active: activeTab === "plan",
          },
          ...(isAuthenticated
            ? [
                {
                  key: "log",
                  label: "Log",
                  icon: FileText,
                  onClick: () => onSelectTab("log"),
                  active: activeTab === "log",
                },
              ]
            : []),
          ...(!isPaidUser
            ? [
                {
                  key: "pricing",
                  label: "Pro",
                  icon: DollarSign,
                  onClick: () => onSelectTab("pricing"),
                  active: activeTab === "pricing",
                },
              ]
            : []),
          ...(!isAuthenticated
            ? [
                {
                  key: "join",
                  label: "Join",
                  icon: UserPlus,
                  onClick: onJoin,
                  active: false,
                },
              ]
            : []),
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              item.onClick();
              if (item.key !== "join") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className={`relative flex flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium transition-colors ${
              item.active ? "text-[#ffd278]" : "text-[#7A9BB8]"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#D9A441]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
