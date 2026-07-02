import { X, Activity } from "lucide-react";

interface DiagnosticOverlayProps {
  diagnostic: any;
  onClose: () => void;
}

export function DiagnosticOverlay({ diagnostic, onClose }: DiagnosticOverlayProps) {
  if (!diagnostic) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/60 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-stone-500" />
            <h2 className="text-base font-semibold text-stone-900">API Diagnostics</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">Request URL</h3>
            <p className="font-mono text-sm text-stone-900 bg-stone-50 p-2 rounded border border-stone-100 break-all">
              {diagnostic.url}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">Status</h3>
              <p className="font-mono text-sm">
                <span className={diagnostic.status >= 400 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                  {diagnostic.status} {diagnostic.statusText}
                </span>
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">Duration</h3>
              <p className="font-mono text-sm text-stone-900">{diagnostic.duration}ms</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">Response Headers</h3>
            <div className="font-mono text-xs text-stone-800 bg-stone-50 p-2 rounded border border-stone-100 overflow-x-auto">
              {Object.entries(diagnostic.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-semibold text-stone-600">{key}:</span>
                  <span className="truncate">{value as string}</span>
                </div>
              ))}
              {Object.keys(diagnostic.headers).length === 0 && <span className="text-stone-400">No headers</span>}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">Raw Response Body</h3>
            <pre className="font-mono text-xs bg-stone-900 text-stone-100 p-3 rounded border border-stone-800 overflow-x-auto whitespace-pre-wrap max-h-60">
              {diagnostic.rawResponse || "(Empty Response)"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
