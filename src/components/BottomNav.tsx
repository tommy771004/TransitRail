import { Search, History, Bookmark, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center pt-2 pb-safe pb-6 bg-white border-t border-slate-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] h-16 sm:h-20">
      <button className="flex flex-col items-center justify-center bg-orange-600 text-white rounded-full px-4 py-1 active:scale-95 transition-transform duration-150">
        <Search className="w-5 h-5 mb-0.5" />
        <span className="font-medium text-[10px] sm:text-xs font-mono">{t('nav.search')}</span>
      </button>
      <button className="flex flex-col items-center justify-center text-slate-500 active:scale-95 transition-transform duration-150">
        <History className="w-5 h-5 mb-0.5" />
        <span className="font-medium text-[10px] sm:text-xs font-mono">{t('nav.history')}</span>
      </button>
      <button className="flex flex-col items-center justify-center text-slate-500 active:scale-95 transition-transform duration-150">
        <Bookmark className="w-5 h-5 mb-0.5" />
        <span className="font-medium text-[10px] sm:text-xs font-mono">{t('nav.saved')}</span>
      </button>
      <button className="flex flex-col items-center justify-center text-slate-500 active:scale-95 transition-transform duration-150 relative">
        <Bell className="w-5 h-5 mb-0.5" />
        <span className="font-medium text-[10px] sm:text-xs font-mono">{t('nav.alerts')}</span>
        <div className="absolute top-0 right-1 w-2 h-2 bg-orange-600 rounded-full border border-white"></div>
      </button>
    </nav>
  );
}
