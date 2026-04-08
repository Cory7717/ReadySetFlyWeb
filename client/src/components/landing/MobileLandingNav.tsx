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
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,23,29,0.97),rgba(11,13,17,0.98))] px-3 py-2 backdrop-blur md:hidden">
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
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out ${
              activeTab === tab.id
                ? "border-[#7186a5]/55 bg-[linear-gradient(180deg,rgba(33,60,100,0.92),rgba(18,32,54,0.96))] text-[#F3F7FF] shadow-[0_12px_28px_-20px_rgba(70,112,196,0.9)]"
                : "border-[#576579]/30 bg-[linear-gradient(180deg,rgba(25,29,36,0.98),rgba(14,17,23,0.96))] text-[#A1B5CC] hover:border-[#73859d]/45 hover:text-[#E8F0FC]"
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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[linear-gradient(180deg,rgba(18,21,27,0.98),rgba(9,11,15,0.98))] pb-safe backdrop-blur-md md:hidden">
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
            className={`relative flex flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium transition-all duration-200 ease-out ${
              item.active ? "text-[#EEF4FF]" : "text-[#8FA5BE] hover:text-[#DCE7F6]"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(111,146,202,0.12),rgba(110,155,244,0.92),rgba(111,146,202,0.12))]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
