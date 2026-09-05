# Night Shift courtyard — visual proof

The courtyard now includes the character animation and richer-prop passes.
Open `/combat`, select **Night Shift courtyard**, choose a character/opposition,
and launch. This uses the existing campaign encounter creation and `/play/:id`
turn loop. The harness writes real campaign data, as it did before this change.
Existing encounters on other maps retain the diagram renderer.

## Included

- Phaser 4.2.1, loaded only when this arena is displayed in scenic mode.
- One 24 × 24 metre courtyard with eight destructible cover sections: two cargo
  crates, a generator housing, a dumpster, a concrete roadblock, timber packing,
  and the separately destructible cargo and cab/engine halves of a delivery truck.
  Geometry and materials live in `engine/battlefield.ts`; HP is still read from
  RED's cover rules. No database changes or combat rules changes.
- Generated environment art, separate character and prop textures, depth sorting,
  reduced opacity for props obscuring units, rain, and brief muzzle illumination.
- Existing React/SVG controls, path previews, target assessments, labels and hit
  regions over Phaser. Both renderers use `battlefieldProjection`; the canvas
  camera reproduces SVG letterboxing, zoom and pan exactly.
- Saved playback frames animate along the real path, at constant speed. Camera
  changes do not restart playback. The renderer cannot move, damage or save a unit.
- Four screen-facing directions, a four-pose walking cycle, target-facing aim,
  firing recoil, HP-loss reactions, and a hurt-to-prone death transition. Persistent
  unit objects retain facing through saved snapshots; pose changes never move feet
  off the engine path. Firing effects use the registered barrel position.
- Death poses require a resolved Death Save receipt (`exitReason: dead`) saved in
  combatant JSON. Zero HP, withdrawal/surrender, and legacy defeated units are not
  assumed dead. Skipping or reloading keeps the saved outcome without replaying it.
- Intact, damaged and wrecked art follows `coverStatuses`: full HP, any damage,
  and destroyed respectively. This is presentation, not a new damage mechanic.
  Wreckage is registered to the original footprint and stays under characters;
  clicking it in Move mode previews a route. Intact prop inspection shows HP,
  material/thickness and highlights its exact ground footprint.
- `night_shift_yard` is the new layout; saved `night_shift` encounters retain their
  four original footprints, cover IDs and material values. The harness labels that
  choice **Night Shift courtyard (original layout)**. Both use scenic rendering.
- Diagram toggle; the diagram also stays available during loading, asset failure,
  or WebGL context loss. Select Scenic view to retry after a graphics failure.
- Reduced-motion preference suppresses ambient rain, interpolated movement and
  muzzle flashes. The existing playback skip and reduced-motion queue still apply.

## Deliberately provisional

This remains a small pre-rendered sprite set, not a fully rigged character system.
The player and hostiles use representative mercenaries rather than the player's
saved appearance. Four directions and four walking poses establish movement;
firing and hurt are single authored poses with small recoil/settle motion, and
death transitions from hurt into an authored prone pose. The hostile's east views
mirror inspected west-facing rows. Weapon-specific silhouettes and melee attack
poses remain future art work; melee playback does not emit gunfire effects.
Props now have authored damage and wreckage states. The truck is static cover,
not a drivable vehicle; its two sections follow the existing RED cover system.
Combat feedback now adds original synthesized weapon reports, material impacts,
misses, footsteps and reload cues. Sounds follow saved outcomes, unlock on a player
gesture and have persistent mute/volume controls. Skip, unmount and hiding the tab
stop active audio; overdue cues are discarded. A small recoil offset moves the
art and targeting overlay together and returns to the unchanged camera position;
reduced motion disables it. Enemy playback highlights the acting combatant and
shows their action, target and factual result. Cover changes appearance at impact,
and missed tracers avoid the target. The full HUD redesign remains next. Lighting is
primarily baked into the art, not real-time normal-map lighting.

The environment image contains only unobstructed floor and perimeter architecture.
A faint dashed boundary marks the playable inset, which is smaller than the illustrated floor. New cover is always a
separate object; never paint a gameplay obstacle into that background. All eight
sections read their position and projected width from engine rectangles. The art
manifest maps section IDs to appearances and contains no duplicate world positions.

Source PNGs remain unchanged. The renderer loads ground, six prop sheets and two animation
sheets for the richer layout (only the cargo sheet for the original layout); the original standalone character PNGs remain as art references. On upload,
edge-connected light matte is keyed out and each animation sheet is normalized into
one 1024 × 512 atlas (32 cells). Curated crop boundaries avoid clipped heads and
prone bodies, torso registration stabilizes horizontal placement, and a common
standing height anchors the feet. Prop states upload at 256 pixels wide after alpha-preserving cell extraction and
light-matte removal where needed. Six unchanged prop sources total roughly 11 MB;
compressed delivery assets remain a performance follow-up. The supplied alpha is
preserved. Wreckage height is fitted to the projected ground depth, so collapsed
remains read as passable rather than upright cover. Source GPU
textures are released after conversion. Proper authored alpha and compressed delivery
assets remain useful follow-up work. Desktop rendering targets 60 fps; this is a
target, not a measured guarantee on players' devices.

## Prop assets

The built-in image tool generated these project assets, all saved in
`public/images/combat/night-shift/`:

- `cargo-states.png`, `generator-states.png`, `dumpster-states.png`
- `barrier-states.png`, `pallet-states.png`, `vehicle-states.png`

The first five contain intact/damaged/wrecked columns. The vehicle sheet has
cargo/cab columns and intact/damaged/wrecked rows. The complete final prompt set
and style reference are in [courtyard-prop-prompts.json](courtyard-prop-prompts.json).
The source images were inspected and copied unchanged into the project.

## Asset provenance and prompts

Assets in `public/images/combat/night-shift/` were made with the built-in image
generation tool for this project. No external asset pack or paid license was added.
The supplied screenshot informed art direction, not mechanics or asset reuse.

**ground.png** — final prompt:

> Use case: stylized-concept. Create a production game environment texture for an isometric cyberpunk tactical game, high-detail realistic pre-rendered 3D look. Wide 1536x1024 image. A flat EMPTY wet industrial courtyard floor viewed orthographically at 30 degree elevation, diamond footprint with corners at approximately top center (768,150), right (1450,540), bottom center (768,930), left (86,540). Entire floor is flat, unobstructed concrete paving with subtle joints, drainage grates flush with floor, oil stains, painted worn loading stripes, puddles reflecting cyan neon on left and crimson on right, warm light patches. Along ONLY the far two edges outside the diamond: moody warehouse facade with corrugated shutters, pipes, vents, a cyan sign reading NIGHT SHIFT on left, crimson industrial lights on right. Foreground two edges fade into near-black. Strong cinematic night atmosphere, textured realistic wet materials, rich dark blue shadows with legible floor detail. Absolutely NO characters, crates, vehicles, barrels or freestanding obstacles on the floor. No UI, no grid overlay, no logos. This is the background layer; cover and actors are separately rendered at runtime. Precise symmetric isometric floor geometry, no perspective vanishing point.

**mercenary.png** — initial prompt:

> Use case: stylized-concept. Production isometric game sprite, actual transparent background. One single cyberpunk armored mercenary, full body and boots, holding a compact rifle ready in both hands, facing upper right (back three-quarter view) viewed from elevated 30 degree isometric tactical camera. Realistic detailed pre-rendered 3D video game aesthetic, dark navy armored jacket, combat trousers, small cyan trim, natural human proportions, believable anatomy. Character occupies 80% image height, centered with margin. Subtle cyan rim light left and neutral overhead lighting, no floor, no backdrop, no text, no UI, no additional poses. Clean alpha edges. This is a separate runtime character asset for a wet neon industrial courtyard.

Final edit prompt, using that generated image as the edit target:

> Use case: background-extraction. Edit target is the attached mercenary image. Remove ALL background including black and colored glow. Return ONLY the complete character and rifle on true transparent alpha background, like a cutout PNG game sprite. Preserve character appearance, pose, detail, proportions and all boots. No background gradient, no haze, no floor shadow, no checkerboard painted into the image. Transparent means empty alpha, not black. Fit entire character within image with small transparent margin.

The tool returned an opaque light matte despite the transparency request; the
renderer handles it as described above.

**hostile.png** — final prompt:

> Use case: stylized-concept. A full body cyberpunk hostile mercenary game sprite, isolated on pure white background. Realistic detailed pre-rendered 3D isometric tactical game art. Elevated camera 30 degrees looking down. Facing lower left, front three-quarter view, rifle aimed diagonally down left across chest at a distant target. Shaved head with cybernetic red eye, black armored tactical vest with crimson cloth panels, dark combat trousers and boots, natural proportions. Entire body from head to boots within image, centered generous margins. Neutral illumination with restrained red rim light. No ground, no shadow, no background texture, no glow outside body, no other characters, no UI. Crisp silhouette for runtime masking. Pose consistent with tactical combat.

**crate.png** — final prompt:

> Use case: stylized-concept. One isolated square industrial cargo crate for a realistic pre-rendered isometric cyberpunk tactics game. Orthographic elevated 30 degree view, front corner pointing down, symmetrical left and right faces, square footprint, low squat height. Dark weathered blue steel frame with olive polymer panels, metal latches, chipped paint, tiny amber identification label, fine rain droplets. Cyan rim on left, crimson rim on right, top readable. No text beyond small illegible serial markings. Full object centered, generous margin, entirely visible. On a solid PURE WHITE background with NO shadow, NO glow outside silhouette, NO floor, no other objects. 1024x1024. Crisp game-ready silhouette, highest material detail.

**mercenary-animation.png** and **hostile-animation.png** — generated with the
built-in image tool using the corresponding standalone character above as the
appearance reference. Output is 1448 × 1086, eight columns by four rows. The
runtime metadata follows inspected art rather than trusting requested row labels.

Mercenary prompt:

> Use case: stylized-concept. Create a production SPRITE SHEET derived from the reference mercenary, same navy armor, cyan trim, male face and compact rifle, realistic pre-rendered 3D isometric game art. Reference is appearance only. EXACTLY 8 columns and 4 rows of equally sized cells, 32 complete sprites, on uniform pure white background. Wide landscape 2048x1536 image. No grid lines or labels. Every sprite fits wholly inside its own cell with generous white margin and identical scale. Feet centered horizontally at 85% of cell height; heads at 15%. Orthographic tactical camera elevated 30 degrees. Row 1 faces upper-right (back three-quarter). Row 2 faces lower-right (front three-quarter). Row 3 faces lower-left (front three-quarter). Row 4 faces upper-left (back three-quarter). IN EACH ROW columns left-to-right: 1 standing aiming rifle; 2 walking left foot forward and right foot back; 3 walking passing pose feet near together; 4 walking right foot forward left foot back; 5 walking opposite passing pose; 6 firing rifle with small recoil lean (NO muzzle flash); 7 recoiling from torso impact knees bent (NO blood); 8 collapsed on ground lying prone, body fully in cell. Keep exact same outfit, body size and camera across all cells. Walking arms hold rifle stable but legs visibly change. Rows must be perfectly aligned in four equal horizontal bands. No cropped bodies, no extra sprites, no shadows, no floor, no background graphics.

Hostile prompt: identical except replacing “reference mercenary, same navy armor,
cyan trim, male face and compact rifle” with “reference hostile, same black armor,
crimson panels, shaved head, red cybernetic eye and compact rifle”.

## Verification

- Character-pass baseline: 1,640 tests pass. Regression coverage includes animation timing, route-corner facing, saved HP
  snapshots, death versus withdrawal receipts, skip and reduced motion, plus camera alignment for desktop and both mobile shapes,
  path interpolation, valid spawn placement, and the existing combat flow tests.
- Type checking and production build pass. Changed-file lint passes; repository
  lint retains the existing errors in `gen_routes.cjs` and `previewAuthStorage.ts`.
- Browser inspection used the shipping CombatBoard with a temporary rendering
  fixture: scenic rendering, zoom, keyboard movement preview/confirmation, cover
  inspection/destruction, portrait and landscape frames, and forced WebGL loss.
  The character pass additionally inspected walking around a corner, firing/hit
  poses, muzzle alignment at zoom, death, withdrawal and skipped playback.
  The fixture was removed. Authenticated database persistence was not browser-tested
  in this environment; its existing code paths and regression tests are retained.

### Richer courtyard verification

- All 1,645 tests pass with `bun run test --maxWorkers=1 --testTimeout=60000`.
  Parallel runs on this machine hit the existing five-second limit in unrelated
  exhaustive city-simulation tests. Type checking, production build and changed-file
  lint pass; repository-wide lint retains the pre-existing errors described above.
- New regression coverage freezes legacy geometry, checks art coverage and safe
  spawns, independently destroys a truck section, round-trips its persisted damage,
  verifies the resulting route/sightline, and checks sprite footprint registration.
- Browser review used a temporary fixture around the shipping CombatBoard:
  intact/damaged/wrecked art, partial truck destruction, keyboard cover inspection,
  zoom, movement onto rubble, and original-layout compatibility. The fixture was
  removed. Database persistence was not browser-tested; existing save paths remain.
