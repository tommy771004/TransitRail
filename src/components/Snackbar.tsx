import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/**
 * Transient confirmation of something the passenger just did.
 *
 * The alerts page used to carry these — "Route added", "Seat preference saved",
 * "Trip details copied", the browser-permission plumbing — so a page meant for
 * transit information filled up with receipts for taps the passenger had
 * already watched happen. Those belong to the moment, not to a list you can
 * come back to, which is exactly what M3 gives a snackbar.
 *
 * No action button on purpose: a control here would have to work, and every
 * message this shows is already the end of its own interaction.
 */
export const SNACKBAR_DURATION_MS = 4000;

/** Identified rather than compared by text, so the same message twice in a row
 *  is two snackbars and each one gets its own full four seconds. */
export interface SnackbarMessage {
  id: number;
  text: string;
}

export function Snackbar({ snack, onDismiss }: { snack?: SnackbarMessage; onDismiss: () => void }) {
  const reduceMotion = useReducedMotion();
  // The caller's handler is re-created on every render of the app shell, and a
  // dependency on it restarted this timer each time — a snackbar could then sit
  // on screen for as long as anything above it kept re-rendering.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  const id = snack?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(() => dismiss.current(), SNACKBAR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [id]);

  // `mode="wait"` so a second message replaces the first in sequence: without
  // it both bars are mounted at the same offset during the 200ms crossfade.
  return (
    <AnimatePresence mode="wait">
      {snack && (
        <motion.div
          key={snack.id}
          // The slide is the only thing animated in: at full opacity from the
          // first frame, so a stalled animation still leaves the message read.
          initial={reduceMotion ? false : { y: 24 }}
          animate={{ y: 0 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          role="status"
          className="fixed inset-x-0 z-[70] mx-auto flex max-w-md px-4"
          style={{ bottom: "calc(80px + env(safe-area-inset-bottom) + 16px)" }}
        >
          <div className="m3-shape-xs m3-elevation-3 m3-body-medium flex min-h-12 w-full items-center px-4 py-3 bg-slate-800 text-slate-100 dark:bg-slate-100 dark:text-slate-900">
            {snack.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
