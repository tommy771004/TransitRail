// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: One sentence for where a train was last seen, shared by the trip card
// and the live train list so both say it the same way.

import type { TFunction } from "i18next";
import type { Country } from "../types";
import { stationLabel } from "./stationLabel";

export function livePositionText(
  t: TFunction,
  position: { nearStation?: string; between?: [string, string] },
  country: Country,
): string {
  if (position.nearStation) return t("result.train_near", { station: stationLabel(t, position.nearStation, country) });
  if (position.between) {
    return t("result.train_between_stations", {
      from: stationLabel(t, position.between[0], country),
      to: stationLabel(t, position.between[1], country),
    });
  }
  return t("result.train_between");
}
