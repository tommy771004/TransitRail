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
    
    // Check if we have coordinates
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
        .attr("class", "text-sm fill-stone-400 font-medium")
        .text(t("result.map_unavailable", { defaultValue: "Map data unavailable" }));
      return;
    }

    // Extract all points
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
    
    // Remove duplicates
    points = points.filter((p, index, self) => 
      index === self.findIndex((t) => t.lat === p.lat && t.lng === p.lng)
    );

    if (points.length < 2) return;

    // Geographic projection
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
      )

    // Translate to center of svg padding
    const path = d3.geoPath().projection(projection);

    const g = svg.append("g").attr("transform", `translate(30, 30)`);

    // Draw route lines
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = projection([points[i].lng, points[i].lat]);
      const p2 = projection([points[i + 1].lng, points[i + 1].lat]);
      if (!p1 || !p2) continue;
      
      const lineColor = trip.lineColor || "#10b981"; // Emerald-500
      
      g.append("line")
        .attr("x1", p1[0])
        .attr("y1", p1[1])
        .attr("x2", p2[0])
        .attr("y2", p2[1])
        .attr("stroke", lineColor)
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", "4,4") // Make it dashed to look like transit
        .attr("opacity", 0.7);
    }

    // Draw stations
    points.forEach((p, i) => {
      const coords = projection([p.lng, p.lat]);
      if (!coords) return;
      
      const isEndpoint = i === 0 || i === points.length - 1;

      g.append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", isEndpoint ? 6 : 4)
        .attr("fill", "white")
        .attr("stroke", isEndpoint ? "#171717" : "#57534e") // stone-900 / stone-600
        .attr("stroke-width", 2);

      g.append("text")
        .attr("x", coords[0])
        .attr("y", coords[1] - 12)
        .attr("text-anchor", "middle")
        .attr("class", "text-[10px] font-medium fill-stone-700 select-none")
        .text(p.name);
    });

  }, [expanded, trip]);

  return (
    <div className="mt-2 border-t border-stone-100">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
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
        <div className="bg-stone-50 px-4 py-4 rounded-b-xl border-t border-stone-100">
          {/* Map View */}
          <div className="mb-4 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 bg-stone-50 px-3 py-2 flex items-center gap-1.5">
              <Map className="h-3.5 w-3.5 text-stone-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">Route Map</span>
            </div>
            <div ref={mapRef} className="w-full h-[200px] flex items-center justify-center bg-[#f8fafc]" />
          </div>

          {/* Step-by-step Timeline */}
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-stone-300" />
            
            <ul className="space-y-4">
              {trip.legs ? trip.legs.map((leg, idx) => (
                <li key={idx} className="relative pl-6">
                  <div 
                    className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: leg.color || trip.lineColor || "#a8a29e" }}
                  />
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{leg.origin}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-stone-500">
                        <span 
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: leg.color || trip.lineColor || "#a8a29e" }}
                        />
                        {leg.lineName}
                        {leg.headsign && <span className="text-stone-400">toward {leg.headsign}</span>}
                      </div>
                      {leg.stopCount != null && (
                        <p className="mt-1 font-mono text-[11px] text-stone-400">
                          {leg.stopCount} stops
                        </p>
                      )}
                      {leg.durationMinutes != null && (
                        <p className="mt-1 font-mono text-[11px] text-stone-500">
                          {leg.durationMinutes} min
                        </p>
                      )}
                      {leg.upcomingDepartures && leg.upcomingDepartures.length > 0 && (
                        <p className="mt-1 font-mono text-[11px] text-orange-700">
                          Next: {leg.upcomingDepartures.join(" / ")}
                        </p>
                      )}
                    </div>
                    {leg.departureTime && (
                      <span className="font-mono text-sm font-semibold text-stone-900">{leg.departureTime}</span>
                    )}
                  </div>
                  
                  {idx === trip.legs!.length - 1 && (
                    <div className="relative pl-6 mt-4 -ml-6">
                      <div className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-stone-900 bg-white shadow-sm" />
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-semibold text-stone-900">{leg.destination}</p>
                        {trip.arrivalTime && (
                          <span className="font-mono text-sm font-semibold text-stone-900">{trip.arrivalTime}</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )) : (
                <>
                  <li className="relative pl-6">
                    <div 
                      className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: trip.lineColor || "#a8a29e" }}
                    />
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{trip.origin}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-stone-500">
                          <span 
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: trip.lineColor || "#a8a29e" }}
                          />
                          {trip.service}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold text-stone-900">{trip.departureTime}</span>
                    </div>
                  </li>
                  <li className="relative pl-6">
                    <div className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-stone-900 bg-white shadow-sm" />
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-stone-900">{trip.destination}</p>
                      {trip.arrivalTime && (
                        <span className="font-mono text-sm font-semibold text-stone-900">{trip.arrivalTime}</span>
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
