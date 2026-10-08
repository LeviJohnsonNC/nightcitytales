# Night Market After Rain — production asset pack

The seven returned paintings are now integrated. See `../checkpoint-night-market-after-rain.md` for implementation and verification. The material below preserves the original production handoff for **one substantial intersection milestone**. Seven images make five fixtures; the mast and transit display each need two camera orientations. The car, food cart, planters, shop interior and occupied-window paintings already in the game are retained.

## Generate these first

1. **signal-r0** — the most distinctive new street silhouette.
2. **transit-r0** — the cyan counterpoint to the amber market.
3. **repair-shutter** — a real, weathered repair-business entrance.
4. **residential-door** — an occupied entrance with depth behind its glass.
5. **market-services** — the small-scale wall construction detail missing above the market.
6. **signal-r90**, then **transit-r90** — use the accepted first orientation as the design reference, and the second orientation's layout for geometry.

For every generation, attach **that asset's `-layout.png`** plus **`style-reference.jpg`**. Use the common prompt below followed by its asset-specific paragraph. Do not attach the contact sheet or annotated version as the geometry source: those are for inspection. Return individual PNGs at 1024 × 1536, named exactly `signal-r0.png`, etc. No contact sheets or tightly cropped outputs.

### Common prompt (paste before each asset paragraph)

> Create a finished production game asset by painting over the attached layout guide. The second attached image is a STYLE reference only: richly detailed, grounded, realistic painted materials for an isometric cyberpunk street. Preserve the layout image's exact canvas, silhouette, ground anchor, proportions, openings, and orientation. Replace the flat guide colours with convincing constructed material; do not redesign the object or move its parts. Edges must be clear enough to read when the object is reduced to approximately 100 pixels tall. Use broad readable forms with fine detail supporting them. Aged, maintained and used, not an abandoned ruin. Neutral diffuse studio illumination, soft local crevice shading, no cast shadow outside the object, no coloured environmental light, no bloom, no fog, no rain streaks, no puddle or ground, no people. Do not include dimension lines, labels, orange ground-anchor marks or the guide background. Output one asset on a transparent background, exactly 1024 × 1536, with the same placement and margins as the guide. Do not add any objects outside its envelope. For signal and transit assets, keep the guide's orthographic isometric projection, 30-degree ground axes and vertical verticals, with no perspective convergence. For the shutter, door and wall service assembly, keep the guide's flat straight-on elevation: the game will project it onto the correct wall.

### signal-r0 / signal-r90

> A substantial municipal traffic-signal mast for Night City's older commercial district. Aged dark bronze-green steel, bolted cast base, visible collars, restrained pale metal wear on exposed edges, weathered ochre signal backplates, black recessed lens hoods and cable joints. Two three-lens signal heads hang exactly where shown on the arm. The small streetlight remains on the opposite short arm. Red, amber and green lenses are coloured glass with no bloom; make the upper red lens the active-looking lens while preserving detail. Retain every signal head, support cable, mast and light housing in the guide. The arm is a rigid tube, not a thin wire. No lettering, flags, additional signs or cables extending beyond the guide. The second orientation must be the SAME physical fixture, same colour and construction, rotated to match its own guide.

### transit-r0 / transit-r90

> A narrow illuminated transit advertising display on an existing metal post. Substantial dark petrol-blue enamel housing, slim brushed aluminium edge trim, visible side depth, tiny fasteners, bottom service seam, a few restrained scuffs and small old sticker remnants only on the housing. Fill the inset blue rectangle with a clean, memorable cyan and deep-blue futuristic transit poster: a luminous stylized moon crossed by a sweeping orbital route, pale ivory graphic accents. No generated lettering; leave a quiet small band near the top for the game's authored text. Keep the poster inside the inset corners exactly. This is a backlit printed panel, with visible illustration detail, not a white light source. No bloom or glow outside it. Keep the slim post and its existing anchor; do not add a full-width pedestal, kiosk floor or extra street obstacle. The second orientation uses the same housing and same poster, rotated to its guide.

### repair-shutter

> A closed street-level electronics repair shop shutter, exactly following the straight-on guide. Deep petrol-blue painted steel slats with slight bends, softened scratches, brighter rubbed edges near the bottom, grime in the seams, a realistic ribbed coil housing above, steel side guides, mounting screws, narrow end stops and a grounded bottom rail. Carefully restrained old repair-shop sticker residue near one lower corner, without readable text. The centre remains a continuous CLOSED metal shutter, not a window or open garage. No separate neon signs, conduits, surrounding wall, door handles floating outside the assembly, or floor. Paint broad tonal variation so it reads as metal at gameplay size, not uniform blue stripes.

### residential-door

> An older inhabited apartment entrance with a heavy dark olive-green painted door and aged brass hardware. Follow the guide's two glass panels and central mullion exactly. Behind the glass, paint a shallow, dim warm vestibule: tiled wall, a short notice board and the suggestion of mailboxes further inside. Rich interior depth without showing an open path or a person. Glass should remain subdued and textured under neutral studio light; the game will add warm emission through the separate glass mask. Solid lower door panels, rubbed brass pull, dark gasket edges, a worn stone surround, fine joints and a few chips near the threshold. No exterior lantern, steps, flowers, signs, additional wall or ground. Retain the exact closed-door opening and surround dimensions.

### market-services

> A compact wall-mounted service assembly above a busy night market: cream-painted extractor housing with dark deep louvres, a galvanized vertical duct, an aged upper wall bracket, a small dark service box, and narrow copper/refrigerant pipe exactly following the guide. Detailed screws, folded sheet-metal seams, mounting feet and drip streaks on the equipment itself. Slight grease around the extractor, verdigris only on old copper, no overwhelming rust. Paint useful depth within these shallow volumes using local crevice shadows. Transparent open spaces between the components, no wall painted behind them, no wires extending outside the envelope, no lamp, light emission, text or extra equipment. Straight-on elevation, no isometric skew: the game projects this assembly onto the masonry pier.

## Emission and integration

The five `-emission-guide.png` files identify the display panels, active signal lenses and residential glass. They are **registration guides**, not final painted light textures. Do not generate a second unregistered glowing version of an asset. After returned art is accepted, the integration step will align the masks to the actual art, preserve mullions and lens hoods, and generate source-coloured emission separately from the albedo. Dark hardware and walls must never emit.

The repair shutter and market service assembly emit no light. Their illumination comes from separately placed fixtures. Reflections must use the same accepted light sources, rather than reflecting an entire lit wall.

## Acceptance before import

- Full object fits the original canvas and matches the anchor; no accidental cropping.
- 30-degree orthographic signal/display views; completely front-on facade components.
- No baked ground, cast shadow, bloom or coloured environmental wash.
- Closed door/shutter preserve the saved entrance geometry.
- Coherent materials and design between orientations.
- Inspect at 1024 px AND about 100–180 px high: readable silhouette, material and focal detail.
- Check transparency around thin mast supports, pipes and display post against both black and white.
- Keep original returned files unchanged; derivatives and registration are separate reproducible outputs.

## Historical prototype (superseded by integrated milestone)

The initial working branch had procedural placeholders for the signal and display at existing dressing anchors, warm commercial upper windows, cooler workshop finish and entrance lighting, and a cached wet-surface experiment. The prototype is **not visually accepted or ready to merge**. It exists to establish the physical sizes and test the scene composition before fitting the finished paintings.

Remaining integration: painted asset loading/registration, safe wall-pier placement for the market assembly, complete cutaway consistency, correct fixture light heights, source-shaped reflections and damage/reveal checks. Seed 8 is the showcase; seeds 0 and 7, compact view, lights-off, targeting and route previews are the required checks. No finished-scene or performance claim is made from these asset guides.

Regenerate the guides with `bun tools/art/after-rain-guides.ts`. Runtime dimensions for signal/display guides come from `CITY_FIXTURES`; the face-plane dimensions follow the existing 1.6 × 2.2 m entrance assembly. The runtime applies the projection; generated pixels do not change movement, cover or saved geometry.
