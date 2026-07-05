import type { LineStation, TransitLine } from "../types";

export const japanStations = [
  // 主要新幹線與大城市車站 (Major Shinkansen & City Stations)
  "Tokyo", "Shinagawa", "Shinjuku", "Shibuya", "Ikebukuro", "Ueno", "Akihabara",
  "Shin-Yokohama", "Yokohama", "Omiya",
  "Nagoya", "Kyoto", "Shin-Osaka", "Osaka", "Umeda", "Namba", "Tennoji",
  "Kobe", "Shin-Kobe", "Sannomiya", "Himeji",
  "Okayama", "Hiroshima", "Hakata", "Fukuoka",
  "Kumamoto", "Kagoshima-Chuo",
  "Sendai", "Morioka", "Shin-Aomori",
  "Shin-Hakodate-Hokuto", "Sapporo",
  "Kanazawa", "Toyama", "Nagano", "Niigata",
  "Fukui", "Tsuruga",
  "Fukushima", "Yonezawa", "Yamagata", "Shinjo",
  "Kakunodate", "Akita",
  "Takeo-Onsen", "Ureshino-Onsen", "Shin-Omura", "Isahaya", "Nagasaki"
];

// Major stops only, not the full station list of each line. Used as a static
// directory until the ODPT route adapter provides live station data.
const japanLineDefs: Array<{ id: string; name: string; color: string; stations: string[] }> = [
  {
    id: "tokaido-shinkansen",
    name: "Tōkaidō Shinkansen",
    color: "#1153AF",
    stations: ["Tokyo", "Shinagawa", "Shin-Yokohama", "Nagoya", "Kyoto", "Shin-Osaka"],
  },
  {
    id: "sanyo-shinkansen",
    name: "San'yō Shinkansen",
    color: "#0068B7",
    stations: ["Shin-Osaka", "Shin-Kobe", "Himeji", "Okayama", "Hiroshima", "Hakata"],
  },
  {
    id: "kyushu-shinkansen",
    name: "Kyūshū Shinkansen",
    color: "#E50012",
    stations: ["Hakata", "Kumamoto", "Kagoshima-Chuo"],
  },
  {
    id: "nishi-kyushu-shinkansen",
    name: "Nishi-Kyūshū Shinkansen",
    color: "#E50012",
    stations: ["Takeo-Onsen", "Ureshino-Onsen", "Shin-Omura", "Isahaya", "Nagasaki"],
  },
  {
    id: "tohoku-shinkansen",
    name: "Tōhoku Shinkansen",
    color: "#008803",
    stations: ["Tokyo", "Ueno", "Omiya", "Sendai", "Morioka", "Shin-Aomori"],
  },
  {
    id: "hokkaido-shinkansen",
    name: "Hokkaidō Shinkansen",
    color: "#8FC31F",
    stations: ["Shin-Aomori", "Shin-Hakodate-Hokuto"],
  },
  {
    id: "hokuriku-shinkansen",
    name: "Hokuriku Shinkansen",
    color: "#8A6BBE",
    stations: ["Tokyo", "Ueno", "Omiya", "Nagano", "Toyama", "Kanazawa", "Fukui", "Tsuruga"],
  },
  {
    id: "joetsu-shinkansen",
    name: "Jōetsu Shinkansen",
    color: "#00B2E5",
    stations: ["Tokyo", "Ueno", "Omiya", "Niigata"],
  },
  {
    id: "yamagata-shinkansen",
    name: "Yamagata Shinkansen",
    color: "#F08300",
    stations: ["Tokyo", "Ueno", "Omiya", "Fukushima", "Yonezawa", "Yamagata", "Shinjo"],
  },
  {
    id: "akita-shinkansen",
    name: "Akita Shinkansen",
    color: "#E4007F",
    stations: ["Tokyo", "Sendai", "Morioka", "Kakunodate", "Akita"],
  },
];

export const japanRailLines: TransitLine[] = (() => {
  const linesByStation = new Map<string, string[]>();
  for (const line of japanLineDefs) {
    for (const station of line.stations) {
      const names = linesByStation.get(station) || [];
      names.push(line.name);
      linesByStation.set(station, names);
    }
  }
  return japanLineDefs.map((line) => ({
    id: line.id,
    name: line.name,
    color: line.color,
    stations: line.stations.map((station): LineStation => {
      const transfers = (linesByStation.get(station) || []).filter((name) => name !== line.name);
      return { name: station, interchanges: transfers.length > 0 ? transfers : undefined };
    }),
  }));
})();

export const koreaStations = [
  // KTX 與主要轉乘站 (KTX & Major Transfer Stations)
  "Seoul (SNC)", "Yongsan", "Yeongdeungpo", "Cheongnyangni",
  "Gwangmyeong", "Suwon", "Cheonan-Asan", "Osong",
  "Daejeon", "Seodaejeon",
  "Dongdaegu", "Daegu", "Singyeongju", "Ulsan", "Busan (BSN)",
  "Pohang", "Masan", "Jinju",
  "Iksan", "Jeonju", "Gwangju-Songjeong", "Mokpo", "Yeosu-EXPO",
  "Gangneung", "Donghae", "Pyeongchang",
  // 首爾主要地鐵站 (Major Seoul Subway Stations)
  "Gangnam", "Hongik Univ.", "Myeongdong", "Itaewon", "Dongdaemun", "Jamsil"
];
