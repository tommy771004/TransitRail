import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { TransitResult } from "../types";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Map } from "lucide-react";

interface TripDetailsProps {
  trip: TransitResult;
}

export function TripDetails({ trip }: TripDetailsProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || !mapRef.current) return;

    const hasCoords = trip.originLat != null && trip.originLng != null && trip.destLat != null && trip.destLng != null;

    const container = d3.select(mapRef.current);
    container.selectAll("*").remove();

    const width = mapRef.current.clientWidth;
    const height = 200;

    const svg = container
      .append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    if (!hasCoords) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("class", "text-sm fill-slate-400 font-medium")
        .text(t("result.map_unavailable", { defaultValue: "Map data unavailable" }));
      return;
    }

    let points: { lat: number; lng: number; name: string }[] = [];

    if (trip.legs && trip.legs.length > 0) {
      trip.legs.forEach(leg => {
        if (leg.originLat && leg.originLng) {
          points.push({ lat: leg.originLat, lng: leg.originLng, name: leg.origin });
        }
        if (leg.destLat && leg.destLng) {
          points.push({ lat: leg.destLat, lng: leg.destLng, name: leg.destination });
        }
      });
    } else {
      points = [
        { lat: trip.originLat!, lng: trip.originLng!, name: trip.origin },
        { lat: trip.destLat!, lng: trip.destLng!, name: trip.destination }
      ];
    }

    points = points.filter((p, index, self) =>
      index === self.findIndex((t) => t.lat === p.lat && t.lng === p.lng)
    );

    if (points.length < 2) return;

    const projection = d3.geoMercator()
      .fitSize([width - 60, height - 60], {
        type: "FeatureCollection",
        features: points.map(p => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: {}
        }))
      })
      .center(
        points.length === 2 ?
        [(points[0].lng + points[1].lng) / 2, (points[0].lat + points[1].lat) / 2] :
        [d3.mean(points, d => d.lng) || 0, d3.mean(points, d => d.lat) || 0]
      );

    const path = d3.geoPath().projection(projection);

    const g = svg.append("g").attr("transform", `translate(30, 30)`);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = projection([points[i].lng, points[i].lat]);
      const p2 = projection([points[i + 1].lng, points[i + 1].lat]);
      if (!p1 || !p2) continue;

      const lineColor = trip.lineColor || "#10b981";

      g.append("line")
        .attr("x1", p1[0])
        .attr("y1", p1[1])
        .attr("x2", p2[0])
        .attr("y2", p2[1])
        .attr("stroke", lineColor)
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.7);
    }

    points.forEach((p, i) => {
      const coords = projection([p.lng, p.lat]);
      if (!coords) return;

      const isEndpoint = i === 0 || i === points.length - 1;

      g.append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", isEndpoint ? 6 : 4)
        .attr("fill", "white")
        .attr("stroke", isEndpoint ? "#0f172a" : "#64748b")
        .attr("stroke-width", 2);

      g.append("text")
        .attr("x", coords[0])
        .attr("y", coords[1] - 12)
        .attr("text-anchor", "middle")
        .attr("class", "text-[10px] font-bold fill-slate-700 select-none")
        .text(p.name);
    });

  }, [expanded, trip]);

  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            {t("result.hide_details", { defaultValue: "Hide details" })}
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            {t("result.show_details", { defaultValue: "Trip details & map" })}
          </>
        )}
      </button>

      {expanded && (
        <div className="bg-slate-50 px-4 sm:px-5 py-4 rounded-b-2xl border-t border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 flex items-center gap-1.5 dark:border-slate-800 dark:bg-slate-900">
              <Map className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Route Map</span>
            </div>
            <div ref={mapRef} className="w-full h-[200px] flex items-center justify-center bg-slate-50 dark:bg-slate-900" />
          </div>

          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-300 dark:bg-slate-600" />

            <ul className="space-y-4">
              {trip.legs ? trip.legs.map((leg, idx) => (
                <li key={idx} className="relative pl-6">
                  <div
                    className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm dark:border-slate-900"
                    style={{ backgroundColor: leg.color || trip.lineColor || "#94a3b8" }}
                  />
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{leg.origin}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: leg.color || trip.lineColor || "#94a3b8" }}
                        />
                        {leg.lineName}
                        {leg.headsign && <span className="text-slate-400">toward {leg.headsign}</span>}
                      </div>
                      {leg.stopCount != null && (
                        <p className="mt-1 font-mono text-[11px] text-slate-400">
                          {leg.stopCount} stops
                        </p>
                      )}
                      {leg.durationMinutes != null && (
                        <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {leg.durationMinutes} min
                        </p>
                      )}
                      {leg.upcomingDepartures && leg.upcomingDepartures.length > 0 && (
                        <p className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                          Next: {leg.upcomingDepartures.join(" / ")}
                        </p>
                      )}
                    </div>
                    {leg.departureTime && (
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{leg.departureTime}</span>
                    )}
                  </div>

                  {idx === trip.legs!.length - 1 && (
                    <div className="relative pl-6 mt-4 -ml-6">
                      <div className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-white shadow-sm dark:border-slate-100 dark:bg-slate-900" />
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{leg.destination}</p>
                        {trip.arrivalTime && (
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{trip.arrivalTime}</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )) : (
                <>
                  <li className="relative pl-6">
                    <div
                      className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm dark:border-slate-900"
                      style={{ backgroundColor: trip.lineColor || "#94a3b8" }}
                    />
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{trip.origin}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: trip.lineColor || "#94a3b8" }}
                          />
                          {trip.service}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{trip.departureTime}</span>
                    </div>
                  </li>
                  <li className="relative pl-6">
                    <div className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-white shadow-sm dark:border-slate-100 dark:bg-slate-900" />
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{trip.destination}</p>
                      {trip.arrivalTime && (
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{trip.arrivalTime}</span>
                      )}
                    </div>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
