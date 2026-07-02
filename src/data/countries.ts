import type { Country } from "../types";

export const countryOptions: Country[] = [
  "japan",
  "korea",
  "hong_kong",
  "united_kingdom",
  "united_states",
];

export const countryConfig: Record<Country, {
  labelKey: string;
  provider: string;
  originPlaceholder: string;
  destinationPlaceholder: string;
  featuredStations: string[];
  promptName: string;
  connected: boolean;
  /** Provider only serves live "today" data; the date field is locked. */
  liveOnly: boolean;
  timeZone: string;
}> = {
  japan: {
    labelKey: "search.japan",
    provider: "ODPT",
    originPlaceholder: "Tokyo",
    destinationPlaceholder: "Shin-Osaka",
    featuredStations: ["Tokyo", "Shinagawa", "Kyoto", "Shin-Osaka", "Nagoya"],
    promptName: "日本",
    connected: false,
    liveOnly: false,
    timeZone: "Asia/Tokyo",
  },
  korea: {
    labelKey: "search.korea",
    provider: "ODsay",
    originPlaceholder: "Seoul (SNC)",
    destinationPlaceholder: "Busan (BSN)",
    featuredStations: ["Seoul (SNC)", "Yongsan", "Daejeon", "Dongdaegu", "Busan (BSN)"],
    promptName: "韓國",
    connected: false,
    liveOnly: false,
    timeZone: "Asia/Seoul",
  },
  hong_kong: {
    labelKey: "search.hong_kong",
    provider: "MTR Next Train",
    originPlaceholder: "Central",
    destinationPlaceholder: "Tsuen Wan",
    featuredStations: ["Central", "Admiralty", "Tsim Sha Tsui", "Mong Kok", "Causeway Bay"],
    promptName: "香港",
    connected: true,
    liveOnly: true,
    timeZone: "Asia/Hong_Kong",
  },
  united_kingdom: {
    labelKey: "search.united_kingdom",
    provider: "TfL Unified API",
    originPlaceholder: "King's Cross St. Pancras",
    destinationPlaceholder: "Oxford Circus",
    featuredStations: [
      "King's Cross St. Pancras Underground Station",
      "Oxford Circus Underground Station",
      "Victoria Underground Station",
      "Waterloo Underground Station",
      "London Bridge Underground Station",
    ],
    promptName: "英國倫敦",
    connected: true,
    liveOnly: true,
    timeZone: "Europe/London",
  },
  united_states: {
    labelKey: "search.united_states",
    provider: "MBTA V3 API",
    originPlaceholder: "South Station",
    destinationPlaceholder: "Back Bay",
    featuredStations: [
      "South Station",
      "Back Bay",
      "North Station",
      "Park Street",
      "Harvard",
    ],
    promptName: "美國波士頓",
    connected: true,
    liveOnly: true,
    timeZone: "America/New_York",
  },
};

export function providerDateValue(country: Country) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: countryConfig[country].timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
