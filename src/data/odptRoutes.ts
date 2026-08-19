import type { ScrapedRoute } from "../../scripts/scrapers/types";

export interface OdptRoute extends ScrapedRoute {
  operator: "Toei" | "TokyoMetro";
  railway: string;
  originStation: string;
  destinationStation: string;
  lineName: string;
  lineColor: string;
}

const bothDirections = (route: Omit<OdptRoute, "origin" | "destination" | "originStation" | "destinationStation"> & {
  stations: [[string, string], [string, string]];
}): OdptRoute[] => {
  const [[origin, originStation], [destination, destinationStation]] = route.stations;
  const shared = {
    operator: route.operator,
    railway: route.railway,
    lineName: route.lineName,
    lineColor: route.lineColor,
  };
  return [
    { ...shared, origin, destination, originStation, destinationStation },
    { ...shared, origin: destination, destination: origin, originStation: destinationStation, destinationStation: originStation },
  ];
};

/**
 * One pair per line, terminal to terminal.
 *
 * ODPT times every call a train makes, so a run scraped end to end answers any
 * two stations on the line — {@link ../server/odptTimetable} files those times
 * as legs and the matcher cuts the ride down to the pair asked for. A pair set
 * somewhere in the middle instead would collect the same trains and publish
 * only the stations at its ends: the Asakusa Line filed as Asakusa ↔ Nihombashi
 * held eighteen of its twenty stations as names search could not answer.
 *
 * Endpoints are spelled the way the line map spells them, since that is the
 * name the picker offers and search has to match; the ids are matched on their
 * romaji, so a station whose ODPT id differs in case or hyphenation still binds
 * to the right platform.
 */
export const odptRoutes: OdptRoute[] = [
  ...bothDirections({
    // The Oedo Line is a "6": a branch from Hikarigaoka joins a loop at
    // Tochomae, and the through run ends where it rejoined — its calling
    // pattern reads Hikarigaoka … Tochomae … round the loop … Tochomae.
    //
    // The pair is therefore Shinjuku-nishiguchi, the last station before that
    // second Tochomae, and not Tochomae itself: a train is read up to the
    // *first* time it calls at the destination, so Hikarigaoka ↔ Tochomae stops
    // at the branch and publishes 11 of the line's 38 stations. Both directions
    // of this pair carry the whole run (verified against the feed: 38 stations
    // each way). Hikarigaoka → Tochomae is still answered — as the short branch
    // ride it really is — by cutting this run down to its first call there.
    operator: "Toei",
    railway: "odpt.Railway:Toei.Oedo",
    lineName: "Toei Oedo Line",
    lineColor: "#b6007a",
    stations: [
      ["Hikarigaoka", "odpt.Station:Toei.Oedo.Hikarigaoka"],
      ["Shinjuku-nishiguchi", "odpt.Station:Toei.Oedo.ShinjukuNishiguchi"],
    ],
  }),
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Asakusa",
    lineName: "Toei Asakusa Line",
    lineColor: "#e85298",
    stations: [
      ["Nishi-magome", "odpt.Station:Toei.Asakusa.Nishimagome"],
      ["Oshiage", "odpt.Station:Toei.Asakusa.Oshiage"],
    ],
  }),
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Shinjuku",
    lineName: "Toei Shinjuku Line",
    lineColor: "#6cbb5a",
    stations: [
      ["Shinjuku", "odpt.Station:Toei.Shinjuku.Shinjuku"],
      ["Motoyawata", "odpt.Station:Toei.Shinjuku.Motoyawata"],
    ],
  }),
  ...bothDirections({
    // Toei lines answer on api-public.odpt.org without a consumer key, so these
    // routes produce real scheduled departures today. The seven remaining Tokyo
    // Metro lines (Hibiya, Tozai, Chiyoda, Yurakucho, Hanzomon, Namboku,
    // Fukutoshin) return an empty array on that endpoint and need ODPT_API_KEY;
    // they are deliberately not configured until a key exists, because a route
    // with no usable source would only fall back to a synthetic snapshot.
    operator: "Toei",
    railway: "odpt.Railway:Toei.Mita",
    lineName: "Toei Mita Line",
    lineColor: "#0079c2",
    stations: [
      ["Nishi-takashimadaira", "odpt.Station:Toei.Mita.Nishitakashimadaira"],
      ["Meguro", "odpt.Station:Toei.Mita.Meguro"],
    ],
  }),
  ...bothDirections({
    operator: "TokyoMetro",
    railway: "odpt.Railway:TokyoMetro.Ginza",
    lineName: "Tokyo Metro Ginza Line",
    lineColor: "#f39700",
    stations: [
      ["Shibuya", "odpt.Station:TokyoMetro.Ginza.Shibuya"],
      ["Asakusa", "odpt.Station:TokyoMetro.Ginza.Asakusa"],
    ],
  }),
  ...bothDirections({
    // Main line only. The Honancho branch is a separate run and would need its
    // own pair once a key makes any of this reachable.
    operator: "TokyoMetro",
    railway: "odpt.Railway:TokyoMetro.Marunouchi",
    lineName: "Tokyo Metro Marunouchi Line",
    lineColor: "#e60012",
    stations: [
      ["Ogikubo", "odpt.Station:TokyoMetro.Marunouchi.Ogikubo"],
      ["Ikebukuro", "odpt.Station:TokyoMetro.Marunouchi.Ikebukuro"],
    ],
  }),
  // Through services are why one pair per line is not enough. Only 135 of the
  // Asakusa Line's 516 weekday trains run it end to end; the rest come off the
  // Keikyu or the Keisei and turn back at Sengakuji, so a line filed only as
  // Nishi-magome ↔ Oshiage publishes every station but answers Asakusa →
  // Nihombashi with a third of the departures that actually serve it. These
  // spans are the runs the operator actually schedules, read off the feed's own
  // calling patterns rather than guessed. A train that appears in both a
  // whole-line file and a span file is one departure, and the matcher publishes
  // it once.
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Asakusa",
    lineName: "Toei Asakusa Line",
    lineColor: "#e85298",
    stations: [
      ["Sengakuji", "odpt.Station:Toei.Asakusa.Sengakuji"],
      ["Oshiage", "odpt.Station:Toei.Asakusa.Oshiage"],
    ],
  }),
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Asakusa",
    lineName: "Toei Asakusa Line",
    lineColor: "#e85298",
    stations: [
      ["Nishi-magome", "odpt.Station:Toei.Asakusa.Nishimagome"],
      ["Sengakuji", "odpt.Station:Toei.Asakusa.Sengakuji"],
    ],
  }),
  ...bothDirections({
    // Same story on the Mita Line: 131 of its weekday trains turn back at
    // Shirokane-takanawa rather than running down to Meguro.
    operator: "Toei",
    railway: "odpt.Railway:Toei.Mita",
    lineName: "Toei Mita Line",
    lineColor: "#0079c2",
    stations: [
      ["Nishi-takashimadaira", "odpt.Station:Toei.Mita.Nishitakashimadaira"],
      ["Shirokane-takanawa", "odpt.Station:Toei.Mita.Shirokanetakanawa"],
    ],
  }),
];

export function findOdptRoute(origin: string, destination: string): OdptRoute | undefined {
  const key = (value: string) => value.trim().toLowerCase();
  return odptRoutes.find((route) => key(route.origin) === key(origin) && key(route.destination) === key(destination));
}
