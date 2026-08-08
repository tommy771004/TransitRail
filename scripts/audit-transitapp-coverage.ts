import dotenv from "dotenv";
import { countryOptions } from "../src/data/countries";
import { getStationsForCountry } from "../src/server/catalog";
import { transitAppClient } from "../src/server/transitApp";
import type { Country } from "../src/types";

dotenv.config();

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const requestedCountry = argument("--country");
const countries = requestedCountry ? [requestedCountry] : countryOptions;
if (requestedCountry && !countryOptions.includes(requestedCountry as Country)) {
  throw new Error(`Unknown country: ${requestedCountry}`);
}

const reports = [];
for (const country of countries as Country[]) {
  const { stations } = await getStationsForCountry(country);
  reports.push(await transitAppClient.auditStations(country, stations));
}

// This is a non-published, provider-labelled lead for source discovery. It is
// deliberately never written to scraped data, the source registry, or SEO.
process.stdout.write(`${JSON.stringify({ provider: "Transit", reports }, null, 2)}\n`);
