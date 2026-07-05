import { Bell, Bookmark, Clock3, MapPinned, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppView, Country } from "../types";
import { countryThemes } from "../data/countries";
import { triggerHaptic } from "../utils/haptics";

interface BottomNavProps {
  activeView: AppView;
  unreadAlerts: number;
  onNavigate: (view: AppView) => void;
  country?: Country;
}

const searchViews = new Set<AppView>(["search", "results", "workflow"]);

export function BottomNav({ activeView, unreadAlerts, onNavigate, country = "japan" }: BottomNavProps) {
  const { t } = useTranslation();
  const theme = countryThemes[country] || countryThemes.japan;
  const items = [
    { view: "search" as const, label: t("nav.search"), icon: Search },
    { view: "stations" as const, label: t("nav.stations"), icon: MapPinned },
    { view: "history" as const, label: t("nav.history"), icon: Clock3 },
    { view: "saved" as const, label: t("nav.saved"), icon: Bookmark },
    { view: "alerts" as const, label: t("nav.alerts"), icon: Bell },
  ];

  return (
    <nav
      className="fixed bottom-5 left-4 right-4 mx-auto max-w-[350px] z-[60] rounded-[24px] border border-slate-200/40 bg-white/75 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:border-slate-800/40 dark:bg-[#0b1220]/80 dark:backdrop-blur-md"
      aria-label={t("nav.primary")}
    >
      <div className="grid h-15 grid-cols-5 px-1.5 py-1">
        {items.map(({ view, label, icon: Icon }) => {
          const active = view === "search" ? searchViews.has(activeView) : activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigate(view);
              }}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${
                active ? theme.textActive : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <span className="relative flex items-center justify-center">
                <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 1.8} />
                {view === "alerts" && unreadAlerts > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 font-mono text-[9px] font-bold leading-none text-white shadow-[0_0_6px_rgba(16,185,129,0.4)]">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate scale-90 tracking-tight">{label}</span>
              {active ? (
                <span className={`absolute bottom-0 h-1 w-1.5 rounded-full ${theme.indicatorBg}`} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
