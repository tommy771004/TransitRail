import { useTranslation } from "react-i18next";

export function ResultSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="w-full space-y-4 px-2 py-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-stone-100 bg-stone-50 px-4 py-3 flex items-center justify-between">
            <div className="h-5 w-24 rounded bg-stone-200"></div>
            <div className="h-4 w-16 rounded bg-stone-200"></div>
          </div>
          
          {/* Body */}
          <div className="px-4 py-4">
            <div className="relative">
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-stone-200" />
              
              <ul className="space-y-4">
                <li className="relative pl-6">
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-stone-300 bg-stone-100" />
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-32 rounded bg-stone-200"></div>
                    <div className="h-4 w-12 rounded bg-stone-200"></div>
                  </div>
                  <div className="mt-2 h-3 w-20 rounded bg-stone-100"></div>
                </li>
                
                <li className="relative pl-6">
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-stone-300 bg-stone-100" />
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-40 rounded bg-stone-200"></div>
                    <div className="h-4 w-12 rounded bg-stone-200"></div>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-stone-100 px-4 py-3 flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-stone-100"></div>
            <div className="h-8 w-8 rounded-full bg-stone-100"></div>
          </div>
        </div>
      ))}
      <div className="flex justify-center mt-2">
        <p className="text-sm font-medium text-stone-400">{t("result.searching", { defaultValue: "Searching..." })}</p>
      </div>
    </div>
  );
}
