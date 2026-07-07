import type { Country } from "../types";

export const countryFlags: Record<string, string> = {
  japan: "🇯🇵",
  korea: "🇰🇷",
  singapore: "🇸🇬",
  thailand: "🇹🇭",
  hong_kong: "🇭🇰",
  united_kingdom: "🇬🇧",
  united_states: "🇺🇸",
  germany: "🇩🇪",
  france: "🇫🇷",
  switzerland: "🇨🇭",
  china: "🇨🇳",
  taiwan: "🇹🇼",
};

export const countryOptions: Country[] = [
  "japan",
  "korea",
  "china",
  "singapore",
  "thailand",
  "hong_kong",
  "united_kingdom",
  "united_states",
  "germany",
  "france",
  "switzerland",
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
    provider: "Official TfL Journey API",
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
    provider: "Official MBTA Realtime",
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
  switzerland: {
    labelKey: "search.switzerland",
    provider: "OpenTransportData Swiss (OJP 2.0)",
    originPlaceholder: "Zürich HB",
    destinationPlaceholder: "Genève",
    featuredStations: ["Zürich HB", "Bern", "Basel SBB", "Lausanne", "Genève"],
    promptName: "瑞士",
    connected: true,
    liveOnly: false,
    timeZone: "Europe/Zurich",
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

export const countryCurrency: Record<Country, string> = {
  japan: "JPY",
  korea: "KRW",
  hong_kong: "HKD",
  united_kingdom: "GBP",
  united_states: "USD",
  singapore: "SGD",
  thailand: "THB",
  germany: "EUR",
  france: "EUR",
  switzerland: "CHF",
  china: "CNY",
};

export const allCurrencies = [
  "TWD", "USD", "EUR", "GBP", "JPY", "KRW", "HKD",
  "CHF", "SGD", "MYR", "THB", "CNY",
  "AUD", "CAD", "NZD", "PHP", "IDR", "VND",
  "SEK", "NOK", "DKK", "PLN", "TRY", "ZAR",
  "BRL", "MXN", "RUB", "INR", "SAR", "AED",
  "ILS", "CZK", "HUF", "RON",
] as const;

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

export const countryThemes: Record<Country, {
  primaryBgLight: string;
  primaryBgDark: string;
  buttonBg: string;
  buttonShadow: string;
  textActive: string;
  borderActive: string;
  badgeBg: string;
  indicatorBg: string;
  dateSelected: string;
  dateLabelSelected: string;
}> = {
  japan: {
    primaryBgLight: "from-rose-500/5",
    primaryBgDark: "dark:from-rose-950/20",
    buttonBg: "bg-rose-600 hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(225,29,72,0.3)] dark:shadow-[0_4px_14px_rgba(225,29,72,0.15)]",
    textActive: "text-rose-600 dark:text-rose-400",
    borderActive: "border-rose-500",
    badgeBg: "border-rose-500 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-400",
    indicatorBg: "bg-rose-500",
    dateSelected: "bg-rose-50 dark:bg-rose-950/30 border-rose-500 dark:border-rose-500/50 text-rose-600 dark:text-rose-400 shadow-sm",
    dateLabelSelected: "text-rose-500/80 dark:text-rose-400/80",
  },
  korea: {
    primaryBgLight: "from-indigo-500/5",
    primaryBgDark: "dark:from-indigo-950/20",
    buttonBg: "bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(79,70,229,0.3)] dark:shadow-[0_4px_14px_rgba(79,70,229,0.15)]",
    textActive: "text-indigo-600 dark:text-indigo-400",
    borderActive: "border-indigo-500",
    badgeBg: "border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-400",
    indicatorBg: "bg-indigo-500",
    dateSelected: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-400 shadow-sm",
    dateLabelSelected: "text-indigo-500/80 dark:text-indigo-400/80",
  },
  singapore: {
    primaryBgLight: "from-fuchsia-500/5",
    primaryBgDark: "dark:from-fuchsia-950/20",
    buttonBg: "bg-fuchsia-600 hover:bg-fuchsia-500 dark:bg-fuchsia-600 dark:hover:bg-fuchsia-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(192,38,211,0.3)] dark:shadow-[0_4px_14px_rgba(192,38,211,0.15)]",
    textActive: "text-fuchsia-600 dark:text-fuchsia-400",
    borderActive: "border-fuchsia-500",
    badgeBg: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/30 dark:text-fuchsia-400",
    indicatorBg: "bg-fuchsia-500",
    dateSelected: "bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-500 dark:border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm",
    dateLabelSelected: "text-fuchsia-500/80 dark:text-fuchsia-400/80",
  },
  thailand: {
    primaryBgLight: "from-amber-500/5",
    primaryBgDark: "dark:from-amber-950/20",
    buttonBg: "bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(217,119,6,0.3)] dark:shadow-[0_4px_14px_rgba(217,119,6,0.15)]",
    textActive: "text-amber-600 dark:text-amber-400",
    borderActive: "border-amber-500",
    badgeBg: "border-amber-500 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-400",
    indicatorBg: "bg-amber-500",
    dateSelected: "bg-amber-50 dark:bg-amber-950/30 border-amber-500 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-sm",
    dateLabelSelected: "text-amber-500/80 dark:text-amber-400/80",
  },
  hong_kong: {
    primaryBgLight: "from-cyan-500/5",
    primaryBgDark: "dark:from-cyan-950/20",
    buttonBg: "bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(8,145,178,0.3)] dark:shadow-[0_4px_14px_rgba(8,145,178,0.15)]",
    textActive: "text-cyan-600 dark:text-cyan-400",
    borderActive: "border-cyan-500",
    badgeBg: "border-cyan-500 bg-cyan-50 text-cyan-600 dark:border-cyan-500/30 dark:bg-cyan-950/30 dark:text-cyan-400",
    indicatorBg: "bg-cyan-500",
    dateSelected: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-500 dark:border-cyan-500/50 text-cyan-600 dark:text-cyan-400 shadow-sm",
    dateLabelSelected: "text-cyan-500/80 dark:text-cyan-400/80",
  },
  united_kingdom: {
    primaryBgLight: "from-blue-500/5",
    primaryBgDark: "dark:from-blue-950/20",
    buttonBg: "bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(37,99,235,0.3)] dark:shadow-[0_4px_14px_rgba(37,99,235,0.15)]",
    textActive: "text-blue-600 dark:text-blue-400",
    borderActive: "border-blue-500",
    badgeBg: "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-400",
    indicatorBg: "bg-blue-500",
    dateSelected: "bg-blue-50 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-sm",
    dateLabelSelected: "text-blue-500/80 dark:text-blue-400/80",
  },
  united_states: {
    primaryBgLight: "from-slate-500/5",
    primaryBgDark: "dark:from-slate-900/20",
    buttonBg: "bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(51,65,85,0.3)] dark:shadow-[0_4px_14px_rgba(51,65,85,0.15)]",
    textActive: "text-slate-700 dark:text-slate-300",
    borderActive: "border-slate-500",
    badgeBg: "border-slate-500 bg-slate-100 text-slate-700 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-300",
    indicatorBg: "bg-slate-500",
    dateSelected: "bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200 shadow-sm",
    dateLabelSelected: "text-slate-500 dark:text-slate-400",
  },
  germany: {
    primaryBgLight: "from-red-500/5",
    primaryBgDark: "dark:from-red-950/20",
    buttonBg: "bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(220,38,38,0.3)] dark:shadow-[0_4px_14px_rgba(220,38,38,0.15)]",
    textActive: "text-red-600 dark:text-red-400",
    borderActive: "border-red-500",
    badgeBg: "border-red-500 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-400",
    indicatorBg: "bg-red-500",
    dateSelected: "bg-red-50 dark:bg-red-950/30 border-red-500 dark:border-red-500/50 text-red-600 dark:text-red-400 shadow-sm",
    dateLabelSelected: "text-red-500/80 dark:text-red-400/80",
  },
  france: {
    primaryBgLight: "from-violet-500/5",
    primaryBgDark: "dark:from-violet-950/20",
    buttonBg: "bg-violet-600 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(124,58,237,0.3)] dark:shadow-[0_4px_14px_rgba(124,58,237,0.15)]",
    textActive: "text-violet-600 dark:text-violet-400",
    borderActive: "border-violet-500",
    badgeBg: "border-violet-500 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-400",
    indicatorBg: "bg-violet-500",
    dateSelected: "bg-violet-50 dark:bg-violet-950/30 border-violet-500 dark:border-violet-500/50 text-violet-600 dark:text-violet-400 shadow-sm",
    dateLabelSelected: "text-violet-500/80 dark:text-violet-400/80",
  },
  switzerland: {
    primaryBgLight: "from-rose-500/5",
    primaryBgDark: "dark:from-rose-950/25",
    buttonBg: "bg-rose-700 hover:bg-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600",
    buttonShadow: "shadow-[0_4px_14px_rgba(190,24,93,0.28)] dark:shadow-[0_4px_14px_rgba(190,24,93,0.16)]",
    textActive: "text-rose-700 dark:text-rose-300",
    borderActive: "border-rose-600",
    badgeBg: "border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300",
    indicatorBg: "bg-rose-600",
    dateSelected: "bg-rose-50 dark:bg-rose-950/30 border-rose-600 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-sm",
    dateLabelSelected: "text-rose-600/80 dark:text-rose-300/80",
  },
  china: {
    primaryBgLight: "from-orange-500/5",
    primaryBgDark: "dark:from-orange-950/20",
    buttonBg: "bg-orange-600 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500",
    buttonShadow: "shadow-[0_4px_14px_rgba(234,88,12,0.3)] dark:shadow-[0_4px_14px_rgba(234,88,12,0.15)]",
    textActive: "text-orange-600 dark:text-orange-400",
    borderActive: "border-orange-500",
    badgeBg: "border-orange-500 bg-orange-50 text-orange-600 dark:border-orange-500/30 dark:bg-orange-950/30 dark:text-orange-400",
    indicatorBg: "bg-orange-500",
    dateSelected: "bg-orange-50 dark:bg-orange-950/30 border-orange-500 dark:border-orange-500/50 text-orange-600 dark:text-orange-400 shadow-sm",
    dateLabelSelected: "text-orange-500/80 dark:text-orange-400/80",
  },
};
