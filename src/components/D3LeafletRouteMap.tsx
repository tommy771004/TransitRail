import { useEffect, useRef } from "react";
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
  united_states: "https://new.mta.info/maps",
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
  const { t } = useTranslation();

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const points: any[] = [];

    if (trip.legs && trip.legs.length > 0) {
      trip.legs.forEach((leg, legIdx) => {
        let legStops = leg.stops;
        if (!legStops || legStops.length < 2) {
          const pathData = extractPathBetweenStations(
            leg.lineCode || leg.lineName || trip.service,
            leg.origin,
            leg.destination
          );
          if (pathData && pathData.stations.length >= 2) {
            legStops = pathData.stations.map((s) => s.name);
          } else {
            legStops = [leg.origin, leg.destination];
          }
        }

        legStops.forEach((stopName, stopIdx) => {
          const isFirstLeg = legIdx === 0;
          const isLastLeg = legIdx === trip.legs.length - 1;
          const isFirstStop = stopIdx === 0;
          const isLastStop = stopIdx === legStops.length - 1;

          if (!isFirstLeg && isFirstStop) {
            if (points.length > 0) {
              points[points.length - 1].type = "transfer";
            }
            return;
          }

          let pointType: "start" | "end" | "transfer" | "stop" = "stop";
          if (isFirstLeg && isFirstStop) {
            pointType = "start";
          } else if (isLastLeg && isLastStop) {
            pointType = "end";
          }

          const coord = getStationCoordinates(stopName, trip.country);

          points.push({
            name: stopName,
            lat: coord.lat,
            lng: coord.lng,
            type: pointType,
          });
        });
      });
    } else {
      const originCoord = trip.originLat && trip.originLng
        ? { lat: trip.originLat, lng: trip.originLng }
        : getStationCoordinates(trip.origin, trip.country);

      points.push({
        name: trip.origin,
        lat: originCoord.lat,
        lng: originCoord.lng,
        type: "start"
      });

      if (trip.stops && trip.stops.length > 0) {
        trip.stops.forEach((stopName) => {
          if (stopName.toLowerCase().trim() === trip.origin.toLowerCase().trim()) return;
          if (stopName.toLowerCase().trim() === trip.destination.toLowerCase().trim()) return;
          const coord = getStationCoordinates(stopName, trip.country);
          points.push({
            name: stopName,
            lat: coord.lat,
            lng: coord.lng,
            type: "stop"
          });
        });
      }

      const destCoord = trip.destLat && trip.destLng
        ? { lat: trip.destLat, lng: trip.destLng }
        : getStationCoordinates(trip.destination, trip.country);

      points.push({
        name: trip.destination,
        lat: destCoord.lat,
        lng: destCoord.lng,
        type: "end"
      });
    }

    if (points.length === 0) return;

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
    <div className="relative w-full h-80 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner my-4 group">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {officialMapUrl && (
        <a 
          href={officialMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 right-4 z-[400] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-800 dark:text-slate-100 font-semibold text-xs px-4 py-2 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          {t("map.officialRouteMap", "Official Route Map")}
        </a>
      )}
    </div>
  );
}
