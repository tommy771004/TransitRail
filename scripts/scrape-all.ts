import { runAllScrapers } from "./scrapers";

async function main() {
  const dateArg = process.argv[2];
  const date = dateArg || new Date().toISOString().split("T")[0];

  console.log(`Scrape date: ${date}`);
  await runAllScrapers(date);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
