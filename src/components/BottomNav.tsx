import { Bell, Bookmark, Clock3, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHideOnScroll } from "../hooks/useHideOnScroll";
import type { AppView, Country } from "../types";
import { triggerHaptic } from "../utils/haptics";

interface BottomNavProps {
  activeView: AppView;
  unreadAlerts: number;
  onNavigate: (view: AppView) => void;
  country?: Country;
}

const searchViews = new Set<AppView>(["search", "results", "workflow"]);

/**
 * The four destinations. Settings is not a page, so it lives in the side menu
 * behind the header's menu button rather than taking a slot here.
 */
export function BottomNav({ activeView, unreadAlerts, onNavigate, country = "japan" }: BottomNavProps) {
  const { t } = useTranslation();
  // Keyboard focus inside the bar pins it; a tapped item keeps focus in some
  // browsers, so only :focus-visible counts or the bar would never hide again.
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const hidden = useHideOnScroll(keyboardFocus);
  const items = [
    { view: "search" as const, label: t("nav.search"), icon: Search },
    { view: "history" as const, label: t("nav.history"), icon: Clock3 },
    { view: "saved" as const, label: t("nav.saved"), icon: Bookmark },
    { view: "alerts" as const, label: t("nav.alerts"), icon: Bell },
  ];

  return (
    <nav
      onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) setKeyboardFocus(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false); }}
      data-hidden={hidden ? "true" : undefined}
      className="m3-nav-surface m3-nav-autohide m3-elevation-2 fixed z-[60] border-slate-200/70 bg-white/40 backdrop-blur-md md:bg-white/95 dark:border-slate-800/70 dark:bg-[#060a13]/65 md:dark:bg-[#060a13]/95"
      aria-label={t("nav.primary")}
    >
      <div className="m3-nav-bar mx-auto max-w-md grid-cols-4">
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
              className={`m3-nav-item ${
                active ? "text-accent" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
                    <span className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-none bg-accent text-on-accent`}>
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
