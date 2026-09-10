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
