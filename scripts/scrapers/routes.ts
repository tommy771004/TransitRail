import type { ScrapedRoute } from "./types";

export const japanRoutes: ScrapedRoute[] = [
  { origin: "Tokyo", destination: "Shin-Osaka" },
  { origin: "Tokyo", destination: "Kyoto" },
  { origin: "Tokyo", destination: "Nagoya" },
  { origin: "Tokyo", destination: "Hakata" },
  { origin: "Tokyo", destination: "Sendai" },
  { origin: "Tokyo", destination: "Kanazawa" },
  { origin: "Tokyo", destination: "Niigata" },
  { origin: "Shin-Osaka", destination: "Hakata" },
  { origin: "Shin-Osaka", destination: "Tokyo" },
  { origin: "Nagoya", destination: "Shin-Osaka" },
  { origin: "Sendai", destination: "Tokyo" },
];

export const koreaRoutes: ScrapedRoute[] = [
  { origin: "Seoul (SNC)", destination: "Busan (BSN)" },
  { origin: "Seoul (SNC)", destination: "Mokpo" },
  { origin: "Seoul (SNC)", destination: "Gangneung" },
  { origin: "Seoul (SNC)", destination: "Yeosu-EXPO" },
  { origin: "Seoul (SNC)", destination: "Daejeon" },
  { origin: "Seoul (SNC)", destination: "Gwangju-Songjeong" },
  { origin: "Busan (BSN)", destination: "Seoul (SNC)" },
  { origin: "Daejeon", destination: "Busan (BSN)" },
  { origin: "Yongsan", destination: "Mokpo" },
];
