import { buildCountryMetadata } from "./scrapers/artifactBuilder";

const summaries = buildCountryMetadata();
console.log("Scraped metadata rebuilt from the committed files:");
for (const summary of summaries) {
  console.log(
    `  ${summary.country}: ${summary.routeCount} routes, ${summary.recordCount} rows`
    + `, ${summary.coverage.verifiedRoutes} verified / ${summary.coverage.unverifiedRoutes} unverified`,
  );
}
