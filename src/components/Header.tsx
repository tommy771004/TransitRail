import { Menu, UserCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  onMenuOpen: () => void;
  onProfileOpen: () => void;
}

export function Header({ onMenuOpen, onProfileOpen }: HeaderProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh-TW' : 'en');
  };

  return (
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 dark:border-slate-700/50 dark:bg-slate-900/95">
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
