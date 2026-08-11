import type { ScrapedRoute } from "./types";

/**
 * The Tokaido Shinkansen pairs JR Central's own timetable search answers for a
 * requested date.
 *
 * The list used to be much longer. Tokyo–Hakata, Tokyo–Sendai, Tokyo–Kanazawa,
 * Tokyo–Niigata and eleven Yamanote/Chuo commuter pairs were served by a
 * generator that emitted one departure every 30 (or 10) minutes from 06:00 to
 * 22:00 with a constant duration and fare. JR East, JR West, JR Kyushu,
 * JR Hokkaido and JR Shikoku have no source wired up here, so their routes are
 * not listed: no source, no route, no departures.
 */
export const japanJrCentralRoutes: ScrapedRoute[] = [
  { origin: "Tokyo", destination: "Shin-Osaka" },
  { origin: "Tokyo", destination: "Kyoto" },
  { origin: "Tokyo", destination: "Nagoya" },
  { origin: "Shin-Osaka", destination: "Tokyo" },
  { origin: "Nagoya", destination: "Shin-Osaka" },
];

/**
 * Korail has no listed routes. Its journey search blocks automated access, and
 * the nine KTX route files that used to stand in for it were curated snapshots.
 * Korea's data now comes from the Seoul Metro and Incheon Transit timetable
 * CSVs, which are artifacts rather than per-route files.
 */

export const singaporeRoutes: ScrapedRoute[] = [
  { origin: "Changi Airport", destination: "Jurong East" },
  { origin: "HarbourFront", destination: "Punggol" },
  { origin: "Jurong East", destination: "Raffles Place" },
  { origin: "Woodlands", destination: "Orchard" },
];

/**
 * KTMB pairs verified against the official data.gov.my GTFS feed. This is a
 * deliberately small catalogue: every endpoint also exists in the Malaysia
 * station menu, and the crawler only writes dates declared by GTFS calendar.
 */
export const malaysiaKtmbRoutes: ScrapedRoute[] = [
  { origin: "Rawang", destination: "Kuala Lumpur" },
  { origin: "Batu Caves", destination: "Kuala Lumpur" },
  { origin: "Klang", destination: "Subang Jaya" },
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

export const belgiumRoutes: ScrapedRoute[] = [
  { origin: "Brussels-Central", destination: "Antwerpen-Centraal" },
  { origin: "Brussels-Luxembourg", destination: "Antwerpen-Centraal" },
  { origin: "Gent-Sint-Pieters", destination: "Brussels Airport-Zaventem" },
  { origin: "Brugge", destination: "Liège-Guillemins" },
  { origin: "Brussels-South/Brussels-Midi", destination: "Namur" },
];

export const norwayRoutes: ScrapedRoute[] = [
  { origin: "Oslo S", destination: "Bergen stasjon" },
  { origin: "Oslo S", destination: "Trondheim S" },
  { origin: "Oslo S", destination: "Stavanger stasjon" },
  { origin: "Oslo lufthavn", destination: "Lillehammer" },
  { origin: "Trondheim S", destination: "Bodø stasjon" },
];

export const switzerlandRoutes: ScrapedRoute[] = [
  { origin: "Zürich HB", destination: "Bern" },
  { origin: "Zürich HB", destination: "Genève" },
  { origin: "Zürich HB", destination: "Basel SBB" },
  { origin: "Zürich HB", destination: "Lugano" },
  { origin: "Bern", destination: "Lausanne" },
];

/**
 * China has no listed routes. The four high-speed pairs previously stored here
 * were curated snapshots labelled "12306"; no official 12306 feed or permitted
 * scrape is wired up, so the country has no timetable data at all.
 */
