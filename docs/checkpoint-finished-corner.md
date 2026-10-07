# Finished corner: material identity and readable art

Baseline: post-304 main, `1de7a198679157dde52ba992a571cc8178b352ff`.
This pass replaces the repeated reflection experiments with a coherent shop material treatment.
It does **not** claim the reference image has been reached.

## Findings and changes

The shop and its neighbors shared too much grey-blue with the street and roofs. Individual props
were more convincing than the architecture behind them. Increasing light strength would have
made the same flat surfaces brighter. The storefront also bypassed the architectural art
prefilter: direct reduction of a large glyph mask broke the sign into dots.

- One new, neutral Picasso wall field: old ivory plaster over bottle-green ceramic tiles. It
  wraps the shopfront and its composed return face, at **2.0625 × 2.75 m** per repeat. It is drawn
  before the existing openings, not baked into a replacement building sprite. The windows'
  risers retain the ceramic field rather than covering it with flat blue panels.
- A burgundy fascia, an aged stone coping, and a projecting lintel with a soffit, top ledge and
  contact shade. The window recess deepens from 12 to 18 cm, inside the existing face clip.
- The entrance sign grows from 1.9 to 2.9 m, still before the first window, with 0.62 m square
  glyph cells. The sign and blade, window interiors and wear now use the existing cached
  prefilter. Return-face art and the service sign also filter for their actual drawing size.
- Commercial roof fields are quieter. Rooftop units, their footprints, the camera and all
  lighting settings stay as they were. The reflection pilot remains `skip` by default.

`shopFinish.ts` owns only the material field and lintel drawing. Both elevations use it;
cutaway pieces retain their parent clip. All additions go through the existing building
albedo/light/glow lifecycle, fade and depth ordering. There is no scene recipe revision,
new collidable object, persistence migration or per-frame effect.

## Artwork and reproduction

Source: `src/assets/creator/storefront-wall-finish.png` (1086 × 1448, original generated file).
Guide: `docs/finished-corner/wall-layout.png` (768 × 1024).
Runtime: `public/images/storefront/wall-finish.webp` (384 × 512, approximately 50 KB).
Rebuild: `bun tools/art/shop-finish.ts`. The importer checks the guide's aspect ratio. The
source is excluded by the existing `storefront-*.png` creator-art glob.

Commission: edit the attached guide into a flat, orthographic 3:4 shop wall field, representing
2.0625 × 2.75 m. Upper two-thirds: weathered warm ivory lime plaster, fine trowel texture,
restrained chips, hairline cracks and rain wear. Lower third: dark bottle-green ceramic subway
tile, thin charcoal grout, subtle glaze variation and splash dirt. Thin dado cap at the boundary.
Fill the frame, repeat horizontally, use even neutral albedo light. No openings, lettering,
fixtures, perspective, night grade, glow, cast shadows, border or ground. Match the grounded,
painterly material finish of the existing street props. The returned tile pitch is approximately
34 × 15 cm; it is a material texture, not a guide for placing openings. Code owns all geometry.

## Validation

- **4,053 tests pass**, including the new regression for filtered wall art in the albedo only,
  with retained-face clipping and an unchanged serialized environment. Existing painting tests
  now trace prefiltered source ancestry instead of incorrectly requiring the original image.
- Typecheck, production build and lint of changed TypeScript files pass.
- Real Chrome review of seeds 7, 8 and 0; matched before/after captures from two separate
  worktrees at the same browser size and camera. No generated image is used as scene evidence.
- Seed 7: normal play, cutaway, mixed damage, clear and blocked targeting. The lookout remains
  blocked by the sedan engine block. Save the mixed fixture, switch to garage, then load:
  the frozen intersection and all nine destroyed cover sections return.
- Lights-off remains a real unlit view. The cart's painted bulb is an existing exception.
- No actual campaign turn, database save or movement animation was exercised in this review.
  The fixture checks do not substitute for that. No new performance benchmark was run: there
  is one small runtime image and cached reductions, with no extra frame-time lighting passes.

Evidence and exact URLs: [finished-corner/README.md](evidence/finished-corner/README.md).

## Visual judgment and remaining work

The sign is visibly stronger and continuous, the shop reads as a distinct business, the lower
wall has a material scale, and the roof fields recede. This is easier to see in the matched
close-ups; the normal-play pair deliberately exposes the smaller gain when the building fades
behind actors. That distinction matters: this is a better architectural finish, not reference-level
visual acceptance for the whole intersection.

The remaining gap is strongest in the surrounding buildings' broad planar surfaces, repeated
roof equipment and the street's limited large-scale wear. The reference also has richer building
silhouettes and a tighter street-level composition. Do not obscure that gap with another glow
or reflection adjustment. The next art pass should give a second complete frontage a contrasting
architectural identity and compare the whole street at normal play scale. Keep current entrances,
footprints and core activity groups authoritative. Revisit reflections only after the dry scene
holds up on its own.
