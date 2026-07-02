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
    <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-stone-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100"
          aria-label={t("header.open_menu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2 text-base font-semibold tracking-tight text-stone-900">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-orange-700" aria-hidden="true" />
          {t('header.title')}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleLanguage}
          className="flex h-9 items-center rounded-lg px-2.5 font-mono text-xs font-semibold uppercase text-stone-600 hover:bg-stone-100"
          aria-label={t("header.switch_language")}
        >
          {i18n.language === 'en' ? '中' : 'EN'}
        </button>
        <button
          onClick={onProfileOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100"
          aria-label={t("header.open_profile")}
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
