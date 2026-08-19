import type { TFunction } from "i18next";
import i18n from "../i18n";
import type { Country } from "../types";
import { stationOverrides } from "../data/stationOverrides";
import { generatedStationLabel } from "../data/generatedStationLabels";

/**
 * Localised station label with per-country scoping. Resolution order:
 *
 *   1. a curated country-scoped zh-TW override (see {@link stationOverrides}),
 *      so networks that share an English station name don't collide;
 *   2. the flat curated `station.<name>` i18next entry;
 *   3. the sourced, country-scoped label from the generated station-i18n files
 *      (see {@link generatedStationLabel}) — gap-fill only, so a generated
 *      Wikipedia title can never overwrite a curated name;
 *   4. the provider's own name.
 *
 * Step 4 is a real answer, not a failure: the operator's spelling is always
 * correct to display, and it is what search sends back to the provider.
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
  // An empty default separates "the dictionary has no entry" from "the entry is
  // the English name", which matters because only the former may fall through
  // to a generated label.
  const curated = t(`station.${name}`, { defaultValue: "" });
  if (curated) return curated;
  return generatedStationLabel(locale, name, country) || name;
}

/** Localize a displayed station list while leaving provider query names intact. */
export function stationListLabel(
  t: TFunction,
  names: readonly string[],
  country?: Country,
): string {
  return names.map((name) => stationLabel(t, name, country)).join(", ");
}
