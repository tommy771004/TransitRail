// Renders the country-appropriate results chrome from countryConfig policy.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  Country,
  CoverageGap,
  KoreaFilter,
  NoResultReason,
  SearchDataStatus,
  SortMode,
  TransitResult,
} from "../types";
import { getCountryCapability } from "../data/countryCapability";
import { JapanResultView } from "./JapanResultView";
import { KoreaResultView } from "./KoreaResultView";
import { MetroResultView } from "./MetroResultView";
import { LiveRailResultView } from "./LiveRailResultView";
import { MalaysiaCatalogView } from "./MalaysiaCatalogView";
import { TransitAppSupplement } from "./TransitAppSupplement";

export type CountryResultsViewProps = {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
  error?: string;
  /** Why the search returned nothing, so a miss is not framed as a fetch failure. */
  noResultReason?: NoResultReason;
  officialSourceUrl?: string;
  /** Set when the miss is a catalog gap rather than a failed fetch. */
  coverageGap?: CoverageGap;
  /** Which registered source answered, for the attribution notice. */
  dataStatus?: SearchDataStatus;
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

/**
 * Where these departures came from, shown above every result list.
 *
 * Always rendered when a source is known, rather than only when something is
 * wrong. A notice that appears only for suspect data teaches people to read its
 * absence as "this is fine", which is exactly the inference that made curated
 * snapshots indistinguishable from real timetables — nothing was flagged
 * because nothing knew there was anything to flag.
 */
function SourceProvenanceNotice({ dataStatus }: { dataStatus?: SearchDataStatus }) {
  const { t } = useTranslation();
  if (!dataStatus?.sourceUrl) return null;

  const updated = dataStatus.updatedAt || dataStatus.checkedAt;
  const completenessLabel = dataStatus.temporalCoverage === "bounded-upcoming"
    ? t("result.completeness_bounded_upcoming", { defaultValue: "Live upcoming departures only" })
    : dataStatus.completeness === "frequency-only"
    ? t("result.completeness_frequency", { defaultValue: "Service hours and frequency only — no departure list is published" })
    : dataStatus.completeness === "service-hours"
      ? t("result.completeness_service_hours", { defaultValue: "Service hours only — no departure list is published" })
      : t("result.completeness_full", { defaultValue: "Full timetable" });

  return (
    <aside
      role="status"
      className="mx-auto max-w-md border-l-2 border-slate-300 px-4 py-3 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
    >
      <p>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {t("result.data_source", { defaultValue: "Source" })}:
        </span>{" "}
        <a
          href={dataStatus.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          {dataStatus.source}
        </a>
        {dataStatus.provider && dataStatus.provider !== dataStatus.source ? ` — ${dataStatus.provider}` : ""}
      </p>
      <p className="mt-1">{completenessLabel}</p>
      {updated ? (
        <p className="mt-1">
          {t("result.data_updated", { defaultValue: "Retrieved" })}:{" "}
          <time dateTime={updated}>{new Date(updated).toLocaleString()}</time>
        </p>
      ) : null}
      {dataStatus.attribution ? <p className="mt-1">{dataStatus.attribution}</p> : null}
    </aside>
  );
}

export function CountryResultsView(props: CountryResultsViewProps) {
  const capability = getCountryCapability(props.country);
  const notice = <SourceProvenanceNotice dataStatus={props.dataStatus} />;
  const shared = {
    origin: props.origin,
    destination: props.destination,
    date: props.date,
    time: props.time,
    error: props.error,
    noResultReason: props.noResultReason,
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
  const supplementary = <TransitAppSupplement country={props.country} origin={props.origin} destination={props.destination} />;

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
        {supplementary}
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
        {supplementary}
      </>
    );
  }
  if (capability.resultView === "catalog") {
    return (
      <>
        <MalaysiaCatalogView
          origin={props.origin}
          destination={props.destination}
          onModify={props.onModify}
        />
        {supplementary}
      </>
    );
  }
  if (capability.resultView === "metro") {
    return (
      <>
        {notice}
        <MetroResultView country={props.country} {...shared} />
        {supplementary}
      </>
    );
  }
  if (capability.resultView === "live_rail" && capability.liveRailMarket) {
    return (
      <>
        {notice}
        <LiveRailResultView market={capability.liveRailMarket} {...shared} />
        {supplementary}
      </>
    );
  }
  return null;
}
