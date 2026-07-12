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

        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="h-8 cursor-pointer rounded-xl border-none bg-transparent px-2 text-[11px] font-bold text-slate-500 outline-none hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={t("header.switch_language")}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
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
