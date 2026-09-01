# Map: always centred, clean art, real coordinates

## 1. The map opens centred on you

The "Centre on me" button works because it runs after the map has been laid out and drawn. The on-open pass runs while the dialog is still animating and the map image has no box yet, so it computes offsets against a zero-size scroll area and gives up.

- On open, reset to a known zoom and mark the view "not yet centred".
- Keep re-running the exact same routine the button calls — on the image's load event, on every resize of the scroll area, and on a short animation-frame retry loop — until it lands, then stop.
- Any pan or zoom by the player cancels the retry so the map never yanks itself back under their finger.
- Verify with a scripted browser run: open the map twice and screenshot to confirm the pulsing marker sits in the middle both times.

## 2. Remove the red code boxes from the map

The red numbered boxes (A1, B12, N6 …) are printed into the atlas map image itself. They are the atlas's own key, and now that the game draws its own markers and dossiers they are just clutter.

- Detect every red label box by colour and shape, then paint it out with the surrounding background so the streets and blocks underneath read cleanly.
- The red dotted district borders stay — they are the only thing on the map showing where one district ends and the next begins, and they are a different shape from the boxes, so the pass leaves them alone.
- Spot-check the cleaned image at full zoom across several districts before it ships; any box that cannot be cleanly removed gets flagged rather than smudged.

## 3. Honest assessment: no, the coordinates are not accurate yet

Straight answer, because you asked for one:

- District pins: all 24 exist, but several were placed by eye from a thumbnail, and five were hand-nudged. They are roughly right, good enough to say "that's Kabuki, up north", not good enough to trust to the block.
- Named locations: only 61 of 156 have any map point at all. The other 95 have no coordinates, so the game falls back to the district pin. If you said "take me to the University District" the game would put you in the right district; if you said "meet me at a specific bar in it", the pin would be generic.
- So today: district-level accuracy is decent, street-level accuracy does not exist.

The fix rides on the same work as item 2. Those red boxes are the atlas's own ground truth: each one marks the exact spot of one numbered location. The same pass that removes them reads them first.

- Segment every red box, read its code, and record its centre as an exact percentage of the map — for all 156, not 61.
- Recompute each district's pin as the centre of its own located places instead of an eyeballed guess.
- Any box whose code cannot be read confidently gets cropped out and checked by eye against the atlas text; anything still unresolved is reported to you as missing, not guessed. Districts with no printed locations (Exec Zone has none) keep a hand-placed pin, explicitly marked as such in the data.
- After this, "walk to the University District" and "go to a named place inside it" both put the pin on the right spot, and travel-time and combat-zone checks read the same coordinates.

## Technical notes

- `src/features/atlas/MapModal.tsx`: extract the centring into one `centreOnMe` used by both the button and an open-time retry driven by `img.onLoad` + `ResizeObserver` + a bounded rAF loop, cancelled on user pan/zoom.
- Image pass: a Python/PIL script over `public/images/map/night-city.jpg` doing HSV masking for the label red, connected components filtered to filled rectangles of label size (excluding the small border dots), OCR of the white glyphs, then background inpainting. Output written as a new image file; the old one is kept until the new one is verified.
- `src/data/atlas/night-city.json`: `locations[].map` filled for every readable code, `districts[].map` recomputed, and the `map` block's declared `width`/`height` corrected to the real pixel size (currently 6600x10218 vs the actual 3600x5573 — harmless because coordinates are percentages, but wrong).
- `src/engine/geography.ts` needs no new API; `src/engine/__tests__/geography.test.ts` gains a coverage assertion that every location has a map point (with an explicit allow-list for any the atlas genuinely does not print).
- Verification: vitest, typecheck, production build, plus a Playwright pass opening the map on a live campaign.
