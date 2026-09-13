import type { Country } from "../types";

/** Fare-only documents. None of these registers a source of departures. */
export const fareSources: Record<Country, { publisher: string; url: string; matching: boolean }> = {
  japan: { publisher: "Tokyo Metro", url: "https://www.tokyometro.jp/ticket/types/regular/index.html", matching: false },
  korea: { publisher: "Korail", url: "https://www.korail.com/ticket/reserve/train-timeTable", matching: true },
  hong_kong: { publisher: "MTR", url: "https://opendata.mtr.com.hk/data/mtr_lines_fares.csv", matching: true },
  united_states: { publisher: "MBTA", url: "https://cdn.mbta.com/MBTA_GTFS.zip", matching: true },
  singapore: { publisher: "Public Transport Council", url: "https://www.ptc.gov.sg/fares/public-transport-fares-and-passes/", matching: false },
  malaysia: { publisher: "KTMB", url: "https://online.ktmb.com.my/", matching: false },
  thailand: { publisher: "BEM", url: "https://metro.bemplc.co.th/Fare-Calculation?lang=en", matching: false },
  united_kingdom: { publisher: "TfL", url: "https://tfl.gov.uk/fares/find-fares/single-fare-finder", matching: false },
  germany: { publisher: "Deutsche Bahn", url: "https://www.bahn.de/angebot/sparpreis-flexpreis", matching: false },
  france: { publisher: "SNCF Voyageurs", url: "https://www.sncf-voyageurs.com/fr/voyagez-avec-nous/en-france/tarifs-grandes-lignes/conditions-generales-de-vente/", matching: false },
  belgium: { publisher: "SNCB", url: "https://www.belgiantrain.be/fr/support/terms-and-conditions-for-transport", matching: false },
  norway: { publisher: "Ruter", url: "https://ruter.no/en/om-vare-billetter/single-ticket", matching: false },
  switzerland: { publisher: "Alliance SwissPass", url: "https://www.allianceswisspass.ch/de/tarife-vorschriften/uebersicht", matching: false },
  china: { publisher: "China Railway", url: "https://kyfw.12306.cn/otn/leftTicketPrice/initPublicPrice", matching: false },
};
