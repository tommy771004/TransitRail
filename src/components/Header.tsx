import { Menu, UserCircle, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  onMenuOpen: () => void;
  onProfileOpen: () => void;
  timezone: string;
  onChangeTimezone: (tz: string) => void;
}

const REGIONS = [
  { id: "Asia/Taipei", name: "台灣 (Taipei)" },
  { id: "Asia/Tokyo", name: "日本 (Tokyo)" },
  { id: "Asia/Seoul", name: "韓國 (Seoul)" },
  { id: "Asia/Singapore", name: "新加坡 (Singapore)" },
  { id: "Asia/Bangkok", name: "泰國 (Bangkok)" },
  { id: "Asia/Hong_Kong", name: "香港 (Hong Kong)" },
  { id: "Europe/London", name: "英國 (London)" },
  { id: "Europe/Berlin", name: "德國 (Berlin)" },
  { id: "Europe/Paris", name: "法國 (Paris)" },
  { id: "America/New_York", name: "美國東岸 (New York)" },
  { id: "America/Los_Angeles", name: "美國西岸 (Los Angeles)" },
  { id: "Asia/Shanghai", name: "中國 (Shanghai)" },
];

export function Header({ onMenuOpen, onProfileOpen, timezone, onChangeTimezone }: HeaderProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh-TW' : 'en');
  };

  return (
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:border-slate-800/40 dark:bg-[#0b1220]/75 dark:backdrop-blur-md">
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
        <div className="relative flex items-center mr-1 group">
          <Globe className="h-3.5 w-3.5 text-slate-400 absolute left-2 pointer-events-none" />
          <select 
            value={timezone}
            onChange={(e) => onChangeTimezone(e.target.value)}
            className="h-8 appearance-none bg-transparent pl-7 pr-6 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <option value={timezone} disabled hidden>{timezone.split('/').pop()?.replace('_', ' ')}</option>
            {REGIONS.map(r => (
              <option key={r.id} value={r.id} className="text-slate-900 dark:text-white dark:bg-slate-900">{r.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
          </div>
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
