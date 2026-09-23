# UI conventions

The general conventions in [CLAUDE.md](../../CLAUDE.md) still apply; this file carries the rules
for building surfaces.

## Material 3, structure only

`src/index.css` carries the M3 layer — shape, elevation, motion, type scale, state layers, and
component metrics, all as `m3-*` classes. Every colour still comes from the existing
slate/country-accent utilities; M3 contributes no palette.

Build new surfaces from those classes rather than new one-off radii, shadows, or font sizes. A
Tailwind utility on the same element still wins over the `m3-*` class, so drop the utility a
component is meant to inherit from `m3-*`.

`npm run check:ui` is the Material 3 browser smoke check.

## Result cards

Every market renders departures through `src/components/ResultList.tsx` and
`src/components/TripCard.tsx`; the four country views only supply the header and their
market extras (seat preference, amenities, the Korea filter rail, the Metro headsign).
Do not add a second card layout to a view. Tapping a card opens `TripDetails`, which is
always a `TripSheet` (a portal on `<body>`, so a `layout`-animated card can never pin it);
the card owns `open` / `onOpenChange`. Save, map and the market's primary action live in the
sheet; the next departure alone repeats the primary action in a slim row under its card.

The card's first line is a status row: the next badge, a countdown on every departure within
the hour (only when the searched day is today on the market clock), platform, live status,
then duration and fare. It wraps rather than clips and is omitted when empty. A realtime flag
without a provider status is neutral slate, never green, and a delay replaces the countdown.

Layout invariants the card keeps, so nothing overlaps or leaves the card:

- Times, duration, fare, badges and buttons are `shrink-0` / `whitespace-nowrap`; only
  station text (`truncate` or `line-clamp-2`) gives way.
- The route band sits in a `minmax(0,1fr)` column and hides a segment label under 16%.
- The card is `overflow-hidden`; the sheet body scrolls inside `max-h-[85dvh]`.

