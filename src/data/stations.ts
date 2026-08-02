import type { LineStation, TransitLine } from "../types";

export const japanStations = [
  // 主要新幹線與大城市車站 (Major Shinkansen & City Stations)
  "Tokyo", "Shinagawa", "Shinjuku", "Shibuya", "Ikebukuro", "Ueno", "Akihabara",
  "Roppongi", "Asakusa", "Nihombashi", "Jimbocho", "Ginza", "Otemachi",
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
    // Full station order from the operator's published line map. The five Tokyo
    // subway lines here previously held only their endpoints (10 entries for
    // ~130 stations), so interchange derivation — which works by shared station
    // name — could not see Akasaka-mitsuke, Otemachi, Nihombashi or any other
    // real transfer point.
    //
    // The Oedo Line is a "6": a branch from Hikarigaoka joins a loop at
    // Tochomae. buildLines models a line as one ordered array, so this is the
    // through-service order and the loop's closing link is not represented.
    id: "toei-oedo",
    name: "Toei Oedo Line",
    color: "#B6007A",
    stations: [
      "Hikarigaoka", "Nerima-kasugacho", "Toshimaen", "Nerima", "Shin-egota",
      "Ochiai-minami-nagasaki", "Nakai", "Higashi-nakano", "Nakano-sakaue",
      "Nishi-shinjuku-gochome", "Tochomae", "Shinjuku-nishiguchi",
      "Higashi-shinjuku", "Wakamatsu-kawada", "Ushigome-yanagicho",
      "Ushigome-kagurazaka", "Iidabashi", "Kasuga", "Hongo-sanchome",
      "Ueno-okachimachi", "Shin-okachimachi", "Kuramae", "Ryogoku", "Morishita",
      "Kiyosumi-shirakawa", "Monzen-nakacho", "Tsukishima", "Kachidoki",
      "Tsukijishijo", "Shiodome", "Daimon", "Akabanebashi", "Azabu-juban",
      "Roppongi", "Aoyama-itchome", "Kokuritsu-kyogijo", "Yoyogi", "Shinjuku",
    ],
  },
  {
    id: "toei-asakusa",
    name: "Toei Asakusa Line",
    color: "#E85298",
    stations: [
      "Nishi-magome", "Magome", "Nakanobu", "Togoshi", "Gotanda", "Takanawadai",
      "Sengakuji", "Mita", "Daimon", "Shimbashi", "Higashi-ginza", "Takaracho",
      "Nihombashi", "Ningyocho", "Higashi-nihombashi", "Asakusabashi",
      "Kuramae", "Asakusa", "Honjo-azumabashi", "Oshiage",
    ],
  },
  {
    id: "toei-shinjuku",
    name: "Toei Shinjuku Line",
    color: "#6CBB5A",
    stations: [
      "Shinjuku", "Shinjuku-sanchome", "Akebonobashi", "Ichigaya", "Kudanshita",
      "Jimbocho", "Ogawamachi", "Iwamotocho", "Bakuro-yokoyama", "Hamacho",
      "Morishita", "Kikukawa", "Sumiyoshi", "Nishi-ojima", "Ojima",
      "Higashi-ojima", "Funabori", "Ichinoe", "Mizue", "Shinozaki", "Motoyawata",
    ],
  },
  {
    id: "tokyo-metro-ginza",
    name: "Tokyo Metro Ginza Line",
    color: "#FF9500",
    stations: [
      "Shibuya", "Omote-sando", "Gaiemmae", "Aoyama-itchome", "Akasaka-mitsuke",
      "Tameike-sanno", "Toranomon", "Shimbashi", "Ginza", "Kyobashi",
      "Nihombashi", "Mitsukoshimae", "Kanda", "Suehirocho", "Ueno-hirokoji",
      "Ueno", "Inaricho", "Tawaramachi", "Asakusa",
    ],
  },
  {
    // Station order taken from the ODPT timetable feed itself (the longest run),
    // which is the same source the timetable adapter reads.
    id: "toei-mita",
    name: "Toei Mita Line",
    color: "#0079C2",
    stations: [
      "Nishi-takashimadaira", "Shin-takashimadaira", "Takashimadaira", "Nishidai",
      "Hasune", "Shimura-sanchome", "Shimura-sakaue", "Motohasunuma",
      "Itabashi-honcho", "Itabashi-kuyakushomae", "Shin-itabashi", "Nishi-sugamo",
      "Sugamo", "Sengoku", "Hakusan", "Kasuga", "Suidobashi", "Jimbocho",
      "Otemachi", "Hibiya", "Uchisaiwaicho", "Onarimon", "Shibakoen", "Mita",
      "Shirokane-takanawa", "Shirokanedai", "Meguro",
    ],
  },
  {
    // Main line only; the Honancho branch (Honancho-Nakano-fujimicho-
    // Nakano-shimbashi, joining at Nakano-sakaue) is a separate ordered run.
    id: "tokyo-metro-marunouchi",
    name: "Tokyo Metro Marunouchi Line",
    color: "#F62E36",
    stations: [
      "Ogikubo", "Minami-asagaya", "Shin-koenji", "Higashi-koenji",
      "Shin-nakano", "Nakano-sakaue", "Nishi-shinjuku", "Shinjuku",
      "Shinjuku-sanchome", "Shinjuku-gyoemmae", "Yotsuya-sanchome", "Yotsuya",
      "Akasaka-mitsuke", "Kokkai-gijido-mae", "Kasumigaseki", "Ginza", "Tokyo",
      "Otemachi", "Awajicho", "Ochanomizu", "Hongo-sanchome", "Korakuen",
      "Myogadani", "Shin-otsuka", "Ikebukuro",
    ],
  },
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
