import { runAllScrapers } from "./scrapers";

const SCRAPE_WINDOW_DAYS = 7;
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
  const dateArg = process.argv[2];
  const startDate = dateArg || dateInTimeZone(DEFAULT_TIME_ZONE);
  const dates = getScrapeDates(startDate, SCRAPE_WINDOW_DAYS);

  console.log(`Scrape dates: ${dates.join(", ")}`);
  await runAllScrapers(dates);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
