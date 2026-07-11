import { useEffect, useRef, useState } from "react";
import type { TransitResult, JourneyLeg } from "../types";
import { useTranslation } from "react-i18next";
import { stationLabel } from "../utils/stationLabel";
import { getTransitIcon } from "../utils/transitIcons";
import { ChevronDown, ChevronUp, Clock, MapPin, ArrowRightLeft, Info, BellRing, LocateFixed } from "lucide-react";
import { motion } from "motion/react";
import { D3LeafletRouteMap } from "./D3LeafletRouteMap";
import { TransferInfoPopup } from "./TransferInfoPopup";
import { getTransferInfo, type TransferInfo } from "../data/transfers";
import { findNearestKnownStation } from "../utils/geoCoordinates";
import { triggerHaptic } from "../utils/haptics";

interface TripDetailsProps {
  trip: TransitResult;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
}

function getMinutesDiff(time1?: string, time2?: string): number | null {
  if (!time1 || !time2) return null;
  const [h1, m1] = time1.split(":").map(Number);
  const [h2, m2] = time2.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff >= 0 ? diff : null;
}

function getLegColor(leg: JourneyLeg, defaultColor?: string) {
  if (leg.color) return leg.color;
  const m = (leg.mode || "").toLowerCase();
  const l = (leg.lineName || "").toLowerCase();
  if (m.includes("bus") || m.includes("coach") || l.includes("bus") || l.includes("客運") || l.includes("巴士")) return "#f59e0b"; // amber
  if (m.includes("subway") || m.includes("metro") || m.includes("underground") || l.includes("subway") || l.includes("metro") || l.includes("捷運") || l.includes("地鐵")) return "#3b82f6"; // blue
  if (m.includes("high_speed") || m.includes("shinkansen") || l.includes("shinkansen") || l.includes("express") || l.includes("bullet") || l.includes("新幹線") || l.includes("高鐵") || l.includes("特急")) return "#ef4444"; // red
  return defaultColor || "#10b981"; // emerald default
}

function transferPressure(minutes: number | null, isChinese: boolean) {
  if (minutes === null) return undefined;
  if (minutes <= 4) {
    return { emoji: "🔴", label: isChinese ? "要跑" : "Run", className: "text-rose-700 dark:text-rose-300" };
  }
  if (minutes <= 10) {
    return { emoji: "🟡", label: isChinese ? "正常轉乘" : "Normal connection", className: "text-amber-700 dark:text-amber-300" };
  }
  return { emoji: "🟢", label: isChinese ? "可以買杯咖啡" : "Time for coffee", className: "text-emerald-700 dark:text-emerald-300" };
}

export function TripDetails({ trip, onOpenLegend, formatPrice }: TripDetailsProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"timeline" | "map">("timeline");
  const [expandedLegs, setExpandedLegs] = useState<Record<number, boolean>>({});
  const [selectedTransferStationId, setSelectedTransferStationId] = useState<string | null>(null);
  const [selectedTransferStationName, setSelectedTransferStationName] = useState<string | null>(null);
  const [selectedTransferInfo, setSelectedTransferInfo] = useState<TransferInfo | null>(null);
  const [arrivalReminderState, setArrivalReminderState] = useState<"idle" | "watching" | "alerted" | "unavailable">("idle");
  const [arrivalDistanceKm, setArrivalDistanceKm] = useState<number | undefined>();
  const arrivalWatchId = useRef<number | undefined>();

  const displayLegs: JourneyLeg[] = trip.legs && trip.legs.length > 0 ? trip.legs : [
    {
      lineName: trip.service || trip.trainType || "Transit",
      origin: trip.origin,
      destination: trip.destination,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      durationMinutes: trip.durationMinutes,
      mode: trip.trainType,
    }
  ];

  const destinationStation = displayLegs[displayLegs.length - 1]?.destination || trip.destination;

  const stopArrivalReminder = () => {
    if (arrivalWatchId.current !== undefined && navigator.geolocation) {
      navigator.geolocation.clearWatch(arrivalWatchId.current);
    }
    arrivalWatchId.current = undefined;
  };

  useEffect(() => () => stopArrivalReminder(), []);

  const enableArrivalReminder = () => {
    if (!navigator.geolocation) {
      setArrivalReminderState("unavailable");
      return;
    }
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setArrivalReminderState("watching");
    arrivalWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const nearest = findNearestKnownStation(
          [destinationStation],
          position.coords.latitude,
          position.coords.longitude,
        );
        if (!nearest) {
          setArrivalReminderState("unavailable");
          stopArrivalReminder();
          return;
        }
        setArrivalDistanceKm(nearest.distanceKm);
        if (nearest.distanceKm <= 0.6) {
          setArrivalReminderState("alerted");
          triggerHaptic("warning");
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(t("result.arrival_reminder_title", { defaultValue: "Approaching your stop" }), {
                body: t("result.arrival_reminder_body", { station: destinationStation, defaultValue: `${destinationStation} is coming up. Prepare to get off.` }),
              });
            } catch {
              // Notification support varies by browser; haptics remain the fallback.
            }
          }
          stopArrivalReminder();
        }
      },
      () => {
        setArrivalReminderState("unavailable");
        stopArrivalReminder();
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  };

  const routeTransferInfo = (stationName: string, legIndex: number): TransferInfo => {
    const curated = getTransferInfo(stationName, trip.country);
    if (curated) return curated;

    const arrivingLeg = displayLegs[legIndex];
    const departingLeg = displayLegs[legIndex + 1];
    const lines = [arrivingLeg, departingLeg]
      .filter((leg): leg is JourneyLeg => Boolean(leg))
      .map((leg) => ({ name: leg.lineName, color: getLegColor(leg, trip.lineColor) }))
      .filter((line, index, all) => all.findIndex((candidate) => candidate.name === line.name) === index);

    return {
      stationId: `route-${trip.id}-${legIndex}`,
      stationName,
      country: trip.country,
      guidanceZh: "此提示依目前查得的兩段行程產生；請依現場月台、出口與服務公告完成轉乘。",
      guidanceEn: "This guidance is based on the two services in the current result. Follow on-site platform, exit, and service notices when transferring.",
      transferLines: [{
        category: t("result.current_journey_services", { defaultValue: "Services in this journey" }),
        lines,
      }],
    };
  };

  const handleOpenTransferInfo = (stationName: string, country: string, legIndex?: number) => {
    const info = legIndex === undefined
      ? getTransferInfo(stationName, country)
      : routeTransferInfo(stationName, legIndex);
    if (!info) return;
    setSelectedTransferInfo(info);
    setSelectedTransferStationId(info.stationId);
    setSelectedTransferStationName(stationName);
  };

  // Normalize the timeline items
  const timelineItems: any[] = [];

  if (displayLegs.length > 0) {
    // Start Station
    timelineItems.push({
      id: "start",
      type: "station",
      name: displayLegs[0].origin,
      time: displayLegs[0].departureTime,
      platform: displayLegs[0].platform,
      isStart: true,
      legIndex: 0,
    });

    for (let i = 0; i < displayLegs.length; i++) {
      const leg = displayLegs[i];
      
      // Add Transit Leg
      timelineItems.push({
        id: `transit-${i}`,
        type: "transit",
        leg,
        legIndex: i,
      });

      const nextLeg = displayLegs[i + 1];
      if (nextLeg) {
        // It's a transfer point
        const transferMinutes = getMinutesDiff(leg.arrivalTime, nextLeg.departureTime);
        timelineItems.push({
          id: `transfer-${i}`,
          type: "transfer",
          stationName: leg.destination,
          arrivalTime: leg.arrivalTime,
          departureTime: nextLeg.departureTime,
          arrivalPlatform: leg.platform,
          departurePlatform: nextLeg.platform,
          durationMinutes: transferMinutes,
          legIndex: i,
        });
      } else {
        // Final Station
        timelineItems.push({
          id: "end",
          type: "station",
          name: leg.destination,
          time: leg.arrivalTime || trip.arrivalTime,
          platform: leg.platform,
          isEnd: true,
          legIndex: i,
        });
      }
    }
  }

  const hasPrice = trip.price !== undefined && trip.price !== null;
  const isChinese = i18n.language.toLowerCase().startsWith("zh");

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
            {t("result.show_details", { defaultValue: "Trip details & timeline" })}
          </>
        )}
      </button>

      {expanded && (
        <div className="bg-slate-50/50 px-4 sm:px-6 py-5 rounded-b-3xl border-t border-slate-100 dark:bg-slate-950/30 dark:border-slate-800/80">
          <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/60 dark:bg-sky-950/25">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <LocateFixed className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
                <div>
                  <p className="text-xs font-black text-sky-950 dark:text-sky-100">{isChinese ? "下車提醒" : "Get-off reminder"}</p>
                  <p className="text-[10px] font-medium text-sky-800/80 dark:text-sky-200/80">
                    {arrivalReminderState === "watching"
                      ? (arrivalDistanceKm !== undefined
                        ? (isChinese ? `距 ${stationLabel(t, destinationStation, trip.country)} 約 ${arrivalDistanceKm.toFixed(1)} 公里` : `${arrivalDistanceKm.toFixed(1)} km from ${stationLabel(t, destinationStation, trip.country)}`)
                        : (isChinese ? "正在確認你與目的站的距離…" : "Checking your distance to the destination…"))
                      : arrivalReminderState === "alerted"
                        ? (isChinese ? "已提醒，準備下車。" : "Alert sent — prepare to get off.")
                        : arrivalReminderState === "unavailable"
                          ? (isChinese ? "此目的站沒有可靠座標，或定位權限未開啟。" : "A reliable station coordinate or location permission is unavailable.")
                          : (isChinese ? `接近 ${stationLabel(t, destinationStation, trip.country)} 600 公尺時震動提醒。` : `Vibrates when you are within 600 m of ${stationLabel(t, destinationStation, trip.country)}.`)}
                  </p>
                </div>
              </div>
              {arrivalReminderState === "watching" ? (
                <button type="button" onClick={() => { stopArrivalReminder(); setArrivalReminderState("idle"); }} className="shrink-0 rounded-lg border border-sky-300 px-2.5 py-1.5 text-[10px] font-black text-sky-800 dark:border-sky-700 dark:text-sky-200">
                  {isChinese ? "停止" : "Stop"}
                </button>
              ) : (
                <button type="button" onClick={enableArrivalReminder} disabled={arrivalReminderState === "alerted"} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-700 px-2.5 py-1.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950">
                  <BellRing className="h-3 w-3" />
                  {arrivalReminderState === "alerted" ? (isChinese ? "已提醒" : "Alerted") : (isChinese ? "開啟" : "Enable")}
                </button>
              )}
            </div>
          </div>

          {hasPrice && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{isChinese ? "此班次票價" : "Fare for this service"}</p>
                <p className="mt-1 font-mono text-xl font-black text-slate-800 dark:text-slate-100">{formatPrice?.(trip) || `${trip.price} ${trip.currency || ""}`}</p>
              </div>
              <div className="flex max-w-52 items-start gap-1.5 text-[10px] leading-relaxed text-blue-800/80 dark:text-blue-400/80">
                <Info className="h-3 w-3 shrink-0" />
                <span>
                  {isChinese ? "僅顯示資料來源提供的此班次票價；不同乘客、座位或優惠方案請以營運商為準。" : "Only the provider fare for this service is shown. Confirm passenger, seat, and promotional fares with the operator."}
                </span>
              </div>
            </div>
          )}

          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800 mb-6 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                viewMode === "timeline"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <span>📋</span>
              {t("result.timeline_tab", { defaultValue: "Timeline" })}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                viewMode === "map"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <span>🗺️</span>
              {t("result.map_tab", { defaultValue: "Route Map" })}
            </button>
          </div>

          {viewMode === "map" && <D3LeafletRouteMap trip={trip} />}
          {viewMode === "timeline" && (
            <div className="flex flex-col space-y-0 relative">
              {timelineItems.map((item, idx) => {
                const currentLeg = displayLegs[item.legIndex];
                const legColor = currentLeg ? getLegColor(currentLeg, trip.lineColor) : (trip.lineColor || "#10b981");

                let lineStyle = "solid";
                let lineColor = legColor;
                const nextItem = timelineItems[idx + 1];
                if (nextItem) {
                  if (nextItem.type === "transfer" || item.type === "transfer") {
                    lineStyle = "dashed";
                    lineColor = "#94a3b8";
                  } else if (nextItem.type === "transit") {
                    const nextLeg = displayLegs[nextItem.legIndex];
                    lineColor = getLegColor(nextLeg, trip.lineColor);
                  }
                }

                if (item.type === "station") {
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                      className="flex gap-x-4 min-h-[48px] relative"
                    >
                      <div className="w-12 shrink-0 text-right font-mono text-xs font-bold text-slate-500 dark:text-slate-400 pt-0.5">
                        {item.time || "--:--"}
                      </div>

                      <div className="relative w-6 shrink-0 flex flex-col items-center">
                        {!item.isEnd && (
                          <div
                            className="absolute top-4.5 bottom-0 w-[3px]"
                            style={{
                              backgroundColor: lineColor,
                              borderLeft: lineStyle === "dashed" ? "3px dashed #cbd5e1" : "none",
                              background: lineStyle === "dashed" ? "transparent" : lineColor,
                            }}
                          />
                        )}
                        
                        <div
                          className={`z-10 h-4.5 w-4.5 rounded-full border-2 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center`}
                          style={{ borderColor: legColor }}
                        >
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: legColor }}
                          />
                        </div>
                      </div>

                      <div className="flex-1 pb-4">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {stationLabel(t, item.name, trip.country)}
                          </span>
                          {item.isStart && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30">
                              {t("search.origin", { defaultValue: "Origin" })}
                            </span>
                          )}
                          {item.isEnd && (
                            <>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30">
                                {t("search.destination", { defaultValue: "Destination" })}
                              </span>
                              {getTransferInfo(item.name, trip.country) && (
                                <button
                                  onClick={() => handleOpenTransferInfo(item.name, trip.country)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-200/60 shadow-xs hover:from-indigo-100 hover:to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/30 dark:text-indigo-300 dark:border-indigo-800/40 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/40 transition-all cursor-pointer animate-badge-pulse"
                                >
                                  <Info className="h-3 w-3 animate-spin [animation-duration:3s]" />
                                  {t("result.transfer_info", { defaultValue: "Transfer Info" })}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {item.platform && (
                          <div className="mt-1 font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {t("result.platform_label", { defaultValue: "Platform" })} {item.platform}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                }

                if (item.type === "transit") {
                  const leg = item.leg;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                      className="flex gap-x-4 relative"
                    >
                      <div className="w-12 shrink-0" />

                      <div className="relative w-6 shrink-0 flex flex-col items-center">
                        <div
                          className="absolute top-0 bottom-0 w-[3px]"
                          style={{ backgroundColor: legColor }}
                        />
                      </div>

                      <div className="flex-1 pb-4 pr-1">
                        <div className="rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="text-2xl mt-0.5 shrink-0 select-none">
                                {getTransitIcon(leg.mode, leg.lineName)}
                              </span>
                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                                  {leg.lineName}
                                </h5>
                                {leg.headsign && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                                    {t("result.toward", { defaultValue: "toward" })} {stationLabel(t, leg.headsign, trip.country)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {leg.durationMinutes != null && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  {leg.durationMinutes} {t("result.min_label", { defaultValue: "min" })}
                                </span>
                              )}
                              {leg.stopCount != null && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                                  {leg.stopCount} {t("result.stops", { defaultValue: "stops" })}
                                </p>
                              )}
                            </div>
                          </div>

                          {leg.upcomingDepartures && leg.upcomingDepartures.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100/60 dark:border-slate-800/60">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {t("result.next_departures", { defaultValue: "Upcoming departures" })}:
                              </span>
                              <div className="flex gap-1.5 mt-1 overflow-x-auto scrollbar-none pb-0.5">
                                {leg.upcomingDepartures.map((time: string) => (
                                  <span
                                    key={time}
                                    className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 shrink-0"
                                  >
                                    {time}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {leg.stops && leg.stops.length > 2 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100/60 dark:border-slate-800/60">
                              <button
                                type="button"
                                onClick={() => setExpandedLegs((prev) => ({ ...prev, [item.legIndex]: !prev[item.legIndex] }))}
                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                              >
                                <span>🚉</span>
                                {expandedLegs[item.legIndex]
                                  ? t("result.hide_stops", { defaultValue: "Hide intermediate stops" })
                                  : t("result.show_stops", { count: leg.stops.length - 2, defaultValue: `Show ${leg.stops.length - 2} intermediate stops` })}
                              </button>
                              
                              {expandedLegs[item.legIndex] && (
                                <div className="mt-2.5 pl-3 border-l-2 border-emerald-100 dark:border-emerald-950/60 flex flex-col space-y-1.5">
                                  {leg.stops.slice(1, -1).map((stop: string, sIdx: number) => (
                                    <div key={sIdx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                                      <span>{stationLabel(t, stop, trip.country)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (item.type === "transfer") {
                  const pressure = transferPressure(item.durationMinutes, isChinese);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                      className="flex gap-x-4 relative"
                    >
                      <div className="w-12 shrink-0 flex flex-col justify-between py-1 text-right font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        <div>{item.arrivalTime}</div>
                        <div className="text-slate-300 dark:text-slate-700">|</div>
                        <div>{item.departureTime}</div>
                      </div>

                      <div className="relative w-6 shrink-0 flex flex-col items-center py-1">
                        <div
                          className="absolute top-0 bottom-0 w-[3px]"
                          style={{ borderLeft: "3px dashed #cbd5e1" }}
                        />
                        <div className="z-10 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
                        <div className="flex-1" />
                        <div className="z-10 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
                      </div>

                      <div className="flex-1 py-1.5 pb-4">
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-100/40 p-3 dark:border-slate-800 dark:bg-slate-900/20">
                          <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-700 dark:text-slate-300 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>
                                {t("result.transfer_at", { 
                                  station: stationLabel(t, item.stationName, trip.country),
                                  defaultValue: `Transfer at ${stationLabel(t, item.stationName, trip.country)}`
                                })}
                              </span>
                            </div>
                            
                            <button
                                onClick={() => handleOpenTransferInfo(item.stationName, trip.country, item.legIndex)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-200/60 shadow-xs hover:from-indigo-100 hover:to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/30 dark:text-indigo-300 dark:border-indigo-800/40 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/40 transition-all cursor-pointer animate-badge-pulse shrink-0"
                              >
                                <Info className="h-3 w-3 animate-spin [animation-duration:3s]" />
                                {t("result.transfer_info", { defaultValue: "Transfer Info" })}
                              </button>
                          </div>
                          
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {item.durationMinutes != null && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {item.durationMinutes} {t("result.min_connection", { defaultValue: "min connection" })}
                              </span>
                            )}
                            {pressure ? (
                              <span className={`inline-flex items-center gap-1 font-black ${pressure.className}`}>
                                <span aria-hidden="true">{pressure.emoji}</span>
                                {pressure.label}
                              </span>
                            ) : null}
                            {item.arrivalPlatform && item.departurePlatform && (
                              <span className="text-slate-400">
                                {t("result.plat_label", { defaultValue: "Plat" })} {item.arrivalPlatform} → {item.departurePlatform}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      )}
      
      {selectedTransferStationId && (
        <TransferInfoPopup
          isOpen={!!selectedTransferStationId}
          onClose={() => {
            setSelectedTransferStationId(null);
            setSelectedTransferStationName(null);
            setSelectedTransferInfo(null);
          }}
          stationId={selectedTransferStationId}
          stationName={selectedTransferStationName || undefined}
          country={trip.country}
          info={selectedTransferInfo || undefined}
        />
      )}
    </div>
  );
}
