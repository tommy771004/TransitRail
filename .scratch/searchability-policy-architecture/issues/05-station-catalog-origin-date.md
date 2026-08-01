# 05 — Filter the station catalog by service day and origin

**What to build:** The Station and line catalog exposes only stations that the passenger can search for the selected country, service day, and origin. Selecting an origin narrows destinations to the reachable set described by the Searchability policy.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** ready-for-agent

- [ ] Station discovery accepts the selected service day and origin search context.
- [ ] Unsearchable stations are absent from the relevant catalog result or carry the policy’s unavailable explanation.
- [ ] Destination options are restricted to the origin-conditioned reachable set.
- [ ] Station provenance and truth mode remain available wherever they affect user trust.
- [ ] A station chosen from the catalog produces a journey search that uses the same policy decision.
