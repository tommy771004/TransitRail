import type { TransitLine, LineStation } from "../types";

export const taiwanStations = [
  "Keelung", "Qidu", "Nangang", "Songshan", "Taipei", "Banqiao", "Shulin",
  "Taoyuan", "Zhongli", "Hsinchu", "Zhunan", "Miaoli", "Fengyuan", "Taichung",
  "Changhua", "Yuanlin", "Douliu", "Chiayi", "Xinying", "Tainan",
  "Gangshan", "Xinzuoying", "Kaohsiung", "Fengshan", "Pingtung", "Chaozhou", "Fangliao",
  "Ruifang", "Yilan", "Luodong", "Hualien", "Yuli", "Taitung"
];

// Grouped stations for regional bento-grid UI selection
export const taiwanRegions = [
  {
    name: "北北基 (Taipei/Keelung)",
    stations: ["Keelung", "Qidu", "Nangang", "Songshan", "Taipei", "Banqiao", "Shulin"]
  },
  {
    name: "桃竹苗 (Taoyuan/Hsinchu)",
    stations: ["Taoyuan", "Zhongli", "Hsinchu", "Zhunan", "Miaoli"]
  },
  {
    name: "中彰投 (Taichung/Changhua)",
    stations: ["Fengyuan", "Taichung", "Changhua", "Yuanlin"]
  },
  {
    name: "雲嘉南 (Chiayi/Tainan)",
    stations: ["Douliu", "Chiayi", "Xinying", "Tainan"]
  },
  {
    name: "高屏 (Kaohsiung/Pingtung)",
    stations: ["Gangshan", "Xinzuoying", "Kaohsiung", "Fengshan", "Pingtung", "Chaozhou", "Fangliao"]
  },
  {
    name: "宜花東 (East Coast)",
    stations: ["Ruifang", "Yilan", "Luodong", "Hualien", "Yuli", "Taitung"]
  }
];

export const taiwanRailLines: TransitLine[] = [
  {
    id: "western-line",
    name: "West Coast Main Line (西部幹線)",
    color: "#004F95",
    stations: [
      { name: "Keelung" },
      { name: "Qidu", interchanges: ["eastern-line"] },
      { name: "Nangang", interchanges: ["eastern-line"] },
      { name: "Songshan", interchanges: ["eastern-line"] },
      { name: "Taipei", interchanges: ["eastern-line"] },
      { name: "Banqiao", interchanges: ["eastern-line"] },
      { name: "Shulin", interchanges: ["eastern-line"] },
      { name: "Taoyuan" },
      { name: "Zhongli" },
      { name: "Hsinchu" },
      { name: "Zhunan" },
      { name: "Miaoli" },
      { name: "Fengyuan" },
      { name: "Taichung" },
      { name: "Changhua" },
      { name: "Yuanlin" },
      { name: "Douliu" },
      { name: "Chiayi" },
      { name: "Xinying" },
      { name: "Tainan" },
      { name: "Gangshan" },
      { name: "Xinzuoying", interchanges: ["pingtung-line"] },
      { name: "Kaohsiung", interchanges: ["pingtung-line"] }
    ]
  },
  {
    id: "pingtung-line",
    name: "Pingtung & South-Link (屏東及南迴線)",
    color: "#0072C6",
    stations: [
      { name: "Xinzuoying", interchanges: ["western-line"] },
      { name: "Kaohsiung", interchanges: ["western-line"] },
      { name: "Fengshan" },
      { name: "Pingtung" },
      { name: "Chaozhou" },
      { name: "Fangliao" },
      { name: "Taitung", interchanges: ["eastern-line"] }
    ]
  },
  {
    id: "eastern-line",
    name: "East Coast Main Line (東部幹線)",
    color: "#00A0E9",
    stations: [
      { name: "Taipei", interchanges: ["western-line"] },
      { name: "Songshan", interchanges: ["western-line"] },
      { name: "Nangang", interchanges: ["western-line"] },
      { name: "Shulin", interchanges: ["western-line"] },
      { name: "Ruifang" },
      { name: "Yilan" },
      { name: "Luodong" },
      { name: "Hualien" },
      { name: "Yuli" },
      { name: "Taitung", interchanges: ["pingtung-line"] }
    ]
  }
];
