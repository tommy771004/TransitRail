// Renders the country-appropriate results chrome from countryConfig policy.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  Country,
  CoverageGap,
  KoreaFilter,
  SortMode,
  TimetableProvenance,
  TimetableTruthMode,
  TransitResult,
} from "../types";
import { getCountryCapability } from "../data/countryCapability";
import { JapanResultView } from "./JapanResultView";
import { KoreaResultView } from "./KoreaResultView";
import { MetroResultView } from "./MetroResultView";
import { LiveRailResultView } from "./LiveRailResultView";
import { MalaysiaCatalogView } from "./MalaysiaCatalogView";

export type CountryResultsViewProps = {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
  error?: string;
  officialSourceUrl?: string;
  /** Set when the miss is a catalog gap rather than a failed fetch. */
  coverageGap?: CoverageGap;
  truthMode?: TimetableTruthMode;
  provenance?: TimetableProvenance | "unknown";
  indicativeFallback?: boolean;
  results: TransitResult[];
  savedIds: Set<string>;
  sortMode: SortMode;
  koreaFilter: KoreaFilter;
  onSortChange: (mode: SortMode) => void;
  onKoreaFilterChange: (filter: KoreaFilter) => void;
  onModify: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
};

function SearchabilityTrustNotice({
  truthMode,
  provenance,
  fallback,
}: {
  truthMode?: TimetableTruthMode;
  provenance?: TimetableProvenance | "unknown";
  fallback?: boolean;
}) {
  const { t } = useTranslation();
  if (truthMode !== "indicative") return null;

  const sourceLabel = provenance === "llm-advisory"
    ? t("result.source_llm_advisory", { defaultValue: "AI-advisory source" })
    : provenance === "curated"
      ? t("result.source_curated", { defaultValue: "Curated snapshot" })
      : provenance === "official"
        ? t("result.source_official", { defaultValue: "Official source" })
        : t("result.source_unknown", { defaultValue: "Source not identified" });

  return (
    <aside
      role="status"
      className="mx-auto max-w-md border-l-2 border-amber-500 px-4 py-3 text-sm text-slate-700 dark:border-amber-400 dark:text-slate-200"
    >
      <p className="font-semibold">
        {fallback
          ? t("result.indicative_fallback", {
              defaultValue: "Live timetable unavailable. Showing an indicative timetable pattern instead.",
            })
          : t("result.indicative_timetable", {
              defaultValue: "Indicative timetable: departures are representative and are not verified for the selected service day.",
            })}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sourceLabel}</p>
    </aside>
  );
}

export function CountryResultsView(props: CountryResultsViewProps) {
  const capability = getCountryCapability(props.country);
  const truthMode = props.truthMode || props.results.find((result) => result.truthMode)?.truthMode;
  const notice = (
    <SearchabilityTrustNotice
      truthMode={truthMode}
      provenance={props.provenance || props.results.find((result) => result.provenance)?.provenance}
      fallback={props.indicativeFallback}
    />
  );
  const shared = {
    origin: props.origin,
    destination: props.destination,
    date: props.date,
    time: props.time,
    error: props.error,
    officialSourceUrl: props.officialSourceUrl,
    coverageGap: props.coverageGap,
    results: props.results,
    savedIds: props.savedIds,
    onModify: props.onModify,
    onSave: props.onSave,
    onOpenLegend: props.onOpenLegend,
    formatPrice: props.formatPrice,
    overview: props.overview,
  };

  if (capability.resultView === "japan") {
    return (
      <>
        {notice}
        <JapanResultView
          country={props.country}
          {...shared}
          sortMode={props.sortMode}
          onSortChange={props.onSortChange}
          onSelectSeat={props.onSelectSeat}
        />
      </>
    );
  }
  if (capability.resultView === "korea") {
    return (
      <>
        {notice}
        <KoreaResultView
          {...shared}
          filter={props.koreaFilter}
          onFilterChange={props.onKoreaFilterChange}
          onSelectSeat={props.onSelectSeat}
        />
      </>
    );
  }
  if (capability.resultView === "catalog") {
    return (
      <MalaysiaCatalogView
        origin={props.origin}
        destination={props.destination}
        onModify={props.onModify}
      />
    );
  }
  if (capability.resultView === "metro") {
    return (
      <>
        {notice}
        <MetroResultView country={props.country} {...shared} />
      </>
    );
  }
  if (capability.resultView === "live_rail" && capability.liveRailMarket) {
    return (
      <>
        {notice}
        <LiveRailResultView market={capability.liveRailMarket} {...shared} />
      </>
    );
  }
  return null;
}
