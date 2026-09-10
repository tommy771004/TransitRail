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
  // San'yō Shinkansen, from the same joint Tokaido/San'yō timetable search.
  // West of Shin-Osaka the catalogue had six stations and no committed data,
  // so the whole line was hidden; these pairs are what makes it answerable.
  { origin: "Shin-Osaka", destination: "Okayama" },
  { origin: "Okayama", destination: "Shin-Osaka" },
  { origin: "Shin-Osaka", destination: "Hiroshima" },
  { origin: "Hiroshima", destination: "Shin-Osaka" },
  { origin: "Shin-Osaka", destination: "Hakata" },
  { origin: "Hakata", destination: "Shin-Osaka" },
];

// Korea's subway CSV artifacts and dynamically discovered Korail XLSX routes
// are owned by KoreaScraper and KorailTimetableScraper respectively.

export const singaporeRoutes: ScrapedRoute[] = [
  // Changi Airport → Jurong East is not a single service: the airport branch
  // terminates at Tanah Merah, so the GTFS feed publishes no direct trip and
  // the pair failed every night. Scraping the two real legs keeps the journey
  // answerable — search chains origin→X with X→destination — and every row is
  // a train the operator actually runs.
  { origin: "Changi Airport", destination: "Tanah Merah" },
  { origin: "Tanah Merah", destination: "Jurong East" },
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

/**
 * Every pair the destination picker marks as a direct connection.
 *
 * Switzerland answers arbitrary pairs live through OJP, and these files are the
 * fallback for when it cannot — no credential configured, or an outage. The
 * fallback was five pairs covering six stations while the station menu offered
 * twenty-three, so a keyless build sent most of the menu to an empty result and
 * the picker promised an "IC1 direct" the search then called unsupported.
 *
 * The list is derived from the market topology: one entry per pair of stations
 * that share a line, which is exactly the set the picker badges. A stored route
 * answers both directions, so each pair is listed once.
 *
 * The OJP token buys live answers for pairs beyond these lines; it is not what
 * makes these work. The GTFS static feed behind them needs no credential.
 */
export const switzerlandRoutes: ScrapedRoute[] = [
  // off-line hub pairs
  { origin: "Bern", destination: "Interlaken Ost" },
  { origin: "Luzern", destination: "Zürich HB" },
  // IC1 Genève-Aéroport–St. Gallen
  { origin: "Bern", destination: "Fribourg/Freiburg" },
  { origin: "Bern", destination: "Genève" },
  { origin: "Bern", destination: "Genève-Aéroport" },
  { origin: "Bern", destination: "Lausanne" },
  { origin: "Bern", destination: "St. Gallen" },
  { origin: "Bern", destination: "Winterthur" },
  { origin: "Bern", destination: "Zürich HB" },
  { origin: "Fribourg/Freiburg", destination: "Genève" },
  { origin: "Fribourg/Freiburg", destination: "Genève-Aéroport" },
  { origin: "Fribourg/Freiburg", destination: "Lausanne" },
  { origin: "Fribourg/Freiburg", destination: "St. Gallen" },
  { origin: "Fribourg/Freiburg", destination: "Winterthur" },
  { origin: "Fribourg/Freiburg", destination: "Zürich HB" },
  { origin: "Genève", destination: "Genève-Aéroport" },
  { origin: "Genève", destination: "Lausanne" },
  { origin: "Genève", destination: "St. Gallen" },
  { origin: "Genève", destination: "Winterthur" },
  { origin: "Genève", destination: "Zürich HB" },
  { origin: "Genève-Aéroport", destination: "Lausanne" },
  { origin: "Genève-Aéroport", destination: "St. Gallen" },
  { origin: "Genève-Aéroport", destination: "Winterthur" },
  { origin: "Genève-Aéroport", destination: "Zürich HB" },
  { origin: "Lausanne", destination: "St. Gallen" },
  { origin: "Lausanne", destination: "Winterthur" },
  { origin: "Lausanne", destination: "Zürich HB" },
  { origin: "St. Gallen", destination: "Winterthur" },
  { origin: "St. Gallen", destination: "Zürich HB" },
  { origin: "Winterthur", destination: "Zürich HB" },
  // IC2 Zürich HB–Lugano
  { origin: "Arth-Goldau", destination: "Bellinzona" },
  { origin: "Arth-Goldau", destination: "Lugano" },
  { origin: "Arth-Goldau", destination: "Zug" },
  { origin: "Arth-Goldau", destination: "Zürich HB" },
  { origin: "Bellinzona", destination: "Lugano" },
  { origin: "Bellinzona", destination: "Zug" },
  { origin: "Bellinzona", destination: "Zürich HB" },
  { origin: "Lugano", destination: "Zug" },
  { origin: "Lugano", destination: "Zürich HB" },
  { origin: "Zug", destination: "Zürich HB" },
  // IC3 Basel SBB–Chur
  { origin: "Basel SBB", destination: "Chur" },
  { origin: "Basel SBB", destination: "Sargans" },
  { origin: "Basel SBB", destination: "Zürich Flughafen" },
  { origin: "Basel SBB", destination: "Zürich HB" },
  { origin: "Chur", destination: "Sargans" },
  { origin: "Chur", destination: "Zürich Flughafen" },
  { origin: "Chur", destination: "Zürich HB" },
  { origin: "Sargans", destination: "Zürich Flughafen" },
  { origin: "Sargans", destination: "Zürich HB" },
  { origin: "Zürich Flughafen", destination: "Zürich HB" },
  // IC5 Genève-Aéroport–St. Gallen via Biel/Bienne
  { origin: "Biel/Bienne", destination: "Genève" },
  { origin: "Biel/Bienne", destination: "Genève-Aéroport" },
  { origin: "Biel/Bienne", destination: "Lausanne" },
  { origin: "Biel/Bienne", destination: "St. Gallen" },
  { origin: "Biel/Bienne", destination: "Winterthur" },
  { origin: "Biel/Bienne", destination: "Yverdon-les-Bains" },
  { origin: "Biel/Bienne", destination: "Zürich HB" },
  { origin: "Genève", destination: "Yverdon-les-Bains" },
  { origin: "Genève-Aéroport", destination: "Yverdon-les-Bains" },
  { origin: "Lausanne", destination: "Yverdon-les-Bains" },
  { origin: "St. Gallen", destination: "Yverdon-les-Bains" },
  { origin: "Winterthur", destination: "Yverdon-les-Bains" },
  { origin: "Yverdon-les-Bains", destination: "Zürich HB" },
  // IR90 Brig–Genève-Aéroport
  { origin: "Brig", destination: "Genève" },
  { origin: "Brig", destination: "Genève-Aéroport" },
  { origin: "Brig", destination: "Lausanne" },
  { origin: "Brig", destination: "Montreux" },
  { origin: "Brig", destination: "Sion" },
  { origin: "Genève", destination: "Montreux" },
  { origin: "Genève", destination: "Sion" },
  { origin: "Genève-Aéroport", destination: "Montreux" },
  { origin: "Genève-Aéroport", destination: "Sion" },
  { origin: "Lausanne", destination: "Montreux" },
  { origin: "Lausanne", destination: "Sion" },
  { origin: "Montreux", destination: "Sion" },
];

/**
 * China has no listed routes. The four high-speed pairs previously stored here
 * were curated snapshots labelled "12306"; no official 12306 feed or permitted
 * scrape is wired up, so the country has no timetable data at all.
 */
