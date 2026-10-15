/**
 * How a ride is named on a card: an optional short code drawn as a badge, then
 * whatever of the name the badge does not already say.
 *
 * Providers disagree on what `lineCode` holds — an MTR code ("TWL"), an Entur
 * public code ("FB73"), a TfL line id ("victoria"), an iRail vehicle id
 * ("BE.NMBS.IC3705"), or simply the service name again. Only a short, upper-case
 * code reads as a badge; everything else stays text, so a badge never shows an
 * internal id or a lower-case slug.
 */
export interface LineBadgeLabel {
  /** Short code for the badge; absent when the ride has none worth drawing. */
  code?: string;
  /** Text after the badge; empty when the badge already says everything. */
  text: string;
}

const MAX_CODE_LENGTH = 5;
/** "EW", "TWL", "FB73", "RE10", "SL1", "ETS", or a bare line number such as "1" or "705". */
const SHORT_CODE = /^(?:[A-Z]{1,4}\d{0,4}|\d{1,3})$/;
/** A product category before a train number: "ICE 28", "IC 3705", "EUR 9301". */
const CATEGORY_AND_NUMBER = /^([A-Z]{2,4})\s+(\d{1,5})$/;

function shortCode(value: string | undefined): string | undefined {
  const code = value?.trim();
  return code && code.length <= MAX_CODE_LENGTH && SHORT_CODE.test(code) ? code : undefined;
}

export function lineBadge(name: string | undefined, code?: string): LineBadgeLabel {
  const text = (name ?? "").trim();

  const category = CATEGORY_AND_NUMBER.exec(text);
  if (category) return { code: category[1], text: category[2] };

  const provided = shortCode(code);
  if (provided) return { code: provided, text: text === provided ? "" : text };

  const fromName = shortCode(text);
  if (fromName) return { code: fromName, text: "" };

  return { text };
}
