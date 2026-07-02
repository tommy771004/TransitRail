import { Menu, UserCircle, Globe } from "lucide-react";
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
    <header className="fixed top-0 w-full z-50 bg-white border-b border-slate-200 flex justify-between items-center px-4 h-12">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="text-slate-900 active:opacity-80 transition-opacity"
          aria-label={t("header.open_menu")}
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="text-xl font-bold text-slate-900 font-[Hanken_Grotesk]">{t('header.title')}</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={toggleLanguage}
          className="text-slate-600 active:opacity-80 transition-opacity flex items-center gap-1"
          aria-label={t("header.switch_language")}
        >
          <Globe className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase">{i18n.language.split('-')[0]}</span>
        </button>
        <button
          onClick={onProfileOpen}
          className="text-slate-900 active:opacity-80 transition-opacity"
          aria-label={t("header.open_profile")}
        >
          <UserCircle className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
