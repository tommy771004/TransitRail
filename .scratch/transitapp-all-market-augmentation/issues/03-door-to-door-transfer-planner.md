# 03 — Add an isolated door-to-door transfer planner

**What to build:** Let a user explicitly request a Transit App door-to-door route suggestion for a selected origin and destination. Render walking, transfer, accessibility, pathway, fare, and alert details when supplied, but keep the suggestion outside the verified timetable and exact-service-day search contracts.

**Blocked by:** Ticket 01 — planner calls must only use resolved, runtime third-party stop/network identities.

**Status:** ready-for-agent

- [ ] The result page provides a deliberate user action to request a third-party journey suggestion; it must not make planner calls automatically as part of timetable search.
- [ ] A dedicated server endpoint validates origin, destination, optional accessibility preferences, and input bounds before calling Transit App; it returns a typed plan or an explicit supplementary-data status.
- [ ] The presentation identifies the content as a third-party route suggestion and shows its freshness/availability context; it does not label any planner departure as a verified TransitRail timetable departure.
- [ ] Walking, transfer, and pathway instructions remain plan details. Existing Journey/Trip verified-timetable fields, transfer calculation, source attribution, and search rank are not repurposed or mutated.
- [ ] Fares, shared mobility, alerts, or accessibility fields are displayed only when provided and are omitted gracefully when unavailable.
- [ ] Uncovered endpoints, API rejection, no suggested route, malformed provider payload, and missing key each result in clear recoverable feedback without erasing the existing search result.
- [ ] Tests cover direct and multi-leg plans, walking/transfer detail, accessibility preference forwarding, optional fare/alert fields, each unavailable state, and proof that planner output cannot enter scraped data or SEO/publication inputs.
- [ ] The repository lint gate passes.
