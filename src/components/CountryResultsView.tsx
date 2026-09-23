// Renders the country-appropriate results chrome from countryConfig policy.
import { useEffect, useState, type ReactNode } from "react";
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
  SearchParams,
  TimeMode,
  TransitResult,
} from "../types";
import { getCountryCapability } from "../data/countryCapability";
import { JapanResultView } from "./JapanResultView";
import { KoreaResultView } from "./KoreaResultView";
import { MetroResultView } from "./MetroResultView";
import { LiveRailResultView } from "./LiveRailResultView";
import { MalaysiaCatalogView } from "./MalaysiaCatalogView";
import { TransitAppSupplement } from "./TransitAppSupplement";
import { addDateValueDays, countryConfig, providerDateValues } from "../data/countries";
import { formatServiceDay } from "./ResultShell";
import { nearestAvailableDate, searchTimeMode } from "../utils/searchConditions";
import { loadStationCatalog } from "../utils/catalogClient";

export type CountryResultsViewProps = {
  country: Country;
  origin: string;
  destination: string;
  date: string;
  time?: string;
  timeMode?: TimeMode;
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
  /** Raw verified rows before passenger-selected filters are applied. */
  totalResults?: number;
  savedIds: Set<string>;
  sortMode: SortMode;
  koreaFilter: KoreaFilter;
  onSortChange: (mode: SortMode) => void;
  onKoreaFilterChange: (filter: KoreaFilter) => void;
  onModify: () => void;
  onRetry?: () => void;
  onRecover?: (changes: Pick<SearchParams, "date" | "timeMode">) => void;
  onChangeStations?: () => void;
  onResetFilters?: () => void;
  onSave: (trip: TransitResult) => void;
  onSelectSeat: (trip: TransitResult) => void;
  onOpenLegend?: (highlight?: string) => void;
  formatPrice?: (trip: TransitResult) => string | null;
  formatRowPrice?: (trip: TransitResult) => string | null;
  overview?: ReactNode;
  /** Injectable wall clock for the departure countdown; tests pin it. */
  now?: () => Date;
};

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
  const totalResults = props.totalResults ?? props.results.length;
  const hasNoMatchingResults = props.results.length === 0 && totalResults > 0;
  const hasNoSearchResults = props.results.length === 0 && totalResults === 0;
  const mode = searchTimeMode(props);
  const [nearestDate, setNearestDate] = useState<string>();
  useEffect(() => {
    setNearestDate(undefined);
    if (props.noResultReason !== "future_date_unavailable") return;
    let active = true;
    // Offer only a date substantiated by current catalog coverage and market policy.
    loadStationCatalog(props.country)
      .then(body => {
        const range = body?.coverage?.dateRange;
        if (!active || !range || !(typeof range.days === "number" && range.days > 0)) return;
        const { start, end } = range;
        if (!start || !end) return;
        const offered = providerDateValues(props.country, countryConfig[props.country].dateRangeDays)
          .filter(date => date >= start && date <= end);
        const nearest = nearestAvailableDate(props.date, offered);
        if (nearest !== props.date) setNearestDate(nearest);
      }).catch(() => { /* Modifying conditions remains available if coverage cannot load. */ });
    return () => { active = false; };
  }, [props.country, props.date, props.noResultReason]);
  const recovery = <>
    {props.onChangeStations && (props.coverageGap || props.noResultReason === "unsupported_route") && (
      <button type="button" className="m3-button m3-state border border-slate-300 dark:border-slate-700" onClick={props.onChangeStations}>{t("journey.change_stations")}</button>
    )}
    {!props.failureKind && props.noResultReason === "no_service" && mode !== "all_day" && !countryConfig[props.country].liveOnly && props.onRecover && (
      <button type="button" className="m3-button m3-state border border-slate-300 dark:border-slate-700" onClick={() => props.onRecover!({ date: props.date, timeMode: "all_day" })}>{t("journey.all_day_recovery")}</button>
    )}
    {nearestDate && props.onRecover && (
      <button type="button" className="m3-button m3-state border border-slate-300 dark:border-slate-700" onClick={() => props.onRecover!({ date: nearestDate, timeMode: mode === "now" ? "all_day" : mode })}>{t("search.date_unavailable_use_nearest", { date: nearestDate })}</button>
    )}
    {props.country === "korea" && ["direct", "first_class"].includes(props.koreaFilter) && props.onResetFilters && (
      <button type="button" className="m3-button m3-state border border-slate-300 dark:border-slate-700" onClick={props.onResetFilters}>{t("journey.reset_filters")}</button>
    )}
  </>;
  // Once every listed departure has left, the following day is the way on,
  // offered only when the market's date window includes it.
  const followingDay = addDateValueDays(props.date, 1);
  const offersFollowingDay = !countryConfig[props.country].liveOnly
    && providerDateValues(props.country, countryConfig[props.country].dateRangeDays, props.now?.()).includes(followingDay);
  const allDepartedAction = offersFollowingDay && props.onRecover ? (
    <button type="button" className="m3-button m3-state border border-slate-300 dark:border-slate-700" onClick={() => props.onRecover!({ date: followingDay, timeMode: mode === "now" ? "all_day" : mode })}>
      {t("result.search_date", { date: formatServiceDay(followingDay) })}
    </button>
  ) : null;
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
    error: props.error || (hasNoSearchResults
      ? t("search.no_result.no_verified_data")
      : hasNoMatchingResults ? t("search.no_result.no_service") : undefined),
    noResultReason: props.noResultReason ?? (!props.error && hasNoSearchResults
      ? "no_verified_data" as const
      : !props.error && hasNoMatchingResults ? "no_service" as const : undefined),
    failureKind: props.failureKind,
    officialSourceUrl: props.officialSourceUrl ?? props.dataStatus?.sourceUrl,
    coverageGap: props.coverageGap,
    results: props.results,
    savedIds: props.savedIds,
    onModify: props.onModify,
    onRetry: props.onRetry,
    recovery,
    onSave: props.onSave,
    onOpenLegend: props.onOpenLegend,
    formatPrice: props.formatPrice,
    formatRowPrice: props.formatRowPrice,
    allDepartedAction,
    // Every market sorts the same way; the list owns the chips.
    sortMode: props.sortMode,
    onSortChange: props.onSortChange,
    now: props.now,
    overview: <>{resultAnnouncement}{deliveryNotice}</>,
    afterResults: props.overview,
  };
  const supplementary = <TransitAppSupplement country={props.country} origin={props.origin} destination={props.destination} />;

  if (capability.resultView === "japan") {
    return (
      <>
        <JapanResultView
          country={props.country}
          {...shared}
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
