// Description: Hides a bottom bar while the passenger scrolls down and brings it back on
// the first scroll up, the way Safari's own toolbar behaves.
//
// Finger jitter does not flicker it: the page has to travel HIDE_AFTER px down (or
// SHOW_AFTER px up) in one direction before the state changes, and a change of
// direction resets the count. The bar always shows near the top of the page, at the very
// end of the page (so the footer stays reachable and the iOS rubber-band bounce does not
// hide it), and while `force` is set. Scroll events are read once per frame.

import { useEffect, useRef, useState } from "react";

export const HIDE_TOP_ZONE = 64;
export const HIDE_BOTTOM_ZONE = 24;
export const HIDE_AFTER = 28;
export const SHOW_AFTER = 10;

export interface HideScrollState {
  hidden: boolean;
  lastY: number;
  /** Signed distance travelled in the current direction. */
  travel: number;
}

/** One scroll reading → the next state. Pure, so the thresholds are testable. */
export function stepHideOnScroll(
  state: HideScrollState,
  rawY: number,
  maxY: number,
  force = false,
): HideScrollState {
  const max = Math.max(0, maxY);
  // Clamp the rubber-band overscroll iOS reports past either end.
  const y = Math.min(Math.max(0, rawY), max);
  const dy = y - state.lastY;
  if (force || y < HIDE_TOP_ZONE || max - y < HIDE_BOTTOM_ZONE) {
    return { hidden: false, lastY: y, travel: 0 };
  }
  if (dy === 0) return { ...state, lastY: y };
  const reversed = (dy > 0 && state.travel < 0) || (dy < 0 && state.travel > 0);
  const travel = (reversed ? 0 : state.travel) + dy;
  let hidden = state.hidden;
  if (travel > HIDE_AFTER) hidden = true;
  else if (travel < -SHOW_AFTER) hidden = false;
  return { hidden, lastY: y, travel };
}

export function useHideOnScroll(force: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  const stateRef = useRef<HideScrollState>({ hidden: false, lastY: 0, travel: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    stateRef.current = { hidden: force ? false : stateRef.current.hidden, lastY: Math.max(0, window.scrollY), travel: 0 };
    if (force) setHidden(false);
    let frame = 0;

    const read = () => {
      frame = 0;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const next = stepHideOnScroll(stateRef.current, window.scrollY, maxY, force);
      if (next.hidden !== stateRef.current.hidden) setHidden(next.hidden);
      stateRef.current = next;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [force]);

  return hidden && !force;
}
