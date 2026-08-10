import type { Page } from "playwright";
import type { ScrapedRouteData } from "../data/scraped/timetableDay";
import type { TransitResult } from "../types";

const MBTA_TRIP_PLANNER_URL = "https://www.mbta.com/trip-planner";
const MBTA_TRIP_PLANNER_SOURCE = "MBTA official Trip Planner";
const BOSTON_TIME_ZONE = "America/New_York";
const DAY_MINUTES = 24 * 60;

export interface MbtaBrowserJourneySummary {
  departureTime: string;
  arrivalTime: string;
  durationMinutes?: number;
  services: string[];
  modes: string[];
  price?: number;
  unavailable?: boolean;
  suggestedTimes?: string[];
}

interface RawMbtaJourneySummary {
  timeRange: string;
  durationMinutes?: number;
  services: string[];
  modes: string[];
  price?: number;
  unavailable: boolean;
  suggestedTimes: string[];
}

function stableToken(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clockMinutes(hour: number, minute: number, meridiem: string) {
  return (hour % 12) * 60 + minute + (meridiem === "pm" ? 12 * 60 : 0);
}

function formatClock(minutes: number) {
  const normalized = (minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function hhmmMinutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

function parseMbtaClock(value: string) {
  const match = value.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return null;
  return formatClock(clockMinutes(Number(match[1]), Number(match[2]), match[3]));
}

export function sameMbtaServiceDate(
  sampleTime: string,
  journeys: MbtaBrowserJourneySummary[],
) {
  const requestedMinutes = hhmmMinutes(sampleTime);
  return journeys.filter((journey) => hhmmMinutes(journey.departureTime) >= requestedMinutes);
}

export function parseMbtaTimeRange(value: string): { departureTime: string; arrivalTime: string } | null {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(am|pm)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)/);
  if (!match) return null;

  const arrivalMeridiem = match[6];
  const departureHasMeridiem = Boolean(match[3]);
  let departureMinutes = clockMinutes(Number(match[1]), Number(match[2]), match[3] || arrivalMeridiem);
  const arrivalMinutes = clockMinutes(Number(match[4]), Number(match[5]), arrivalMeridiem);

  // MBTA elides the first meridiem when both clocks share it. Around noon,
  // "11:45 - 12:40 pm" means 11:45 am, not 11:45 pm.
  if (!departureHasMeridiem && departureMinutes - arrivalMinutes > 6 * 60) {
    departureMinutes -= 12 * 60;
  }

  return {
    departureTime: formatClock(departureMinutes),
    arrivalTime: formatClock(arrivalMinutes),
  };
}

export function buildMbtaBrowserResults(
  origin: string,
  destination: string,
  date: string,
  samples: MbtaBrowserJourneySummary[],
): TransitResult[] {
  const unique = new Map<string, MbtaBrowserJourneySummary>();
  for (const sample of samples) {
    if (sample.unavailable) continue;
    if (!/^\d{2}:\d{2}$/.test(sample.departureTime) || !/^\d{2}:\d{2}$/.test(sample.arrivalTime)) continue;
    const services = Array.from(new Set(sample.services.map((value) => value.trim()).filter(Boolean)));
    const modes = Array.from(new Set(sample.modes.map((value) => value.trim()).filter(Boolean)));
    if (!modes.some((mode) => mode === "subway" || mode === "commuter-rail" || mode === "rail")) continue;
    const key = [sample.departureTime, sample.arrivalTime, ...services].join("|");
    if (!unique.has(key)) unique.set(key, { ...sample, services, modes });
  }

  return [...unique.entries()]
    .sort(([, left], [, right]) => left.departureTime.localeCompare(right.departureTime))
    .map(([key, sample]) => {
      const includesBus = sample.modes.includes("bus");
      return {
        id: `${date}-us-mbta-browser-${sample.departureTime.replace(":", "")}-${sample.arrivalTime.replace(":", "")}-${stableToken(key)}`,
        country: "united_states",
        date,
        operator: "MBTA",
        service: sample.services.join(" + ") || "MBTA",
        trainType: sample.modes.join(" + ") || undefined,
        durationMinutes: sample.durationMinutes,
        departureTime: sample.departureTime,
        arrivalTime: sample.arrivalTime,
        origin,
        destination,
        price: sample.price,
        currency: sample.price === undefined ? undefined : "USD",
        direct: sample.services.length <= 1,
        stops: [],
        realtime: false,
        warning: includesBus
          ? "Official MBTA Trip Planner alternative. This journey includes a bus or walking transfer."
          : undefined,
      } satisfies TransitResult;
    });
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function queryTimeParts(time: string) {
  const hour24 = Number(time.slice(0, 2));
  return {
    hour: String(hour24 % 12 || 12),
    minute: time.slice(3, 5),
    meridiem: hour24 >= 12 ? "PM" : "AM",
    display: `${hour24 % 12 || 12}:${time.slice(3, 5)} ${hour24 >= 12 ? "pm" : "am"}`,
  };
}

function bostonDateAndMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOSTON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function nextSelectableMinute(value: number, minuteOptions: readonly number[]) {
  for (let candidate = Math.max(0, value); candidate < DAY_MINUTES; candidate += 1) {
    if (minuteOptions.includes(candidate % 60)) return candidate;
  }
  return null;
}

function earliestQueryMinute(date: string, minuteOptions: readonly number[]) {
  const boston = bostonDateAndMinutes();
  if (date < boston.date) {
    throw new Error(`MBTA Trip Planner cannot query the past service date ${date}.`);
  }
  return nextSelectableMinute(date === boston.date ? boston.minutes : 0, minuteOptions);
}

async function selectStation(page: Page, placeholder: string, hiddenPrefix: string, station: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(station);
  const option = page.locator("[role=option]").filter({ hasText: station }).first();
  await option.waitFor({ state: "visible", timeout: 15_000 });
  await option.click();

  const selected = new Function("arg", `
    const name = document.querySelector(arg.nameSelector)?.value || "";
    const stopId = document.querySelector(arg.idSelector)?.value || "";
    return name.trim().toLowerCase() === arg.expected && Boolean(stopId);
  `) as (arg: { nameSelector: string; idSelector: string; expected: string }) => boolean;
  await page.waitForFunction(selected, {
    nameSelector: `#trip-planner-input-form_${hiddenPrefix}_0_name`,
    idSelector: `#trip-planner-input-form_${hiddenPrefix}_0_stop_id`,
    expected: station.trim().toLowerCase(),
  }, { timeout: 15_000 });
}

async function configureTrip(page: Page, origin: string, destination: string, date: string) {
  await page.goto(MBTA_TRIP_PLANNER_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await selectStation(page, "Enter an origin location", "from", origin);
  await selectStation(page, "Enter a destination location", "to", destination);
  await page.locator("label[for=trip-planner-input-form_datetime_type_leave_at]").click({ force: true });
  await page.locator("#trip-planner-input-form_datetime").waitFor({ state: "attached", timeout: 15_000 });

  const dateInput = page.locator("#trip-planner-input-form input[type=text]");
  await dateInput.click();
  const targetDate = page.locator(`.flatpickr-day[aria-label="${dateLabel(date)}"]:not(.flatpickr-disabled)`).first();
  if (await targetDate.count() === 0) {
    const month = String(Number(date.slice(5, 7)) - 1);
    await page.locator(".flatpickr-monthDropdown-months").selectOption(month);
  }
  await page.locator(`.flatpickr-day[aria-label="${dateLabel(date)}"]:not(.flatpickr-disabled)`).first().click();
}

async function selectQueryTime(page: Page, time: string) {
  const parts = queryTimeParts(time);
  await page.selectOption("#timepicker_ampm", parts.meridiem);
  await page.selectOption("#timepicker_hour", parts.hour);
  await page.selectOption("#timepicker_minute", parts.minute);

  const resultsReady = new Function("expected", `
    const body = (document.body.innerText || "").replace(/\\s+/g, " ").toLowerCase();
    const results = document.querySelector("#trip-planner-results");
    return body.includes("leaving at " + expected)
      && ((Boolean(results) && !results.textContent.includes("Waiting for results"))
        || body.includes("no transit routes found within")
        || body.includes("no trips found")
        || body.includes("something went wrong"));
  `) as (expected: string) => boolean;
  try {
    await page.waitForFunction(resultsReady, parts.display, { timeout: 45_000 });
  } catch (error) {
    const state = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600);
    throw new Error(
      `MBTA Trip Planner did not settle for ${time} (${parts.display}). Page state: ${state}`,
      { cause: error },
    );
  }
}

async function readJourneySummaries(page: Page): Promise<MbtaBrowserJourneySummary[]> {
  const extract = new Function("elements", `
    const text = (element) => element?.textContent?.replace(/\\s+/g, " ").trim() || "";
    const unique = (values) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
    return elements.map((element) => {
      const timeRange = text(element.querySelector('[data-test="itinerary_summary:time_range"]'));
      const durationText = text(element.querySelector('[data-test="itinerary_summary:time_range"]')?.parentElement?.children?.[1]);
      const hours = Number(durationText.match(/(\\d+)\\s*hrs?/)?.[1] || 0);
      const minutes = Number(durationText.match(/(\\d+)\\s*min/)?.[1] || 0);
      const routeNodes = [...element.querySelectorAll('.mbta-system-route-icon, .mbta-icon-stacked')]
        .filter((node) => !node.parentElement?.closest('.mbta-icon-stacked'));
      const services = [];
      const modes = [];
      for (const node of routeNodes) {
        const classes = [...node.classList];
        const label = node.getAttribute('aria-label') || text(node);
        if (!label) continue;
        if (classes.includes('mbta-route-bus') || classes.includes('mbta-route-silver-line')) {
          services.push(/^bus\\s/i.test(label) ? label : 'Bus ' + label);
          modes.push('bus');
        } else if (/commuter rail/i.test(label) || classes.some((name) => name.includes('commuter'))) {
          services.push(label);
          modes.push('commuter-rail');
        } else {
          services.push(label);
          modes.push('subway');
        }
      }
      const fare = Number(text(element).match(/\\$([0-9]+(?:\\.[0-9]{2})?)/)?.[1]);
      const similar = [...element.querySelectorAll('*')]
        .find((candidate) => /similar trips depart at/i.test(text(candidate))
          && ![...candidate.children].some((child) => /similar trips depart at/i.test(text(child))));
      const suggestedTimes = similar
        ? [...text(similar).matchAll(/(\\d{1,2}:[0-5]\\d)\\s*(am|pm)/gi)]
          .map((match) => match[1] + ' ' + match[2])
        : [];
      return {
        timeRange,
        durationMinutes: hours * 60 + minutes || undefined,
        services: unique(services),
        modes: unique(modes),
        price: Number.isFinite(fare) && fare > 0 ? fare : undefined,
        unavailable: /temporarily unavailable/i.test(text(element)),
        suggestedTimes,
      };
    });
  `) as (elements: Element[]) => RawMbtaJourneySummary[];

  const raw = await page.locator('[data-test^="results:itinerary_group:"]').evaluateAll(extract);
  return raw.flatMap((summary) => {
    const parsed = parseMbtaTimeRange(summary.timeRange);
    return parsed ? [{
      ...summary,
      ...parsed,
      suggestedTimes: summary.suggestedTimes
        .map(parseMbtaClock)
        .filter((value): value is string => Boolean(value)),
    }] : [];
  });
}

async function minuteOptions(page: Page) {
  const readOptions = new Function("elements", `
    return elements
      .map((element) => Number(element.value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value < 60);
  `) as (elements: Element[]) => number[];
  const options = await page.locator("#timepicker_minute option").evaluateAll(readOptions);
  const unique = Array.from(new Set(options)).sort((left, right) => left - right);
  if (unique.length === 0) throw new Error("MBTA Trip Planner exposed no selectable minute values.");
  return unique;
}

export function mbtaNoRouteHorizon(text: string) {
  const hours = Number(text.match(/No transit routes found within (\d+) hours?/i)?.[1]);
  if (Number.isFinite(hours) && hours > 0) return hours * 60;
  const minutes = Number(text.match(/No transit routes found within (\d+) minutes?/i)?.[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

async function noRouteSearchHorizon(page: Page) {
  return mbtaNoRouteHorizon((await page.locator("main").innerText()).replace(/\s+/g, " "));
}

async function hasGenericNoTrips(page: Page) {
  return /\bNo trips found\b/i.test(await page.locator("main").innerText());
}

async function hasTransientPlannerError(page: Page) {
  return /\bSomething went wrong\b/i.test(await page.locator("main").innerText());
}

async function queryJourneysAt(
  page: Page,
  origin: string,
  destination: string,
  date: string,
  time: string,
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await selectQueryTime(page, time);
    if (!await hasTransientPlannerError(page)) return readJourneySummaries(page);
    if (attempt < 2) {
      console.warn(`  MBTA browser query retry ${date} at ${time}`);
      await configureTrip(page, origin, destination, date);
    }
  }
  throw new Error(`MBTA Trip Planner failed twice for ${origin} → ${destination} on ${date} at ${time}.`);
}

/**
 * Crawl one service day without assuming when trains run. Every next query is
 * derived from a journey or a similar-departure time actually rendered by the
 * official page. The selectable minute values also come from the page itself.
 */
async function crawlServiceDay(page: Page, origin: string, destination: string, date: string) {
  const selectableMinutes = await minuteOptions(page);
  const firstMinute = earliestQueryMinute(date, selectableMinutes);
  if (firstMinute === null) return [];

  const pending = new Set<number>([firstMinute]);
  const visited = new Set<number>();
  const journeys: MbtaBrowserJourneySummary[] = [];

  while (pending.size > 0 && visited.size < DAY_MINUTES) {
    const cursor = Math.min(...pending);
    pending.delete(cursor);
    if (visited.has(cursor)) continue;
    visited.add(cursor);

    const queryTime = formatClock(cursor);
    console.log(`  MBTA browser query ${date} at ${queryTime}`);
    const rendered = sameMbtaServiceDate(
      queryTime,
      await queryJourneysAt(page, origin, destination, date, queryTime),
    );
    journeys.push(...rendered);

    const publishedMinutes = rendered.flatMap((journey) => [
      hhmmMinutes(journey.departureTime),
      ...(journey.suggestedTimes || []).map(hhmmMinutes),
    ]).filter((value) => value >= cursor && value < DAY_MINUTES);
    if (publishedMinutes.length === 0) {
      const horizon = await noRouteSearchHorizon(page);
      const frontier = horizon !== null
        ? nextSelectableMinute(cursor + horizon, selectableMinutes)
        : await hasGenericNoTrips(page)
          ? nextSelectableMinute((Math.floor(cursor / 60) + 1) * 60, selectableMinutes)
          : null;
      if (frontier !== null && !visited.has(frontier)) pending.add(frontier);
      continue;
    }

    // Similar-departure labels define how far this result page already covers,
    // but are not themselves saved because they omit arrival times and modes.
    // Continue just beyond the page's latest published clock and let the next
    // official result page provide the next complete itinerary group.
    const frontier = nextSelectableMinute(Math.max(...publishedMinutes) + 1, selectableMinutes);
    if (frontier !== null && !visited.has(frontier)) pending.add(frontier);
  }

  return journeys;
}

/**
 * Query the official passenger planner across the operating day. Itinerary
 * groups marked unavailable are discarded, and similar-departure labels are
 * not expanded because the page does not publish their arrival times.
 */
export async function scrapeMbtaBrowserServiceDay(
  page: Page,
  origin: string,
  destination: string,
  date: string,
): Promise<ScrapedRouteData> {
  await configureTrip(page, origin, destination, date);
  const results = buildMbtaBrowserResults(
    origin,
    destination,
    date,
    await crawlServiceDay(page, origin, destination, date),
  );
  if (results.length === 0) {
    throw new Error(`MBTA Trip Planner returned no available rail journeys for ${origin} → ${destination} on ${date}.`);
  }
  return {
    origin,
    destination,
    date,
    scrapedAt: new Date().toISOString(),
    source: MBTA_TRIP_PLANNER_SOURCE,
    results,
  };
}
