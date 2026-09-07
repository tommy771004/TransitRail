import { X, Activity } from "lucide-react";
import { motion } from "motion/react";

interface DiagnosticOverlayProps {
  diagnostic: any;
  onClose: () => void;
}

export function DiagnosticOverlay({ diagnostic, onClose }: DiagnosticOverlayProps) {
  if (!diagnostic) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
        className="m3-dialog flex max-h-[80vh] w-full max-w-2xl flex-col bg-white dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h2 className="m3-title-large text-slate-900 dark:text-white">API Diagnostics</h2>
          </div>
          <button onClick={onClose} className="m3-icon-button m3-state text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="m3-label-medium mb-1 uppercase text-slate-500 dark:text-slate-400">Request URL</h3>
            <p className="m3-card break-all border border-slate-100 bg-slate-50 p-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {diagnostic.url}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="m3-label-medium mb-1 uppercase text-slate-500 dark:text-slate-400">Status</h3>
              <p className="font-mono text-sm">
                <span className={diagnostic.status >= 400 ? "text-red-600 font-bold dark:text-red-400" : "text-emerald-600 font-bold dark:text-emerald-400"}>
                  {diagnostic.status} {diagnostic.statusText}
                </span>
              </p>
            </div>
            <div>
              <h3 className="m3-label-medium mb-1 uppercase text-slate-500 dark:text-slate-400">Duration</h3>
              <p className="font-mono text-sm text-slate-900 dark:text-slate-200">{diagnostic.duration}ms</p>
            </div>
          </div>

          <div>
            <h3 className="m3-label-medium mb-1 uppercase text-slate-500 dark:text-slate-400">Response Headers</h3>
            <div className="m3-card overflow-x-auto border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
            <h3 className="m3-label-medium mb-1 uppercase text-slate-500 dark:text-slate-400">Raw Response Body</h3>
            <pre className="m3-card max-h-60 overflow-x-auto whitespace-pre-wrap border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-100">
              {diagnostic.rawResponse || "(Empty Response)"}
            </pre>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
