import type { Country } from "../types";

export const countryOptions: Country[] = ["japan", "korea", "hong_kong"];

export const countryConfig: Record<Country, {
  labelKey: string;
  provider: string;
  originPlaceholder: string;
  destinationPlaceholder: string;
  featuredStations: string[];
  promptName: string;
}> = {
  japan: {
    labelKey: "search.japan",
    provider: "ODPT",
    originPlaceholder: "Tokyo",
    destinationPlaceholder: "Shin-Osaka",
    featuredStations: ["Tokyo", "Shinagawa", "Kyoto", "Shin-Osaka", "Nagoya"],
    promptName: "日本",
  },
  korea: {
    labelKey: "search.korea",
    provider: "ODsay",
    originPlaceholder: "Seoul (SNC)",
    destinationPlaceholder: "Busan (BSN)",
    featuredStations: ["Seoul (SNC)", "Yongsan", "Daejeon", "Dongdaegu", "Busan (BSN)"],
    promptName: "韓國",
  },
  hong_kong: {
    labelKey: "search.hong_kong",
    provider: "MTR Next Train",
    originPlaceholder: "Central",
    destinationPlaceholder: "Tsuen Wan",
    featuredStations: ["Central", "Admiralty", "Tsim Sha Tsui", "Mong Kok", "Causeway Bay"],
    promptName: "香港",
  },
};
