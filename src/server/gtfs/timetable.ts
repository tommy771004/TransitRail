import type { Country, TransitResult } from "../../types";
import type { GtfsFeed } from "./feed";
import { formatGtfsClock, type GtfsJourney } from "./journeys";

type GtfsTimetableOptions = {
  origin: string;
  destination: string;
  country: Country;
  operator: string;
  idPrefix: string;
  serviceLabel: (feed: GtfsFeed, journey: GtfsJourney) => string;
  headsign?: (journey: GtfsJourney) => string | undefined;
};

export function buildGtfsTimetable(
  feed: GtfsFeed,
  journeys: readonly GtfsJourney[],
  options: GtfsTimetableOptions,
): TransitResult[] {
  return journeys.map((journey) => {
    const headsign = options.headsign?.(journey);
    return {
      id: `${options.idPrefix}-${journey.tripId}`,
      country: options.country,
      operator: options.operator,
      service: options.serviceLabel(feed, journey),
      departureTime: formatGtfsClock(journey.departure),
      arrivalTime: formatGtfsClock(journey.arrival),
      durationMinutes: journey.arrival - journey.departure,
      origin: options.origin,
      destination: options.destination,
      direct: true,
      stops: [],
      ...(headsign ? { headsign } : {}),
    };
  });
}
