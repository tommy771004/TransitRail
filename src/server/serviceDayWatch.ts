import { getCountryCapability } from "../data/countryCapability";
import { countryConfig } from "../data/countries";
import type { Country, ServiceDayAdvisory, ServiceDayType } from "../types";
import { getFranceServiceDayAdvisory } from "./franceGtfs";
import { searchMbtaJourney } from "./mbta";
import { getThailandServiceDayAdvisory } from "./thailandBem";
import { searchTflJourney } from "./tfl";

export interface WatchedServiceRoute {
  origin: string;
  destination: string;
  country: Country;
  serviceDate: string;
  selectedTime?: string;
}

function serviceDayType(date: string, timezone: string): ServiceDayType {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" })
    .format(new Date(`${date}T12:00:00Z`));
  if (weekday === "Saturday") return "saturday";
  if (weekday === "Sunday") return "sunday_holiday";
  return "weekday";
}

/** Explicit unavailable state used when no adapter can provide service-day data. */
export function unavailableServiceDayAdvisory(route: WatchedServiceRoute): ServiceDayAdvisory {
  const capability = getCountryCapability(route.country).serviceDay;
  const timezone = countryConfig[route.country].timeZone;
  return {
    coverage: "unavailable",
    serviceDate: route.serviceDate,
    timezone,
    serviceDayType: serviceDayType(route.serviceDate, timezone),
    risk: "unavailable",
    source: capability.source,
    sourceUrl: capability.sourceUrl,
    checkedAt: new Date().toISOString(),
    note: capability.scope,
  };
}

/**
 * Resolve only the shared advisory for a saved-route check. Unsupported
 * markets return explicit unavailable coverage, never a changed boundary.
 */
export async function serviceDayAdvisoryForWatch(route: WatchedServiceRoute): Promise<ServiceDayAdvisory> {
  switch (route.country) {
    case "france":
      return getFranceServiceDayAdvisory(route.origin, route.destination, route.serviceDate, route.selectedTime);
    case "thailand":
      return getThailandServiceDayAdvisory(route.origin, route.destination, route.serviceDate, route.selectedTime);
    case "united_kingdom": {
      const response = await searchTflJourney(route.origin, route.destination, route.serviceDate, route.selectedTime);
      return response.status >= 200 && response.status < 300
        ? response.body.serviceDayAdvisory || unavailableServiceDayAdvisory(route)
        : unavailableServiceDayAdvisory(route);
    }
    case "united_states": {
      const response = await searchMbtaJourney(route.origin, route.destination, route.serviceDate, route.selectedTime);
      return response.status >= 200 && response.status < 300
        ? response.body.serviceDayAdvisory || unavailableServiceDayAdvisory(route)
        : unavailableServiceDayAdvisory(route);
    }
    default:
      return unavailableServiceDayAdvisory(route);
  }
}
