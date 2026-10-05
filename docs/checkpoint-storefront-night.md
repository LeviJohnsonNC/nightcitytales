# Checkpoint: the seed-7 corner at night

**Scope:** the benchmark storefront of intersection seed 7 (`building_0`, its saved entrance, awning and
streetlight), plus the night every intersection now has. No other shopfront gets the storefront treatment. No new
generated art. **This is not claimed to match the reference.** It is evidence for review, and it stops here.

## What changed

- **Night is a tint, not an overlay.** `courtyard/nightLighting.ts` holds one config, `INTERSECTION_NIGHT`. Its
  cool `ambient` is a Phaser tint on the scene's own sprites: ground, buildings, cutaways, dressing, props and
  people. Grid, shot lines, labels, rings and the HUD are not tinted, so they keep their colour. `nightFor` turns
  night on only for the composed intersection. The six other environments render pixel-identically to `main`
  with no actors on screen. With actors on screen, the only differences are the characters' idle breathing
  frames, which depend on capture timing.
- **Light is its own sprite, attached to its surface.** Every storefront painter takes a `Pass`:
  - `albedo` is the art.
  - `light` is light falling on a surface. The renderer multiplies it by that surface's own albedo, clips it to
    the surface's pixels, and applies `gain` (×2.6). A pool therefore shows the paving's texture rather than
    covering it.
  - `glow` is light a surface gives off (window glass, neon, the lamp's lens). It is added as it is.

  Each surface's light becomes an additive companion sprite. Every frame, that sprite copies its parent's
  visibility, alpha and depth (+0.5). It therefore hides, fades and sorts with its wall, awning or lamp. A light
  cannot show on a hidden cutaway piece, and cannot come loose while panning, zooming or fading.

- **People and props stand in the same light.** `lightAt` reads the same `GroundLight` list the ground's light
  sprite is painted from. It returns zero inside any building footprint, so no light passes through walls. Units
  and props are tinted `ambient + light × gain`, capped at the art's own colour.
- **Lights off keeps the night.** `lights=0` hides only the light sprites; the ambient stays. `night=0` is a
  neutral inspection mode that shows the materials untinted. The Night and Lights toggles in `/scene-review` now
  also work with characters shown, and they switch live without a remount.
- **The streetlight.** It keeps its saved ground position (`shop_lamp_detail_0`).
  - It is drawn as a footing, a tapered 5.6 m pole with a lit edge, an arm curving out over the pavement, and a
    flat cobra head.
  - The bright lens is a small sliver with a tight halo. A faint cone falls to a pool centred under the head.
  - `streetLamp()` gives the head's position to the painter, the pool and the wall and awning wash alike, so the
    halo cannot move independently of its source.
  - It sorts at its saved base: in front of the parked car, behind the awning.
- **Storefront identity with reveal on.**
  - The windows facing the street (`litBays`) have lit rooms and throw a warm spill.
  - The three bays on the wall that `building_0_middle` stands against stay dark and throw nothing. They are still
    painted, but their room faces a neighbour.
  - A downlight under the shutter housing pools at the door.
  - The valance is now 0.32 m deep. It carries a dark lightbox strip with 深夜市場 in neon, which is the one sign
    the cutaway keeps. Its glyphs are about 9 px at play zoom and legible close up.
  - The fascia sign is unchanged and is not floated.
  - The awning and storefront are drawn at higher texture density (×4 and ×3) so the lettering survives.
- **Contact shading.** The wall-foot strip is now 0.8 m deep and starts at 0.62 alpha. The awning's shadow on the
  pavement and the roof shade around rooftop units are stronger.
- **Reproducible framing.**
  - `/scene-review` takes `cam=x,y,zoom` (passed as `initialCamera` to the shipping `CombatBoard`) and
    `player=x,y`, which only moves the review fixture's character.
  - `tools/scenes/storefront-night.mjs` captures a fixed framing: the storefront, the pavement beside it and the
    edge of the crossing. The character is about 62 px tall, close to the reference's.

## Evidence (unedited browser captures, `docs/evidence/storefront-night/`)

The corner framing is `cam=-10,115,2.2&player=30.3,1.6`.

| View                    | Reveal on                                                                            | Reveal off                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Lights on               | [corner-reveal](evidence/storefront-night/corner-reveal.jpg)                         | [corner-solid](evidence/storefront-night/corner-solid.jpg)                         |
| Lights off (same night) | [corner-reveal-lights-off](evidence/storefront-night/corner-reveal-lights-off.jpg)   | [corner-solid-lights-off](evidence/storefront-night/corner-solid-lights-off.jpg)   |
| Neutral (`night=0`)     | [corner-reveal-neutral](evidence/storefront-night/corner-reveal-neutral.jpg)         | [corner-solid-neutral](evidence/storefront-night/corner-solid-neutral.jpg)         |
| Overlays hidden         | [corner-reveal-no-overlays](evidence/storefront-night/corner-reveal-no-overlays.jpg) | [corner-solid-no-overlays](evidence/storefront-night/corner-solid-no-overlays.jpg) |

- Close-ups (`cam=-30,140,4.5`):
  - [reveal](evidence/storefront-night/closeup-reveal.jpg)
  - [solid](evidence/storefront-night/closeup-solid.jpg)
  - [reveal, lights off](evidence/storefront-night/closeup-reveal-lights-off.jpg)
- Cover destroyed: [corner-reveal-damaged](evidence/storefront-night/corner-reveal-damaged.jpg).
- Overview:
  - [solid](evidence/storefront-night/overview-solid.jpg)
  - [reveal](evidence/storefront-night/overview-reveal.jpg)
  - [seeds 1, 4, 12, 0](evidence/storefront-night/other-seeds-reveal.jpg)
- Against the reference, at the same character size:
  [reference-comparison](evidence/storefront-night/reference-comparison.jpg).

"Overlays hidden" hides the tactical SVG layer with a capture-only stylesheet. The art is untouched.

## Honest critique against the reference

- **What now works.**
  - The shop is the warm focal point of the corner and of the overview.
  - Lit and unlit read apart at play zoom: the pool, the window spill and the entrance pool against a cool,
    still-legible ambient.
  - The cart and the character visibly pick up the light they stand in.
  - The lamp has a pole, an arm and a pool, and lights-off keeps the night.
- **The reference is still far ahead.**
  - It has wet, reflective pavement and broad atmospheric glow, both deferred by the brief.
  - It has much denser props and signage.
  - It has multi-storey facades whose walls carry lit windows and neon at height. Here the cutaway leaves 2.4 m
    pieces.
  - Its warm and cool light are separated more strongly.
  - Here the pavement is still flat paint under a tint, and the asphalt has no sheen.
- **The streetlight still sits over the parked car.** The saved lamp is 0.6 m off the shop's west corner, and the
  car at (18–20, 6–10) is directly behind it from this camera. At any plausible height, the head lands over the
  car's bonnet. The pole, arm, cone and pool now make it read as a streetlight rather than a headlight, but the
  overlap remains. The real fix is a lamp position: a recipe change, which this pass does not make.
- **Fading still governs the solid view.** With the review fixture's workers behind the shop, the whole building
  fades to 40% as gameplay requires. The fascia sign and lit windows fade with it, by design.
- **Cutaways still dominate with reveal on.** The shop's and `building_0_middle`'s interiors are large dark slabs.
  - A lighter, hatched slab was tried: [trial-cutaway-lighter-slab](evidence/storefront-night/trial-cutaway-lighter-slab.jpg)
    against [the current one](evidence/storefront-night/corner-reveal-no-overlays.jpg).
  - Under the night ambient it barely differs, and a lighter slab starts to read as walkable ground. It was not
    kept.
  - Proposed separate treatment, to be decided first: draw a hidden building's footprint as a roof-coloured
    outline with a thin parapet line and no fill beyond a low-contrast hatch. It would read as "a building is
    here" rather than as a floor. This needs its own pass with comparison captures.
- **Lettering is small.** At play zoom, the valance sign is a readable pink band and not readable as text.
  Legibility needs the close-up.
- **Tuned by eye in one renderer** (SwiftShader in headless Chromium). The ambient, gain and intensities live in
  `INTERSECTION_NIGHT` so they can be tuned from play.

## Not changed

Geometry, collision, cover, entrances, targeting, damage and campaign behaviour are unchanged; nothing here is
saved. Recipe revision 7 and its lamp position are unchanged. Other environments are unchanged. Wet reflections
and bloom remain deferred.
