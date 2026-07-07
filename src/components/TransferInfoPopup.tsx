import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import type { TransferInfo } from "../data/transfers";
import { stationLabel } from "../utils/stationLabel";
import type { Country } from "../types";

const normalizeKey = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

interface TransferInfoPopupProps {
  isOpen: boolean;
  onClose: () => void;
  stationId?: string;
  stationName?: string;
  country?: Country;
  info?: TransferInfo;
}

export function TransferInfoPopup({ isOpen, onClose, stationId, stationName, country, info }: TransferInfoPopupProps) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<TransferInfo | null>(info || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (info) {
      setData(info);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = "";
        if (stationId) {
          url = `/api/transit/transfers/${encodeURIComponent(stationId)}`;
        } else if (stationName && country) {
          url = `/api/transit/transfers?stationName=${encodeURIComponent(stationName)}&country=${encodeURIComponent(country)}`;
        } else {
          return;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(t("result.no_transfer_data", { defaultValue: "No transfer data found for this station." }));
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to fetch transfer info.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, stationId, stationName, country, info, t]);

  const resolvedStationName = stationName || data?.stationName || "";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, type: "spring", bounce: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 w-11/12 max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {resolvedStationName ? stationLabel(t, resolvedStationName, country || (data?.country?.toLowerCase() as Country)) : "..."}
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {t("result.transfer_details", { defaultValue: "Transfer Details" })}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-slate-200/50 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-4 md:p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                    {t("result.loading_transfer_info", { defaultValue: "Loading transfer info..." })}
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-red-50 p-3 dark:bg-red-950/20 text-red-600 dark:text-red-400 mb-3">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
                    {t("result.fetch_error_title", { defaultValue: "Could Not Load Transfer Info" })}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-4">
                    {error}
                  </p>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    {t("common.close", { defaultValue: "Close" })}
                  </button>
                </div>
              )}

              {!loading && !error && data && (
                <>
                  {data.recommendedExit && (
                    <div className="mb-4 rounded-2xl bg-indigo-50/70 p-3.5 border border-indigo-100/40 dark:bg-indigo-950/20 dark:border-indigo-900/20">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">
                        📍 {t("result.recommended_exit", { defaultValue: "Recommended Exit / Platform" })}
                      </span>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {t(`transfers.${data.stationId}.recommendedExit`, { defaultValue: data.recommendedExit })}
                      </p>
                    </div>
                  )}

                  {(data.guidanceZh || data.guidanceEn) && (
                    <div className="mb-5 rounded-2xl bg-amber-50/70 p-3.5 border border-amber-100/40 dark:bg-amber-950/20 dark:border-amber-900/20">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-1">
                        💡 {t("result.smart_guidance", { defaultValue: "Smart Transfer Guide" })}
                      </span>
                      <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-bold">
                        {i18n.language.startsWith("zh") ? (
                          data.guidanceZh ? (
                            <p className="text-slate-900 dark:text-slate-100">
                              {t(`transfers.${data.stationId}.guidance`, { defaultValue: data.guidanceZh })}
                            </p>
                          ) : (
                            <p className="text-slate-500 dark:text-slate-400 italic font-medium">
                              {t(`transfers.${data.stationId}.guidance`, { defaultValue: data.guidanceEn })}
                            </p>
                          )
                        ) : (
                          data.guidanceEn ? (
                            <p className="text-slate-800 dark:text-slate-200">
                              {t(`transfers.${data.stationId}.guidance`, { defaultValue: data.guidanceEn })}
                            </p>
                          ) : (
                            <p className="text-slate-900 dark:text-slate-100">
                              {t(`transfers.${data.stationId}.guidance`, { defaultValue: data.guidanceZh })}
                            </p>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {data.description && (
                    <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
                      {t(`transfers.${data.stationId}.description`, { defaultValue: data.description })}
                    </p>
                  )}
                  
                  <div className="space-y-5">
                    {data.transferLines && data.transferLines.map((categoryGroup, idx) => {
                      const categoryKey = categoryGroup.category
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_+|_+$/g, "");
                      const translatedCategory = t(`transferCategories.${categoryKey}`, { defaultValue: categoryGroup.category });

                      return (
                        <div key={idx}>
                          <h4 className="mb-2.5 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {translatedCategory}
                          </h4>
                          <div className="space-y-2">
                            {categoryGroup.lines && categoryGroup.lines.map((line, lIdx) => {
                              const lineKey = normalizeKey(line.name);
                              const translatedLineName = t(`transferLines.${lineKey}`, {
                                defaultValue: stationLabel(t, line.name, country || (data?.country?.toLowerCase() as Country))
                              });
                              const translatedLineNotes = line.notes
                                ? t(`transferLineNotes.${normalizeKey(line.notes)}`, {
                                    defaultValue: t(`station.${line.notes}`, { defaultValue: line.notes })
                                  })
                                : undefined;

                              return (
                                <div key={lIdx} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                                  <div
                                    className="h-3 w-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: line.color || "#cbd5e1" }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="truncate font-bold text-slate-800 dark:text-slate-200 text-sm">
                                      {translatedLineName}
                                    </div>
                                    {translatedLineNotes && (
                                      <div className="truncate text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {translatedLineNotes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
