import { describe, expect, it } from "vitest";
import { HIDE_AFTER, SHOW_AFTER, stepHideOnScroll, type HideScrollState } from "./useHideOnScroll";

const MAX = 5000;
const start = (y: number): HideScrollState => ({ hidden: false, lastY: y, travel: 0 });

function scrollTo(state: HideScrollState, ...ys: number[]) {
  return ys.reduce((s, y) => stepHideOnScroll(s, y, MAX), state);
}

describe("stepHideOnScroll", () => {
  it("hides only after travelling past the threshold downward", () => {
    const near = scrollTo(start(200), 200 + HIDE_AFTER);
    expect(near.hidden).toBe(false);
    expect(scrollTo(near, 200 + HIDE_AFTER + 1).hidden).toBe(true);
  });

  it("returns after a short scroll up and resets the count on a direction change", () => {
    const hidden = scrollTo(start(200), 300);
    expect(hidden.hidden).toBe(true);
    const jitter = scrollTo(hidden, 300 - SHOW_AFTER);
    expect(jitter.hidden).toBe(true);
    expect(scrollTo(jitter, 300 - SHOW_AFTER - 1).hidden).toBe(false);
  });

  it("always shows near the top, at the end of the page, and while forced", () => {
    const hidden = scrollTo(start(200), 400);
    expect(scrollTo(hidden, 40).hidden).toBe(false);
    expect(scrollTo(hidden, MAX - 10).hidden).toBe(false);
    expect(stepHideOnScroll(hidden, 600, MAX, true).hidden).toBe(false);
  });

  it("treats rubber-band overscroll past the end as the end", () => {
    const hidden = scrollTo(start(200), 400);
    expect(stepHideOnScroll(hidden, MAX + 80, MAX).hidden).toBe(false);
  });
});
