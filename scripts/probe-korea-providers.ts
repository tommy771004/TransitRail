/**
 * Probe the two Korean open-data providers before committing to an adapter.
 *
 * Korea is the worst-covered country in the app: the picker offers 305 Seoul
 * Metro stations and the timetables cover 9, because `KoreaScraper` is a
 * `SnapshotScraper` — Korail blocks automated browsers ("macro activity",
 * CODE : -8003), so there has never been a live source. The two candidates for
 * a real `ProviderBackedScraper` are:
 *
 *   TAGO 열차정보서비스 (data.go.kr)  — intercity rail: KTX / ITX / 무궁화.
 *                                       Would cover Cheongnyangni, Suwon, …
 *   서울 열린데이터광장 (openapi.seoul.go.kr) — Seoul Metro timetables.
 *                                       Would cover City Hall, Chungjeongno, …
 *
 * This script answers the questions an adapter design depends on, without
 * writing any data: does the key authenticate, what shape comes back, and are
 * the stations we actually 404 on present?
 *
 * Run: npx tsx scripts/probe-korea-providers.ts
 * Env: KOREA_TAGO_SERVICE_KEY, SEOUL_OPENAPI_KEY (see docs/korea-api-registration.md)
 */
import "dotenv/config";

const TAGO_BASE = process.env.KOREA_TAGO_BASE_URL || "https://apis.data.go.kr/1613000/TrainInfoService";
const SEOUL_BASE = process.env.SEOUL_OPENAPI_BASE_URL || "http://openapi.seoul.go.kr:8088";

const TIMEOUT_MS = 20_000;

/** Stations the app currently cannot answer for — the reason to do this at all. */
const TARGET_INTERCITY = ["청량리", "수원", "동대구", "서울", "부산"];
const TARGET_METRO = ["시청", "충정로", "청량리"];

type Json = Record<string, unknown>;

function heading(text: string) {
  console.log(`\n${"=".repeat(72)}\n${text}\n${"=".repeat(72)}`);
}

function ok(text: string) { console.log(`  ✓ ${text}`); }
function bad(text: string) { console.log(`  ✗ ${text}`); }
function info(text: string) { console.log(`    ${text}`); }

async function getText(url: string): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * data.go.kr returns HTTP 200 with an error envelope for most failures, and
 * sometimes XML even when `_type=json` was asked for. Both cases have to be
 * reported as failures or a broken key looks like an empty result set.
 */
function readDataGoKr(body: string): { rows: Json[]; note?: string } {
  const trimmed = body.trim();

  if (trimmed.startsWith("<")) {
    const code = /<returnReasonCode>([^<]+)</.exec(trimmed)?.[1]
      ?? /<resultCode>([^<]+)</.exec(trimmed)?.[1];
    const msg = /<returnAuthMsg>([^<]+)</.exec(trimmed)?.[1]
      ?? /<resultMsg>([^<]+)</.exec(trimmed)?.[1]
      ?? /<errMsg>([^<]+)</.exec(trimmed)?.[1];
    throw new Error(`XML response${code ? ` (code ${code})` : ""}${msg ? `: ${msg}` : ""}. `
      + "A registered key that returns XML here usually means the request was rejected before routing.");
  }

  let parsed: Json;
  try {
    parsed = JSON.parse(trimmed) as Json;
  } catch {
    throw new Error(`Body is neither XML nor JSON: ${trimmed.slice(0, 160)}`);
  }

  const response = (parsed.response ?? {}) as Json;
  const header = (response.header ?? {}) as Json;
  const resultCode = String(header.resultCode ?? "");
  const resultMsg = String(header.resultMsg ?? "");

  if (resultCode && resultCode !== "00") {
    throw new Error(`resultCode ${resultCode}: ${resultMsg}`);
  }

  const bodyNode = (response.body ?? {}) as Json;
  const items = bodyNode.items;
  // An empty page is serialised as "" rather than an empty array.
  if (items === "" || items === undefined || items === null) {
    return { rows: [], note: `totalCount=${String(bodyNode.totalCount ?? "?")}` };
  }
  const item = (items as Json).item;
  const rows = Array.isArray(item) ? (item as Json[]) : item ? [item as Json] : [];
  return { rows, note: `totalCount=${String(bodyNode.totalCount ?? "?")}` };
}

async function probeTago(serviceKey: string) {
  heading("TAGO 열차정보서비스 — data.go.kr (intercity rail)");

  // The key is issued in both encoded and decoded forms. Passing the encoded
  // one through URLSearchParams double-encodes it, which the portal rejects as
  // SERVICE_KEY_IS_NOT_REGISTERED_ERROR — the single most common setup failure.
  if (/%[0-9A-Fa-f]{2}/.test(serviceKey)) {
    bad("KOREA_TAGO_SERVICE_KEY looks URL-encoded (contains %XX).");
    info("Use the Decoding key from the portal, or this request will double-encode it.");
  }

  const call = async (op: string, params: Record<string, string>) => {
    const query = new URLSearchParams({
      serviceKey,
      _type: "json",
      numOfRows: "200",
      pageNo: "1",
      ...params,
    });
    const { status, body } = await getText(`${TAGO_BASE}/${op}?${query}`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${body.slice(0, 200)}`);
    return readDataGoKr(body);
  };

  // 1. Cheapest call that proves the key works at all.
  let cityRows: Json[] = [];
  try {
    const { rows, note } = await call("getCtyCodeList", {});
    cityRows = rows;
    ok(`getCtyCodeList — key authenticates, ${rows.length} cities (${note})`);
    info(`sample: ${rows.slice(0, 3).map((r) => `${r.cityname}=${r.citycode}`).join(", ")}`);
  } catch (e) {
    bad(`getCtyCodeList failed: ${e instanceof Error ? e.message : e}`);
    info("Everything below depends on this; fix the key before reading further.");
    return;
  }

  // 2. Station list — does it contain the stations we currently 404 on?
  const seoulCity = cityRows.find((r) => String(r.cityname ?? "").includes("서울"));
  if (!seoulCity) {
    bad("No 서울 entry in the city list — check the field names in the sample above.");
  } else {
    try {
      const { rows } = await call("getCtyAcctoTrainSttnList", {
        cityCode: String(seoulCity.citycode),
      });
      ok(`getCtyAcctoTrainSttnList(서울) — ${rows.length} stations`);
      const names = rows.map((r) => String(r.nodename ?? ""));
      for (const target of TARGET_INTERCITY) {
        const hit = rows.find((r) => String(r.nodename ?? "").includes(target));
        if (hit) info(`  ${target}: FOUND  id=${hit.nodeid}`);
        else info(`  ${target}: not in 서울 city list (may sit under another cityCode)`);
      }
      info(`  first few: ${names.slice(0, 6).join(", ")}`);
    } catch (e) {
      bad(`getCtyAcctoTrainSttnList failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3. The call an adapter would actually make per route.
  const depDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  try {
    const { rows, note } = await call("getStrtpntAlocFndTrainInfo", {
      depPlaceId: "NAT010000",   // 서울
      arrPlaceId: "NAT014445",   // 부산
      depPlandTime: depDate,
    });
    ok(`getStrtpntAlocFndTrainInfo(서울→부산, ${depDate}) — ${rows.length} departures (${note})`);
    if (rows[0]) {
      info(`  fields: ${Object.keys(rows[0]).join(", ")}`);
      info(`  sample: ${JSON.stringify(rows[0])}`);
    } else {
      info("  0 rows — confirm the hardcoded NAT station ids above are still correct.");
    }
  } catch (e) {
    bad(`getStrtpntAlocFndTrainInfo failed: ${e instanceof Error ? e.message : e}`);
  }
}

async function probeSeoul(key: string) {
  heading("서울 열린데이터광장 — openapi.seoul.go.kr (Seoul Metro)");

  // Path-style API: /{KEY}/{TYPE}/{SERVICE}/{START}/{END}/{...filters}
  const call = async (service: string, start: number, end: number, ...filters: string[]) => {
    const path = [key, "json", service, String(start), String(end), ...filters]
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const { status, body } = await getText(`${SEOUL_BASE}/${path}/`);
    if (status !== 200) throw new Error(`HTTP ${status}: ${body.slice(0, 200)}`);

    const parsed = JSON.parse(body) as Json;
    // Errors come back as { RESULT: { CODE, MESSAGE } } at the top level.
    const result = (parsed.RESULT ?? {}) as Json;
    if (result.CODE && result.CODE !== "INFO-000") {
      throw new Error(`${String(result.CODE)}: ${String(result.MESSAGE)}`);
    }
    const node = (parsed[service] ?? {}) as Json;
    const nested = (node.RESULT ?? {}) as Json;
    if (nested.CODE && nested.CODE !== "INFO-000") {
      throw new Error(`${String(nested.CODE)}: ${String(nested.MESSAGE)}`);
    }
    return {
      total: Number(node.list_total_count ?? 0),
      rows: (node.row as Json[] | undefined) ?? [],
    };
  };

  // 1. Station lookup — proves the key works and gives the codes the
  //    timetable service is keyed on.
  const codes = new Map<string, string>();
  for (const name of TARGET_METRO) {
    try {
      const { total, rows } = await call("SearchInfoBySubwayNameService", 1, 5, name);
      if (rows.length === 0) {
        bad(`${name}: no station row (total=${total})`);
        continue;
      }
      ok(`${name}: ${rows.length} row(s), total=${total}`);
      info(`  fields: ${Object.keys(rows[0]).join(", ")}`);
      const code = rows[0].STATION_CD ?? rows[0].FR_CODE;
      if (code) codes.set(name, String(code));
      info(`  ${JSON.stringify(rows[0])}`);
    } catch (e) {
      bad(`${name}: ${e instanceof Error ? e.message : e}`);
      if (codes.size === 0 && name === TARGET_METRO[0]) {
        info("First lookup failed — check SEOUL_OPENAPI_KEY before reading further.");
        return;
      }
    }
  }

  // 2. The timetable itself: this is what decides whether real Seoul Metro
  //    departures are reachable, or only realtime arrivals.
  const [firstName, firstCode] = codes.entries().next().value ?? [];
  if (!firstCode) {
    bad("No station code resolved — cannot probe the timetable service.");
    return;
  }
  try {
    // filters: 전철역코드 / 요일구분(1=평일 2=토요일 3=휴일) / 상하행(1=상행 2=하행)
    const { total, rows } = await call("SearchSTNTimeTableByFRCodeService", 1, 5, firstCode, "1", "1");
    ok(`SearchSTNTimeTableByFRCodeService(${firstName}, 평일, 상행) — ${rows.length} of ${total}`);
    if (rows[0]) {
      info(`  fields: ${Object.keys(rows[0]).join(", ")}`);
      info(`  sample: ${JSON.stringify(rows[0])}`);
    }
  } catch (e) {
    bad(`SearchSTNTimeTableByFRCodeService failed: ${e instanceof Error ? e.message : e}`);
    info("If this is a permission error the key may need this dataset activated separately.");
  }
}

async function main() {
  const tagoKey = process.env.KOREA_TAGO_SERVICE_KEY?.trim();
  const seoulKey = process.env.SEOUL_OPENAPI_KEY?.trim();

  if (!tagoKey && !seoulKey) {
    console.log("No Korean provider keys configured.\n");
    console.log("  KOREA_TAGO_SERVICE_KEY  intercity rail  (data.go.kr)");
    console.log("  SEOUL_OPENAPI_KEY       Seoul Metro     (data.seoul.go.kr)\n");
    console.log("Registration walkthrough: docs/korea-api-registration.md");
    process.exitCode = 1;
    return;
  }

  if (tagoKey) await probeTago(tagoKey);
  else console.log("\n(skipping TAGO — KOREA_TAGO_SERVICE_KEY not set)");

  if (seoulKey) await probeSeoul(seoulKey);
  else console.log("\n(skipping Seoul — SEOUL_OPENAPI_KEY not set)");

  heading("What to do with this output");
  console.log(`  Record the field names above in docs/korea-api-registration.md, then map them
  onto TransitResult. Only wire an adapter for a service that returned real
  departure rows — a station list alone cannot answer a timetable search, and
  this project does not synthesize schedules to fill the gap.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
