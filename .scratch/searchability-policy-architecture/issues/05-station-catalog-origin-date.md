# 05 — Filter the station catalog by service day and origin

**What to build:** The Station and line catalog exposes only stations that the passenger can search for the selected country, service day, and origin. Selecting an origin narrows destinations to the reachable set described by the Searchability policy.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract.

**Status:** resolved

**驗證（2026-08-02）：** getStationsForCountry 接受 date 與 origin；韓國 280 站依日期收斂，選定 Gangnam 後終點收斂為 269 站。

- [x] Station discovery accepts the selected service day and origin search context.
- [x] Unsearchable stations are absent from the relevant catalog result or carry the policy’s unavailable explanation.
- [x] Destination options are restricted to the origin-conditioned reachable set.
- [x] Station provenance and truth mode remain available wherever they affect user trust.
- [x] A station chosen from the catalog produces a journey search that uses the same policy decision.
