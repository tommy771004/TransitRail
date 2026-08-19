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
  // Read the locale off the `t` we were handed, not the global one: `getFixedT`
  // renders a locale without switching the app to it, so a global check would
  // silently skip the override and hand back the other network's name.
  const locale = (t as TFunction & { lng?: string }).lng || i18n.language;
  if (name && country && locale === "zh-TW") {
    const override = stationOverrides[country]?.[name];
    if (override) return override;
  }
  return t(`station.${name}`, { defaultValue: name });
}
