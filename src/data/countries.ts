import type { Country } from "../types";

export const countryOptions: Country[] = [
  "japan",
  "korea",
  "taiwan",
  "singapore",
  "thailand",
  "hong_kong",
  "united_kingdom",
  "united_states",
  "germany",
  "france",
  "china",
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
    provider: "Scraped (Jorudan)",
    originPlaceholder: "Tokyo",
    destinationPlaceholder: "Shin-Osaka",
    featuredStations: ["Tokyo", "Shinagawa", "Kyoto", "Shin-Osaka", "Nagoya"],
    promptName: "日本",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Tokyo",
  },
  korea: {
    labelKey: "search.korea",
    provider: "Scraped (Korail)",
    originPlaceholder: "Seoul (SNC)",
    destinationPlaceholder: "Busan (BSN)",
    featuredStations: ["Seoul (SNC)", "Yongsan", "Daejeon", "Dongdaegu", "Busan (BSN)"],
    promptName: "韓國",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Seoul",
  },
  taiwan: {
    labelKey: "search.taiwan",
    provider: "Scraped (TRA/THSR)",
    originPlaceholder: "Taipei",
    destinationPlaceholder: "Zuoying",
    featuredStations: ["Taipei", "Taichung", "Zuoying", "Kaohsiung", "Hualien"],
    promptName: "台灣",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Taipei",
  },
  singapore: {
    labelKey: "search.singapore",
    provider: "Scraped (LTA)",
    originPlaceholder: "Jurong East",
    destinationPlaceholder: "Raffles Place",
    featuredStations: ["Jurong East", "Raffles Place", "City Hall", "Orchard", "Woodlands"],
    promptName: "新加坡",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Singapore",
  },
  thailand: {
    labelKey: "search.thailand",
    provider: "Scraped (BTS/MRT)",
    originPlaceholder: "Siam",
    destinationPlaceholder: "Sukhumvit",
    featuredStations: ["Siam", "Chit Lom", "Asok", "Mo Chit", "Sukhumvit"],
    promptName: "泰國",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Bangkok",
  },
  hong_kong: {
    labelKey: "search.hong_kong",
    provider: "Scraped (MTR)",
    originPlaceholder: "Central",
    destinationPlaceholder: "Tsuen Wan",
    featuredStations: ["Central", "Admiralty", "Tsim Sha Tsui", "Mong Kok", "Causeway Bay"],
    promptName: "香港",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Hong_Kong",
  },
  united_kingdom: {
    labelKey: "search.united_kingdom",
    provider: "Scraped (TfL)",
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
    liveOnly: false,
    timeZone: "Europe/London",
  },
  united_states: {
    labelKey: "search.united_states",
    provider: "Scraped (MBTA)",
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
    liveOnly: false,
    timeZone: "America/New_York",
  },
  germany: {
    labelKey: "search.germany",
    provider: "Scraped (DB)",
    originPlaceholder: "Berlin Hbf",
    destinationPlaceholder: "Munich Hbf",
    featuredStations: ["Berlin Hbf", "Hamburg Hbf", "Munich Hbf", "Frankfurt Hbf", "Cologne Hbf"],
    promptName: "德國",
    connected: true,
    liveOnly: false,
    timeZone: "Europe/Berlin",
  },
  france: {
    labelKey: "search.france",
    provider: "Scraped (SNCF)",
    originPlaceholder: "Paris Gare de Lyon",
    destinationPlaceholder: "Lyon Part-Dieu",
    featuredStations: ["Paris Gare de Lyon", "Lyon Part-Dieu", "Marseille St-Charles", "Lille Europe", "Strasbourg"],
    promptName: "法國",
    connected: true,
    liveOnly: false,
    timeZone: "Europe/Paris",
  },
  china: {
    labelKey: "search.china",
    provider: "Scraped (12306)",
    originPlaceholder: "Beijing South",
    destinationPlaceholder: "Shanghai Hongqiao",
    featuredStations: ["Beijing South", "Shanghai Hongqiao", "Guangzhou South", "Shenzhen North", "Chengdu East"],
    promptName: "中國",
    connected: true,
    liveOnly: false,
    timeZone: "Asia/Shanghai",
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
