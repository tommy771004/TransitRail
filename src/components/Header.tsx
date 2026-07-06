import { Menu, UserCircle, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { allCurrencies } from "../data/countries";

interface HeaderProps {
  onMenuOpen: () => void;
  onProfileOpen: () => void;
  timezone: string;
  homeCurrency: string;
}

const REGIONS = [
  { id: "Asia/Taipei", name: "🇹🇼 台灣 (Taipei)" },
  { id: "Asia/Tokyo", name: "🇯🇵 日本 (Tokyo)" },
  { id: "Asia/Seoul", name: "🇰🇷 韓國 (Seoul)" },
  { id: "Asia/Singapore", name: "🇸🇬 新加坡 (Singapore)" },
  { id: "Asia/Bangkok", name: "🇹🇭 泰國 (Bangkok)" },
  { id: "Asia/Hong_Kong", name: "🇭🇰 香港 (Hong Kong)" },
  { id: "Europe/London", name: "🇬🇧 英國 (London)" },
  { id: "Europe/Berlin", name: "🇩🇪 德國 (Berlin)" },
  { id: "Europe/Paris", name: "🇫🇷 法國 (Paris)" },
  { id: "America/New_York", name: "🇺🇸 美國東岸 (New York)" },
  { id: "America/Los_Angeles", name: "🇺🇸 美國西岸 (Los Angeles)" },
  { id: "Asia/Shanghai", name: "🇨🇳 中國 (Shanghai)" },
];

const timezoneFlags: Record<string, string> = {
  "Asia/Taipei": "🇹🇼",
  "Asia/Tokyo": "🇯🇵",
  "Asia/Seoul": "🇰🇷",
  "Asia/Singapore": "🇸🇬",
  "Asia/Bangkok": "🇹🇭",
  "Asia/Hong_Kong": "🇭🇰",
  "Europe/London": "🇬🇧",
  "Europe/Berlin": "🇩🇪",
  "Europe/Paris": "🇫🇷",
  "America/New_York": "🇺🇸",
  "America/Los_Angeles": "🇺🇸",
  "Asia/Shanghai": "🇨🇳",
};

export function Header({ onMenuOpen, onProfileOpen, timezone, homeCurrency }: HeaderProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh-TW' : 'en');
  };

  const getTimezoneCity = (tz: string, lang: string) => {
    const cityMap: Record<string, { en: string; 'zh-TW': string }> = {
      'Asia/Taipei': { en: 'Taipei', 'zh-TW': '台北' },
      'Asia/Tokyo': { en: 'Tokyo', 'zh-TW': '東京' },
      'Asia/Seoul': { en: 'Seoul', 'zh-TW': '首爾' },
      'Asia/Singapore': { en: 'Singapore', 'zh-TW': '新加坡' },
      'Asia/Bangkok': { en: 'Bangkok', 'zh-TW': '曼谷' },
      'Asia/Hong_Kong': { en: 'Hong Kong', 'zh-TW': '香港' },
      'Europe/London': { en: 'London', 'zh-TW': '倫敦' },
      'Europe/Berlin': { en: 'Berlin', 'zh-TW': '柏林' },
      'Europe/Paris': { en: 'Paris', 'zh-TW': '巴黎' },
      'America/New_York': { en: 'New York', 'zh-TW': '紐約' },
      'America/Los_Angeles': { en: 'Los Angeles', 'zh-TW': '洛杉磯' },
      'Asia/Shanghai': { en: 'Shanghai', 'zh-TW': '上海' },
    };
    const mapping = cityMap[tz];
    const flag = timezoneFlags[tz] || "";
    if (mapping) return `${flag} ${mapping[lang as keyof typeof mapping] || mapping.en}`;
    return `${flag} ${tz.split('/').pop()?.replace('_', ' ') || ''}`;
  };

  return (
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:border-slate-800/40 dark:bg-[#060a13]/75 dark:backdrop-blur-md">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={t("header.open_menu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
          <span className="h-2.5 w-2.5 rounded-[4px] bg-emerald-600 shadow-[0_0_6px_rgba(16,185,129,0.3)]" aria-hidden="true" />
          {t('header.title')}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {getTimezoneCity(timezone, i18n.language)}
          </span>
          <span className="text-[10px] text-slate-300 dark:text-slate-600">|</span>
          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {homeCurrency}
          </span>
        </div>

        <button
          onClick={toggleLanguage}
          className="flex h-8 items-center rounded-xl px-2.5 font-mono text-[11px] font-bold uppercase text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={t("header.switch_language")}
        >
          {i18n.language === 'en' ? '中' : 'EN'}
        </button>
        <button
          onClick={onProfileOpen}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={t("header.open_profile")}
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
