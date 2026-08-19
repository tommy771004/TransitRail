/**
 * TfL's public Journey Planner page, driven with Playwright.
 *
 * NOT wired into the nightly run. tfl.gov.uk sits behind a Cloudflare
 * challenge that answers an automated browser with `Just a moment…` /
 * "Verification required" rather than journey results, which is what silently
 * stalled London for ten days from 2026-08-09. Defeating that check is not
 * something this project does, and it does not need to: the same journeys come
 * from TfL's documented Unified API, which `UnitedKingdomScraper` uses instead
 * and which the register grades tier A against this page's tier B.
 *
 * The module is kept — it is correct, tested, and works from networks the
 * challenge does not target — but re-wiring it into the scheduled job would
 * reintroduce that outage.
 */
import type { TransitResult } from "../types";
import type { ScrapedRouteData } from "../data/scraped/timetableDay";

const TFL_JOURNEY_PLANNER_URL = "https://tfl.gov.uk/JourneyPlanner/ResultsAsync";
const TFL_JOURNEY_PLANNER_SOURCE = "TfL official Journey Planner";
const TFL_MODES = "tube,dlr,overground,elizabeth-line";
const TFL_RAIL_MODES = new Set(TFL_MODES.split(","));

/**
 * Stable ids published by TfL for the routes committed by the nightly scraper.
 * Keeping this set explicit prevents a typeahead mismatch from silently
 * scraping a similarly named bus stop, point of interest, or National Rail
 * station. Expanding the route list requires certifying its page id here too.
 */
const TFL_BROWSER_STATIONS: Record<string, { id: string; pageName: string }> = {
  "heathrow terminals 2&3": {
    id: "1000105",
    pageName: "Heathrow Airport Terminals 1-3, Heathrow Terminals 2 & 3 Underground Station",
  },
  "oxford circus underground station": {
    id: "1000173",
    pageName: "Oxford Circus, Oxford Circus Station",
  },
  "king's cross st. pancras underground station": {
    id: "1000129",
    pageName: "Kings Cross (London), King's Cross St.Pancras Underground Station",
  },
  "leicester square": { id: "1000135", pageName: "Leicester Square, Leicester Square" },
  "camden town": { id: "1000036", pageName: "Camden Town (London), Camden Town Station" },
  "paddington station": { id: "1001221", pageName: "Paddington (London), Paddington Station" },
  "liverpool street station": { id: "1000138", pageName: "Liverpool Street, Liverpool Street Station" },
};

/**
 * How long to wait for the results markup after the document is parsed.
 *
 * The Journey Planner renders results server-side — every marker below is in
 * the initial HTML — so this either matches immediately or the page is not the
 * results page at all. Waiting 45s for that verdict bought nothing and cost a
 * failing route ninety seconds before it even reached its second sample.
 */
const RESULTS_MARKUP_TIMEOUT_MS = 12_000;

/** Pause before a sample's second attempt, so a retry never doubles a burst. */
const RETRY_BACKOFF_MS = 2_000;

/**
 * How many of the samples below may fail before the day is refused.
 *
 * Each sample covers roughly seventy-five minutes of the operating day, so a
 * missing one is a hole a passenger would read as "no service". Tolerating a
 * few keeps a flaky night from discarding a whole day, while refusing a day
 * that would be published with material gaps — the previous file, which is
 * complete, is the better answer then.
 */
const MAX_FAILED_SAMPLES = 3;

const SERVICE_DAY_SAMPLE_TIMES = [
  "05:30", "06:45", "08:00", "09:15", "10:30",
  "11:45", "13:00", "14:15", "15:30", "16:45",
  "18:00", "19:15", "20:30", "21:45", "23:00",
];

export interface TflBrowserJourneySummary {
  departureTime: string;
  arrivalTime: string;
  durationMinutes?: number;
  services: string[];
  modes: string[];
  stops?: string[];
  price?: number;
}

type TflBrowserPage = {
  goto(url: string, options?: { waitUntil?: "domcontentloaded"; timeout?: number }): Promise<unknown>;
  waitForFunction(
    fn: () => boolean,
    arg?: unknown,
    options?: { timeout?: number },
  ): Promise<unknown>;
  locator(selector: string): {
    evaluateAll<T>(fn: (elements: Element[]) => T): Promise<T>;
  };
  /** Present on a real Playwright page; used only to describe a failure. */
  url?(): string;
  evaluate?<T>(fn: () => T): Promise<T>;
};

function station(name: string) {
  const match = TFL_BROWSER_STATIONS[name.toLowerCase().trim()];
  if (!match) throw new Error(`No TfL Journey Planner station id is registered for "${name}".`);
  return match;
}

export function buildTflBrowserQueryUrl(
  origin: string,
  destination: string,
  date: string,
  time: string,
) {
  const from = station(origin);
  const to = station(destination);
  const url = new URL(TFL_JOURNEY_PLANNER_URL);
  const params = {
    InputFrom: from.pageName,
    From: from.pageName,
    FromId: from.id,
    InputTo: to.pageName,
    To: to.pageName,
    ToId: to.id,
    Date: date.replace(/-/g, ""),
    Time: time.replace(/:/g, ""),
    TimeIs: "departing",
    Modes: TFL_MODES,
    JpType: "publictransport",
    JourneyPreference: "leasttime",
    IsAsync: "true",
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function stableToken(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildTflBrowserResults(
  origin: string,
  destination: string,
  date: string,
  samples: TflBrowserJourneySummary[],
): TransitResult[] {
  const unique = new Map<string, TflBrowserJourneySummary>();
  for (const sample of samples) {
    if (!/^\d{2}:\d{2}$/.test(sample.departureTime) || !/^\d{2}:\d{2}$/.test(sample.arrivalTime)) continue;
    const services = Array.from(new Set(sample.services.map((value) => value.trim()).filter(Boolean)));
    const modes = Array.from(new Set(sample.modes.map((value) => value.trim()).filter(Boolean)));
    if (!modes.some((mode) => TFL_RAIL_MODES.has(mode))) continue;
    const key = [sample.departureTime, sample.arrivalTime, ...services].join("|");
    if (!unique.has(key)) unique.set(key, { ...sample, services, modes });
  }

  return [...unique.entries()]
    .sort(([, left], [, right]) => left.departureTime.localeCompare(right.departureTime))
    .map(([key, sample]) => {
      const modes = Array.from(new Set(sample.modes.map((value) => value.trim()).filter(Boolean)));
      const stops = Array.from(new Set((sample.stops || []).map((value) => value.trim()).filter(Boolean)));
      const service = sample.services.join(" + ") || "TfL";
      return {
        id: `${date}-uk-tfl-browser-${sample.departureTime.replace(":", "")}-${sample.arrivalTime.replace(":", "")}-${stableToken(key)}`,
        country: "united_kingdom",
        date,
        operator: "Transport for London",
        service,
        trainType: modes.join(" + ") || undefined,
        durationMinutes: sample.durationMinutes,
        departureTime: sample.departureTime,
        arrivalTime: sample.arrivalTime,
        origin,
        destination,
        price: sample.price,
        currency: sample.price === undefined ? undefined : "GBP",
        direct: sample.services.length <= 1,
        stops,
        realtime: false,
      } satisfies TransitResult;
    });
}

async function readJourneySummaries(page: TflBrowserPage): Promise<TflBrowserJourneySummary[]> {
  // Playwright serializes this function into the page. Constructing it from a
  // string keeps tsx/esbuild's Node-only `__name` helper out of the browser
  // context; an ordinary transpiled callback fails before it can read the DOM.
  const extract = new Function("elements", `
    const text = (element) => element?.textContent?.replace(/\\s+/g, " ").trim() || "";
    const unique = (values) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
    return elements.flatMap((element) => {
      const times = [...text(element.querySelector(".time-box .time")).matchAll(/\\b([01]\\d|2[0-3]):[0-5]\\d\\b/g)]
        .map((match) => match[0]);
      if (times.length < 2) return [];

      const durationText = text(element.querySelector(".journey-time"));
      const hours = Number(durationText.match(/(\\d+)\\s*hrs?/)?.[1] || 0);
      const minutes = Number(durationText.match(/(\\d+)\\s*mins?/)?.[1] || 0);
      const durationMinutes = hours * 60 + minutes || undefined;
      const stepModes = (step) => {
        const icon = step.querySelector(".step-heading > div[class*='-icon']");
        return [...(icon?.classList || [])]
          .map((className) => className.match(/^(.+)-icon$/)?.[1] || "")
          .filter(Boolean);
      };
      const transitSteps = [...element.querySelectorAll(".journey-detail-step")]
        .filter((step) => {
          const modes = stepModes(step);
          return !step.classList.contains("footpath")
            && !step.classList.contains("visually-hidden")
            && !modes.includes("walking");
        });
      const services = unique(transitSteps.map((step) => {
        const namedLine = text(step.querySelector(".step-summary .line-text"));
        if (namedLine) return namedLine;
        const summary = text(step.querySelector(".step-summary"));
        return summary.split(/\\s+to\\s+/i)[0] || "";
      }));
      const modes = unique(transitSteps.flatMap((step) => stepModes(step)));
      const stops = unique(transitSteps.flatMap((step) =>
        [...step.querySelectorAll(".stop-list .stop-link")].map((stop) => text(stop)),
      ));
      const fareText = text(element.querySelector(".journey-cost"));
      const fare = Number(fareText.replace(/[^0-9.]/g, ""));

      return [{
        departureTime: times[0],
        arrivalTime: times[1],
        durationMinutes,
        services,
        modes,
        stops,
        price: Number.isFinite(fare) && fare > 0 ? fare : undefined,
      }];
    });
  `) as (elements: Element[]) => TflBrowserJourneySummary[];
  return page.locator(".publictransport-box").evaluateAll(extract);
}

/**
 * Say what the page actually was when the results markup never appeared.
 *
 * `page.waitForFunction: Timeout` on its own cannot distinguish a slow render
 * from a block page, a challenge, or an outage notice — which is exactly the
 * question an operator needs answered, and the reason a ten-day outage read as
 * one repeating stack trace.
 */
async function describeUnexpectedPage(page: TflBrowserPage): Promise<string> {
  try {
    const url = page.url?.() || "";
    const snapshot = await page.evaluate?.(() => ({
      title: document.title,
      text: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160),
    }));
    const parts = [
      url ? `at ${url}` : "",
      snapshot?.title ? `title "${snapshot.title}"` : "",
      snapshot?.text ? `page says "${snapshot.text}"` : "",
    ].filter(Boolean);
    return parts.length > 0 ? ` The page was ${parts.join(", ")}.` : "";
  } catch {
    return "";
  }
}

async function scrapeSample(
  page: TflBrowserPage,
  origin: string,
  destination: string,
  date: string,
  time: string,
  retryDelayMs: number,
) {
  const url = buildTflBrowserQueryUrl(origin, destination, date, time);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForFunction(
        () => Boolean(document.querySelector(".journey-results, .disambiguation-form, .field-validation-errors")),
        undefined,
        { timeout: RESULTS_MARKUP_TIMEOUT_MS },
      );
      return readJourneySummaries(page);
    } catch (error) {
      lastError = new Error(
        `${error instanceof Error ? error.message : String(error)}${await describeUnexpectedPage(page)}`,
      );
      if (attempt < 2) {
        console.warn(`  TfL browser query retry: ${origin} → ${destination} on ${date} at ${time}`);
        // Back off before retrying. An immediate second request is the worst
        // thing to send when the first was refused for pacing reasons.
        if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Drive the same official Journey Planner a passenger uses at fifteen points in
 * the operating day. Only returned journeys become rows; gaps are not expanded
 * from a headway and overlapping results are deduplicated.
 */
export async function scrapeTflBrowserServiceDay(
  page: TflBrowserPage,
  origin: string,
  destination: string,
  date: string,
  options: { retryDelayMs?: number } = {},
): Promise<ScrapedRouteData> {
  const retryDelayMs = options.retryDelayMs ?? RETRY_BACKOFF_MS;
  const samples: TflBrowserJourneySummary[] = [];
  const failures: string[] = [];
  let attempted = 0;
  for (const time of SERVICE_DAY_SAMPLE_TIMES) {
    attempted += 1;
    // One refused sample used to throw straight out of this loop, so a single
    // timeout at 05:30 discarded the fourteen samples never attempted and the
    // route reported nothing at all. Collect what the planner does answer and
    // judge the day as a whole below.
    try {
      samples.push(...await scrapeSample(page, origin, destination, date, time, retryDelayMs));
    } catch (error) {
      failures.push(`${time}: ${error instanceof Error ? error.message : String(error)}`);
      // Say why on the first failure. The retry warnings alone produced thirty
      // lines that named every sample and no cause.
      if (failures.length === 1) console.warn(`  TfL sample failed: ${failures[0]}`);
      // Once the day cannot be published, more samples cannot rescue it — and
      // a market that is refusing every request would otherwise spend fifteen
      // timeouts per route-date. Four routes over seven days at that rate
      // overruns the workflow's 90-minute budget, and a cancelled job skips
      // the commit step, so an unreachable London would take every other
      // country's fresh data down with it.
      if (failures.length > MAX_FAILED_SAMPLES) break;
    }
  }

  const results = buildTflBrowserResults(origin, destination, date, samples);
  const context = `${attempted - failures.length}/${attempted} samples answered`
    + `${attempted < SERVICE_DAY_SAMPLE_TIMES.length ? ` (stopped after ${attempted} of ${SERVICE_DAY_SAMPLE_TIMES.length})` : ""}`
    + `${failures.length > 0 ? `; first failure — ${failures[0]}` : ""}`;

  if (failures.length > MAX_FAILED_SAMPLES) {
    throw new Error(
      `TfL Journey Planner covered too little of ${date} for ${origin} → ${destination} `
      + `to publish (${context}). Keeping the previous file rather than a day with gaps.`,
    );
  }
  if (results.length === 0) {
    throw new Error(
      `TfL Journey Planner returned no published journeys for ${origin} → ${destination} on ${date} (${context}).`,
    );
  }
  if (failures.length > 0) {
    console.warn(`  TfL partial day: ${origin} → ${destination} on ${date} — ${context}`);
  }
  return {
    origin,
    destination,
    date,
    scrapedAt: new Date().toISOString(),
    source: TFL_JOURNEY_PLANNER_SOURCE,
    results,
  };
}
