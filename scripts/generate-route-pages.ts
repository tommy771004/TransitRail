/**
 * Prerender static SEO route pages from the scraped timetable snapshots.
 *
 * For every route file that clears the thin-content guard (see
 * scripts/lib/routePages.ts) this emits:
 *   public/<country>/<origin>-to-<dest>/index.html    (English)
 *   public/zh/<country>/<origin>-to-<dest>/index.html (zh-TW)
 *   public/ja/<country>/<origin>-to-<dest>/index.html (Japanese)
 *   public/ko/<country>/<origin>-to-<dest>/index.html (Korean)
 * plus a crawlable hub page at /routes/, /zh/routes/, /ja/routes/, /ko/routes/.
 *
 * Vercel serves static files before the SPA catch-all rewrite, so these pages
 * win their exact paths while every other path still loads the app. Each page
 * links into the live SPA search for the same route.
 *
 * Run: npm run routes  (also runs as part of npm run build)
 */
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import i18n from "../src/i18n";
import { stationOverrides } from "../src/data/stationOverrides";
import { getStationCoordinates } from "../src/utils/geoCoordinates";
import { COUNTRY_PATHS, collectRoutePages, type RoutePageData } from "./lib/routePages";
import type { Country, TransitResult } from "../src/types";

const SITE_URL = (process.env.SITE_URL || "https://rail-national.vercel.app").replace(/\/$/, "");
const PUBLIC_DIR = resolve("public");
const MAX_TABLE_ROWS = 40;
const MAX_SCHEMA_TRIPS = 10;
const MAX_RELATED_LINKS = 6;

type Lang = "en" | "zh" | "ja" | "ko";
const ALL_LANGS: Lang[] = ["en", "zh", "ja", "ko"];
const HREFLANG: Record<Lang, string> = { en: "en", zh: "zh-Hant", ja: "ja", ko: "ko" };
const HUB_PATH: Record<Lang, string> = { en: "/routes/", zh: "/zh/routes/", ja: "/ja/routes/", ko: "/ko/routes/" };

/** Representative geo for country hub pages (not a claim of exclusive HQ). */
const COUNTRY_GEO: Record<string, { region: string; lat: number; lng: number; placename: string }> = {
  japan: { region: "JP", lat: 35.6812, lng: 139.7671, placename: "Tokyo" },
  korea: { region: "KR", lat: 37.5547, lng: 126.9708, placename: "Seoul" },
  china: { region: "CN", lat: 31.2492, lng: 121.4557, placename: "Shanghai" },
  singapore: { region: "SG", lat: 1.2843, lng: 103.8515, placename: "Singapore" },
  malaysia: { region: "MY", lat: 3.1390, lng: 101.6869, placename: "Kuala Lumpur" },
  thailand: { region: "TH", lat: 13.7563, lng: 100.5018, placename: "Bangkok" },
  hong_kong: { region: "HK", lat: 22.2819, lng: 114.1581, placename: "Hong Kong" },
  united_kingdom: { region: "GB", lat: 51.5074, lng: -0.1278, placename: "London" },
  united_states: { region: "US-MA", lat: 42.3601, lng: -71.0589, placename: "Boston" },
  germany: { region: "DE", lat: 52.5251, lng: 13.3694, placename: "Berlin" },
  france: { region: "FR", lat: 48.8443, lng: 2.3744, placename: "Paris" },
  belgium: { region: "BE", lat: 50.8455, lng: 4.3571, placename: "Brussels" },
  norway: { region: "NO", lat: 59.9111, lng: 10.7523, placename: "Oslo" },
  switzerland: { region: "CH", lat: 47.3782, lng: 8.5402, placename: "Zürich" },
};

function countryHubPaths(country: Country): Record<Lang, string> {
  const base = COUNTRY_PATHS[country] || `/${country}`;
  return {
    en: `${base}/`,
    zh: `/zh${base}/`,
    ja: `/ja${base}/`,
    ko: `/ko${base}/`,
  };
}

function trainStationSchema(englishName: string, country: Country, lang: Lang): Record<string, unknown> {
  const label = stationName(englishName, country, lang);
  const coord = getStationCoordinates(englishName);
  const node: Record<string, unknown> = {
    "@type": "TrainStation",
    name: label,
    ...(label !== englishName ? { alternateName: englishName } : {}),
  };
  if (coord) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: coord.lat,
      longitude: coord.lng,
    };
  }
  return node;
}

const T: Record<Lang, ReturnType<typeof i18n.getFixedT>> = {
  en: i18n.getFixedT("en"),
  zh: i18n.getFixedT("zh-TW"),
  ja: i18n.getFixedT("ja"),
  ko: i18n.getFixedT("ko"),
};

const STATION_DICTS: Record<Lang, Record<string, string>> = {
  en: i18n.getResourceBundle("en", "translation").station as Record<string, string>,
  zh: i18n.getResourceBundle("zh-TW", "translation").station as Record<string, string>,
  ja: i18n.getResourceBundle("ja", "translation").station as Record<string, string>,
  ko: i18n.getResourceBundle("ko", "translation").station as Record<string, string>,
};

const UI = {
  en: {
    langCode: "en",
    ogLocale: "en_US",
    siteName: "Rail Nation",
    shortLabel: "EN",
    home: "Home",
    allRoutes: "All routes",
    trainsPerDay: "trains/day",
    firstDeparture: "First departure",
    lastDeparture: "Last departure",
    fastest: "Fastest",
    faresFrom: "Fares from",
    timetable: "Timetable",
    departure: "Departure",
    arrival: "Arrival",
    service: "Service",
    duration: "Duration",
    transfer: "Transfer",
    price: "Price",
    direct: "Direct",
    via: "via",
    moreDepartures: (n: number) => `+${n} more departures — open the live planner for the full list.`,
    openApp: "Plan this journey in the app",
    services: "Services on this route",
    servicesCount: (n: number, fastest: string) => `${n} departures/day · fastest ${fastest}`,
    faq: "Frequently asked questions",
    faqDuration: (o: string, d: string) => `How long does the train from ${o} to ${d} take?`,
    faqDurationA: (o: string, d: string, fastest: string, typical: string) =>
      `The fastest service from ${o} to ${d} takes ${fastest}; most departures take about ${typical}.`,
    faqFirstLast: (o: string, d: string) => `What time are the first and last trains from ${o} to ${d}?`,
    faqFirstLastA: (first: string, last: string) =>
      `The first departure of the day is at ${first} and the last is at ${last}.`,
    faqPrice: (o: string, d: string) => `How much does the train from ${o} to ${d} cost?`,
    faqPriceA: (price: string) => `Fares start from ${price} (standard fare on the cheapest service shown).`,
    faqFrequency: (o: string, d: string) => `How many trains run from ${o} to ${d} per day?`,
    faqFrequencyA: (n: number) => `There are ${n} departures per day in this timetable snapshot.`,
    related: "Related routes",
    reverseDirection: "Reverse direction",
    routesHubTitle: "All Train Route Timetables",
    routesHubDescription:
      "Browse every origin–destination timetable on Rail Nation: departure times, journey duration, transfers and fares across Asia, Europe and North America.",
    routesOnHub: (n: number) => `${n} routes`,
    countryApp: (c: string) => `Open ${c} in the planner`,
    countryHubTitle: (c: string) => `${c} train & transit routes`,
    countryHubDescription: (c: string, n: number) =>
      `Browse ${n} origin–destination timetable pages for ${c}: departure times, duration, transfers and fares on Rail Nation.`,
    countryHubIntro: (c: string) =>
      `Static timetable pages for popular ${c} rail and metro routes. Open any route for the full departure table, or jump into the live planner.`,
    sourceLabel: "Data source",
    snapshotDate: "Timetable snapshot",
    disclaimer:
      "Times and fares are a scraped snapshot for planning reference — always confirm with the operator before travelling.",
    breadcrumbRoutes: "Routes",
    titleSuffix: "Train Timetable, Duration & Fares",
    metaDescription: (o: string, d: string, n: number, first: string, last: string, fastest: string, price: string | null) =>
      `All ${n} daily trains from ${o} to ${d}: first departure ${first}, last ${last}` +
      (fastest ? `, fastest journey ${fastest}` : "") +
      (price ? `, fares from ${price}` : "") +
      ". Timetable, transfers and prices.",
  },
  zh: {
    langCode: "zh-Hant",
    ogLocale: "zh_TW",
    siteName: "Rail Nation",
    shortLabel: "中文",
    home: "首頁",
    allRoutes: "所有路線",
    trainsPerDay: "班/日",
    firstDeparture: "首班車",
    lastDeparture: "末班車",
    fastest: "最快",
    faresFrom: "票價自",
    timetable: "時刻表",
    departure: "出發",
    arrival: "抵達",
    service: "車種/路線",
    duration: "行車時間",
    transfer: "轉乘",
    price: "票價",
    direct: "直達",
    via: "經",
    moreDepartures: (n: number) => `還有 ${n} 個班次 — 開啟即時查詢工具查看完整列表。`,
    openApp: "在 App 中規劃此行程",
    services: "本路線車種",
    servicesCount: (n: number, fastest: string) => `每日 ${n} 班 · 最快 ${fastest}`,
    faq: "常見問題",
    faqDuration: (o: string, d: string) => `${o}到${d}的列車需要多久？`,
    faqDurationA: (o: string, d: string, fastest: string, typical: string) =>
      `${o}到${d}最快的班次需 ${fastest}，大多數班次約 ${typical}。`,
    faqFirstLast: (o: string, d: string) => `${o}到${d}的首班車和末班車是幾點？`,
    faqFirstLastA: (first: string, last: string) => `當日首班車為 ${first}，末班車為 ${last}。`,
    faqPrice: (o: string, d: string) => `${o}到${d}的車票多少錢？`,
    faqPriceA: (price: string) => `票價自 ${price} 起（所示最低票價之標準票）。`,
    faqFrequency: (o: string, d: string) => `${o}到${d}每天有幾班車？`,
    faqFrequencyA: (n: number) => `本時刻表快照中每日共有 ${n} 個班次。`,
    related: "相關路線",
    reverseDirection: "反方向",
    routesHubTitle: "所有列車路線時刻表",
    routesHubDescription:
      "瀏覽 Rail Nation 全部起訖站時刻表：出發時間、行車時間、轉乘與票價，涵蓋亞洲、歐洲與北美。",
    routesOnHub: (n: number) => `${n} 條路線`,
    countryApp: (c: string) => `在查詢工具中開啟${c}`,
    countryHubTitle: (c: string) => `${c}列車與大眾運輸路線`,
    countryHubDescription: (c: string, n: number) =>
      `瀏覽 ${c} ${n} 條起訖站時刻表頁：出發時間、行車時間、轉乘與票價 — Rail Nation。`,
    countryHubIntro: (c: string) =>
      `${c}熱門鐵路與捷運路線的靜態時刻表頁。點選路線可查看完整班次表，或進入即時查詢工具。`,
    sourceLabel: "資料來源",
    snapshotDate: "時刻表快照",
    disclaimer: "時刻與票價為擷取快照，僅供行程規劃參考 — 出發前請以營運商公告為準。",
    breadcrumbRoutes: "路線",
    titleSuffix: "列車時刻表・行車時間・票價",
    metaDescription: (o: string, d: string, n: number, first: string, last: string, fastest: string, price: string | null) =>
      `${o}到${d}每日 ${n} 班列車完整時刻表：首班 ${first}、末班 ${last}` +
      (fastest ? `、最快 ${fastest}` : "") +
      (price ? `、票價 ${price} 起` : "") +
      "。含轉乘與票價資訊。",
  },
  ja: {
    langCode: "ja",
    ogLocale: "ja_JP",
    siteName: "Rail Nation",
    shortLabel: "日本語",
    home: "ホーム",
    allRoutes: "全路線",
    trainsPerDay: "本/日",
    firstDeparture: "始発",
    lastDeparture: "終電",
    fastest: "最速",
    faresFrom: "運賃",
    timetable: "時刻表",
    departure: "出発",
    arrival: "到着",
    service: "列車種別",
    duration: "所要時間",
    transfer: "乗換",
    price: "運賃",
    direct: "直通",
    via: "経由",
    moreDepartures: (n: number) => `他 ${n} 便 — アプリのリアルタイム検索で全便を確認できます。`,
    openApp: "アプリでこの旅程を計画",
    services: "この路線の列車種別",
    servicesCount: (n: number, fastest: string) => `1日 ${n} 便 · 最速 ${fastest}`,
    faq: "よくある質問",
    faqDuration: (o: string, d: string) => `${o}から${d}までの所要時間は？`,
    faqDurationA: (o: string, d: string, fastest: string, typical: string) =>
      `${o}から${d}への最速便は${fastest}、多くの便は約${typical}かかります。`,
    faqFirstLast: (o: string, d: string) => `${o}から${d}行きの始発と終電は何時ですか？`,
    faqFirstLastA: (first: string, last: string) => `当日の始発は${first}、終電は${last}です。`,
    faqPrice: (o: string, d: string) => `${o}から${d}までの運賃はいくらですか？`,
    faqPriceA: (price: string) => `運賃は${price}から（表示中の最安便の通常運賃）。`,
    faqFrequency: (o: string, d: string) => `${o}から${d}までは1日何本運行していますか？`,
    faqFrequencyA: (n: number) => `この時刻表スナップショットでは1日${n}便運行しています。`,
    related: "関連路線",
    reverseDirection: "反対方向",
    routesHubTitle: "全列車路線時刻表",
    routesHubDescription:
      "Rail Nationに掲載されている全ての出発地・到着地の時刻表を検索：発車時刻、所要時間、乗換、運賃をアジア・ヨーロッパ・北米で網羅。",
    routesOnHub: (n: number) => `${n} 路線`,
    countryApp: (c: string) => `アプリで${c}を開く`,
    countryHubTitle: (c: string) => `${c}の鉄道・交通路線`,
    countryHubDescription: (c: string, n: number) =>
      `${c}の出発地・到着地時刻表ページ${n}件：発車時刻、所要時間、乗換、運賃をRail Nationで。`,
    countryHubIntro: (c: string) =>
      `${c}の主要路線の静的時刻表ページです。路線を開くと全便一覧を確認でき、アプリのリアルタイム検索にも移動できます。`,
    sourceLabel: "データソース",
    snapshotDate: "時刻表スナップショット",
    disclaimer:
      "掲載の時刻・運賃はスクレイピングによるスナップショットです。ご利用前に必ず運行会社の公式情報をご確認ください。",
    breadcrumbRoutes: "路線",
    titleSuffix: "列車時刻表・所要時間・運賃",
    metaDescription: (o: string, d: string, n: number, first: string, last: string, fastest: string, price: string | null) =>
      `${o}から${d}への1日${n}本の列車時刻表：始発${first}、終電${last}` +
      (fastest ? `、最速${fastest}` : "") +
      (price ? `、運賃${price}から` : "") +
      "。時刻表・乗換・運賃情報。",
  },
  ko: {
    langCode: "ko",
    ogLocale: "ko_KR",
    siteName: "Rail Nation",
    shortLabel: "한국어",
    home: "홈",
    allRoutes: "전체 노선",
    trainsPerDay: "편/일",
    firstDeparture: "첫차",
    lastDeparture: "막차",
    fastest: "최단시간",
    faresFrom: "요금",
    timetable: "시간표",
    departure: "출발",
    arrival: "도착",
    service: "열차 종류",
    duration: "소요시간",
    transfer: "환승",
    price: "요금",
    direct: "직통",
    via: "경유",
    moreDepartures: (n: number) => `${n}편 더 있음 — 전체 목록은 앱의 실시간 검색에서 확인하세요.`,
    openApp: "앱에서 이 여정 계획하기",
    services: "이 노선의 열차 종류",
    servicesCount: (n: number, fastest: string) => `하루 ${n}편 · 최단 ${fastest}`,
    faq: "자주 묻는 질문",
    faqDuration: (o: string, d: string) => `${o}에서 ${d}까지 열차로 얼마나 걸리나요?`,
    faqDurationA: (o: string, d: string, fastest: string, typical: string) =>
      `${o}에서 ${d}까지 가장 빠른 열차는 ${fastest}가 걸리며, 대부분의 열차는 약 ${typical}이 걸립니다.`,
    faqFirstLast: (o: string, d: string) => `${o}에서 ${d}행 첫차와 막차는 몇 시인가요?`,
    faqFirstLastA: (first: string, last: string) => `당일 첫차는 ${first}, 막차는 ${last}입니다.`,
    faqPrice: (o: string, d: string) => `${o}에서 ${d}까지 요금은 얼마인가요?`,
    faqPriceA: (price: string) => `요금은 ${price}부터입니다 (표시된 가장 저렴한 열차의 일반 요금 기준).`,
    faqFrequency: (o: string, d: string) => `${o}에서 ${d}까지 하루에 몇 편 운행하나요?`,
    faqFrequencyA: (n: number) => `이 시간표 스냅샷 기준으로 하루 ${n}편이 운행됩니다.`,
    related: "관련 노선",
    reverseDirection: "반대 방향",
    routesHubTitle: "전체 열차 노선 시간표",
    routesHubDescription:
      "Rail Nation에 등록된 모든 출발지-도착지 시간표를 살펴보세요: 출발 시각, 소요 시간, 환승, 요금까지 아시아・유럽・북미를 아우릅니다.",
    routesOnHub: (n: number) => `${n}개 노선`,
    countryApp: (c: string) => `앱에서 ${c} 열기`,
    countryHubTitle: (c: string) => `${c} 철도·대중교통 노선`,
    countryHubDescription: (c: string, n: number) =>
      `${c} 출발지–도착지 시간표 페이지 ${n}개: 출발 시각, 소요 시간, 환승, 요금 — Rail Nation.`,
    countryHubIntro: (c: string) =>
      `${c} 주요 노선의 정적 시간표 페이지입니다. 노선을 열면 전체 운행표를 볼 수 있고, 앱의 실시간 검색으로도 이동할 수 있습니다.`,
    sourceLabel: "데이터 출처",
    snapshotDate: "시간표 스냅샷",
    disclaimer:
      "표시된 시각과 요금은 수집된 스냅샷이며 참고용입니다. 이용 전 반드시 운영사의 공식 정보를 확인하세요.",
    breadcrumbRoutes: "노선",
    titleSuffix: "열차 시간표・소요시간・요금",
    metaDescription: (o: string, d: string, n: number, first: string, last: string, fastest: string, price: string | null) =>
      `${o}에서 ${d}까지 하루 ${n}편의 열차 시간표: 첫차 ${first}, 막차 ${last}` +
      (fastest ? `, 최단 ${fastest}` : "") +
      (price ? `, 요금 ${price}부터` : "") +
      ". 시간표, 환승, 요금 정보.",
  },
} as const;

const OG_LABELS: Record<Lang, { early: string; departure: string; snapshot: string }> = {
  en: { early: "EARLY", departure: "DEPARTURE", snapshot: "Timetable · first three departures" },
  zh: { early: "早班", departure: "班次", snapshot: "今日時刻表 · 前三班車" },
  ja: { early: "始発", departure: "発車", snapshot: "本日の時刻表・上位3便" },
  ko: { early: "첫차", departure: "출발", snapshot: "오늘의 시간표・상위 3편" },
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only zh-TW has per-country disambiguation overrides (see stationOverrides.ts);
 *  en/ja/ko fall straight through to their flat station dict, then the raw name. */
function stationName(name: string, country: Country, lang: Lang): string {
  if (lang === "zh") return stationOverrides[country]?.[name] ?? STATION_DICTS.zh[name] ?? name;
  return STATION_DICTS[lang][name] ?? name;
}

function countryLabel(country: Country, lang: Lang): string {
  return T[lang](`search.${country}`);
}

function pagePath(page: RoutePageData, lang: Lang): string {
  return lang === "en" ? page.urlPath : lang === "zh" ? page.zhUrlPath : lang === "ja" ? page.jaUrlPath : page.koUrlPath;
}

function routeTitle(origin: string, destination: string, lang: Lang): string {
  if (lang === "en") return `${origin} to ${destination}`;
  if (lang === "zh") return `${origin}到${destination}`;
  return `${origin}→${destination}`;
}

function parseTimeMinutes(time: string | undefined): number | undefined {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function resultDurationMinutes(result: TransitResult): number | undefined {
  if (Number.isFinite(result.durationMinutes)) return result.durationMinutes;
  const dep = parseTimeMinutes(result.departureTime);
  const arr = parseTimeMinutes(result.arrivalTime);
  if (dep === undefined || arr === undefined) return undefined;
  return arr - dep + (arr < dep ? 1440 : 0);
}

function formatDuration(minutes: number, lang: Lang): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (lang === "zh") return h > 0 ? (m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`) : `${m} 分鐘`;
  if (lang === "ja") return h > 0 ? (m > 0 ? `${h}時間${m}分` : `${h}時間`) : `${m}分`;
  if (lang === "ko") return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
  return h > 0 ? (m > 0 ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

function formatPrice(price: number, currency: string, lang: Lang): string {
  const locale = lang === "zh" ? "zh-TW" : lang === "ja" ? "ja-JP" : lang === "ko" ? "ko-KR" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

/** "Nozomi 100" → "Nozomi"; leaves names without a trailing number alone. */
function serviceFamily(service: string): string {
  return service.replace(/\s+\d+$/, "").trim() || service;
}

interface RouteStats {
  count: number;
  first: string;
  last: string;
  fastestMinutes: number | undefined;
  typicalMinutes: number | undefined;
  cheapest: { price: number; currency: string } | undefined;
  hasTransfers: boolean;
}

function computeStats(results: TransitResult[]): RouteStats {
  const durations = results
    .map(resultDurationMinutes)
    .filter((d): d is number => d !== undefined && d > 0)
    .sort((a, b) => a - b);
  const prices = results
    .filter((r) => typeof r.price === "number" && Number.isFinite(r.price) && r.currency)
    .sort((a, b) => (a.price! - b.price!));
  return {
    count: results.length,
    first: results[0]?.departureTime || "",
    last: results[results.length - 1]?.departureTime || "",
    fastestMinutes: durations[0],
    typicalMinutes: durations.length > 0 ? durations[Math.floor(durations.length / 2)] : undefined,
    cheapest: prices.length > 0 ? { price: prices[0].price!, currency: prices[0].currency! } : undefined,
    hasTransfers: results.some((r) => !r.direct),
  };
}

const PAGE_CSS = `
:root{color-scheme:light dark;--bg:#f8fafc;--card:#ffffff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--accent:#0f766e;--accent-ink:#ffffff}
@media(prefers-color-scheme:dark){:root{--bg:#0f172a;--card:#1e293b;--ink:#f1f5f9;--muted:#94a3b8;--line:#334155;--accent:#2dd4bf;--accent-ink:#042f2e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC","Noto Sans JP","Noto Sans KR",sans-serif}
main{max-width:56rem;margin:0 auto;padding:1rem 1rem 3rem}
nav.crumbs{font-size:.85rem;color:var(--muted);padding:.75rem 0}nav.crumbs a{color:var(--muted)}
h1{font-size:1.6rem;line-height:1.3;margin:.25rem 0 1rem}h2{font-size:1.15rem;margin:2rem 0 .75rem}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.5rem;margin:1rem 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:.75rem;padding:.75rem}
.stat .k{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.stat .v{font-size:1.2rem;font-weight:600;font-variant-numeric:tabular-nums}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:.75rem;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:.9rem;min-width:34rem}
th,td{padding:.5rem .75rem;text-align:left;white-space:nowrap}
th{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--line)}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--line) 30%,transparent)}
td.num{font-variant-numeric:tabular-nums}
.note{font-size:.85rem;color:var(--muted);margin:.5rem 0 0}
.cta{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;border-radius:.75rem;padding:.7rem 1.2rem;margin:1.25rem 0}
.cta:hover{text-decoration:none;opacity:.9}
ul.links{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.4rem}
ul.links li{background:var(--card);border:1px solid var(--line);border-radius:.6rem}
ul.links a{display:block;padding:.55rem .8rem}
details{background:var(--card);border:1px solid var(--line);border-radius:.6rem;margin:.4rem 0;padding:.6rem .9rem}
summary{cursor:pointer;font-weight:600}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
header.top{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--line)}
header.top .brand{font-weight:700;color:var(--ink)}
`.trim();

function htmlShell(options: {
  lang: Lang;
  title: string;
  description: string;
  paths: Record<Lang, string>;
  ogImagePath?: string;
  /** Optional geo meta for country hubs (ISO region + representative place). */
  geo?: { region: string; lat: number; lng: number; placename: string };
  body: string;
  jsonLd: object[];
}): string {
  const { lang, title, description, paths, ogImagePath, geo, body, jsonLd } = options;
  const ui = UI[lang];
  const path = paths[lang];
  const langSwitcher = ALL_LANGS.filter((l) => l !== lang)
    .map((l) => `<a href="${paths[l]}" hreflang="${HREFLANG[l]}">${UI[l].shortLabel}</a>`)
    .join(" · ");
  const geoTags = geo
    ? `<meta name="geo.region" content="${esc(geo.region)}">
<meta name="geo.placename" content="${esc(geo.placename)}">
<meta name="geo.position" content="${geo.lat};${geo.lng}">
<meta name="ICBM" content="${geo.lat}, ${geo.lng}">`
    : "";
  return `<!doctype html>
<html lang="${ui.langCode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${path}">
${ALL_LANGS.map((l) => `<link rel="alternate" hreflang="${HREFLANG[l]}" href="${SITE_URL}${paths[l]}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${SITE_URL}${paths.en}">
${geoTags}
<meta property="og:site_name" content="${ui.siteName}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}${path}">
<meta property="og:locale" content="${ui.ogLocale}">
${ogImagePath ? `<meta property="og:image" content="${SITE_URL}${ogImagePath}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}${ogImagePath}">` : ""}
<meta name="robots" content="index, follow">
<style>${PAGE_CSS}</style>
${jsonLd.map((entry) => `<script type="application/ld+json">${JSON.stringify(entry)}</script>`).join("\n")}
</head>
<body>
<main>
<header class="top">
<a class="brand" href="/">${ui.siteName}</a>
<span><a href="${HUB_PATH[lang]}">${ui.allRoutes}</a> · ${langSwitcher}</span>
</header>
${body}
</main>
</body>
</html>
`;
}

function renderRouteOgSvg(page: RoutePageData, lang: Lang): string {
  const ui = UI[lang];
  const labels = OG_LABELS[lang];
  const origin = stationName(page.origin, page.country, lang);
  const destination = stationName(page.destination, page.country, lang);
  const country = countryLabel(page.country, lang);
  const departures = page.dayResults.slice(0, 3).map((result) => result.departureTime || "—");
  const palette = {
    japan: ["#be123c", "#fb7185"], korea: ["#1d4ed8", "#38bdf8"], china: ["#b91c1c", "#f97316"],
    singapore: ["#047857", "#2dd4bf"], malaysia: ["#0f766e", "#5eead4"], thailand: ["#7c3aed", "#f472b6"],
    hong_kong: ["#be123c", "#f43f5e"], united_kingdom: ["#1d4ed8", "#60a5fa"], united_states: ["#0369a1", "#22d3ee"],
    germany: ["#b91c1c", "#f59e0b"], france: ["#1d4ed8", "#818cf8"], belgium: ["#111827", "#facc15"],
    norway: ["#8b1d3d", "#e11d48"], switzerland: ["#b91c1c", "#ef4444"],
  }[page.country] || ["#0f766e", "#2dd4bf"];
  const departureCards = departures.map((time, index) => {
    const x = 76 + index * 346;
    return `<g transform="translate(${x} 456)"><rect width="308" height="98" rx="22" fill="#fff" fill-opacity=".13" stroke="#fff" stroke-opacity=".22"/><text x="24" y="33" fill="#e2e8f0" font-size="18" font-family="system-ui, sans-serif" font-weight="700">${esc(index === 0 ? labels.early : labels.departure)}</text><text x="24" y="76" fill="#fff" font-size="38" font-family="ui-monospace, SFMono-Regular, monospace" font-weight="800">${esc(time)}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(`${origin} to ${destination} timetable`)}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="36"/></filter></defs><rect width="1200" height="630" fill="url(#bg)"/><circle cx="1050" cy="90" r="175" fill="#fff" fill-opacity=".14" filter="url(#blur)"/><circle cx="130" cy="590" r="210" fill="#020617" fill-opacity=".18" filter="url(#blur)"/><path d="M-30 420 C260 250 480 610 760 378 S1120 290 1260 180" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="7" stroke-dasharray="13 17"/><text x="76" y="90" fill="#fff" font-size="27" font-family="system-ui, sans-serif" font-weight="800" letter-spacing="2">RAIL NATION · ${esc(country.toUpperCase())}</text><text x="76" y="200" fill="#fff" font-size="62" font-family="system-ui, sans-serif" font-weight="800">${esc(origin)}</text><text x="76" y="275" fill="#fff" fill-opacity=".92" font-size="48" font-family="system-ui, sans-serif" font-weight="700">→ ${esc(destination)}</text><text x="76" y="352" fill="#fff" fill-opacity=".82" font-size="25" font-family="system-ui, sans-serif">${esc(labels.snapshot)}</text>${departureCards}<text x="76" y="601" fill="#fff" fill-opacity=".72" font-size="17" font-family="system-ui, sans-serif">${esc(ui.disclaimer)}</text></svg>`;
}

function transferCell(result: TransitResult, country: Country, lang: Lang): string {
  const ui = UI[lang];
  if (result.direct !== false) return ui.direct;
  const stations = (result.transferStations || []).map((s) => stationName(s, country, lang));
  return stations.length > 0 ? `${ui.via} ${stations.join(", ")}` : `${ui.transfer}`;
}

function renderRoutePage(page: RoutePageData, siblings: RoutePageData[], lang: Lang): string {
  const ui = UI[lang];
  const origin = stationName(page.origin, page.country, lang);
  const destination = stationName(page.destination, page.country, lang);
  const country = countryLabel(page.country, lang);
  const stats = computeStats(page.dayResults);
  const fastest = stats.fastestMinutes !== undefined ? formatDuration(stats.fastestMinutes, lang) : "";
  const typical = stats.typicalMinutes !== undefined ? formatDuration(stats.typicalMinutes, lang) : fastest;
  const cheapest = stats.cheapest ? formatPrice(stats.cheapest.price, stats.cheapest.currency, lang) : null;
  const paths: Record<Lang, string> = { en: page.urlPath, zh: page.zhUrlPath, ja: page.jaUrlPath, ko: page.koUrlPath };
  const path = paths[lang];
  const title_ = routeTitle(origin, destination, lang);
  const title = `${title_} ${ui.titleSuffix} | ${ui.siteName}`;
  const description = ui.metaDescription(origin, destination, stats.count, stats.first, stats.last, fastest, cheapest);
  const appLink = `${page.countryPath}?origin=${encodeURIComponent(page.origin)}&destination=${encodeURIComponent(page.destination)}`;
  const hubPath = HUB_PATH[lang];
  const ogImagePath = `/og-routes/${page.country}/${page.slug}-${lang}.svg`;

  const rows = page.dayResults.slice(0, MAX_TABLE_ROWS).map((r) => {
    const duration = resultDurationMinutes(r);
    return `<tr>
<td class="num">${esc(r.departureTime || "—")}</td>
<td class="num">${esc(r.arrivalTime || "—")}</td>
<td>${esc(r.service || r.operator || "")}</td>
<td class="num">${duration !== undefined ? esc(formatDuration(duration, lang)) : "—"}</td>
<td>${esc(transferCell(r, page.country, lang))}</td>
<td class="num">${typeof r.price === "number" && r.currency ? esc(formatPrice(r.price, r.currency, lang)) : "—"}</td>
</tr>`;
  }).join("\n");
  const hiddenRows = page.dayResults.length - Math.min(page.dayResults.length, MAX_TABLE_ROWS);

  const families = new Map<string, TransitResult[]>();
  for (const r of page.dayResults) {
    const family = serviceFamily(r.service || r.operator || "");
    if (!family) continue;
    families.set(family, [...(families.get(family) || []), r]);
  }
  const serviceSection = families.size > 1
    ? `<h2>${ui.services}</h2>
<ul>
${[...families.entries()].map(([family, results]) => {
      const familyStats = computeStats([...results].sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || "")));
      const familyFastest = familyStats.fastestMinutes !== undefined ? formatDuration(familyStats.fastestMinutes, lang) : "—";
      return `<li><strong>${esc(family)}</strong> — ${esc(ui.servicesCount(results.length, familyFastest))}</li>`;
    }).join("\n")}
</ul>`
    : "";

  const faq: Array<{ q: string; a: string }> = [
    { q: ui.faqFirstLast(origin, destination), a: ui.faqFirstLastA(stats.first, stats.last) },
    { q: ui.faqFrequency(origin, destination), a: ui.faqFrequencyA(stats.count) },
  ];
  if (fastest) faq.unshift({ q: ui.faqDuration(origin, destination), a: ui.faqDurationA(origin, destination, fastest, typical) });
  if (cheapest) faq.push({ q: ui.faqPrice(origin, destination), a: ui.faqPriceA(cheapest) });

  const reverse = siblings.find((s) => s.origin === page.destination && s.destination === page.origin);
  const related = siblings
    .filter((s) => s !== page && s !== reverse)
    .filter((s) => [s.origin, s.destination].some((n) => n === page.origin || n === page.destination))
    .slice(0, MAX_RELATED_LINKS);
  const relatedItems = [
    ...(reverse ? [{ page: reverse, label: `${stationName(reverse.origin, reverse.country, lang)} → ${stationName(reverse.destination, reverse.country, lang)} (${ui.reverseDirection})` }] : []),
    ...related.map((s) => ({ page: s, label: `${stationName(s.origin, s.country, lang)} → ${stationName(s.destination, s.country, lang)}` })),
  ];
  const relatedSection = relatedItems.length > 0
    ? `<h2>${ui.related}</h2>
<ul class="links">
${relatedItems.map(({ page: p, label }) => `<li><a href="${pagePath(p, lang)}">${esc(label)}</a></li>`).join("\n")}
</ul>`
    : "";

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: ui.home, item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: ui.breadcrumbRoutes, item: `${SITE_URL}${hubPath}` },
        { "@type": "ListItem", position: 3, name: country, item: `${SITE_URL}${page.countryPath}` },
        { "@type": "ListItem", position: 4, name: title_, item: `${SITE_URL}${path}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${title_} — ${ui.timetable}`,
      itemListElement: page.dayResults.slice(0, MAX_SCHEMA_TRIPS).map((r, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "TrainTrip",
          provider: { "@type": "Organization", name: r.operator },
          trainName: r.service,
          departureStation: trainStationSchema(page.origin, page.country, lang),
          arrivalStation: trainStationSchema(page.destination, page.country, lang),
          departureTime: r.departureTime,
          ...(r.arrivalTime ? { arrivalTime: r.arrivalTime } : {}),
          ...(typeof r.price === "number" && r.currency
            ? { offers: { "@type": "Offer", price: r.price, priceCurrency: r.currency } }
            : {}),
        },
      })),
    },
  ];

  const body = `
<nav class="crumbs"><a href="/">${ui.home}</a> › <a href="${hubPath}">${ui.breadcrumbRoutes}</a> › <a href="${page.countryPath}">${esc(country)}</a> › ${esc(title_)}</nav>
<h1>${esc(title_)} ${ui.titleSuffix}</h1>
<div class="stats">
<div class="stat"><div class="k">${ui.timetable}</div><div class="v">${stats.count} ${ui.trainsPerDay}</div></div>
<div class="stat"><div class="k">${ui.firstDeparture}</div><div class="v">${esc(stats.first)}</div></div>
<div class="stat"><div class="k">${ui.lastDeparture}</div><div class="v">${esc(stats.last)}</div></div>
${fastest ? `<div class="stat"><div class="k">${ui.fastest}</div><div class="v">${esc(fastest)}</div></div>` : ""}
${cheapest ? `<div class="stat"><div class="k">${ui.faresFrom}</div><div class="v">${esc(cheapest)}</div></div>` : ""}
</div>
<a class="cta" href="${esc(appLink)}">${ui.openApp} →</a>
<h2>${ui.timetable}</h2>
<div class="tablewrap">
<table>
<thead><tr><th>${ui.departure}</th><th>${ui.arrival}</th><th>${ui.service}</th><th>${ui.duration}</th><th>${ui.transfer}</th><th>${ui.price}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
${hiddenRows > 0 ? `<p class="note">${esc(ui.moreDepartures(hiddenRows))} <a href="${esc(appLink)}">${ui.openApp}</a></p>` : ""}
${serviceSection}
<h2>${ui.faq}</h2>
${faq.map(({ q, a }) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n")}
${relatedSection}
<footer>
<p>${ui.sourceLabel}: ${esc(page.source || "—")}${page.scrapedAt ? ` · ${ui.snapshotDate}: ${esc(page.scrapedAt.slice(0, 10))}` : ""}</p>
<p>${ui.disclaimer}</p>
</footer>`;

  return htmlShell({ lang, title, description, paths, ogImagePath, body, jsonLd });
}

function renderCountryHubPage(country: Country, countryPages: RoutePageData[], lang: Lang): string {
  const ui = UI[lang];
  const label = countryLabel(country, lang);
  const paths = countryHubPaths(country);
  const geo = COUNTRY_GEO[country];
  const title = `${ui.countryHubTitle(label)} | ${ui.siteName}`;
  const description = ui.countryHubDescription(label, countryPages.length);

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: ui.home, item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: ui.breadcrumbRoutes, item: `${SITE_URL}${HUB_PATH[lang]}` },
        { "@type": "ListItem", position: 3, name: label, item: `${SITE_URL}${paths[lang]}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: ui.countryHubTitle(label),
      description,
      url: `${SITE_URL}${paths[lang]}`,
      inLanguage: ui.langCode,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: {
        "@type": "Country",
        name: label,
        ...(geo
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: geo.lat,
                longitude: geo.lng,
              },
            }
          : {}),
      },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: countryPages.length,
        itemListElement: countryPages.map((p, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SITE_URL}${pagePath(p, lang)}`,
          name: `${stationName(p.origin, country, lang)} → ${stationName(p.destination, country, lang)}`,
        })),
      },
    },
  ];

  const body = `
<nav class="crumbs"><a href="/">${ui.home}</a> › <a href="${HUB_PATH[lang]}">${ui.breadcrumbRoutes}</a> › ${esc(label)}</nav>
<h1>${esc(ui.countryHubTitle(label))}</h1>
<p>${esc(ui.countryHubIntro(label))}</p>
<div class="stats">
<div class="stat"><div class="k">${ui.breadcrumbRoutes}</div><div class="v">${countryPages.length}</div></div>
${geo ? `<div class="stat"><div class="k">GEO</div><div class="v">${esc(geo.placename)}</div></div>` : ""}
</div>
<a class="cta" href="${COUNTRY_PATHS[country]}">${esc(ui.countryApp(label))} →</a>
<h2>${esc(label)} <small>(${ui.routesOnHub(countryPages.length)})</small></h2>
<ul class="links">
${countryPages.map((p) => `<li><a href="${pagePath(p, lang)}">${esc(stationName(p.origin, country, lang))} → ${esc(stationName(p.destination, country, lang))}</a></li>`).join("\n")}
</ul>
<footer><p>${ui.disclaimer}</p></footer>`;

  return htmlShell({
    lang,
    title,
    description,
    paths,
    geo,
    body,
    jsonLd,
  });
}

function renderHubPage(pages: RoutePageData[], lang: Lang): string {
  const ui = UI[lang];
  const paths = HUB_PATH;
  const byCountry = new Map<Country, RoutePageData[]>();
  for (const page of pages) {
    byCountry.set(page.country, [...(byCountry.get(page.country) || []), page]);
  }

  const sections = [...byCountry.entries()]
    .sort(([a], [b]) => (byCountry.get(b)!.length - byCountry.get(a)!.length) || a.localeCompare(b))
    .map(([country, countryPages]) => {
      const label = countryLabel(country, lang);
      const hub = countryHubPaths(country)[lang];
      return `<h2><a href="${hub}">${esc(label)}</a> <small>(${ui.routesOnHub(countryPages.length)})</small></h2>
<ul class="links">
${countryPages.map((p) => `<li><a href="${pagePath(p, lang)}">${esc(stationName(p.origin, country, lang))} → ${esc(stationName(p.destination, country, lang))}</a></li>`).join("\n")}
</ul>
<p class="note"><a href="${hub}">${esc(ui.countryHubTitle(label))} →</a></p>`;
    }).join("\n");

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: ui.home, item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: ui.breadcrumbRoutes, item: `${SITE_URL}${paths[lang]}` },
      ],
    },
  ];

  const body = `
<nav class="crumbs"><a href="/">${ui.home}</a> › ${ui.breadcrumbRoutes}</nav>
<h1>${ui.routesHubTitle}</h1>
<p>${ui.routesHubDescription}</p>
${sections}
<footer><p>${ui.disclaimer}</p></footer>`;

  return htmlShell({
    lang,
    title: `${ui.routesHubTitle} | ${ui.siteName}`,
    description: ui.routesHubDescription,
    paths,
    body,
    jsonLd,
  });
}

function writePage(urlPath: string, html: string): void {
  const dir = join(PUBLIC_DIR, ...urlPath.split("/").filter(Boolean));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
}

function writeRouteOgImage(page: RoutePageData, lang: Lang): void {
  const dir = join(PUBLIC_DIR, "og-routes", page.country);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${page.slug}-${lang}.svg`), renderRouteOgSvg(page, lang), "utf8");
}

function main(): void {
  const pages = collectRoutePages();

  // These roots are owned by this generator; anything inside is regenerated
  // from scratch each run. Do not hand-place files under them.
  const generatedRoots = new Set<string>([
    "zh",
    "ja",
    "ko",
    "routes",
    "og-routes",
    ...Object.values(COUNTRY_PATHS).map((p) => p.replace(/^\//, "")),
  ]);
  for (const root of generatedRoots) {
    rmSync(join(PUBLIC_DIR, root), { recursive: true, force: true });
  }

  const byCountry = new Map<Country, RoutePageData[]>();
  for (const page of pages) {
    byCountry.set(page.country, [...(byCountry.get(page.country) || []), page]);
  }

  for (const page of pages) {
    const siblings = byCountry.get(page.country) || [];
    for (const lang of ALL_LANGS) {
      writePage(pagePath(page, lang), renderRoutePage(page, siblings, lang));
      writeRouteOgImage(page, lang);
    }
  }
  // Static country hubs at /japan/, /zh/japan/, … so sitemap country URLs are not SPA shells.
  for (const [country, countryPages] of byCountry) {
    for (const lang of ALL_LANGS) {
      writePage(countryHubPaths(country)[lang], renderCountryHubPage(country, countryPages, lang));
    }
  }
  for (const lang of ALL_LANGS) {
    writePage(HUB_PATH[lang], renderHubPage(pages, lang));
  }

  console.log(
    `Generated ${pages.length} route pages × ${ALL_LANGS.length} languages, ` +
      `${byCountry.size} country hubs × ${ALL_LANGS.length} languages, ` +
      `and ${pages.length * ALL_LANGS.length} social cards under public/.`,
  );
}

main();
