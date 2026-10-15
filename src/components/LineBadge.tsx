// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: A ride's name as the platform signs draw it — a short line code on a
// white tile ringed in the line colour, then whatever of the name the code does not say.

import type { CSSProperties } from "react";
import { lineBadge } from "../utils/lineBadge";

interface LineLabelProps {
  name?: string;
  code?: string;
  /** The line colour; the ring carries it so the code itself stays legible ink. */
  color: string;
  className?: string;
}

export function LineBadge({ code, color }: { code: string; color: string }) {
  return (
    <span
      className="m3-label-small m3-shape-xs inline-flex h-5 min-w-7 shrink-0 items-center justify-center border-2 border-[var(--lc)] bg-white px-1 font-mono font-bold leading-none text-slate-900 dark:border-[color-mix(in_srgb,var(--lc)_78%,white)] dark:bg-slate-950 dark:text-white"
      style={{ "--lc": color } as CSSProperties}
      data-line-badge
    >
      {code}
    </span>
  );
}

/** Badge and text together; renders nothing when the ride has neither. */
export function LineLabel({ name, code, color, className = "" }: LineLabelProps) {
  const label = lineBadge(name, code);
  if (!label.code && !label.text) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 align-middle ${className}`}>
      {label.code ? <LineBadge code={label.code} color={color} /> : null}
      {label.text ? <span className="min-w-0">{label.text}</span> : null}
    </span>
  );
}

// --- End of LineBadge.tsx ---
