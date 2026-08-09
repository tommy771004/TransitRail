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
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-2 sm:px-4 dark:border-slate-800 dark:bg-[#060a13]">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("header.open_menu")}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <span className="truncate text-base font-bold text-slate-900 dark:text-white">
          {t('header.title')}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <div className="hidden min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-2 sm:flex dark:bg-slate-800">
          <Globe aria-hidden="true" className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {getTimezoneCity(timezone, i18n.language)}
          </span>
          <span aria-hidden="true" className="text-[10px] text-slate-400 dark:text-slate-600">|</span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {homeCurrency}
          </span>
        </div>

        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="h-11 cursor-pointer rounded-lg bg-transparent px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("header.switch_language")}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onProfileOpen}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("header.open_profile")}
        >
          <UserCircle aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
