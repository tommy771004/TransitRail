/**
 * "10 分鐘前" rather than "9/7/2026, 5:10:00 PM".
 *
 * A notification is read at a glance, and what matters about its timestamp is
 * how fresh it is, not the second it was written. A full machine timestamp
 * makes the reader do the subtraction themselves.
 *
 * Past a day the distance stops being useful ("3 天前" tells you less than the
 * date does), so it hands over to a plain month-and-day.
 *
 * `now` is injected so this is testable without freezing the clock.
 */
export function formatRelativeTime(iso: string, locale: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const absolute = Math.abs(seconds);

  if (absolute < 24 * 60 * 60) {
    // `numeric: "auto"` is what turns -1 day into "yesterday" in every locale
    // that has a word for it, instead of "1 day ago".
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (absolute < 60) return relative.format(seconds, "second");
    if (absolute < 60 * 60) return relative.format(Math.round(seconds / 60), "minute");
    return relative.format(Math.round(seconds / 3600), "hour");
  }

  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(then);
}
