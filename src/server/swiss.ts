import { XMLParser } from "fast-xml-parser";
import type { JourneyLeg, SearchResponse, TransitResult } from "../types";
import { getSwissRouteWarning } from "./swissSituations";

const SWISS_OJP_URL = process.env.SWISS_OJP_URL || "https://api.opentransportdata.swiss/ojp20";
const SWISS_TIME_ZONE = "Europe/Zurich";
const DEFAULT_DEPARTURE_TIME = "08:00";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

interface SwissLocation {
  ref: string;
  name: string;
  longitude?: number;
  latitude?: number;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return (
    textValue(record.Text) ||
    textValue(record.Name) ||
    textValue(record["#text"]) ||
    textValue(record.value)
  );
}

function numberValue(value: unknown): number | undefined {
  const text = textValue(value);
  if (!text) return undefined;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findNodes(root: unknown, key: string): unknown[] {
  const matches: unknown[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as Record<string, unknown>;
    for (const [entryKey, entryValue] of Object.entries(record)) {
      if (entryKey === key) {
        matches.push(entryValue);
      }
      visit(entryValue);
    }
  };

  visit(root);
  return matches;
}

function firstText(root: unknown, ...keys: string[]) {
  for (const key of keys) {
    const [first] = findNodes(root, key);
    const value = textValue(first);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function zurichDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SWISS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function combineSwissDateTime(date: string, time?: string) {
  const effectiveTime = time && /^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_DEPARTURE_TIME;
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const [hour, minute] = effectiveTime.split(":").map((part) => Number.parseInt(part, 10));
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour - 1, minute, 0));
  return utcGuess.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function bearerHeaders(token: string) {
  return {
    Accept: "application/xml",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/xml",
    "User-Agent": "TransitRail/1.0",
  };
}

async function postSwissXml(url: string, xml: string, token: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: bearerHeaders(token),
      body: xml,
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Swiss OJP returned HTTP ${response.status}. ${body.slice(0, 200)}`.trim());
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function buildLocationRequest(query: string, requestorRef: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>${nowIso()}</siri:RequestTimestamp>
      <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
      <OJPLocationInformationRequest>
        <siri:RequestTimestamp>${nowIso()}</siri:RequestTimestamp>
        <siri:MessageIdentifier>TransitRail-LIR-${Date.now()}</siri:MessageIdentifier>
        <InitialInput>
          <Name>${query}</Name>
        </InitialInput>
        <Restrictions>
          <Type>stop</Type>
          <NumberOfResults>5</NumberOfResults>
          <IncludePtModes>true</IncludePtModes>
        </Restrictions>
      </OJPLocationInformationRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>`;
}

function buildTripRequest(origin: SwissLocation, destination: SwissLocation, date: string, time: string | undefined, requestorRef: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>${nowIso()}</siri:RequestTimestamp>
      <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
      <OJPTripRequest>
        <siri:RequestTimestamp>${nowIso()}</siri:RequestTimestamp>
        <siri:MessageIdentifier>TransitRail-TR-${Date.now()}</siri:MessageIdentifier>
        <Origin>
          <PlaceRef>
            <StopPlaceRef>${origin.ref}</StopPlaceRef>
            <Name>
              <Text>${origin.name}</Text>
            </Name>
          </PlaceRef>
          <DepArrTime>${combineSwissDateTime(date, time)}</DepArrTime>
        </Origin>
        <Destination>
          <PlaceRef>
            <StopPlaceRef>${destination.ref}</StopPlaceRef>
            <Name>
              <Text>${destination.name}</Text>
            </Name>
          </PlaceRef>
        </Destination>
        <Params>
          <NumberOfResults>6</NumberOfResults>
          <IncludeIntermediateStops>false</IncludeIntermediateStops>
        </Params>
      </OJPTripRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>`;
}

function chooseLocationCandidate(query: string, locations: SwissLocation[]) {
  const normalizedQuery = normalizeStationName(query);
  return (
    locations.find((candidate) => normalizeStationName(candidate.name) === normalizedQuery) ||
    locations.find((candidate) => normalizeStationName(candidate.name).includes(normalizedQuery)) ||
    locations[0]
  );
}

function parseLocationResponse(xml: string, query: string) {
  const parsed = xmlParser.parse(xml);
  const candidates = findNodes(parsed, "PlaceResult").flatMap((entry) => asArray(entry)).map((result) => {
    const record = result as Record<string, unknown>;
    const place = record.Place as Record<string, unknown> | undefined;
    const stopPlace = place?.StopPlace as Record<string, unknown> | undefined;
    const name = textValue(stopPlace?.StopPlaceName) || textValue(place?.Name) || textValue(record.Name);
    const ref = textValue(stopPlace?.StopPlaceRef) || textValue(place?.StopPlaceRef) || textValue(place?.StopPointRef);

    if (!name || !ref) {
      return undefined;
    }

    return {
      ref,
      name,
      longitude: numberValue(place?.GeoPosition && (place.GeoPosition as Record<string, unknown>).Longitude),
      latitude: numberValue(place?.GeoPosition && (place.GeoPosition as Record<string, unknown>).Latitude),
    } satisfies SwissLocation;
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return chooseLocationCandidate(query, candidates);
}

function parseLegStop(node: unknown) {
  return {
    stopRef: firstText(node, "StopPointRef", "StopPlaceRef"),
    name: firstText(node, "StopPointName", "StopPlaceName", "Name"),
    timetabledTime: firstText(node, "TimetabledTime", "Time", "DateTime"),
    estimatedTime: firstText(node, "EstimatedTime"),
    // OJP 2.0 exposes the platform as <PlannedQuay>/<EstimatedQuay>.
    platform: firstText(node, "EstimatedQuay", "PlannedQuay", "EstimatedPlatform", "PlannedPlatform", "Platform"),
  };
}

function delayInMinutes(timetabled?: string, estimated?: string): number | undefined {
  if (!timetabled || !estimated) return undefined;
  // Compare whole minutes so a sub-minute estimate (e.g. +30s) reads as on-time,
  // matching what a departure board actually shows.
  const tt = Math.floor(new Date(timetabled).getTime() / 60_000);
  const est = Math.floor(new Date(estimated).getTime() / 60_000);
  if (!Number.isFinite(tt) || !Number.isFinite(est)) return undefined;
  return est - tt;
}

function parseTimedLeg(node: unknown): JourneyLeg | undefined {
  const boardNode = findNodes(node, "LegBoard")[0];
  const alightNode = findNodes(node, "LegAlight")[0];
  const board = parseLegStop(boardNode);
  const alight = parseLegStop(alightNode);
  // Prefer the estimated (realtime) time; fall back to the timetabled time.
  const departureIso = board.estimatedTime || board.timetabledTime;
  const arrivalIso = alight.estimatedTime || alight.timetabledTime;
  if (!board.name || !alight.name || !departureIso || !arrivalIso) {
    return undefined;
  }

  const durationMinutes = Math.max(0, Math.round((new Date(arrivalIso).getTime() - new Date(departureIso).getTime()) / 60_000));
  const ptMode = firstText(node, "PtMode");
  const railSubmode = firstText(node, "RailSubmode");
  const trainNumber = firstText(node, "TrainNumber");
  // OJP 2.0 carries the public label in <PublishedServiceName>/<PublicCode>
  // (e.g. "IR35"); <PublishedLineName>/<JourneyRef> are internal identifiers.
  const publishedLineName = firstText(node, "PublishedServiceName", "PublicCode", "PublishedLineName", "LineName");
  const destinationText = firstText(node, "DestinationText", "DestinationStopPointName");

  return {
    lineName: publishedLineName || [ptMode, trainNumber].filter(Boolean).join(" ") || "Swiss Rail",
    lineCode: trainNumber || firstText(node, "JourneyRef"),
    mode: [ptMode, railSubmode].filter(Boolean).join("/") || ptMode,
    origin: board.name,
    destination: alight.name,
    departureTime: zurichDateTime(departureIso),
    arrivalTime: zurichDateTime(arrivalIso),
    durationMinutes,
    platform: board.platform || alight.platform,
    delayMinutes: delayInMinutes(board.timetabledTime, board.estimatedTime),
    headsign: destinationText,
  };
}

function parseTripResults(xml: string, origin: SwissLocation, destination: SwissLocation, date: string): TransitResult[] {
  const parsed = xmlParser.parse(xml);
  const tripResults = findNodes(parsed, "TripResult").flatMap((entry) => asArray(entry));

  return tripResults.slice(0, 6).map((tripResult, index): TransitResult | undefined => {
    const timedLegs = findNodes(tripResult, "TimedLeg")
      .flatMap((entry) => asArray(entry))
      .map(parseTimedLeg)
      .filter((entry): entry is JourneyLeg => Boolean(entry));

    if (timedLegs.length === 0) {
      return undefined;
    }

    const firstLeg = timedLegs[0];
    const lastLeg = timedLegs[timedLegs.length - 1];
    const transferStations = timedLegs.slice(0, -1).map((leg) => leg.destination).filter(Boolean);
    const durationMinutes = timedLegs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);
    const trainNumber = firstText(tripResult, "TrainNumber");
    const service = firstLeg.lineName || trainNumber || "Swiss Rail";
    const amenities = Array.from(new Set(
      findNodes(tripResult, "Attribute")
        .flatMap((attr) => asArray(attr))
        .map((attr) => textValue((attr as Record<string, unknown>).UserText))
        .filter((text): text is string => Boolean(text)),
    )).slice(0, 6);

    return {
      id: `ch-ojp-${date}-${trainNumber || index}-${firstLeg.departureTime}`,
      country: "switzerland",
      date,
      operator: "OpenTransportData Swiss",
      service,
      trainType: firstLeg.mode || "rail",
      durationMinutes: durationMinutes || undefined,
      departureTime: firstLeg.departureTime || "--:--",
      arrivalTime: lastLeg.arrivalTime || "--:--",
      origin: origin.name,
      originLat: origin.latitude,
      originLng: origin.longitude,
      destination: destination.name,
      destLat: destination.latitude,
      destLng: destination.longitude,
      direct: timedLegs.length <= 1,
      stops: [],
      platform: firstLeg.platform,
      delayMinutes: firstLeg.delayMinutes,
      headsign: firstLeg.headsign,
      realtime: true,
      amenities: amenities.length > 0 ? amenities : undefined,
      tags: ["swiss", "ojp2"],
      warning: undefined,
      currency: undefined,
      legs: timedLegs.length > 1 ? timedLegs : undefined,
      transferStations: transferStations.length > 0 ? transferStations : undefined,
    } satisfies TransitResult;
  }).filter((entry): entry is TransitResult => Boolean(entry));
}

export async function searchSwissJourney(
  origin: string,
  destination: string,
  date: string,
  time?: string,
): Promise<{ status: number; body: SearchResponse & { error?: string } }> {
  const token = process.env.SWISS_OJP_TOKEN;
  const requestorRef = process.env.SWISS_OJP_REQUESTOR_REF || "TransitRail_prod";

  if (!token) {
    return {
      status: 501,
      body: {
        error: "Swiss OJP token not configured",
        message: "Set SWISS_OJP_TOKEN to enable Switzerland timetable search.",
        results: [],
        source: SWISS_OJP_URL,
      },
    };
  }

  try {
    const [originXml, destinationXml] = await Promise.all([
      postSwissXml(SWISS_OJP_URL, buildLocationRequest(origin, requestorRef), token),
      postSwissXml(SWISS_OJP_URL, buildLocationRequest(destination, requestorRef), token),
    ]);

    const resolvedOrigin = parseLocationResponse(originXml, origin);
    const resolvedDestination = parseLocationResponse(destinationXml, destination);

    if (!resolvedOrigin || !resolvedDestination) {
      return {
        status: 400,
        body: {
          error: "Station not found",
          message: "Swiss OJP could not resolve one or both station names.",
          results: [],
          source: SWISS_OJP_URL,
        },
      };
    }

    const tripXml = await postSwissXml(
      SWISS_OJP_URL,
      buildTripRequest(resolvedOrigin, resolvedDestination, date, time, requestorRef),
      token,
    );
    const results = parseTripResults(tripXml, resolvedOrigin, resolvedDestination, date);

    // Overlay any currently-valid unplanned disruption (SIRI-SX) that affects a
    // station on the route. Best-effort: a feed failure leaves results untouched.
    if (results.length > 0) {
      const routeStations = new Set<string>([resolvedOrigin.name, resolvedDestination.name]);
      for (const result of results) {
        for (const station of result.transferStations || []) routeStations.add(station);
      }
      const warning = await getSwissRouteWarning([...routeStations]);
      if (warning) {
        for (const result of results) {
          if (!result.warning) result.warning = warning;
        }
      }
    }

    return {
      status: 200,
      body: {
        results,
        message: results.length === 0 ? "Swiss OJP returned no journeys for this route." : undefined,
        source: SWISS_OJP_URL,
      },
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "Provider request failed",
        message: error instanceof Error ? error.message : "Could not reach Swiss OJP.",
        results: [],
        source: SWISS_OJP_URL,
      },
    };
  }
}