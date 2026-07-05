import type { Country } from "../types";

/**
 * Country-scoped zh-TW station names. The i18next `station` dictionary is a
 * flat English-name → Chinese map shared across every country, so a name used
 * by two networks (e.g. "Admiralty" = HK 金鐘 vs SG 海軍部) can only hold one
 * value there. This map overrides that value per country; the flat dictionary
 * keeps whichever country is the default for the shared name.
 *
 * Only list entries that differ from the flat default. Keys are matched
 * literally (no dot/colon parsing), so names with punctuation are safe.
 */
export const stationOverrides: Partial<Record<Country, Record<string, string>>> = {
  singapore: {
    "Admiralty": "海軍部", // flat = HK 金鐘
    "City Hall": "政府大廈", // Seoul 市廳 is the other user of this name
  },
  korea: {
    "City Hall": "市廳", // Seoul Metro 시청
  },
  united_states: {
    "Central": "中央", // flat = HK Central 中環
    "Chinatown": "華埠", // flat = SG Chinatown 牛車水
  },
};
