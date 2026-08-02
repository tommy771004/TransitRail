# 06 — Align line catalog with searchable routes

**What to build:** Line discovery reflects the same searchable routes and provenance as Journey search and station discovery. A line without a policy-permitted timetable is not presented as an available searchable line, and unavailable coverage is explained consistently.

**Blocked by:** 02 — Establish the Searchability policy truth-mode contract; 05 — Filter the station catalog by service day and origin.

**Status:** resolved

**驗證（2026-08-02）：** 新加坡線清單為 0（無可驗證班表）；韓國 12 條線實測每條都至少有一組可搜尋路線。

- [x] Lines are filtered using the same country, service-day, provenance, and truth-mode rules as stations.
- [x] A line shown in discovery has at least one policy-permitted searchable route in the relevant context.
- [x] A country with no searchable lines returns a useful unavailable explanation instead of a misleading empty catalog.
- [x] Live and static line sources produce the same externally visible catalog contract.
- [x] A line selected from discovery does not expose route combinations rejected by the Searchability policy.
