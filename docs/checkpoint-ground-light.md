# Checkpoint: ground light meets the street's objects

**Scope.** Three things on the intersection (seed 7's shop corner first, seeds 0 and 8 for variation):

1. The outstanding prop checks: the corrected r0 stand wreck, and the stand with people round it.
2. A bounded pilot for how the existing ground light meets nearby solids: **lamp shadows** (shipped).
3. A separate material-response experiment: **a broad, rough damp sheen** (tried and omitted).

**Unchanged:** geometry, circulation, cover, targeting, saves, the camera and its play framing, the tactical
overlays, and every light's position, colour and strength. Nothing here adds a light.

**Not exercised:** a real `/play` fight and save/load. Every behaviour below was demonstrated in
`/scene-review` or held by a unit test; none was run in an authenticated campaign.

## 1. The r0 stand's wreck

`street-kiosk-r0-wrecked-v2.png` passes the round-two importer with its volume limit unchanged:

- moved 0.22 m onto its footprint (limit 0.5 m);
- 0.1% of its pixels above its volume (limit 1%; the first wreck was 1.1%);
- 9.2% lying flat past its ground, within `WRECK_APRON`.

`kiosk-r0` is off `TALL_WRECKS_PENDING`, which is empty again, and the runtime frame
`shop-display-wrecked.webp` is the redraw.

## 2. The stand with people round it

A scene-review demonstration (`tools/scenes/stand-actors.mjs`, captures and `report.json` in
`docs/evidence/ground-light/stand-actors/`). It runs on the shipping renderer, submits no combat action and
writes no campaign. Scene review gained one fixture choice for it: `foe=x,y` stands the scene's first hostile
there, as `player=x,y` already did for the review character.

**The cases.** The stand at r0 (seed 7, tile centre 29,25) and r90 (seed 0, 25,29), each with the reveal off
and on:

- **You, directly behind the stand** (straight up the screen from it), then beside it (level with it):
  - drawn and selectable;
  - the marker on the board;
  - when you stand behind, the stand fades in the focus box so you are seen through it, and stays in its place
    in the depth order.
- **A hostile directly behind the stand,** targeted from in front: "No shot, blocked by shop merchandise
  display", with the stand marked "In the way". Beside it: "Shoot, DV 13, 4 m".
- **A route planned across the stand's square** from beside it to the far side:
  - round it while it stands: 4 Move, 8 m;
  - straight across its cleared footprint once destroyed: 3 Move, 6 m, across the wreck.

All 20 cases gave 0 page errors and every marker was on the board.

**One finding.** A person directly behind the stand at r90 is clicked by their torso or marker. Their feet are
drawn behind the stand, so a click there lands on the stand's own square ("Can't move here"). Hovering there
still shows them as a target. This is the board's existing hit order, not new; the tool clicks the torso.

**Held by a unit test as well** (`src/engine/__tests__/standFootprint.test.ts`): on both seeds the stand's square
is not on the path while it stands and is on it once destroyed, at a cost of 3.

**What this is not:** real combat or save/load. It shows the board reading, selecting and targeting the art
correctly in scene review; it does not resolve a shot or persist a fight.

## 3. Lamp shadows (`courtyard/lampShadow.ts`)

### The audit

At the shop corner the ground light was painted as if nothing stood on the pavement:

- The shop lamp's pool ran straight under the crate and the food cart and out the other side.
- The parked car under the lamp left the bay line and the lit kerb in front of its bumper fully lit.
- Seeds 0 and 8 showed the same: the street lamp and sign pools passed under the cars, planters and cabinet near
  them.

The props had only their contact shade: weight on the ground, no direction, the same under every light.

### What was built

Each prop near a light now takes that light's share off the ground behind it.

- **The light is a point at its fixture's height.** The shop lamp's head is 5.45 m up, a street lamp 4.4 m, a sign
  2.6 m (the heights `wallLight.ts` already uses). A lit window is its bay at sill-to-head mid-height (1.5 m),
  from the point of the bay nearest the prop. The entrance downlight, with no fixture saved, hangs at 2.7 m.
- **The prop is a box.** It is its saved 2 m cover piece inset to its body, at a stated presentation height
  (`CASTER_HEIGHT`: a cabin 1.45 m, a planter 0.95 m, the cabinet 1.52 m and 0.9 m deep, the stand 1.31 m, the
  cart 1.4 m). Its wreck is a lower box: the round-one and round-two wreck volumes.
- **The shadow is the box projected from the light onto the ground,** softened by a 0.3 m penumbra. It takes
  72% of that light, never all of it, and nothing else: the ambient and the other lights are untouched. Each light
  is painted on its own small canvas less its shadows, so one light's shadow never removes another's light.
- **A high lamp casts short shadows.** Under the shop lamp they reach well under a metre past most props: the
  physics, not a tuning choice. They are not lengthened to be seen.

### The rules it keeps

- **Ambient and contact shade are separate.** The contact shade (`contactShade.ts`) is unchanged. A lamp shadow
  lives in the ground's light pass, so with the lights off it is gone with the light.
- **A destroyed prop casts its wreck's shadow, never its intact one.** Each prop that shades anything has a small
  restore sprite: exactly the light the ground gains when that prop is a wreck. It is computed per pixel by
  rendering that box of the light pass twice, once as shipped and once with the wreck's low shadow. The pass's
  gain saturates, so the two halves do not simply add; a first version that added them over-restored the lamp's
  brightest pixels. The board shows the sprite while the cover piece is destroyed (`coverDestroyed`).
- **Fading never touches a shadow.** The restore sprite follows damage and the lights switch only. A prop faded so
  a person behind it can be seen keeps its shadow.

### Cost

The first version gave each light and each restore sprite a full ground-sized canvas: load time rose about
6.5 s under SwiftShader. Each light's shadow work is now confined to the box round its shadows, and each restore
sprite to its own shadow's box. Measured in §6.

## 4. The damp sheen: tried and omitted (`groundSheen.ts`, reverted)

`checkpoint-atmosphere.md` §4 rejected tiny puddles with thin mirrored streaks, and left open a broad,
rough sheen. That is what was tried, without restoring the streaks.

**What it did** (commit `575a074`):

- **The highlight came from each light the scene already has.** A light at height z mirrors z metres straight
  down-screen from its foot, so the highlight was centred there. It was a soft lobe 1.1 m across and 3.2 m along
  the view, never a sprite and never a mirrored image. A window was its bay's mirrored span.
- **It showed only where the ground was damp.** Damp patches came from a 3.2 m world-space noise, leaving
  roughly half the ground dry. Asphalt took the sheen fully, paving at 45%, and building footprints not at all.
- **It preserved texture.** The second iteration put it through the ground's albedo-multiplied light pass, so
  it broke up with the asphalt's grain and the markings stayed readable. The first iteration added it after
  the albedo and read as a smooth blob.

**Why it is omitted:**

1. **At play zoom it reads as haze, not as damp.**
   - The shop lamp's mirror point lies on the road beyond the kerb, so its highlight is a lone warm smudge on
     dark asphalt, a short way from the pool (`compare/close-seed7-lamp.jpg`, third column).
   - On the paving it just widens the existing pools (`compare/close-seed8-lamp.jpg`).
   - Nothing in the frame says "wet": a wet street reads by its reflections' shape and contrast, and a rough
     lobe has neither.
2. **The scene has too few sources.** One lamp, a sign and the windows per variant give a few isolated smudges, not
   a surface that catches light everywhere. The atmosphere checkpoint predicted exactly this. Adding lights only
   to make reflections was ruled out.
3. **Sharper or stronger was not an option.** Narrowing the lobe tends toward the rejected streaks; strengthening
   it makes the smudge brighter, not wetter.

The code was reverted (`groundSheen.ts` no longer exists). The evidence stays in `3-sheen/` and the third
column of every `compare/` image.

**Cost, for the record:** no measurable frame cost (§6). It was computed once at load, at a third of scene
resolution.

## 5. Evidence (`docs/evidence/ground-light/`)

Every stage is the same shots from `tools/scenes/ground-light-evidence.mjs`, at the same cameras:

- `1-baseline/`: `main`, with the redrawn r0 wreck file copied in so only the lighting differs;
- `2-shadows/`: §3 alone (commit `f7fd61a`);
- `3-sheen/`: §3 plus the sheen experiment (commit `575a074`, reverted by the next commit).

`compare/` sets each shot's three stages side by side.

- **Normal play framing with characters, seeds 7, 0 and 8:** `seedN-play`, `seedN-reveal`, `seedN-lights-off`,
  `seedN-mixed-damage`.
- **Close-ups of each seed's shop lamp at 3x:** `close-seedN-lamp`, `-destroyed`, `-mixed`, `-lights-off`.
- **The reference comparison camera,** kept apart from gameplay: `reference-seed7`.

### Screenshot observations (not tested behaviour)

**Lamp shadows, stage 2 against stage 1:**

- **Seed 7, the shop corner.**
  - The red sedan parked under the shop lamp now shades its bay line and the lit kerb in front of its bumper.
  - The crate and the cart sit darker on the lit band of paving, instead of the band running straight under
    them (`compare/close-seed7-lamp.jpg`).
  - At play zoom it is a small change: the corner looks grounded rather than different (`compare/seed7-play.jpg`).
- **Seed 8.** The clearest case. The beige sedan beside the shop lamp cuts a visible shadow out of the pool on
  the paving behind it, and the cart and crate by the awning are grounded in it (`compare/close-seed8-lamp.jpg`).
- **Seed 0.** The lamp's pool reaches the cars and the cart. The change is mostly under and just beyond them
  (`compare/close-seed0-lamp.jpg`, `compare/seed0-play.jpg`).
- **Destroyed and mixed.**
  - A destroyed prop keeps only its wreck's short shadow; the light its intact body blocked is back
    (`compare/close-seedN-lamp-destroyed.jpg`).
  - In `-mixed`, wrecked and standing props side by side each cast their own.
- **Lights off.** No difference from the baseline: a lamp shadow belongs to its lamp (`compare/*-lights-off.jpg`).
- **Reveal.** Shadows lie on the ground under the cutaway exactly as on the street (`compare/seedN-reveal.jpg`).
- **Overlays.** Movement squares, markers and labels are unchanged.

**Pixel counts, play shots** (stage 1 against stage 2, pixels whose value changed by more than 4 of 255):
6,344 on seed 7, 5,031 on seed 0 and 3,561 on seed 8, of 1.4 million, mean darkening 3.5 to 4. Restrained by
design: nothing outside a light's own pool changed.

## 6. Performance

Same machine, same commands, the three stages run one after another, twice each
(`tools/scenes/ground-light-evidence.mjs` with `PERF=1`; raw numbers in `perf/`).

- **Renderer:** ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver). It is
  software, so only relative numbers mean anything.
- **What was sampled:** the frames actually delivered during an identical zoom-in, zoom-out sequence on each
  seed's play shot, about 11 s.

| Seed | Stage    | Frames sampled (run 1 / 2) | Mean ms       | p10 / p50 / p90 / p99 ms (run 1; run 2)                    | Load ms         |
| ---- | -------- | -------------------------- | ------------- | ---------------------------------------------------------- | --------------- |
| 7    | baseline | 113 / 123                  | 161.9 / 155.0 | 149.9 / 150.1 / 183.4 / 233.3; 133.3 / 150 / 166.7 / 233.2 | 31,424 / 31,179 |
| 7    | shadows  | 122 / 125                  | 156.7 / 152.8 | 133.3 / 150 / 166.7 / 233.3; 133.3 / 150 / 166.7 / 233.3   | 31,983 / 31,573 |
| 7    | + sheen  | 123 / 123                  | 152.6 / 150.5 | 133.3 / 150 / 166.7 / 233.2; 133.3 / 150 / 166.7 / 216.6   | 31,447 / 31,558 |
| 0    | baseline | 123 / 123                  | 149.5 / 156.2 | 133.3 / 150 / 166.7 / 216.7; 133.3 / 150 / 166.7 / 233.3   | 31,376 / 32,229 |
| 0    | shadows  | 120 / 115                  | 153.0 / 155.8 | 133.3 / 150 / 183.4 / 233.3; 133.3 / 150 / 166.7 / 233.3   | 31,427 / 31,029 |
| 0    | + sheen  | 122 / 116                  | 150.8 / 154.6 | 133.3 / 150 / 166.7 / 216.7; 133.3 / 150 / 166.7 / 216.7   | 31,796 / 31,993 |
| 8    | baseline | 120 / 115                  | 162.4 / 157.1 | 149.9 / 166.5 / 183.3 / 250; 149.9 / 150 / 166.7 / 216.7   | 30,935 / 28,962 |
| 8    | shadows  | 122 / 123                  | 157.1 / 154.9 | 133.4 / 150 / 166.7 / 233.4; 133.3 / 150 / 166.7 / 216.7   | 31,903 / 30,793 |
| 8    | + sheen  | 121 / 122                  | 156.9 / 151.9 | 133.4 / 150 / 166.8 / 233.3; 133.3 / 150 / 166.7 / 216.7   | 30,595 / 29,941 |

**No measurable change.**

- Every stage's median is the same 150 ms vsync interval, and the spread between runs of one stage is as large
  as between stages.
- Load time (navigation to the end of sampling, including a fixed 6.5 s settle and about 11 s of zooming)
  overlaps across stages.
- Before the shadow work was confined to small canvases, the same measure showed shadows adding about 6.5 s to
  load (§3).

## 7. Checks

- `bun run lint`: no errors; the 12 warnings were already there.
- `typecheck`.
- `test`: 4030.
- `build`.
- `test:browser`: 28.
- `architecture-interaction.mjs` on seeds 7, 0 and 8 (scratch output): 0 page errors and 0 unexpected failed requests, live and in the missing-art fallback, on each seed.
- `tools/art/street-props.ts --check`, round one and round two: all pass, no waiver.
- `ground-light-evidence.mjs`: 0 page errors on all 75 captures.
- **New tests:**
  - `lampShadow.test.ts`: the projection's direction and length, a wreck shorter than its intact shadow, a
    bounded shadow under a low light, which lights cast (reach, overhead, a window's nearest point), and every
    prop on seeds 7, 0 and 8 casting from inside its own saved piece;
  - `standFootprint.test.ts` (§2).

## 8. Limitations

- **Props only, ground only.** People cast no lamp shadow (they keep their contact shade). Buildings already stop
  light at their walls. No shadow falls on a wall or another prop.
- **A box, not the picture.** The stand's open front and the cart's canopy shadow as solid boxes. At these
  heights and sizes it reads correctly at play zoom; a silhouette from the art would be the next step if it ever
  does not.
- **Two destroyed props whose shadows overlap** each restore only the light their own wreck gives back, assuming
  the other stands. Where both shadows overlap, that patch stays shaded until neither stands. It needs two adjacent
  props under one light, both destroyed, to show.
- **A lit prop's own tint** (`lightAt`) does not know it stands in another prop's shadow.
- **Not exercised:** a real `/play` fight and save/load.
