import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { TransitResult } from "../types";
import { stationLabel } from "../utils/stationLabel";
import { getTransitIcon } from "../utils/transitIcons";
import { useTranslation } from "react-i18next";

interface D3RouteMapProps {
  trip: TransitResult;
}

export function D3RouteMap({ trip }: D3RouteMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    const render = () => {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove(); // Clear previous render

      const displayLegs = trip.legs && trip.legs.length > 0 ? trip.legs : [
        {
          lineName: trip.service || trip.trainType || "Transit",
          origin: trip.origin,
          destination: trip.destination,
          departureTime: trip.departureTime,
          arrivalTime: trip.arrivalTime,
          durationMinutes: trip.durationMinutes,
          mode: trip.trainType,
          color: trip.lineColor
        }
      ];

      if (displayLegs.length === 0) return;

      const containerWidth = containerRef.current?.clientWidth || 300;
      const minWidth = displayLegs.length * 120 + 80;
      const width = Math.max(containerWidth, minWidth);
      const height = 100;
      const margin = { left: 40, right: 40, top: 40, bottom: 20 };

      svg
        .attr("width", width)
        .attr("height", height)
        .style("overflow", "visible");

      const stations: any[] = [];
      stations.push({
        id: "node-0",
        name: displayLegs[0].origin,
        time: displayLegs[0].departureTime,
        type: "start",
        index: 0
      });

      for (let i = 0; i < displayLegs.length; i++) {
        stations.push({
          id: `node-${i + 1}`,
          name: displayLegs[i].destination,
          time: displayLegs[i].arrivalTime || trip.arrivalTime,
          type: i === displayLegs.length - 1 ? "end" : "transfer",
          index: i + 1
        });
      }

      const links = displayLegs.map((leg, i) => {
        let color = leg.color || trip.lineColor || "#10b981";
        if (!leg.color && !trip.lineColor) {
          const m = (leg.mode || "").toLowerCase();
          const l = (leg.lineName || "").toLowerCase();
          if (m.includes("bus") || l.includes("bus")) color = "#f59e0b";
          else if (m.includes("subway") || l.includes("metro")) color = "#3b82f6";
          else if (m.includes("high_speed") || l.includes("shinkansen") || l.includes("express")) color = "#ef4444";
        }
        return {
          source: i,
          target: i + 1,
          color,
          lineName: leg.lineName,
          duration: leg.durationMinutes,
          mode: leg.mode
        };
      });

      const xScale = d3.scaleLinear()
        .domain([0, stations.length - 1])
        .range([margin.left, width - margin.right]);

      const yPos = height / 2;

      const g = svg.append("g");

      // Draw links (paths) with animation
      const linkPaths = g.selectAll(".link")
        .data(links)
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("x1", d => xScale(d.source))
        .attr("y1", yPos)
        .attr("x2", d => xScale(d.source)) // Start at source for animation
        .attr("y2", yPos)
        .attr("stroke", d => d.color)
        .attr("stroke-width", 6)
        .attr("stroke-linecap", "round");

      // Animate lines
      linkPaths.transition()
        .duration(600)
        .delay((d, i) => i * 400)
        .ease(d3.easeCubicOut)
        .attr("x2", d => xScale(d.target));

      // Link labels (duration/line name)
      const linkGroups = g.selectAll(".link-label")
        .data(links)
        .enter()
        .append("g")
        .attr("class", "link-label")
        .attr("transform", d => `translate(${(xScale(d.source) + xScale(d.target)) / 2}, ${yPos - 12})`)
        .style("opacity", 0);

      linkGroups.transition()
        .duration(400)
        .delay((d, i) => i * 400 + 300)
        .style("opacity", 1);
        
      linkGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("y", -8)
        .style("font-size", "14px")
        .text(d => getTransitIcon(d.mode, d.lineName));

      linkGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("y", 2)
        .attr("class", "fill-slate-500 dark:fill-slate-400 font-bold")
        .style("font-size", "9px")
        .text(d => d.duration ? `${d.duration} ${t("result.min_label", { defaultValue: "min" })}` : "");

      // Draw nodes
      const nodeGroups = g.selectAll(".node")
        .data(stations)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${xScale(d.index)}, ${yPos})`)
        .style("opacity", 0);

      nodeGroups.transition()
        .duration(400)
        .delay((d, i) => i * 400)
        .style("opacity", 1);

      // Outer circle
      nodeGroups.append("circle")
        .attr("r", 8)
        .attr("class", "fill-white dark:fill-slate-900")
        .attr("stroke", d => {
          if (d.type === "start") return links[0]?.color || "#10b981";
          if (d.type === "end") return links[links.length - 1]?.color || "#10b981";
          return "#94a3b8"; // transfer
        })
        .attr("stroke-width", 3);
        
      // Inner dot for origin/destination
      nodeGroups.append("circle")
        .attr("r", 3)
        .attr("fill", d => {
          if (d.type === "start") return links[0]?.color || "#10b981";
          if (d.type === "end") return links[links.length - 1]?.color || "#10b981";
          return "transparent";
        })
        .style("opacity", d => d.type === 'transfer' ? 0 : 1);

      // Station names
      nodeGroups.append("text")
        .attr("text-anchor", d => d.type === "start" ? "start" : d.type === "end" ? "end" : "middle")
        .attr("x", d => d.type === "start" ? -4 : d.type === "end" ? 4 : 0)
        .attr("y", -20)
        .attr("class", "fill-slate-800 dark:fill-slate-100 font-bold")
        .style("font-size", "11px")
        .text(d => stationLabel(t, d.name, trip.country));

      // Times
      nodeGroups.append("text")
        .attr("text-anchor", d => d.type === "start" ? "start" : d.type === "end" ? "end" : "middle")
        .attr("x", d => d.type === "start" ? -4 : d.type === "end" ? 4 : 0)
        .attr("y", 24)
        .attr("class", "fill-slate-500 dark:fill-slate-400 font-mono font-bold")
        .style("font-size", "10px")
        .text(d => d.time || "--:--");
    };

    render();
    
    let timeoutId: any;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(render, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, [trip, t]);

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden mb-6 mt-2 no-scrollbar" ref={containerRef}>
      <svg ref={svgRef} className="min-w-full" />
    </div>
  );
}
