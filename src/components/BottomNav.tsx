import { Bell, Bookmark, Clock3, MapPinned, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppView } from "../types";

interface BottomNavProps {
  activeView: AppView;
  unreadAlerts: number;
  onNavigate: (view: AppView) => void;
}

const searchViews = new Set<AppView>(["search", "results", "workflow"]);

export function BottomNav({ activeView, unreadAlerts, onNavigate }: BottomNavProps) {
  const { t } = useTranslation();
  const items = [
    { view: "search" as const, label: t("nav.search"), icon: Search },
    { view: "stations" as const, label: t("nav.stations"), icon: MapPinned },
    { view: "history" as const, label: t("nav.history"), icon: Clock3 },
    { view: "saved" as const, label: t("nav.saved"), icon: Bookmark },
    { view: "alerts" as const, label: t("nav.alerts"), icon: Bell },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200/80 bg-white/95 backdrop-blur-sm pb-safe dark:border-slate-700/50 dark:bg-slate-900/95"
      aria-label={t("nav.primary")}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ view, label, icon: Icon }) => {
          const active = view === "search" ? searchViews.has(activeView) : activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold ${
                active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <span className="relative">
                <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" : ""}`} strokeWidth={active ? 2.5 : 1.8} />
                {view === "alerts" && unreadAlerts > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 font-mono text-[9px] font-bold leading-none text-white shadow-[0_0_6px_rgba(16,185,129,0.4)]">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{label}</span>
              {active ? (
                <span className="absolute top-0 h-0.5 w-6 rounded-full bg-emerald-500" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
