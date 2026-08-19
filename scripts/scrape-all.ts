import { runAllScrapers } from "./scrapers";
import { SCRAPE_WINDOW_DAYS } from "../src/data/countries";
import { recordError } from "../src/server/errorLog";

const DEFAULT_TIME_ZONE = "Asia/Taipei";

function dateInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not determine current date for ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function addDays(date: string, offset: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + offset));
  return next.toISOString().split("T")[0];
}

function getScrapeDates(startDate: string, days: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error(`Invalid scrape date "${startDate}". Expected YYYY-MM-DD.`);
  }

  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

async function main() {
  const args = process.argv.slice(2);
  // A live-only pass refreshes just the markets whose source answers for today
  // and no other date, so it collects one date rather than the full window.
  const onlyLiveOnly = args.includes("--live-only");
  const dateArg = args.find((arg) => !arg.startsWith("--"));
  const startDate = dateArg || dateInTimeZone(DEFAULT_TIME_ZONE);
  const dates = onlyLiveOnly ? [startDate] : getScrapeDates(startDate, SCRAPE_WINDOW_DAYS);

  console.log(`Scrape dates: ${dates.join(", ")}`);
  await runAllScrapers(dates, { onlyLiveOnly });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  void recordError({
    severity: "critical",
    module: "scraper",
    operation: "scheduled-run",
    errorCode: "SCRAPE_RUN_FATAL",
    error,
  }).finally(() => {
    process.exit(1);
  });
});
