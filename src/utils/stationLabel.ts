import type { TFunction } from "i18next";
import i18n from "../i18n";
import type { Country } from "../types";
import { stationOverrides } from "../data/stationOverrides";

/**
 * Localised station label with per-country scoping. Prefers a country-specific
 * zh-TW override (see {@link stationOverrides}) so networks that share an
 * English station name don't collide; otherwise falls back to the flat
 * `station.<name>` i18next entry, and finally to the English name itself.
 */
export function stationLabel(t: TFunction, name: string, country?: Country): string {
  if (name && country && i18n.language === "zh-TW") {
    const override = stationOverrides[country]?.[name];
    if (override) return override;
  }
  return t(`station.${name}`, { defaultValue: name });
}
