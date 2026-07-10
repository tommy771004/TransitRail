# Transfer catalog audit

Tags: transfers, station-catalog, data-quality, ux
Category: reference
Last reviewed: 2026-07-10

## Matching rule

Station-specific exit and walking guidance must only match an exact catalog name or an explicitly curated alias. Do not use partial-name matching: it incorrectly maps stations such as `Seoul Nat'l Univ.` to Seoul Station and `Genève-Aéroport` to Genève.

The current alias set aligns German English/German station names, Korean KTX catalog names, Heathrow spelling variants, and MyRapid station-code labels. Malaysia remains governed by [[malaysia-interchange-data]].

## Coverage boundary

The transfer catalog is not a network-wide schedule source. A result with multiple legs now always presents the two services involved at its transfer point; this is derived from the actual returned journey and is labelled as result-based guidance, not a station-specific walking or exit instruction.

Known stale entries must not be treated as live coverage:

- The US product scope is Boston MBTA, while older catalog entries describe New York stations.
- China airport/Shanghai metro entries and France CDG entry are not in the current searchable station catalogs.
- Add station-specific guidance only with an official source, a canonical station name/alias, and an explicit connection type.

## Next audit

Prioritize Boston MBTA interchanges and the existing Singapore, Hong Kong, Korea, Japan, Germany, France, and China line-catalog intersections. Verify each with an official operator source before adding exit, walking, or platform claims.
