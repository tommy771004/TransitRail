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
  // Local Tokyo commuter lines (Yamanote Line, Chūō Line, etc.)
  { origin: "Tokyo", destination: "Ikebukuro" },
  { origin: "Ikebukuro", destination: "Tokyo" },
  { origin: "Tokyo", destination: "Shinjuku" },
  { origin: "Shinjuku", destination: "Tokyo" },
  { origin: "Tokyo", destination: "Shibuya" },
  { origin: "Shibuya", destination: "Tokyo" },
  { origin: "Tokyo", destination: "Shinagawa" },
  { origin: "Shinagawa", destination: "Tokyo" },
  { origin: "Tokyo", destination: "Ueno" },
  { origin: "Ueno", destination: "Tokyo" },
  { origin: "Tokyo", destination: "Akihabara" },
  { origin: "Akihabara", destination: "Tokyo" },
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

export const singaporeRoutes: ScrapedRoute[] = [
  { origin: "Changi Airport", destination: "Jurong East" },
  { origin: "HarbourFront", destination: "Punggol" },
  { origin: "Jurong East", destination: "Raffles Place" },
  { origin: "Woodlands", destination: "Orchard" },
];

export const thailandRoutes: ScrapedRoute[] = [
  { origin: "Mo Chit", destination: "Hua Lamphong" },
  { origin: "Siam", destination: "Mo Chit" },
  { origin: "Siam", destination: "Saphan Taksin" },
  { origin: "Sukhumvit", destination: "Hua Lamphong" },
];

export const hongKongRoutes: ScrapedRoute[] = [
  { origin: "Admiralty", destination: "Tsim Sha Tsui" },
  { origin: "Central", destination: "Tsuen Wan" },
  { origin: "Hong Kong", destination: "Airport" },
  { origin: "Tung Chung", destination: "Sunny Bay" },
];

export const unitedKingdomRoutes: ScrapedRoute[] = [
  { origin: "Heathrow Terminals 2&3", destination: "Oxford Circus Underground Station" },
  { origin: "King's Cross St. Pancras Underground Station", destination: "Oxford Circus Underground Station" },
  { origin: "Leicester Square", destination: "Camden Town" },
  { origin: "Paddington Station", destination: "Liverpool Street Station" },
];

export const unitedStatesRoutes: ScrapedRoute[] = [
  { origin: "Harvard", destination: "Logan International Airport" },
  { origin: "Park Street", destination: "Andrew" },
  { origin: "Park Street", destination: "Boston College" },
  { origin: "South Station", destination: "Harvard" },
];

export const germanyRoutes: ScrapedRoute[] = [
  { origin: "Berlin Hbf", destination: "Hamburg Hbf" },
  { origin: "Berlin Hbf", destination: "Munich Hbf" },
  { origin: "Frankfurt Hbf", destination: "Cologne Hbf" },
  { origin: "Munich Hbf", destination: "Frankfurt Hbf" },
];

export const franceRoutes: ScrapedRoute[] = [
  { origin: "Paris Gare de l'Est", destination: "Strasbourg" },
  { origin: "Paris Gare de Lyon", destination: "Lyon Part-Dieu" },
  { origin: "Paris Gare de Lyon", destination: "Marseille St-Charles" },
  { origin: "Paris Gare du Nord", destination: "Lille Europe" },
];

export const switzerlandRoutes: ScrapedRoute[] = [
  { origin: "Zürich HB", destination: "Bern" },
  { origin: "Zürich HB", destination: "Genève" },
  { origin: "Zürich HB", destination: "Basel SBB" },
  { origin: "Zürich HB", destination: "Lugano" },
  { origin: "Bern", destination: "Lausanne" },
];

export const chinaRoutes: ScrapedRoute[] = [
  { origin: "Beijing South", destination: "Nanjing South" },
  { origin: "Beijing South", destination: "Shanghai Hongqiao" },
  { origin: "Guangzhou South", destination: "Shenzhen North" },
  { origin: "Shanghai Hongqiao", destination: "Hangzhou East" },
];
