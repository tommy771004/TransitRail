import { searchMalaysiaKtmbGtfs } from "../../src/server/malaysiaGtfs";
import { OfficialFeedScraper } from "./kinds";
import { malaysiaKtmbRoutes } from "./routes";

/**
 * The feed is re-read for every scrape window. OfficialFeedScraper preserves
 * the previous route slice on an unavailable feed or an uncovered service date.
 */
export class MalaysiaKtmbScraper extends OfficialFeedScraper {
  constructor() {
    super(
      "data.gov.my KTMB GTFS",
      "malaysia",
      malaysiaKtmbRoutes,
      "my-ktmb-gtfs",
      searchMalaysiaKtmbGtfs,
    );
  }
}
