import { ArrowRight, Edit2, Train, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface JapanResultViewProps {
  origin: string;
  destination: string;
  date: string;
  error?: string;
  onModify: () => void;
}

export function JapanResultView({ origin, destination, date, error, onModify }: JapanResultViewProps) {
  const { t } = useTranslation();
  return (
    <main className="pt-12 pb-24">
      {/* Search Header Context */}
      <section className="bg-white px-4 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">{origin}</span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className="text-lg font-semibold text-slate-900">{destination}</span>
            </div>
            <p className="text-sm text-slate-600">{t('result.today')}, Oct 24 • 1 {t('result.adult')}</p>
          </div>
          <button 
            onClick={onModify}
            className="flex items-center gap-1 px-3 py-2 bg-blue-50 rounded-xl text-slate-900 font-mono text-xs active:scale-95 transition-transform border border-slate-200"
          >
            <Edit2 className="w-3 h-3" />
            {t('result.modify')}
          </button>
        </div>
      </section>

      {/* Sorting Tabs */}
      <nav className="flex w-full bg-white border-b border-slate-200 sticky top-12 z-40">
        <button className="flex-1 py-3 font-mono text-xs text-slate-900 border-b-2 border-slate-900">{t('result.fastest')}</button>
        <button className="flex-1 py-3 font-mono text-xs text-slate-500 border-b-2 border-transparent">{t('result.earliest')}</button>
        <button className="flex-1 py-3 font-mono text-xs text-slate-500 border-b-2 border-transparent">{t('result.cheapest')}</button>
      </nav>

      {/* Results List */}
      <div className="px-4 pt-4 space-y-4">
        {error ? (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
            <p className="font-semibold mb-1">{t('result.unable_to_fetch')}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Result Card 1 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden active:bg-blue-50 transition-colors duration-150">
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-orange-600 text-white font-mono text-[10px] rounded uppercase">Nozomi 223</span>
                    <span className="text-sm text-slate-600">2h 30m</span>
                  </div>
                  <span className="text-base font-bold text-slate-900">¥14,720</span>
                </div>
                <div className="flex justify-between items-center relative">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight">14:00</span>
                    <span className="text-sm text-slate-600">Tokyo</span>
                  </div>
                  <div className="flex-1 mx-4 flex flex-col items-center">
                    <div className="w-full h-[1px] journey-line relative">
                      <div className="absolute -top-1 left-0 w-2 h-2 rounded-full border border-slate-300 bg-white"></div>
                      <div className="absolute -top-1 right-0 w-2 h-2 rounded-full border border-slate-300 bg-white"></div>
                    </div>
                    <Train className="w-4 h-4 text-slate-400 mt-1" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight">16:30</span>
                    <span className="text-sm text-slate-600">Shin-Osaka</span>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 px-4 py-2 flex justify-between items-center border-t border-slate-200">
                <span className="font-mono text-[10px] text-orange-600">{t('result.direct')} • {t('result.reserved_seat')}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Result Card 2 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden active:bg-blue-50 transition-colors duration-150">
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] rounded uppercase">Hikari 517</span>
                    <span className="text-sm text-slate-600">2h 54m</span>
                  </div>
                  <span className="text-base font-bold text-slate-900">¥14,400</span>
                </div>
                <div className="flex justify-between items-center relative">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight">14:03</span>
                    <span className="text-sm text-slate-600">Tokyo</span>
                  </div>
                  <div className="flex-1 mx-4 flex flex-col items-center">
                    <div className="w-full h-[1px] journey-line relative">
                      <div className="absolute -top-1 left-0 w-2 h-2 rounded-full border border-slate-300 bg-white"></div>
                      <div className="absolute -top-1 right-0 w-2 h-2 rounded-full border border-slate-300 bg-white"></div>
                    </div>
                    <Train className="w-4 h-4 text-slate-400 mt-1" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold leading-tight text-slate-900 tracking-tight">16:57</span>
                    <span className="text-sm text-slate-600">Shin-Osaka</span>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 px-4 py-2 flex justify-between items-center border-t border-slate-200">
                <span className="font-mono text-[10px] text-slate-900">{t('result.direct')} • {t('result.jr_pass_eligible')}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Promo Banner */}
            <div className="relative h-32 rounded-xl overflow-hidden bg-slate-900 flex items-center p-4">
              <div className="z-10 flex flex-col">
                <span className="text-white text-xl font-bold">{t('result.travel_smarter')}</span>
                <p className="text-slate-400 text-sm mt-1 max-w-[180px]">{t('result.get_realtime')}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-40">
                <div className="w-24 h-24 border-4 border-white rounded-full"></div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
