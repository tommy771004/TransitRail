// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: The modal bottom sheet a result card opens. On a phone it rises from the
// bottom edge; from 640px up it is a centred dialog. The list underneath keeps its scroll
// position, which an inline expansion never could.

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TransitResult } from "../types";
import { RouteBand } from "./RouteBand";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";

interface TripSheetProps {
  open: boolean;
  onClose: () => void;
  /** Id of the dialog surface, so the card's `aria-controls` can point at it. */
  panelId: string;
  trip: TransitResult;
  title?: ReactNode;
  /** A nested modal (transfer info) that must stack above the sheet. */
  popup?: ReactNode;
  /** Save / seat actions, pinned above the body. */
  actions?: ReactNode;
  /** While a layer sits on top of the sheet, Escape closes that layer instead. */
  onEscape?: () => void;
  children: ReactNode;
}

export function TripSheet({ open, onClose, panelId, trip, title, popup, actions, onEscape, children }: TripSheetProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  // Read through a ref so a re-rendered handler never re-runs the open effect
  // (which would bounce focus back to the card while the sheet is up).
  const onEscapeRef = useRef(onClose);
  onEscapeRef.current = onEscape ?? onClose;

  // The trap wraps the whole sheet root, so a nested popup stays inside it.
  // It moves focus to the first control (Close), keeps Tab inside, routes
  // Escape to the top layer, and restores focus to the card on close.
  useModalFocusTrap(rootRef, () => onEscapeRef.current(), open);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const titleId = `${panelId}-title`;
  const node = (
    // `hidden` keeps the panel in the tree (tests and screen readers can find
    // it) while Tailwind's preflight removes it from layout and the tab order.
    <div ref={rootRef} hidden={!open} className="fixed inset-0 z-[70]" data-trip-sheet>
      <div className="m3-scrim m3-scrim-enter absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="m3-sheet-dialog m3-elevation-3 m3-sheet-enter absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden bg-white dark:bg-slate-900 sm:inset-0 sm:m-auto sm:h-fit"
      >
        <div className="m3-drag-handle mx-auto mt-2.5 shrink-0 bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 pb-3 pt-3 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m3-title-medium truncate text-slate-900 dark:text-white">
              {title ?? trip.service}
            </h2>
            <RouteBand trip={trip} className="mt-2" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="m3-icon-button m3-state shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            aria-label={t("result.close", { defaultValue: "Close" })}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:px-6">
          {actions ? <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
          {children}
        </div>
      </div>
      {popup}
    </div>
  );

  // The card that owns this sheet animates with `layout`; a transformed
  // ancestor would pin a fixed child to the card instead of the viewport, so
  // the sheet lives on <body>. The server (and the static tests) keep it inline.
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

// --- End of TripSheet.tsx ---
