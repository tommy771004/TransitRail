// Description: the city a passenger knows an IANA time zone by ("Asia/Tokyo" → 東京), in the
// four shipped locales. Used by the header's time zone chip and the search page's market
// time chip; every market's zone in countryConfig has an entry (timezoneCity.test.ts).

type CityNames = { en: string; "zh-TW": string; ja: string; ko: string };

const CITY: Record<string, CityNames> = {
  "Asia/Taipei": { en: "Taipei", "zh-TW": "台北", ja: "台北", ko: "타이베이" },
  "Asia/Tokyo": { en: "Tokyo", "zh-TW": "東京", ja: "東京", ko: "도쿄" },
  "Asia/Seoul": { en: "Seoul", "zh-TW": "首爾", ja: "ソウル", ko: "서울" },
  "Asia/Singapore": { en: "Singapore", "zh-TW": "新加坡", ja: "シンガポール", ko: "싱가포르" },
  "Asia/Kuala_Lumpur": { en: "Kuala Lumpur", "zh-TW": "吉隆坡", ja: "クアラルンプール", ko: "쿠알라룸푸르" },
  "Asia/Bangkok": { en: "Bangkok", "zh-TW": "曼谷", ja: "バンコク", ko: "방콕" },
  "Asia/Hong_Kong": { en: "Hong Kong", "zh-TW": "香港", ja: "香港", ko: "홍콩" },
  "Asia/Shanghai": { en: "Shanghai", "zh-TW": "上海", ja: "上海", ko: "상하이" },
  "Europe/London": { en: "London", "zh-TW": "倫敦", ja: "ロンドン", ko: "런던" },
  "Europe/Berlin": { en: "Berlin", "zh-TW": "柏林", ja: "ベルリン", ko: "베를린" },
  "Europe/Paris": { en: "Paris", "zh-TW": "巴黎", ja: "パリ", ko: "파리" },
  "Europe/Brussels": { en: "Brussels", "zh-TW": "布魯塞爾", ja: "ブリュッセル", ko: "브뤼셀" },
  "Europe/Oslo": { en: "Oslo", "zh-TW": "奧斯陸", ja: "オスロ", ko: "오슬로" },
  "Europe/Zurich": { en: "Zurich", "zh-TW": "蘇黎世", ja: "チューリッヒ", ko: "취리히" },
  "America/New_York": { en: "New York", "zh-TW": "紐約", ja: "ニューヨーク", ko: "뉴욕" },
  "America/Los_Angeles": { en: "Los Angeles", "zh-TW": "洛杉磯", ja: "ロサンゼルス", ko: "로스앤젤레스" },
};

/** True when the zone has a translated city name, not the IANA fallback. */
export function hasTimezoneCity(timeZone: string): boolean {
  return timeZone in CITY;
}

/** The zone's city in `language`, English for other languages, else the IANA city part. */
export function timezoneCity(timeZone: string, language: string): string {
  const names = CITY[timeZone];
  if (names) return names[language as keyof CityNames] ?? names.en;
  return timeZone.split("/").pop()?.replace(/_/g, " ") ?? "";
}
