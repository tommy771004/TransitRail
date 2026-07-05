import { X, Activity } from "lucide-react";

interface DiagnosticOverlayProps {
  diagnostic: any;
  onClose: () => void;
}

export function DiagnosticOverlay({ diagnostic, onClose }: DiagnosticOverlayProps) {
  if (!diagnostic) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">API Diagnostics</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Request URL</h3>
            <p className="font-mono text-sm text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100 break-all dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
              {diagnostic.url}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Status</h3>
              <p className="font-mono text-sm">
                <span className={diagnostic.status >= 400 ? "text-red-600 font-bold dark:text-red-400" : "text-emerald-600 font-bold dark:text-emerald-400"}>
                  {diagnostic.status} {diagnostic.statusText}
                </span>
              </p>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Duration</h3>
              <p className="font-mono text-sm text-slate-900 dark:text-slate-200">{diagnostic.duration}ms</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Response Headers</h3>
            <div className="font-mono text-xs text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100 overflow-x-auto dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {Object.entries(diagnostic.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-bold text-slate-600 dark:text-slate-400">{key}:</span>
                  <span className="truncate">{value as string}</span>
                </div>
              ))}
              {Object.keys(diagnostic.headers).length === 0 && <span className="text-slate-400">No headers</span>}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Raw Response Body</h3>
            <pre className="font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-60">
              {diagnostic.rawResponse || "(Empty Response)"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
