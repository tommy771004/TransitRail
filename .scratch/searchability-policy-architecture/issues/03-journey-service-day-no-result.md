# 03 — Apply Searchability policy to journey service days and no-result reasons

**What to build:** When a passenger searches for a Journey, the response uses the Searchability policy for service-day eligibility and explains why no answer is available. Direct and transfer searches must report the same truth mode and rejection reason for the same source facts.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** ready-for-agent

- [ ] Future-date and unsupported-date searches return the policy’s explicit reason rather than a generic empty response.
- [ ] A route with no searchable service-day data returns a distinguishable no-result reason.
- [ ] Direct and transfer Journeys use the same service-day and truth-mode decision.
- [ ] Search responses preserve provenance and truth mode for successful Journeys.
- [ ] Existing journey result shapes remain compatible for verified routes.
