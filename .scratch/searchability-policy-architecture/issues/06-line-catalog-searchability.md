# 06 — Align line catalog with searchable routes

**What to build:** Line discovery reflects the same searchable routes and provenance as Journey search and station discovery. A line without a policy-permitted timetable is not presented as an available searchable line, and unavailable coverage is explained consistently.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract; 05 — Filter the station catalog by service day and origin.

**Status:** ready-for-agent

- [ ] Lines are filtered using the same country, service-day, provenance, and truth-mode rules as stations.
- [ ] A line shown in discovery has at least one policy-permitted searchable route in the relevant context.
- [ ] A country with no searchable lines returns a useful unavailable explanation instead of a misleading empty catalog.
- [ ] Live and static line sources produce the same externally visible catalog contract.
- [ ] A line selected from discovery does not expose route combinations rejected by the Searchability policy.
