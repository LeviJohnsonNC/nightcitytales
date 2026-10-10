# Night City Tales — approved painted architecture

2026-10-10. Levi approved the generated full-screen paint-over and authorized production integration.

## Checkout and publication

- Active isolated checkout: ../city-block-painted; branch codex/painted-architecture.
- Base main cf9c575616157a021478f7ded621542216105dae, tree 669242aadb09225f964dac4602282b7a055b502a.
- PR332 verified merged. Base includes shopping PR345. Do not merge on Levi's behalf.
- Publish using GitHub blob/tree/commit/update_ref with expected-head lease, NEVER git push.
- Original city-block-recovery checkout and its dirty cityBlock.ts/untracked tests/recovery files untouched.

## Implemented

- Three generated two-panel atlases: market/repair upper bays, trading-floor surrounds, masonry/canopy.
- Source WebP masters in src/assets/creator/painted-architecture; original PNGs retained locally (ignored).
- Importer tools/art/painted-architecture.ts builds seven optimized runtime WebPs.
- paintedArchitecture.ts maps nine image regions to exact existing opening bounds; separate interiors remain clear.
- Upper commercial elevations now carry painted masonry, joinery and dim rooms; same clipped full/reveal painter.
- Market front AND return faces use painted surrounds, a stocked interior and solid teal canvas canopy.
- Repair surrounds retain Levi's bench/parts art. Small service buildings receive measured masonry.
- Existing footprint/collision, entrance, roof/canopy geometry and actors remain unchanged.
- Upper-window emission halved for painted kit to keep street shops dominant. Existing restrained reflections retained.

## Verification

- Typecheck passed; 49 focused tests initially passed, expanded set underway after return-face integration.
- Lint passed (13 existing warnings, zero errors); production build passed before last return-face/light refinement.
- Local Vite on 127.0.0.1:5175 works. Restart after adding public images (Vite cached public-file index).
- Local Playwright Chromium launch blocked by macOS MachPort permission; no test screenshots from that attempt.
- Connected Chrome native screenshot confirmed fallback images before restart; not evidence of new kit.
- Isolated in-app browser tab 1 now shows actual new brick/render/canopy pixels. Seed8 partial play capture inspected.
- Need final seed8 full/reveal and seed0 pixels; CI and matched visual workflow still required.
- Do not claim reference parity or automated visual pass until actual captures inspected.

## Art reference

- Approved concept: ../generated_images/exec-8fe0a16b-631d-449b-b648-48a78e5c7071.png
- User source reference: ../art-reference/image.png (actual pixels opened).
- Generated source PNGs and WebP masters are reproducible via importer; runtime art is projection-aware, not a backdrop.
