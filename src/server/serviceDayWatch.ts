import type { Country, ServiceDayAdvisory } from "../types";
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

/**
 * Resolve only the shared advisory for a saved-route check. Unsupported
 * markets intentionally return undefined; a missing advisory must not be
 * mistaken for a changed timetable boundary.
 */
export async function serviceDayAdvisoryForWatch(route: WatchedServiceRoute): Promise<ServiceDayAdvisory | undefined> {
  switch (route.country) {
    case "france":
      return getFranceServiceDayAdvisory(route.origin, route.destination, route.serviceDate, route.selectedTime);
    case "thailand":
      return getThailandServiceDayAdvisory(route.origin, route.destination, route.serviceDate, route.selectedTime);
    case "united_kingdom": {
      const response = await searchTflJourney(route.origin, route.destination, route.serviceDate, route.selectedTime);
      return response.status >= 200 && response.status < 300 ? response.body.serviceDayAdvisory : undefined;
    }
    case "united_states": {
      const response = await searchMbtaJourney(route.origin, route.destination, route.serviceDate, route.selectedTime);
      return response.status >= 200 && response.status < 300 ? response.body.serviceDayAdvisory : undefined;
    }
    default:
      return undefined;
  }
}
