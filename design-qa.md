# Route Card Density Design QA

- Source visual truth: `/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/codex-clipboard-2206b525-976e-4a12-bc70-080964aea76e.png`
- Implementation screenshot: Codex in-app Browser capture of `http://localhost:3000/zh/routes/`
- Viewport: 513 × 1037 CSS px, dark color scheme, Chinese route directory, overview collapsed
- Source pixels: 378 × 181 px
- Implementation pixels: 513 × 1037 px
- Density normalization: both captures were reviewed at their native 1× presentation; the source is a focused component crop, so the route card region was compared rather than scaling the full page into the crop.

## Full-view comparison evidence

The reference crop and the browser-rendered directory were opened together in one comparison. The implementation preserves the existing page hierarchy and country section while replacing the tall route cards with compact rows. The resulting page shows materially more routes above the fold without changing the navigation, filters, or section structure.

## Focused region comparison evidence

The first Korean route card was compared directly with the reference. Both use one horizontal row for the station pair and timetable action. The implementation reduces each card to a 3.2rem minimum height with 0.65rem vertical padding and a 0.5rem list gap. The station arrow and action retain the existing accent color and the timetable action remains anchored on the right.

## Required fidelity surfaces

- Fonts and typography: existing TransitRail system font, weights, and hierarchy are preserved; the route label and action remain legible at the denser height.
- Spacing and layout rhythm: fixed tall-card whitespace is removed; station and action content align vertically in one row with consistent compact gaps.
- Colors and visual tokens: existing background, border, text, muted text, and accent tokens are unchanged.
- Image quality and asset fidelity: the reference contains no raster imagery, logos, illustrations, or non-standard icons requiring assets.
- Copy and content: station labels, localized timetable text, country headings, and accessible route labels are unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the requested route-card layout.

## Comparison history

- Initial implementation: route stations and timetable action were vertically separated inside a 6.4rem card.
- Fix: changed the route card to a two-column grid, moved the station pair and timetable action onto one row, reduced the minimum height to 3.2rem, and tightened card padding and list gaps.
- Post-fix evidence: the browser capture shows `Bujeon → 清涼里` and `時刻表 ›` on the same row across the visible route list, with no clipping or horizontal overflow.

## Implementation checklist

- [x] Keep station pair and timetable action on the same horizontal row.
- [x] Remove unnecessary vertical whitespace.
- [x] Preserve localized content and accessible link labels.
- [x] Verify the compact layout in the browser.

## Follow-up polish

None required for this scoped change.

final result: passed
