import { ChevronDown, Menu, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { timezoneCity } from "../utils/timezoneCity";

interface HeaderProps {
  onMenuOpen: () => void;
  /** Whether the side menu is open, for the menu button's aria-expanded. */
  menuOpen?: boolean;
  /** The page the passenger is on. The bottom bar scrolls away, so the header names it. */
  pageLabel: string;
  timezone: string;
  homeCurrency: string;
}

export const LANGUAGES = [
  { code: "zh-TW", label: "繁中" },
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
] as const;

export function Header({ onMenuOpen, menuOpen = false, pageLabel, timezone, homeCurrency }: HeaderProps) {
  const { t, i18n } = useTranslation();

  return (
    <header className="m3-top-app-bar m3-elevation-0 fixed top-0 z-50 w-full justify-between gap-1 border-b border-slate-200 bg-white/40 px-1 backdrop-blur-md sm:px-2 dark:border-slate-800 dark:bg-[#060a13]/40">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onMenuOpen}
          className="m3-icon-button m3-icon-button-large m3-state text-slate-700 dark:text-slate-300"
          aria-label={t("header.open_menu")}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>
        <span className="m3-title-large hidden shrink-0 text-slate-900 md:inline dark:text-white">
          {t('header.title')}
        </span>
        <span
          aria-hidden="true"
          className={`m3-title-medium min-w-0 truncate font-bold transition-colors duration-500 md:ml-2 text-accent`}
        >
          {pageLabel}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {/* Assist chip: the passenger's home timezone and currency at a glance.
            Both are set in the side menu, so the chip opens it. */}
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label={`${t("profile.timezone")} ${timezoneCity(timezone, i18n.language)} · ${t("profile.local_currency")} ${homeCurrency}`}
          className="m3-chip m3-chip-icon-leading m3-label-medium m3-state mr-1 inline-flex max-w-[11rem] border border-slate-200 bg-slate-100 text-slate-600 md:mr-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <Globe aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="truncate">{timezoneCity(timezone, i18n.language)}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">|</span>
          <span className="tabular-nums">{homeCurrency}</span>
        </button>

        {/* Phones change language in the side menu; the desktop bar has room for it. */}
        <div className="relative hidden shrink-0 md:block">
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="m3-label-medium m3-shape-full m3-elevation-1 h-9 cursor-pointer appearance-none border border-slate-200 bg-white/80 py-0 pl-3 pr-7 text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            aria-label={t("header.switch_language")}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
        </div>
      </div>
    </header>
  );
}
