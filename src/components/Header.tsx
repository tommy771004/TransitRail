import { Menu, UserCircle, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  onMenuOpen: () => void;
  onProfileOpen: () => void;
  timezone: string;
  homeCurrency: string;
}

const LANGUAGES = [
  { code: "zh-TW", label: "繁中" },
  { code: "en", label: "EN" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
] as const;

export function Header({ onMenuOpen, onProfileOpen, timezone, homeCurrency }: HeaderProps) {
  const { t, i18n } = useTranslation();

  const getTimezoneCity = (tz: string, lang: string) => {
    const cityMap: Record<string, { en: string; 'zh-TW': string; ja: string; ko: string }> = {
      'Asia/Taipei': { en: 'Taipei', 'zh-TW': '台北', ja: '台北', ko: '타이베이' },
      'Asia/Tokyo': { en: 'Tokyo', 'zh-TW': '東京', ja: '東京', ko: '도쿄' },
      'Asia/Seoul': { en: 'Seoul', 'zh-TW': '首爾', ja: 'ソウル', ko: '서울' },
      'Asia/Singapore': { en: 'Singapore', 'zh-TW': '新加坡', ja: 'シンガポール', ko: '싱가포르' },
      'Asia/Bangkok': { en: 'Bangkok', 'zh-TW': '曼谷', ja: 'バンコク', ko: '방콕' },
      'Asia/Hong_Kong': { en: 'Hong Kong', 'zh-TW': '香港', ja: '香港', ko: '홍콩' },
      'Europe/London': { en: 'London', 'zh-TW': '倫敦', ja: 'ロンドン', ko: '런던' },
      'Europe/Berlin': { en: 'Berlin', 'zh-TW': '柏林', ja: 'ベルリン', ko: '베를린' },
      'Europe/Paris': { en: 'Paris', 'zh-TW': '巴黎', ja: 'パリ', ko: '파리' },
      'America/New_York': { en: 'New York', 'zh-TW': '紐約', ja: 'ニューヨーク', ko: '뉴욕' },
      'America/Los_Angeles': { en: 'Los Angeles', 'zh-TW': '洛杉磯', ja: 'ロサンゼルス', ko: '로스앤젤레스' },
      'Asia/Shanghai': { en: 'Shanghai', 'zh-TW': '上海', ja: '上海', ko: '상하이' },
    };
    const mapping = cityMap[tz];
    if (mapping) return mapping[lang as keyof typeof mapping] || mapping.en;
    return tz.split('/').pop()?.replace('_', ' ') || '';
  };

  return (
    <header className="m3-top-app-bar m3-elevation-0 fixed top-0 z-50 w-full justify-between gap-1 border-b border-slate-200 bg-white/40 px-1 sm:px-2 dark:border-slate-800 dark:bg-[#060a13]/40">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onMenuOpen}
          className="m3-icon-button m3-icon-button-large m3-state text-slate-700 dark:text-slate-300"
          aria-label={t("header.open_menu")}
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>
        <span className="m3-title-large truncate text-slate-900 dark:text-white">
          {t('header.title')}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {/* Assist chip: the passenger's home timezone and currency at a glance. */}
        <div className="m3-chip m3-chip-icon-leading m3-label-medium hidden border border-slate-200 bg-slate-100 text-slate-600 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Globe aria-hidden="true" className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span>{getTimezoneCity(timezone, i18n.language)}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">|</span>
          <span className="tabular-nums">{homeCurrency}</span>
        </div>

        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="m3-label-large m3-shape-full h-12 cursor-pointer bg-transparent px-3 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("header.switch_language")}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onProfileOpen}
          className="m3-icon-button m3-icon-button-large m3-state text-slate-700 dark:text-slate-300"
          aria-label={t("header.open_profile")}
        >
          <UserCircle aria-hidden="true" className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}
