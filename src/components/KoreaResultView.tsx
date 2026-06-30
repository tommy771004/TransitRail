import { ArrowRight, Calendar, Wifi, Zap, Utensils, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface KoreaResultViewProps {
  origin: string;
  destination: string;
  date: string;
  error?: string;
}

export function KoreaResultView({ origin, destination, date, error }: KoreaResultViewProps) {
  const { t } = useTranslation();
  return (
    <main className="pb-24 min-h-screen">
      {/* Search Context Header */}
      <div className="mt-12 bg-slate-900 text-white px-4 py-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-slate-400 font-mono text-xs mb-1">{t('result.origin_label')}</span>
            <span className="text-lg font-bold">{origin}</span>
          </div>
          <div className="px-4">
            <ArrowRight className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-slate-400 font-mono text-xs mb-1">{t('result.destination_label')}</span>
            <span className="text-lg font-bold">{destination}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">{date} • 1 {t('result.adult')} • KTX Only</span>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 px-4 py-4 overflow-x-auto no-scrollbar bg-slate-50 sticky top-12 z-40">
        <button className="whitespace-nowrap px-4 py-2 rounded-full bg-slate-900 text-white font-mono text-xs">{t('result.all_times')}</button>
        <button className="whitespace-nowrap px-4 py-2 rounded-full border border-slate-300 text-slate-600 font-mono text-xs bg-white">{t('result.cheapest_first')}</button>
        <button className="whitespace-nowrap px-4 py-2 rounded-full border border-slate-300 text-slate-600 font-mono text-xs bg-white">{t('result.direct')}</button>
        <button className="whitespace-nowrap px-4 py-2 rounded-full border border-slate-300 text-slate-600 font-mono text-xs bg-white">{t('result.first_class')}</button>
      </div>

      <div className="px-4 space-y-4 mt-2">
        {error ? (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
            <p className="font-semibold mb-1">{t('result.unable_to_fetch')}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* KTX Result Card 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:scale-[0.98] transition-transform duration-150">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-50 text-orange-600 font-mono text-[10px] px-2 py-0.5 rounded border border-orange-200">KTX 101</span>
                  <span className="text-slate-600 text-sm">Sancheon</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-slate-900">₩59,800</span>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">{t('result.economy_class')}</p>
                </div>
              </div>
              <div className="flex justify-between items-center relative py-2">
                <div className="flex flex-col">
                  <span className="text-[32px] font-bold leading-tight text-slate-900 tracking-tight">08:15</span>
                  <span className="text-sm text-slate-600">Seoul</span>
                </div>
                <div className="flex-1 px-4 flex flex-col items-center">
                  <span className="text-[11px] font-mono text-slate-500 mb-1">2h 32m</span>
                  <div className="w-full h-[1px] bg-slate-300 relative">
                    <div className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-slate-900"></div>
                    <div className="absolute -top-1 right-0 w-2 h-2 rounded-full border-2 border-slate-900 bg-white"></div>
                  </div>
                  <span className="text-[10px] font-mono text-orange-600 mt-1">{t('result.non_stop')}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[32px] font-bold leading-tight text-slate-900 tracking-tight">10:47</span>
                  <span className="text-sm text-slate-600">Busan</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-slate-400" />
                  <Zap className="w-4 h-4 text-slate-400" />
                  <Utensils className="w-4 h-4 text-slate-400" />
                </div>
                <button className="bg-slate-900 text-white px-6 py-2 rounded-lg font-mono text-xs active:opacity-90">{t('result.select_seat')}</button>
              </div>
            </div>

            {/* Promotional Banner */}
            <div className="relative overflow-hidden rounded-xl h-40 group cursor-pointer shadow-sm">
              <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent"></div>
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" 
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC_xjMd8sOgHcGoD0PyOPu3pdqf6UbOlY1VjvO4hjxxgSCwbGI2dYCqszH6CE6_5cRNgFyYOYRwXTpXVVRRbpbt3QsrME5HwxocE2ApDKELSBOOKwqJ64TTAAOO_Zn-wLUJAF396hu8bYUPg1GvLJUPEoMTGvPMBNL_IbhJ6kBAd-DbI_Wg7jNI8ti7-6KOy1mn8dCTZYhkjF_Lc4m1JnZSm13C24uZjL-1r3GkMetKkqY9UFM9a6I40SJjI-5SDDg48FinTBAjY5g')" }}
              ></div>
              <div className="relative z-20 p-5 flex flex-col h-full justify-between">
                <div>
                  <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">{t('result.travel_offer')}</span>
                  <h3 className="text-white font-bold text-lg mt-2 leading-tight">{t('result.book_stay')}</h3>
                </div>
                <div className="flex items-center text-white gap-1 font-mono text-xs">
                  <span>{t('result.explore_partners')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* KTX Result Card 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm opacity-90">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-50 text-orange-600 font-mono text-[10px] px-2 py-0.5 rounded border border-orange-200">KTX 103</span>
                  <span className="text-slate-600 text-sm">KTX</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-slate-900">₩59,800</span>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">{t('result.economy_class')}</p>
                </div>
              </div>
              <div className="flex justify-between items-center relative py-2">
                <div className="flex flex-col">
                  <span className="text-[32px] font-bold leading-tight text-slate-900 tracking-tight">09:00</span>
                  <span className="text-sm text-slate-600">Seoul</span>
                </div>
                <div className="flex-1 px-4 flex flex-col items-center">
                  <span className="text-[11px] font-mono text-slate-500 mb-1">2h 45m</span>
                  <div className="w-full h-[1px] bg-slate-300 relative">
                    <div className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-slate-900"></div>
                    <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                    <div className="absolute -top-1 right-0 w-2 h-2 rounded-full border-2 border-slate-900 bg-white"></div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1">1 Stop (Daejeon)</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[32px] font-bold leading-tight text-slate-900 tracking-tight">11:45</span>
                  <span className="text-sm text-slate-600">Busan</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                <p className="text-[11px] text-red-600 font-medium italic flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('result.limited_seats')}
                </p>
                <button className="bg-slate-900 text-white px-6 py-2 rounded-lg font-mono text-xs active:opacity-90">{t('result.select_seat')}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
