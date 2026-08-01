/**
 * Resolve Seoul subway stations named the Korean way onto the English names
 * the app searches by.
 *
 * data.go.kr's 서울 도시철도 열차운행시각표 identifies a station by 역사명 and
 * 역사코드. Search matches on the *English* menu name: the station menu's `name`
 * is `STATION_NM_ENG` and Korean lives only in `localName` (see seoulSubway.ts).
 * An adapter that emitted 역사명 verbatim would add 279 more stations the picker
 * lists but search cannot reach — the same defect as the Korail files calling
 * Seoul Station "Seoul (SNC)". Every Korean-side identifier crosses into the
 * app through this module.
 */
import rawStations from "./seoulSubwayStations.json";

interface SeoulSubwayRecord {
  STATION_CD: string;
  STATION_NM: string;
  STATION_NM_ENG: string;
  LINE_NUM: string;
  FR_CODE: string;
}

const records = rawStations as SeoulSubwayRecord[];

/** Korean extracts pad names inconsistently; whitespace is never significant. */
function koreanKey(name: string): string {
  return name.replace(/\s+/g, "");
}

const englishByKorean = new Map<string, string>();
const englishByCode = new Map<string, string>();
for (const record of records) {
  englishByKorean.set(koreanKey(record.STATION_NM), record.STATION_NM_ENG);
  englishByCode.set(record.STATION_CD.trim(), record.STATION_NM_ENG);
}

/**
 * 역사명 -> English menu name, or undefined when the dataset covers a station
 * the menu does not (Shinbundang, Gyeongui-Jungang and other non-1~9호선 lines).
 * Returning undefined is the point: the caller must drop the row rather than
 * invent a name search will never match.
 */
export function seoulStationNameFromKorean(korean: string): string | undefined {
  const key = koreanKey(korean);
  if (!key) return undefined;

  const exact = englishByKorean.get(key);
  if (exact) return exact;

  // Some extracts write 시청역 where the station list says 시청. The exact hit
  // above runs first, so 서울역 — the one real name that ends in 역 — still
  // resolves to Seoul Station instead of being trimmed to a non-station.
  if (key.endsWith("역")) return englishByKorean.get(key.slice(0, -1));
  return undefined;
}

/**
 * 역사코드 -> English menu name. Pass the code as it appeared in the file; do
 * not coerce it through Number() first (see isAmbiguousSeoulStationCode).
 */
export function seoulStationNameFromCode(code: string): string | undefined {
  const key = String(code).trim();
  if (!key) return undefined;

  const exact = englishByCode.get(key);
  if (exact) return exact;

  // A file that stored 역사코드 as a number lost the leading zero. Recover it
  // only when the bare form is not itself a station code, so this never
  // overrules a legitimate 3-digit code.
  if (/^\d{1,3}$/.test(key)) return englishByCode.get(key.padStart(4, "0"));
  return undefined;
}

/**
 * True when a code is one of the 11 that a numeric round-trip makes ambiguous:
 * "416" is Miasageori's own code and also 0416 (Seoul Station) with its leading
 * zero eaten by a spreadsheet. seoulStationNameFromCode resolves these to the
 * exact match, which is right only if the file really did keep leading zeros —
 * so an importer should check this and fall back to 역사명 instead of trusting
 * the code.
 */
export function isAmbiguousSeoulStationCode(code: string): boolean {
  const key = String(code).trim();
  if (!/^\d{1,3}$/.test(key)) return false;
  const padded = key.padStart(4, "0");
  return englishByCode.has(key) && englishByCode.has(padded);
}
