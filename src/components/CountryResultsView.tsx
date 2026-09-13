// Renders the country-appropriate results chrome from countryConfig policy.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  Country,
  CoverageGap,
  KoreaFilter,
  NoResultReason,
  SearchDeliveryStatus,
  SearchFailureKind,
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
  failureKind?: SearchFailureKind;
  officialSourceUrl?: string;
  /** Set when the miss is a catalog gap rather than a failed fetch. */
  coverageGap?: CoverageGap;
  /** Which registered source answered, for the attribution notice. */
  dataStatus?: SearchDataStatus;
  deliveryStatus?: SearchDeliveryStatus;
  results: TransitResult[];
  savedIds: Set<string>;
  sortMode: SortMode;
  koreaFilter: KoreaFilter;
  onSortChange: (mode: SortMode) => void;
  onKoreaFilterChange: (filter: KoreaFilter) => void;
  onModify: () => void;
  onRetry?: () => void;
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
    : dataStatus.temporalCoverage === "sampled-service-day"
    ? t("result.completeness_sampled")
    : dataStatus.completeness === "frequency-only"
    ? t("result.completeness_frequency", { defaultValue: "Service hours and frequency only — no departure list is published" })
    : dataStatus.completeness === "service-hours"
      ? t("result.completeness_service_hours", { defaultValue: "Service hours only — no departure list is published" })
      : dataStatus.completeness === "full-timetable" && dataStatus.temporalCoverage === "full-day"
        ? t("result.completeness_full", { defaultValue: "Full timetable" })
        : t("result.completeness_unknown");
  const retrievedTime = updated
    ? new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <aside
      role="status"
      className="m3-body-small mx-auto max-w-md border-l-2 border-slate-300 px-4 py-2.5 text-slate-600 dark:border-slate-600 dark:text-slate-300"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1">
          <a
            href={dataStatus.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="m3-label-medium text-slate-700 underline underline-offset-2 dark:text-slate-200"
          >
            {dataStatus.source}
          </a>
          <span aria-hidden="true"> · </span>{completenessLabel}
          {retrievedTime ? <><span aria-hidden="true"> · </span><time dateTime={updated}>{retrievedTime}</time></> : null}
        </p>
        <details className="shrink-0 text-right">
          <summary className="m3-label-medium m3-state cursor-pointer list-none underline underline-offset-2">
            {t("result.provenance_details")}
          </summary>
          <div className="mt-2 max-w-72 space-y-1 text-left">
            {dataStatus.provider && dataStatus.provider !== dataStatus.source ? <p>{dataStatus.provider}</p> : null}
            {updated ? <p>{t("result.data_updated")}: <time dateTime={updated}>{new Date(updated).toLocaleString()}</time></p> : null}
            {dataStatus.sourceTier ? <p>{t("result.source_grade", { grade: dataStatus.sourceTier })}</p> : null}
            {dataStatus.attribution ? <p>{dataStatus.attribution}</p> : null}
          </div>
        </details>
      </div>
    </aside>
  );
}

function OfflineCacheNotice({ deliveryStatus }: { deliveryStatus?: SearchDeliveryStatus }) {
  const { t } = useTranslation();
  if (deliveryStatus?.kind !== "offline-cache") return null;
  return (
    <aside
      role="status"
      className="m3-body-small mx-auto max-w-md border-l-2 border-amber-400 bg-amber-50/70 px-4 py-3 text-amber-900 dark:border-amber-500 dark:bg-amber-950/25 dark:text-amber-200"
    >
      <span className="m3-label-medium">{t("result.offline_cache")}</span>
      {deliveryStatus.fetchedAt ? (
        <> · <time dateTime={deliveryStatus.fetchedAt}>{new Date(deliveryStatus.fetchedAt).toLocaleString()}</time></>
      ) : null}
    </aside>
  );
}

export function CountryResultsView(props: CountryResultsViewProps) {
  const { t } = useTranslation();
  const capability = getCountryCapability(props.country);
  const notice = <SourceProvenanceNotice dataStatus={props.dataStatus} />;
  const deliveryNotice = <OfflineCacheNotice deliveryStatus={props.deliveryStatus} />;
  const resultAnnouncement = props.results.length > 0 ? (
    <p role="status" aria-live="polite" className="sr-only">
      {t("result.results_found", { count: props.results.length })}
    </p>
  ) : null;
  const shared = {
    origin: props.origin,
    destination: props.destination,
    date: props.date,
    time: props.time,
    error: props.error,
    noResultReason: props.noResultReason,
    failureKind: props.failureKind,
    officialSourceUrl: props.officialSourceUrl,
    coverageGap: props.coverageGap,
    results: props.results,
    savedIds: props.savedIds,
    onModify: props.onModify,
    onRetry: props.onRetry,
    onSave: props.onSave,
    onOpenLegend: props.onOpenLegend,
    formatPrice: props.formatPrice,
    overview: <>{resultAnnouncement}{deliveryNotice}{notice}</>,
    afterFirstResult: props.overview,
  };
  const supplementary = <TransitAppSupplement country={props.country} origin={props.origin} destination={props.destination} />;

  if (capability.resultView === "japan") {
    return (
      <>
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
        <MetroResultView country={props.country} {...shared} />
        {supplementary}
      </>
    );
  }
  if (capability.resultView === "live_rail" && capability.liveRailMarket) {
    return (
      <>
        <LiveRailResultView market={capability.liveRailMarket} {...shared} />
        {supplementary}
      </>
    );
  }
  return null;
}
