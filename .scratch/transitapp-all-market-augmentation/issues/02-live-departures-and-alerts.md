# 02 — Show labelled Transit App live departures and alerts

**What to build:** Add a clearly labelled, on-demand third-party live-transit card beneath the search result. For stations proven covered by ticket 01, it shows current departures and alerts with data freshness; for every other state it gives an honest, non-empty explanation. It must remain visually and semantically separate from TransitRail’s verified timetable.

**Blocked by:** Ticket 01 — it supplies the safe station-to-network resolution contract.

**Status:** ready-for-agent

- [ ] The card loads only after a user has selected or viewed the relevant result, using a dedicated supplementary-data endpoint rather than the existing timetable-search endpoint.
- [ ] The response distinguishes `available`, `uncovered`, `unavailable`, `empty-live-data`, and `error`; each status has a user-facing explanation and never implies that trains are not running.
- [ ] Available live content displays a conspicuous “Third-party live data” label, source/provider identity, last-updated/freshness value, and a time-zone-safe presentation of departures.
- [ ] Departures may show cancellation or terminal information only when the provider supplied it; missing optional fields do not fabricate or hide the rest of the card.
- [ ] Alerts are rendered as separately attributable third-party advisories and do not merge into existing official situations or alter verified-route status.
- [ ] The card does not modify the requested service day, `results`, source metadata, official-source links, no-verified-timetable message, or route-publication/SEO eligibility.
- [ ] API and UI integration tests cover a live departure with alert, empty provider data, uncovered station, no configured key, upstream error, stale/unknown freshness, and a normal verified search result alongside the card.
- [ ] The repository lint gate passes.
