import { Bell, Bookmark, Clock3, Search, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppView, Country } from "../types";
import { countryThemes } from "../data/countries";
import { triggerHaptic } from "../utils/haptics";

interface BottomNavProps {
  activeView: AppView;
  unreadAlerts: number;
  onNavigate: (view: AppView) => void;
  onOpenSettings: () => void;
  country?: Country;
}

const searchViews = new Set<AppView>(["search", "results", "workflow"]);

export function BottomNav({ activeView, unreadAlerts, onNavigate, onOpenSettings, country = "japan" }: BottomNavProps) {
  const { t } = useTranslation();
  const theme = countryThemes[country] || countryThemes.japan;
  const items = [
    { view: "search" as const, label: t("nav.search"), icon: Search },
    
    { view: "history" as const, label: t("nav.history"), icon: Clock3 },
    { view: "saved" as const, label: t("nav.saved"), icon: Bookmark },
    { view: "alerts" as const, label: t("nav.alerts"), icon: Bell },
    { view: "settings" as const, label: t("nav.settings"), icon: Settings },
  ];

  return (
    <nav
      className="m3-nav-surface m3-elevation-2 fixed z-[60] border-slate-200/70 bg-white/40 backdrop-blur-md md:bg-white/95 dark:border-slate-800/70 dark:bg-[#060a13]/65 md:dark:bg-[#060a13]/95"
      aria-label={t("nav.primary")}
    >
      <div className="m3-nav-bar mx-auto max-w-md grid-cols-5">
        {items.map(({ view, label, icon: Icon }) => {
          const active = view === "search" ? searchViews.has(activeView) : view !== "settings" && activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                if (view === "settings") {
                  onOpenSettings();
                } else {
                  onNavigate(view);
                }
              }}
              className={`m3-nav-item ${
                active ? theme.textActive : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              {/* The pill is drawn by .m3-nav-indicator::before in currentColor,
                  so it always tints itself with the country's own accent. */}
              <span className="m3-nav-indicator m3-state">
                <span className="relative flex items-center justify-center">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} />
                  {view === "alerts" && unreadAlerts > 0 ? (
                    <span className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-none text-white ${theme.buttonBg}`}>
                      {unreadAlerts > 9 ? "9+" : unreadAlerts}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className={`m3-nav-label m3-label-medium max-w-full truncate px-0.5 ${active ? "font-semibold" : ""}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
