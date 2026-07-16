// Renders the country-appropriate results chrome from countryConfig policy.
import type { ReactNode } from "react";
import type { Country, KoreaFilter, SortMode, TransitResult } from "../types";
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

export function CountryResultsView(props: CountryResultsViewProps) {
  const capability = getCountryCapability(props.country);
  const shared = {
    origin: props.origin,
    destination: props.destination,
    date: props.date,
    time: props.time,
    error: props.error,
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
      <JapanResultView
        country={props.country}
        {...shared}
        sortMode={props.sortMode}
        onSortChange={props.onSortChange}
        onSelectSeat={props.onSelectSeat}
      />
    );
  }
  if (capability.resultView === "korea") {
    return (
      <KoreaResultView
        {...shared}
        filter={props.koreaFilter}
        onFilterChange={props.onKoreaFilterChange}
        onSelectSeat={props.onSelectSeat}
      />
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
    return <MetroResultView country={props.country} {...shared} />;
  }
  if (capability.resultView === "live_rail" && capability.liveRailMarket) {
    return <LiveRailResultView market={capability.liveRailMarket} {...shared} />;
  }
  return null;
}
