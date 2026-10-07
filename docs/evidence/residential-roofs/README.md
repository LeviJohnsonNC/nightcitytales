# Residential roof browser evidence

Actual connected-Chrome captures of the local shared shipping renderer.
JPEG derivatives of untouched PNG screenshots, without compositing or recolouring.

- `seed7-play-before/after`: ordinary play camera, actors, night, lights on;
  matched 682 × 660 viewport and page scroll.
- `seed7-roof-neutral-before/after`: scenery only, `night=0`,
  `cam=-290,-160,1.4`; matched 682 × 660 viewport and page scroll.
- `seed{0,7,8}-lights-off-after`: ordinary play camera, local lights off.
- `seed{0,7,8}-reveal-after`: ordinary play camera, reveal on.
- `seed0-play-after`, `seed8-play-after`: alternate placements, ordinary play.
- `seed7-overview-before`: initial 1382 × 766 overview before the browser resized;
  context only, not a matched comparison.

Normal play can crop the rear roof or fade a foreground building. The seed-7
neutral inspection exposes the full home roof. Controls can scroll into view
when toggled, so lights-off images have different page scroll from play images.
Reflections are off/not built throughout. See `../../checkpoint-residential-roofs.md`
for critique and validation limits.
