# Transit App API v4 Assessment

## Scope and decision

Transit App v4 is a key-protected, third-party transit-data API.  Its own
documentation describes the data as provided by transit.app and requires an
`apiKey` HTTP header; it is not an operator or transport-authority source.
[Transit App API v4 introduction](https://api-doc.transitapp.com/v4.html#description/introduction)

**Decision: do not register it as a TransitRail timetable source and do not
use it to replace any current official scraper.** TransitRail's source policy
allows a searchable or indexable departure only when it is supported by a
registered official source.  Transit App can still be useful as an optional,
clearly labelled product feature or an internal coverage/reliability tool, but
must never backfill `results`, `sourceMeta`, service-day artifacts, or SEO
route pages.

## What the API provides

| Capability | v4 endpoints | Useful project purpose | Policy status |
| --- | --- | --- | --- |
| Nearby station and route discovery | `nearby_stops`, `nearby_routes`, `search_stops`, `available_networks`, `routes_for_networks`, `stops_for_network`, `route_details`, `stop_details` | Explore coverage, map a user's position to a station, discover names/coordinates/networks, and audit the static station catalogue. | **Internal discovery/audit only**. Do not publish its stop catalogue as an official catalogue without independently validating it. |
| Upcoming departures and live changes | `stop_departures` (`should_update_realtime` defaults to true), `nearby_routes` with real-time enabled, `latest_update_for_network` | A separate “live information from Transit” panel, outage monitoring, or comparison against an operator feed. | **Optional, non-authoritative overlay**. It cannot replace verified search results or change a stored official time. |
| Static scheduled departures for dates | `schedule_for_dates`, `trips_for_dates`, then `trip_details` | Technically close to TransitRail's date-specific search: get static scheduled calls, whole-route trips, and complete stop-by-stop schedules. | **Do not use as a timetable replacement.** Both date endpoints are documented as Preview, and their feed data is not an official TransitRail source. |
| Door-to-door and multimodal routing | `plan`, `estimate_plan_duration`, plus `trip_details` | Add a voluntary “plan my whole journey” hand-off/experience: walking, transit, accessibility options, route/stop exclusions, service-alert avoidance, fares, shapes, and possibly shared mobility. | **Add-on only**, isolated from the verified timetable answer and clearly attributed to Transit. Never use its returned itinerary to manufacture a TransitRail departure. |
| Service alerts | `alerts_for_networks`; alerts are also returned with several route/departure responses | Show a separate disruption banner or monitor whether operator sources are stale. | **Supplemental only** until the same alert is confirmed by the relevant operator. Do not use it to suppress, cancel, or modify an official schedule. |

The endpoint list and endpoint behaviour above come from the official v4
reference: [nearby routes/stops and departures](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/nearby_routes),
[route and network metadata](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/available_networks),
[dated static schedules](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/schedule_for_dates),
[trip planning](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/plan), and
[network alerts](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/alerts_for_networks).

## Replacement assessment

| Current TransitRail component | Can Transit App replace it? | Why |
| --- | --- | --- |
| Official GTFS/official-query scrapers (including LTA GTFS) | No | A Transit App response is an intermediary's representation of a feed, not the registered operator source required for a published departure. |
| Thailand frequency-only routes | No | `schedule_for_dates` might return data if Transit covers the network, but that does not establish a source provenance TransitRail may publish. It would turn an honest “no verified timetable” into an unsupported claim. |
| UK TfL and US MBTA live integrations | No | It may be a useful cross-check or an opt-in alternate live view, but cannot replace the agencies' APIs as TransitRail's authoritative source. |
| Static station menu | Not directly | It can identify missing stations and coordinate/name mismatches, but any additions must be reconciled with the relevant official operator data and the existing mapping audit. |
| Transfer chaining and route-page generation | No | Those features must continue to operate only on date-specific, registered official results. |

## Highest-value additions, in order

1. **Coverage-audit job (lowest risk).** Periodically call `available_networks`,
   then location/network discovery endpoints, to create a non-published report
   of countries/networks that might warrant an official-source integration.
   This can especially help find a Thai authority/GTFS feed, but the report is
   a lead, not evidence for a departure.
2. **Opt-in live disruption card.** Given a station already selected from
   TransitRail's official menu, call `stop_departures` and/or
   `alerts_for_networks`; render it outside the verified timetable component
   as “Live data supplied by Transit,” include retrieval time, and do not
   persist it as a timetable. `stop_departures` is explicitly for upcoming
   departures and may update them with real-time data.
   [Transit App stop departures reference](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/stop_departures)
3. **Opt-in door-to-door planner.** Add a separate action after a verified
   result (or for locations with no verified schedule) that calls `plan`.
   Its real-time enrichment and downtime avoidance are useful for a traveller,
   while the isolated UI prevents it being mistaken for TransitRail's sourced
   timetable. [Transit App plan reference](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/plan)

Do **not** begin with a server-side scraper for `schedule_for_dates` or
`trips_for_dates`: the API calls those endpoints Preview, limits each request
to at most 31 requested dates, and says their available date range is dictated
by the underlying feed with no guaranteed future window. Those properties also
conflict with TransitRail's persisted, exact-service-date verification model.
[Schedule for dates reference](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/schedule_for_dates)

## Integration guardrails

- Keep the API key server-side; never expose the `apiKey` header in the SPA.
  Use a distinct environment variable such as `TRANSIT_APP_API_KEY` only if an
  approved non-authoritative feature is built.
- For a live Vercel feature, configure the key in Vercel. For a scheduled
  GitHub audit job, configure it as a GitHub Actions secret. Do not add a
  secret merely to scrape replacement timetable data.
- Make calls on demand and cache briefly by location/network. Live times,
  `trip_search_key` values, and alert state are volatile; the API specifically
  says `trip_search_key` can change as feeds update and should be refreshed
  before use. [Trip details reference](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/trip_details)
- Keep all Transit data in a separate response/type and UI boundary; never
  attach its data to `sourceMeta`, `results`, or the static route page
  pipeline. State the provider and retrieval time in the UI.

## Recommended next decision

Approve either the coverage-audit job or a clearly separated live/door-to-door
experience. Do not approve it as a Thailand timetable fix or as a general
fallback: the proper remedy for missing Thai departures remains locating and
registering a BEM/BTS/authority official schedule source.

## All-market opportunities and endpoint limits

This API is useful across every TransitRail market, not only Thailand.  The
useful distinction is between an **on-demand Transit-provided experience** and
a **TransitRail verified timetable claim**.  The former can be available only
where Transit reports coverage at request time; the latter continues to need a
registered official source.

### 1. Dated timetable comparison or an explicitly labelled alternate view

- `schedule_for_dates` returns static departures for exactly one
  `(global_route_id, global_stop_id)` pair.  It accepts at most 31 local-time
  `YYYY-MM-DD` dates.  Dates beyond the underlying feed's available range
  return an empty `departures` array, not an error; Transit makes no guarantee
  of either a past or future availability window.
- `trips_for_dates` returns every scheduled trip in both directions for one
  route (also at most 31 local-time dates).  It is useful when the user has a
  route but not a particular stop.  Its `trip_search_key` can be followed with
  `trip_details` to obtain the stop-by-stop scheduled calls.
- Both endpoints are marked **Preview**, may change shape without notice, and
  intentionally do not apply real-time updates.  The reference directs live
  requests to `stop_departures` instead.

That makes these endpoints appropriate for a non-persisted “Schedule supplied
by Transit” comparison, source-discrepancy detection, or a user-requested
fallback journey experience.  They must not write `results`, create
`sourceMeta`, populate a service-day artifact, or be used for a route page.
[Dated stop schedules](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/schedule_for_dates)
and [whole-route schedules](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/trips_for_dates)
define these limits.

### 2. Transfer and door-to-door planning

`plan` can add information TransitRail does not model today: cross-network
transfers, walk legs, fare fields when provided, accessibility preferences,
step-by-step directions, GTFS pathways, shared mobility, and service-alert
avoidance.  It accepts coordinates or a stop/correspondence zone.  For an
existing station, pass `from_global_stop_ids` / `to_global_stop_ids` rather
than assuming a single platform is the whole interchange; the API expands a
station to child platforms, and only removes the first/last walk when the plan
actually boards/alights in that zone.  Coordinates take precedence when both
are passed.

Useful controls include `accessibility_need=strict` or
`prioritize_step_free`, `should_include_directions`,
`should_include_pathways`, `allowed_networks`, route/stop avoidance, and
`max_num_legs` (default 3; accepted range 1–6).  With
`should_update_realtime=true`, Transit applies real-time values *after* its
initial static-schedule routing.  `consider_downtimes=true` avoids known
alert-related outages.  A multimodal result is only optimal for the requested
modes; Transit explicitly recommends comparing it with the direct
transit-only plan when true fastest-route selection matters.

Implement this as a separate “Plan complete trip with Transit” action after a
verified result and for a no-verified-timetable state.  It must not turn its
legs or transfer waits into a TransitRail `TripDetails` result.
[Plan reference](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/plan)

### 3. Live departure and disruption layer

- `stop_departures` returns upcoming departures for one or more global stops,
  grouped by route and merged itinerary.  Its `global_stop_ids` input supports
  no more than 100 valid IDs, its time defaults to request time, and
  `should_update_realtime` defaults to true.  Results can be narrowed to at
  most 10 departures per itinerary and can omit cancelled entries or terminal
  arrivals.
- `alerts_for_networks` returns alerts affecting routes, stops, and trips for
  one to 20 network IDs.  `show_active_alerts_only=true` limits display to
  alert periods that intersect the current time; undated-end alerts are treated
  as ongoing.
- `latest_update_for_network` reports the latest data-update time for a
  network ID or location.  It is valuable to display how fresh a Transit live
  card is and to monitor whether a data feed is stale; it does not validate an
  official timetable.

Across all countries, the safe addition is a short-lived card next to (not
inside) the verified answer: “Live information supplied by Transit”, including
retrieval time and the network's latest-update time.  Alerts may inform the
traveller, but they cannot cancel, suppress, or rewrite an official departure
unless TransitRail independently confirms the change with that operator.
[Live departures](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/stop_departures),
[network alerts](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/alerts_for_networks),
and [network freshness](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/latest_update_for_network)
are the applicable contracts.

### 4. Network and station discovery, plus QA

The API can accelerate catalogue and mapping work in all existing countries:

- `available_networks` lists Transit networks globally, or only those serving
  a supplied `lat`/`lon`; it can additionally filter by ISO alpha-2
  `country_code`.  Its default response filters out some supported networks
  such as school buses and preview agency redesigns; `include_all_networks`
  exposes those extra candidates.  Network geometry is included by default.
  Responses can flag `network_in_beta`; the API documentation says beta
  networks must not be publicly used without validation.
- `stops_for_network` and `routes_for_networks` enumerate a selected network;
  the latter accepts one to 20 IDs and can include itineraries.  `search_stops`
  searches names or stop codes only among feeds serving the supplied coordinate
  area, returns at most 50 results, and can merge nearby similar platforms.
  `nearby_stops` and `nearby_routes` are suitable for coordinate-first checks;
  the latter's radius is capped at 1,500 metres.
- `route_details` can supply a route's shape and itineraries, while
  `trip_details` supplies an entire trip's scheduled stops.  A
  `trip_search_key` changes frequently as underlying GTFS feeds change and
  must be refetched before reuse, so it is unsuitable as persistent route
  identity.

Use these responses to report missing stations, station-name/code/location
mismatches, route-direction coverage, platform/interchange grouping, and
operator-feed discrepancies.  Do not copy them wholesale into TransitRail's
official station menu or use them as proof that the operator publishes a
searchable timetable.  See [available networks](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/available_networks),
[network routes](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/routes_for_networks),
[network stops](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/stops_for_network),
and [stop search](https://api-doc.transitapp.com/v4.html#tag/default/GET/v4/public/search_stops).

## Runtime coverage gate: `available_networks` is mandatory

Do not maintain a hard-coded statement that Transit covers a country, city, or
operator.  The documented source of truth for Transit availability is the
runtime `available_networks` response; an API key alone establishes nothing.
Every Transit-powered request should use this sequence:

1. Resolve the selected TransitRail station/location to coordinates from the
   existing official/static catalogue.  Call `available_networks` with both
   `lat` and `lon` (and use `country_code` as a narrowing filter where known).
   A country-only query is insufficient for a cross-border or regional
   network: the location-filtered response establishes whether the network
   serves this journey endpoint.
2. Intersect the returned network IDs with the desired feature.  Use only the
   normal response for user features; do not silently enable the API's
   `include_all_networks` preview/school-bus candidates, and exclude any
   `network_in_beta` candidate unless it has separately been validated.  An
   empty result means no Transit feature is offered for that endpoint, not
   “no transit service”.
3. Resolve a real global stop ID only through a location-scoped
   `nearby_stops` or `search_stops` call (and, when necessary,
   `stops_for_network`), then confirm it belongs to one of the runtime network
   IDs.  Never map by station name alone across markets or persist a guessed
   global identifier.
4. Pass only those verified runtime IDs to `stop_departures`,
   `alerts_for_networks`, `routes_for_networks`, or `plan`'s
   `allowed_networks`.  Refresh the discovery when a request is made or after
   a short cache TTL; refetch a `trip_search_key` for every subsequent trip
   detail request as the API requires.

For a scheduled QA job, record a coverage snapshot per project station:
coordinate, query time, returned network IDs/names, matched stops, and route
IDs.  Compare it with TransitRail's catalogue and official scraper coverage,
then publish only an internal audit report.  A Transit match is a lead for
finding an official source, never a basis for changing source provenance.

## Safe additions versus prohibited replacements

| Feature / endpoint group | Safe addition across countries | Prohibited use |
| --- | --- | --- |
| `schedule_for_dates`, `trips_for_dates`, `trip_details` | On-demand, clearly attributed schedule comparison; discrepancy/coverage QA | Fill empty official `results`; save as verified departures; create SEO timetable pages |
| `plan`, `estimate_plan_duration` | Separate full-journey, transfers, walk/pathway, accessibility and multimodal planner | Replace TransitRail transfer chaining or calculate authoritative departure/transfer times |
| `stop_departures`, `nearby_routes`, `latest_update_for_network` | Short-lived live-departure card and freshness/quality monitoring | Overwrite stored official times, mark cancellations, or claim future-date service |
| `alerts_for_networks` | Attributed disruption card and operational monitoring | Suppress/change official routes or departures without operator confirmation |
| `available_networks`, `nearby_stops`, `search_stops`, `stops_for_network`, `routes_for_networks`, `route_details` | Runtime coverage gate; station/route/platform mapping audit; internal source-discovery leads | Treat a listed network/stop as an official source; bulk-replace TransitRail station data or source registry |

The central product rule is unchanged: all Transit API content must remain in
a provider-separated, non-indexable response/UI path, carry Transit attribution
and retrieval time, and never cross the `sourceMeta` / scraped-results
boundary.
