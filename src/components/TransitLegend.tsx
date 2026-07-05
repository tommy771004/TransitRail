import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Train, Bus, Info, Layers, Sparkles, Wifi, Utensils, Compass, HelpCircle, Footprints, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface TransitLegendProps {
  onBack: () => void;
  highlightLine?: string | null;
}

export function TransitLegend({ onBack, highlightLine }: TransitLegendProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightLine && containerRef.current) {
      // Find the element with the matching data-line attribute
      // Since line names might only partially match, we look for includes
      const elements = Array.from(containerRef.current.querySelectorAll("[data-line]")) as HTMLElement[];
      const target = elements.find(el => {
        const lineName = el.getAttribute("data-line");
        return lineName && highlightLine.includes(lineName);
      }) || elements.find(el => {
        const lineName = el.getAttribute("data-line");
        return lineName && lineName.includes(highlightLine);
      });

      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("ring-2", "ring-emerald-500", "bg-emerald-50", "dark:bg-emerald-950/30");
          setTimeout(() => {
            target.classList.remove("ring-2", "ring-emerald-500", "bg-emerald-50", "dark:bg-emerald-950/30");
          }, 2000);
        }, 300);
      }
    }
  }, [highlightLine]);

  const categories = [
    {
      id: "modes",
      title: t("legend.modes_title", { defaultValue: "Transit Modes & Icons / 乘車工具與圖標" }),
      description: t("legend.modes_desc", { defaultValue: "Common icons used across the route planning details." }),
      items: [
        {
          icon: <Train className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
          label: t("legend.mode_bullet", { defaultValue: "Shinkansen / Bullet Train (新幹線)" }),
          desc: t("legend.mode_bullet_desc", { defaultValue: "High-speed rail connections including Japan Shinkansen, Korea KTX/SRT, China High-Speed, Germany ICE, and France TGV." }),
        },
        {
          icon: <Train className="h-5 w-5 text-blue-500 dark:text-blue-400" />,
          label: t("legend.mode_metro", { defaultValue: "Metro / Subway / MRT (地鐵 / 捷運)" }),
          desc: t("legend.mode_metro_desc", { defaultValue: "Urban rapid transit networks such as London Underground (TfL), Boston Subway (MBTA), Hong Kong MTR, Singapore MRT, Bangkok BTS/MRT." }),
        },
        {
          icon: <Bus className="h-5 w-5 text-amber-500 dark:text-amber-400" />,
          label: t("legend.mode_bus", { defaultValue: "Bus / Highway Coach (巴士 / 客運)" }),
          desc: t("legend.mode_bus_desc", { defaultValue: "Local bus, highway express, and airport limousine bus services linking key locations." }),
        },
        {
          icon: <Footprints className="h-5 w-5 text-slate-500 dark:text-slate-400" />,
          label: t("legend.mode_transfer", { defaultValue: "Transfer / Walk (轉乘 / 步行)" }),
          desc: t("legend.mode_transfer_desc", { defaultValue: "Indicates walking between platforms, street-level transfers, or changing lines within a transit interchange." }),
        },
      ],
    },
    {
      id: "amenities",
      title: t("legend.amenities_title", { defaultValue: "Amenities & Indicators / 服務設施與指示" }),
      description: t("legend.amenities_desc", { defaultValue: "Indicators shown on trip details representing amenities and options." }),
      items: [
        {
          icon: <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />,
          label: t("legend.amenity_first", { defaultValue: "First Class / Premium (商務艙 / 綠色車廂)" }),
          desc: t("legend.amenity_first_desc", { defaultValue: "Indicates availability of premium service levels (e.g. Green Car, KTX First Class, ICE 1st Class)." }),
        },
        {
          icon: <Wifi className="h-5 w-5 text-sky-500 dark:text-sky-400" />,
          label: t("legend.amenity_wifi", { defaultValue: "Wi-Fi Access (車上無線網路)" }),
          desc: t("legend.amenity_wifi_desc", { defaultValue: "Complimentary wireless internet connectivity available on board the train or vehicle." }),
        },
        {
          icon: <Utensils className="h-5 w-5 text-pink-500 dark:text-pink-400" />,
          label: t("legend.amenity_dining", { defaultValue: "Dining Car / Food (餐車 / 餐飲服務)" }),
          desc: t("legend.amenity_dining_desc", { defaultValue: "On-board dining facilities, cafe bar, or dynamic trolley catering services." }),
        },
        {
          icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          label: t("legend.amenity_alerts", { defaultValue: "Transit Warnings (重要通知 / 延誤)" }),
          desc: t("legend.amenity_alerts_desc", { defaultValue: "Service alerts, scheduled maintenance, or localized real-time delay warnings." }),
        },
      ],
    },
    {
      id: "colors",
      title: t("legend.colors_title", { defaultValue: "Network Line Colors / 各國路線色彩標誌" }),
      description: t("legend.colors_desc", { defaultValue: "Representative color codes used for major regional lines." }),
      sections: [
        {
          region: t("legend.region_hk", { defaultValue: "Hong Kong MTR (香港地鐵)" }),
          lines: [
            { name: t("legend.hk_tw", { defaultValue: "Tsuen Wan Line (荃灣綫)" }), color: "#E2231A" },
            { name: t("legend.hk_is", { defaultValue: "Island Line (港島綫)" }), color: "#0075C2" },
            { name: t("legend.hk_kt", { defaultValue: "Kwun Tong Line (觀塘綫)" }), color: "#00A040" },
            { name: t("legend.hk_er", { defaultValue: "East Rail Line (東鐵綫)" }), color: "#5EB7E8" },
            { name: t("legend.hk_tm", { defaultValue: "Tuen Ma Line (屯馬綫)" }), color: "#9C2E00" },
            { name: t("legend.hk_ae", { defaultValue: "Airport Express (機場快綫)" }), color: "#00888E" },
          ],
        },
        {
          region: t("legend.region_uk", { defaultValue: "London Underground / TfL (倫敦地鐵)" }),
          lines: [
            { name: t("legend.uk_picc", { defaultValue: "Piccadilly Line" }), color: "#003688" },
            { name: t("legend.uk_vic", { defaultValue: "Victoria Line" }), color: "#0098D4" },
            { name: t("legend.uk_jub", { defaultValue: "Jubilee Line" }), color: "#A0A5A9" },
            { name: t("legend.uk_central", { defaultValue: "Central Line" }), color: "#E32017" },
            { name: t("legend.uk_eliz", { defaultValue: "Elizabeth Line" }), color: "#6950A1" },
            { name: t("legend.uk_dlr", { defaultValue: "DLR (Docklands Light Railway)" }), color: "#00A4A7" },
          ],
        },
        {
          region: t("legend.region_us", { defaultValue: "Boston MBTA (波士頓地鐵)" }),
          lines: [
            { name: t("legend.us_red", { defaultValue: "Red Line" }), color: "#DA291C" },
            { name: t("legend.us_orange", { defaultValue: "Orange Line" }), color: "#ED8B00" },
            { name: t("legend.us_green", { defaultValue: "Green Line" }), color: "#00843D" },
            { name: t("legend.us_blue", { defaultValue: "Blue Line" }), color: "#003DA5" },
            { name: t("legend.us_cr", { defaultValue: "Commuter Rail" }), color: "#80225F" },
          ],
        },
        {
          region: t("legend.region_kr", { defaultValue: "Seoul Subway & KTX (首爾地鐵與高鐵)" }),
          lines: [
            { name: t("legend.kr_ktx", { defaultValue: "KTX / Express (韓國高鐵)" }), color: "#00529B" },
            { name: t("legend.kr_l1", { defaultValue: "Line 1 (1號線)" }), color: "#0052A4" },
            { name: t("legend.kr_l2", { defaultValue: "Line 2 (2號線)" }), color: "#00A84D" },
            { name: t("legend.kr_l3", { defaultValue: "Line 3 (3號線)" }), color: "#EF7C1C" },
            { name: t("legend.kr_l4", { defaultValue: "Line 4 (4號線)" }), color: "#00A5DE" },
            { name: t("legend.kr_l9", { defaultValue: "Line 9 (9號線)" }), color: "#BDB092" },
          ],
        },
      ],
    },
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-transparent pb-28 pt-14 selection:bg-emerald-200 dark:selection:bg-emerald-800/40">
      {/* Header */}
      <section className="border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 py-4 dark:border-slate-700/50 dark:bg-slate-900/95 sticky top-14 z-30">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Back to search"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {t("legend.title", { defaultValue: "Transit Legend / 乘車指南" })}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("legend.subtitle", { defaultValue: "Network guide, colors, and service icons" })}
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        {/* Intro Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-950 dark:bg-emerald-950/20"
        >
          <div className="flex gap-3">
            <Compass className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {t("legend.banner_title", { defaultValue: "Cross-Border Journey Guide / 跨國交通指南" })}
              </h2>
              <p className="mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-400/80 leading-relaxed">
                {t("legend.banner_desc", { defaultValue: "Our live routing engine tracks official schedules and matches transit markers across multiple countries. Refer below to understand line colors and indicators used in result workflows." })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Categories */}
        {categories.map((cat, catIdx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * (catIdx + 1) }}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{cat.title}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{cat.description}</p>
            </div>

            {/* Render direct items */}
            {cat.items && (
              <div className="space-y-4">
                {cat.items.map((item, idx) => (
                  <div key={idx} className="flex gap-3.5 items-start">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950/40">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Render grouped sections (line colors) */}
            {cat.sections && (
              <div className="space-y-5">
                {cat.sections.map((sec, secIdx) => (
                  <div key={secIdx} className="border-t border-slate-100 dark:border-slate-800 pt-3.5 first:border-t-0 first:pt-0">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      <span>{sec.region}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {sec.lines.map((line, lineIdx) => (
                        <div
                          key={lineIdx}
                          data-line={line.name}
                          className="flex items-center gap-2 rounded-xl bg-slate-50/50 p-2 border border-slate-100 transition-all duration-500 dark:bg-slate-950/20 dark:border-slate-800/80"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: line.color }}
                          />
                          <span className="truncate text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            {line.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}

        {/* Footer info */}
        <div className="text-center pb-4 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{t("legend.footer", { defaultValue: "Schedules and colors are periodically synced with open data portals." })}</span>
        </div>
      </div>
    </div>
  );
}
