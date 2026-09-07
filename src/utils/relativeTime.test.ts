import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

const now = new Date("2026-09-07T18:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("notification timestamps read as distance, not as a clock reading", () => {
  it("counts in the largest unit that is still under a day", () => {
    expect(formatRelativeTime(ago(0.5), "en", now)).toBe("30 seconds ago");
    expect(formatRelativeTime(ago(10), "en", now)).toBe("10 minutes ago");
    expect(formatRelativeTime(ago(3 * 60), "en", now)).toBe("3 hours ago");
  });

  it("hands over to a plain date once the distance stops being useful", () => {
    // Three days back, "3 days ago" says less than the date itself does. The
    // day is asserted loosely because the date is rendered in the reader's own
    // zone, which moves it across midnight depending on where they are.
    const older = formatRelativeTime(ago(3 * 24 * 60), "en", now);
    expect(older).not.toContain("ago");
    expect(older).toMatch(/^Sep \d{1,2}$/);
    // A different year has to say which one.
    expect(formatRelativeTime("2025-12-24T09:00:00Z", "en", now)).toMatch(/^Dec \d{1,2}, 2025$/);
  });

  it("speaks the locale it is handed", () => {
    expect(formatRelativeTime(ago(10), "zh-TW", now)).toContain("10");
    expect(formatRelativeTime(ago(10), "ja", now)).toContain("10");
    expect(formatRelativeTime(ago(10), "ko", now)).toContain("10");
  });

  it("says nothing rather than 'Invalid Date' for an unusable timestamp", () => {
    expect(formatRelativeTime("not-a-date", "en", now)).toBe("");
  });
});
