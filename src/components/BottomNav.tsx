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
    { view: "history" as const, label: t("nav.history"), icon: Clock3 },
    { view: "stations" as const, label: t("nav.stations"), icon: MapPinned },
    { view: "saved" as const, label: t("nav.saved"), icon: Bookmark },
    { view: "alerts" as const, label: t("nav.alerts"), icon: Bell },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(10px+env(safe-area-inset-bottom))]"
      aria-label={t("nav.primary")}
    >
      <div className="mx-auto flex max-w-md items-end gap-2">
        <div className="grid h-[68px] min-w-0 flex-1 grid-cols-4 rounded-[30px] border border-slate-200/80 bg-white/95 px-1.5 shadow-[0_12px_35px_rgba(15,23,42,0.22)] backdrop-blur-xl">
          {items.map(({ view, label, icon: Icon }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => onNavigate(view)}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition-colors ${
                  active ? "text-blue-700" : "text-slate-600"
                }`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
              >
                <span className={`relative flex h-7 w-9 items-center justify-center rounded-full ${active ? "bg-blue-50" : ""}`}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
                  {view === "alerts" && unreadAlerts > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold leading-none text-white">
                      {unreadAlerts > 9 ? "9+" : unreadAlerts}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onNavigate("search")}
          className={`flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border shadow-[0_12px_35px_rgba(15,23,42,0.22)] transition-colors ${
            searchViews.has(activeView)
              ? "border-blue-700 bg-blue-700 text-white"
              : "border-slate-200 bg-white text-blue-700"
          }`}
          aria-current={searchViews.has(activeView) ? "page" : undefined}
          aria-label={t("nav.search")}
          title={t("nav.search")}
        >
          <Search className="h-7 w-7" strokeWidth={2.4} />
        </button>
      </div>
    </nav>
  );
}
