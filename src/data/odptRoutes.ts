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

export const odptRoutes: OdptRoute[] = [
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Oedo",
    lineName: "Toei Oedo Line",
    lineColor: "#b6007a",
    stations: [["Shinjuku", "odpt.Station:Toei.Oedo.Shinjuku"], ["Roppongi", "odpt.Station:Toei.Oedo.Roppongi"]],
  }),
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Asakusa",
    lineName: "Toei Asakusa Line",
    lineColor: "#e85298",
    stations: [["Asakusa", "odpt.Station:Toei.Asakusa.Asakusa"], ["Nihombashi", "odpt.Station:Toei.Asakusa.Nihombashi"]],
  }),
  ...bothDirections({
    operator: "Toei",
    railway: "odpt.Railway:Toei.Shinjuku",
    lineName: "Toei Shinjuku Line",
    lineColor: "#6cbb5a",
    stations: [["Jimbocho", "odpt.Station:Toei.Shinjuku.Jimbocho"], ["Shinjuku", "odpt.Station:Toei.Shinjuku.Shinjuku"]],
  }),
  ...bothDirections({
    operator: "TokyoMetro",
    railway: "odpt.Railway:TokyoMetro.Ginza",
    lineName: "Tokyo Metro Ginza Line",
    lineColor: "#f39700",
    stations: [["Shibuya", "odpt.Station:TokyoMetro.Ginza.Shibuya"], ["Asakusa", "odpt.Station:TokyoMetro.Ginza.Asakusa"]],
  }),
  ...bothDirections({
    operator: "TokyoMetro",
    railway: "odpt.Railway:TokyoMetro.Marunouchi",
    lineName: "Tokyo Metro Marunouchi Line",
    lineColor: "#e60012",
    stations: [["Tokyo", "odpt.Station:TokyoMetro.Marunouchi.Tokyo"], ["Ginza", "odpt.Station:TokyoMetro.Marunouchi.Ginza"]],
  }),
  ...bothDirections({
    operator: "TokyoMetro",
    railway: "odpt.Railway:TokyoMetro.Marunouchi",
    lineName: "Tokyo Metro Marunouchi Line",
    lineColor: "#e60012",
    stations: [["Otemachi", "odpt.Station:TokyoMetro.Marunouchi.Otemachi"], ["Ikebukuro", "odpt.Station:TokyoMetro.Marunouchi.Ikebukuro"]],
  }),
  ...bothDirections({
    // Toei lines answer on api-public.odpt.org without a consumer key, so this
    // route produces real scheduled departures today. The seven remaining Tokyo
    // Metro lines (Hibiya, Tozai, Chiyoda, Yurakucho, Hanzomon, Namboku,
    // Fukutoshin) return an empty array on that endpoint and need ODPT_API_KEY;
    // they are deliberately not configured until a key exists, because a route
    // with no usable source would only fall back to a synthetic snapshot.
    operator: "Toei",
    railway: "odpt.Railway:Toei.Mita",
    lineName: "Toei Mita Line",
    lineColor: "#0079c2",
    stations: [["Jimbocho", "odpt.Station:Toei.Mita.Jimbocho"], ["Otemachi", "odpt.Station:Toei.Mita.Otemachi"]],
  }),
];

export function findOdptRoute(origin: string, destination: string): OdptRoute | undefined {
  const key = (value: string) => value.trim().toLowerCase();
  return odptRoutes.find((route) => key(route.origin) === key(origin) && key(route.destination) === key(destination));
}
