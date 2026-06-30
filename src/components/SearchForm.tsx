import { useState, useEffect } from "react";
import { Calendar, Search, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchFormProps {
  onSearch: (origin: string, destination: string, date: string, country: "japan" | "korea", bypassApi?: boolean) => void;
}

export function SearchForm({ onSearch }: SearchFormProps) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("Tokyo");
  const [destination, setDestination] = useState("Shin-Osaka");
  const [country, setCountry] = useState<"japan" | "korea">("japan");
  const [date, setDate] = useState("2024-10-24");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [stations, setStations] = useState<string[]>([]);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch(`/api/transit/stations?country=${country}`);
        const data = await res.json();
        if (res.ok) {
          setStations(data.stations || []);
        }
      } catch (error) {
        console.error("Failed to fetch stations", error);
      }
    };
    fetchStations();
  }, [country]);

  const handleAiPlan = async () => {
    setIsAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Plan a transit route from ${origin} to ${destination} in ${country === 'japan' ? 'Japan' : 'South Korea'} for date ${date}. Give me the fastest and most efficient way using public transit. Please answer in the current language context (English or Traditional Chinese depending on origin/destination format).` })
      });
      const data = await res.json();
      if (res.ok) {
        setAiResult(data.result);
      } else {
        setAiResult(data.error || "Failed to generate AI plan");
      }
    } catch (e) {
      setAiResult("Network error.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main className="pt-16 pb-24 px-4 max-w-md mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              country === "japan" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
            onClick={() => {
              setCountry("japan");
              setOrigin("Tokyo");
              setDestination("Shin-Osaka");
            }}
          >
            {t('search.japan')}
          </button>
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              country === "korea" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
            onClick={() => {
              setCountry("korea");
              setOrigin("Seoul (SNC)");
              setDestination("Busan (BSN)");
            }}
          >
            {t('search.korea')}
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <label className="text-[10px] uppercase font-mono text-slate-500 font-bold mb-1 block">{t('search.origin')}</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                list="stations-list"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-semibold text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            
            <div className="relative">
              <label className="text-[10px] uppercase font-mono text-slate-500 font-bold mb-1 block">{t('search.destination')}</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                list="stations-list"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-semibold text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <datalist id="stations-list">
              {stations.map((station) => (
                <option key={station} value={station} />
              ))}
            </datalist>
          </div>

          <div className="relative">
            <label className="text-[10px] uppercase font-mono text-slate-500 font-bold mb-1 block">{t('search.date')}</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onSearch(origin, destination, date, country, false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Search className="w-5 h-5" />
              {t('search.realtime_search')}
            </button>
            <button
              onClick={() => onSearch(origin, destination, date, country, true)}
              className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all border border-orange-200"
            >
              {t('search.preview_ui')}
            </button>
            <button
              onClick={handleAiPlan}
              disabled={isAiLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              {isAiLoading ? t('search.thinking') : t('search.plan_ai')}
            </button>
          </div>
        </div>
      </div>

      {aiResult && (
        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-200">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-purple-900">{t('search.ai_plan_title')}</h3>
          </div>
          <div className="text-purple-900 text-sm whitespace-pre-wrap leading-relaxed">
            {aiResult}
          </div>
        </div>
      )}
    </main>
  );
}
