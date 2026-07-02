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
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-stone-200 bg-white pb-safe"
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
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                active ? "text-stone-900" : "text-stone-400"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                {view === "alerts" && unreadAlerts > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-700 px-1 font-mono text-[9px] font-semibold leading-none text-white">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{label}</span>
              {active ? (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-orange-700" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
