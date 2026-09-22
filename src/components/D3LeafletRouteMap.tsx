import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TransitResult } from "../types";
import { getStationCoordinates } from "../utils/geoCoordinates";
import { stationLabel } from "../utils/stationLabel";
import { useTranslation } from "react-i18next";
import { extractPathBetweenStations } from "../utils/pathExtractor";

const OFFICIAL_MAPS: Record<string, string> = {
  singapore: "https://www.lta.gov.sg/content/dam/ltagov/getting_around/public_transport/rail_network/pdf/mrt_system_map.pdf",
  japan: "https://www.tokyometro.jp/en/subwaymap/pdf/routemap_en.pdf",
  korea: "http://www.seoulmetro.co.kr/en/cyberStation.do",
  taiwan: "https://english.metro.taipei/cp.aspx?n=1BE0AF76CB7979DF",
  hong_kong: "https://www.mtr.com.hk/en/customer/services/system_map.html",
  thailand: "https://www.bts.co.th/eng/library/system-map.html",
  united_kingdom: "https://tfl.gov.uk/maps/track/tube",
  united_states: "https://www.mbta.com/maps",
  germany: "https://www.bvg.de/en/connections/network-maps-and-routes",
  france: "https://www.ratp.fr/en/plans",
  switzerland: "https://www.sbb.ch/en/station-services/at-the-station/railway-stations.html",
  china: "https://en.wikipedia.org/wiki/Urban_rail_transit_in_China",
};

interface D3LeafletRouteMapProps {
  trip: TransitResult;
}

export function D3LeafletRouteMap({ trip }: D3LeafletRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // `missing` counts stations that had no verified position and were left off
  // the map; the map itself needs only a placeable origin and destination.
  const [mapState, setMapState] = useState<{ available: boolean; missing: number }>({ available: true, missing: 0 });
  const { t } = useTranslation();

  useEffect(() => {
    if (!mapContainerRef.current) return;

    type Point = { name: string; lat: number; lng: number; type: "start" | "end" | "transfer" | "stop" };
    const points: Point[] = [];
    let missing = 0;
    let endpointMissing = false;

    // A provider coordinate on the trip or the leg counts as verified; the
    // hand-kept table is the fallback. Nothing is ever estimated.
    const provided = (lat?: number, lng?: number) =>
      typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
    const place = (name: string, type: Point["type"], coord: { lat: number; lng: number } | undefined, endpoint = false) => {
      if (!coord) {
        missing += 1;
        if (endpoint) endpointMissing = true;
        return;
      }
      points.push({ name, lat: coord.lat, lng: coord.lng, type });
    };

    if (trip.legs && trip.legs.length > 0) {
      const legs = trip.legs;
      legs.forEach((leg, legIdx) => {
        let legStops = leg.stops;
        if (!legStops || legStops.length < 2) {
          const pathData = extractPathBetweenStations(
            leg.lineCode || leg.lineName || trip.service,
            leg.origin,
            leg.destination
          );
          legStops = pathData && pathData.stations.length >= 2
            ? pathData.stations.map((s) => s.name)
            : [leg.origin, leg.destination];
        }

        legStops.forEach((stopName, stopIdx) => {
          const isFirstLeg = legIdx === 0;
          const isLastLeg = legIdx === legs.length - 1;
          const isFirstStop = stopIdx === 0;
          const isLastStop = stopIdx === legStops.length - 1;

          if (!isFirstLeg && isFirstStop) {
            // The previous leg's last stop is this change station; mark it
            // only if it was actually placed, never whichever stop came last.
            const last = points[points.length - 1];
            if (last && last.name === legs[legIdx - 1].destination) last.type = "transfer";
            return;
          }

          const pointType: Point["type"] = isFirstLeg && isFirstStop ? "start" : isLastLeg && isLastStop ? "end" : "stop";
          const coord = isFirstStop
            ? provided(leg.originLat, leg.originLng) || getStationCoordinates(stopName)
            : isLastStop
              ? provided(leg.destLat, leg.destLng) || getStationCoordinates(stopName)
              : getStationCoordinates(stopName);
          place(stopName, pointType, coord, pointType !== "stop");
        });
      });
    } else {
      place(trip.origin, "start", provided(trip.originLat, trip.originLng) || getStationCoordinates(trip.origin), true);

      const same = (a: string, b: string) => a.toLowerCase().trim() === b.toLowerCase().trim();
      (trip.stops || []).forEach((stopName) => {
        if (same(stopName, trip.origin) || same(stopName, trip.destination)) return;
        place(stopName, "stop", getStationCoordinates(stopName));
      });

      place(trip.destination, "end", provided(trip.destLat, trip.destLng) || getStationCoordinates(trip.destination), true);
    }

    if (endpointMissing || points.length < 2) {
      setMapState({ available: false, missing });
      return;
    }
    setMapState({ available: true, missing });

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      opacity: 0.7
    }).addTo(map);

    L.tileLayer("https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenRailwayMap',
      opacity: 0.8
    }).addTo(map);

    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });

    // Background glowing line
    L.polyline(points.map(p => [p.lat, p.lng]), {
      color: trip.lineColor || "#10b981",
      weight: 12, // Starting thickness, will be overridden by CSS
      opacity: 0.4, // Starting opacity, overridden by CSS
      lineCap: 'round',
      lineJoin: 'round',
      className: 'route-path-glow'
    }).addTo(map);

    // Core active line
    const polyline = L.polyline(points.map(p => [p.lat, p.lng]), {
      color: trip.lineColor || "#10b981",
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    points.forEach(p => {
      let fillColor = "#94a3b8";
      if (p.type === "start") fillColor = "#3b82f6";
      else if (p.type === "end") fillColor = "#10b981";
      else if (p.type === "transfer") fillColor = "#f59e0b";

      const isEndpoint = p.type === "start" || p.type === "end";

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isEndpoint ? 7 : 4,
        fillColor: fillColor,
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1
      }).addTo(map);

      marker.bindTooltip(stationLabel(t, p.name, trip.country), {
        permanent: true,
        direction: 'top',
        className: 'bg-transparent border-0 shadow-none text-slate-800 dark:text-slate-200 font-bold text-xs drop-shadow-md',
        offset: [0, -10]
      });
    });

    return () => {
      map.remove();
    };
  }, [trip, t]);

  const officialMapUrl = OFFICIAL_MAPS[trip.country];

  return (
    <div className="m3-card m3-card-large group relative my-4 h-80 w-full overflow-hidden border border-slate-200 dark:border-slate-800">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {!mapState.available ? (
        <p className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/95 px-6 text-center text-xs font-medium text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
          {t("map.coordinates_unavailable", { defaultValue: "A verified map position is not available for every station on this journey." })}
        </p>
      ) : mapState.missing > 0 ? (
        <p className="m3-label-small absolute inset-x-0 top-0 z-[400] truncate bg-white/90 px-3 py-1.5 text-slate-600 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-300">
          {t("map.positions_missing", { count: mapState.missing })}
        </p>
      ) : null}
      {officialMapUrl && (
        <a 
          href={officialMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="m3-button m3-button-icon-leading m3-state m3-elevation-3 absolute bottom-4 right-4 z-[400] border border-slate-200/50 bg-white/90 text-slate-800 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/90 dark:text-slate-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          {t("map.officialRouteMap", "Official Route Map")}
        </a>
      )}
    </div>
  );
}
