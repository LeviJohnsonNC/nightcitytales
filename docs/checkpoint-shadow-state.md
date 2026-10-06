# Checkpoint: lamp shadows follow the complete destruction state

**Scope.** A stabilisation of #299's lamp shadows (`checkpoint-ground-light.md` §3):

1. **Overlapping shadows after destruction**, corrected.
2. **A check of that exact failure,** against fresh renders.
3. **The gameplay verification gap,** stated: what was not run, and the steps for Levi.
4. **Performance,** measured apart from the benchmark's own waits.

**Unchanged:** every light, its colour and strength; the ambient; the contact shade; geometry, cover, targeting,
saves and the camera. No new light, wetness, artwork or layout. The damp sheen stays omitted.

## 1. The fault

#299 painted the ground's light with every prop standing and gave each prop a restore sprite: the light its
intact shadow took and its wreck's does not, **computed as if every other prop still stood**. Where two props'
shadows overlap under one light and both are destroyed, each sprite restores only what its own prop blocked
alone. The overlap, where either one alone was enough to shade, stays shaded.

In the deterministic case below, 465 pixels were left too dark, by up to 6/255 (`overlap/overlap-sheet.png`,
panel 5). The seeds have the same arrangement: a car's two sections, the cart and its crate, the delivery bin
and the generator.

## 2. The fix: shadow regions (`courtyard/groundShadows.ts`)

- **Regions.** Props whose shadow boxes touch, across every light, form a region (`shadowRegions`; merged until
  no two regions touch). Inside a region's box no other prop's shadow reaches the ground, so its light depends on
  its own props' states alone.
  - Seeds 7 and 0: 18 casters in 4 regions.
  - Seed 8: 17 casters in 3 regions.
- **A patch from the complete state.** When a region's state changes, its patch is rendered:
  - the light pass with each of its props standing or wrecked as it now is;
  - less the light pass with all of them standing, per pixel.

  Added over the ground's light (`ADD`), base + patch is the light pass for that state.

- **Cached by state.** A state rendered once is never rendered again: a reload, a replay, destroying in another
  order. Nothing is rendered per frame, and no combination is rendered before it happens. A change costs one
  small render of one region.
- **Kept apart, as before.**
  - Each light is still painted on its own canvas, so one light's shadow never takes away another's light.
  - The ambient is untouched, and the contact shade is a separate sprite.
  - A patch shows by damage and the lights switch only (`coverDestroyed`), never by a prop's fading.

**Exactness.** A region is rendered as a crop of the ground. For a crop to paint every pixel exactly as the whole
ground does, two things changed in `paintShadowedLights`:

- **Every light is painted on a canvas of its own,** over its whole reach plus `BLUR_MARGIN` (48 px). Before, a
  light was painted directly onto the ground outside its shadows' box and on a separate canvas inside it; the two
  paths rounded differently, and the gain amplified it to 3 levels.
- **That canvas starts on a 16-pixel grid** of the ground (`ALIGN`). Chrome dithers gradients by a pattern fixed
  to the canvas's pixels, so a canvas started at another phase differs by a level or two.

**The one allowed difference.** A patch only adds light. Where rounding in the shadow's blur leaves a wreck's
render a level or two below the standing one, the board keeps the standing value. The check counts these
separately. They are rare: at most 3 channels of one state in the deterministic case, and 1 per state on the
seeds. They are never more than 3/255, and the ones measured were near black (8 against 11).

## 3. The check (`tools/scenes/shadow-state-check.mjs`)

It runs in Chromium against the dev server's own modules. For every state it compares what the board composes
(the base plus each region's patch) with a fresh render of the same complete state, channel by channel
(`comparePixels`), and fails on any difference other than the one allowed above. Output: `check.txt`.

**The deterministic case.**

- **Setup:**
  - casters A and B, with B standing in A's shadow under a lamp (4.4 m);
  - a second, cyan light (2.6 m) over the same ground;
  - a fixed-grain ground at the board's 2 px a unit.
- **One region,** `A,B`.
- **States:** both standing, A destroyed, B destroyed, both destroyed.
  - Each is reached in sequence on one board in both orders (A then B, B then A).
  - Each is also loaded directly on a fresh board.

| Case                                    | Unexplained                         | Rounding below standing |
| --------------------------------------- | ----------------------------------- | ----------------------- |
| A then B: standing, A, both             | 0                                   | 0                       |
| B then A: standing, both                | 0                                   | 0                       |
| B then A: B destroyed                   | 0                                   | 3 channels, max 3       |
| Loaded into standing, A, both           | 0                                   | 0                       |
| Loaded into B                           | 0                                   | 3 channels, max 3       |
| **#299's per-prop restores, both gone** | **465 px too dark, worst by 6/255** |                         |

**The second light is kept.** Inside the region, 40,884 pixels are brighter with the cyan light than with the lamp
alone, and the composite matches the fresh render that includes it.

**The seeds, through the board's own setup.** Scene review exposes it in development only:
`window.__groundLight`, behind `import.meta.env.DEV`. States checked:

- every caster standing;
- every caster destroyed;
- every other caster destroyed;
- each multi-prop region's casters destroyed together.

| Seed | Regions shared by several props                                                       | Unexplained      | Rounding (max)                |
| ---- | ------------------------------------------------------------------------------------- | ---------------- | ----------------------------- |
| 7    | a car's sections with the west car and the cabinet; cart and crate; bin and generator | 0 in every state | 0                             |
| 0    | the cabinet with a car's sections; crate and two planters; bin and generator          | 0                | 1 channel (2) in three states |
| 8    | the crate, the west car, the cabinet and a car's sections; the north car's sections   | 0                | 1 channel (3) in three states |

**The board itself.** Seed 7's shop lamp close up, cart and crate in view. A board opened intact is switched live,
without a reload, to every other destroyed, all destroyed, intact and destroyed again. Each frame is compared with
a board loaded directly into that state: **0 channels differ** in every case. This is the scene-review board's
canvas, not a combat save.

**Unit tests:**

- `groundShadows.test.ts` holds the classification.
- `lampShadow.test.ts` holds region merging (including a caster that bridges two regions) and that a destroyed
  caster stands as its wreck.

## 4. Captures (`docs/evidence/shadow-state/`)

- **`overlap/overlap-sheet.png`: the overlapping region, before and after both are destroyed.**
  - Standing.
  - The fresh render with both destroyed.
  - #299's sum: too dark where the shadows met.
  - This board's composite.
  - #299's deficit, ×10: a patch where the two shadows overlapped.
  - This board's difference, ×10: blank.
- **`before/` and `after/`:** `main` against this branch on the shipping renderer. `compare/` shows each pair with
  a difference map.
  - Shots: each seed's shop lamp close up (intact, mixed, destroyed) and play framing (as saved, mixed damage).
  - On the real seeds the correction is a few levels where shadows overlapped. Most visible is seed 7's cart and
    crate under the shop lamp (`compare/close-seed7-lamp-destroyed.jpg`).
  - Elsewhere the difference maps show only scattered single-level pixels: the light pass's new rounding and
    dither alignment.

## 5. Gameplay verification: not run, steps for Levi

**Not run.** This session has no authenticated Supabase session, test account or credentials. Every check above
ran in `/scene-review` or in module checks. None of it is combat or save/load verification.

**Setup.**

1. Sign in with an expendable character whose campaign opening is done.
2. Open `/combat`.
3. Choose **North Heywood · commercial intersection · variation 1** (the composed corner), any opposition,
   **Unhurt**, and start. It hands off to `/play/:id`. Make sure it is night with lights on.

**Checks.**

| #   | Do                                                                                  | Expect                                                                                                                               |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Move round the shop corner: past the cart, the crate and the planters.              | The route goes round them. Nothing else blocks it.                                                                                   |
| 2   | Aim at a hostile across open road.                                                  | A clear shot: "SHOOT" with a DV.                                                                                                     |
| 3   | Aim at a hostile behind a parked sedan.                                             | "NO SHOT", "IN THE WAY" on the sedan section, and "Find firing position".                                                            |
| 4   | Shoot one sedan section until it is destroyed.                                      | Only that section is a wreck; the other still stands and blocks. Its lamp shadow shrinks to the wreck's; the other section's stays.  |
| 5   | Destroy the other section too.                                                      | Both are wrecks. The ground where their shadows overlapped is as lit as round them, with no darker patch left between.               |
| 6   | Move through the destroyed sections' squares.                                       | Allowed, at normal cost.                                                                                                             |
| 7   | Shoot across where the car stood.                                                   | It no longer blocks.                                                                                                                 |
| 8   | Leave `/play/:id` and reload it.                                                    | Positions, HP, both wrecks, the turn and whose turn it is are as you left them. The ground's light is the same as before the reload. |
| 9   | If the cart and crate are near your fight, destroy them one at a time, then reload. | The same as 4, 5 and 8, for the cart's region.                                                                                       |

**Return:**

- a screenshot after 3, 4, 5, 6 and 8;
- the browser console's errors, if any;
- the step number of anything unexpected.

## 6. Performance (`tools/scenes/scene-perf.mjs`)

**Renderer: SwiftShader (software)** — `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader
driver)`. This container has no GPU, so these are software numbers: compare them with each other, never with a
real machine. `main` ran with the same three `performance.mark` lines added, and nothing else; the two were run
one after another, three runs per seed, at play framing with characters (`perf/main.json`, `perf/branch.json`).

What each column is, and what it is not:

- **Scene ready** is the board's own `courtyard-ready` mark: ms from navigation until the scene is drawn and
  playable. It includes the dev server's module loading and the art downloads; it includes no wait of the script's.
- **Environment build** is the composed scene's construction alone (`courtyard-environment`).
- **Idle** is every frame delivered over 5 s with nothing touched, after a 1 s settle; **zooming** is every frame
  while the board zooms in twice and out three times. Frame counts are the frames actually sampled.

| Seed | Code   | Scene ready, ms (3 runs) | Environment build, ms | Idle frames  | Idle p50 / p99, ms                         | Zooming frames  | Zooming p50 / p90 / p99, ms                                        |
| ---- | ------ | ------------------------ | --------------------- | ------------ | ------------------------------------------ | --------------- | ------------------------------------------------------------------ |
| 7    | main   | 10664 / 10307 / 10195    | 5956 / 5870 / 5749    | 53 / 53 / 52 | 83.4 / 99.9 / 99.9 / 116.7 / 116.7 / 116.7 | 113 / 112 / 113 | 100 / 99.9 / 83.5 / 116.6 / 116.6 / 100.1 / 166.6 / 166.6 / 166.7  |
| 0    | main   | 11265 / 11410 / 11359    | 6862 / 6757 / 6857    | 52 / 53 / 52 | 99.9 / 83.4 / 99.9 / 116.7 / 116.7 / 116.7 | 110 / 114 / 113 | 100 / 99.9 / 99.9 / 133.3 / 100.1 / 100.1 / 183.3 / 166.7 / 166.7  |
| 8    | main   | 9019 / 9099 / 9240       | 4601 / 4590 / 4892    | 50 / 50 / 50 | 100 / 100 / 100 / 150.1 / 116.7 / 150      | 111 / 111 / 113 | 100 / 100 / 100 / 116.7 / 116.6 / 116.6 / 166.7 / 166.7 / 166.6    |
| 7    | branch | 9801 / 9823 / 9741       | 5240 / 5320 / 5250    | 54 / 53 / 53 | 83.4 / 99.9 / 83.4 / 116.7 / 100.1 / 183.2 | 114 / 114 / 113 | 99.9 / 99.9 / 99.9 / 100.1 / 100.1 / 116.6 / 166.7 / 166.7 / 166.7 |
| 0    | branch | 10967 / 10901 / 10850    | 6288 / 6319 / 6226    | 52 / 51 / 53 | 99.9 / 100 / 99.9 / 100.1 / 116.7 / 100.1  | 112 / 112 / 113 | 100 / 100 / 99.9 / 116.6 / 116.7 / 100.1 / 166.7 / 166.7 / 150     |
| 8    | branch | 9112 / 8988 / 8994       | 4699 / 4641 / 4555    | 51 / 51 / 51 | 100 / 100 / 100 / 116.6 / 116.6 / 116.8    | 113 / 112 / 113 | 100 / 100 / 100 / 116.5 / 116.7 / 100.1 / 166.7 / 150 / 166.7      |

**Reading it.**

- **Frame times are unchanged.** Every distribution sits on the same few vsync multiples (83, 100, 117 ms under
  SwiftShader).
- **Ready is about 0.3–0.5 s sooner on seeds 7 and 0, and the same on seed 8.** #299 rendered every prop's
  restore at load; now nothing is rendered until a prop is destroyed.
- **A destruction's cost.** The first time a region reaches a state, its patch is rendered: 8–37 ms under
  SwiftShader for regions of 1–5 props (one outlier of 159 ms on seed 0's first render). Afterwards the state is
  cached (under 0.2 ms). That is one possible hitch at the moment something is destroyed, never per frame.

**On a Mac, with the real GPU.** From the repository:

```
bun install
bun run dev                      # note the port it prints, e.g. 5173
node tools/scenes/scene-perf.mjs 5173 perf-mac.json --chrome
```

`--chrome` uses the installed Google Chrome, so no Playwright browser download is needed; add `--headed` to watch
it. It prints each run's scene-ready time, environment build, and idle and zooming frame distributions, then the
renderer string. It is labelled `hardware` unless it is SwiftShader or llvmpipe. Send `perf-mac.json`.

## 7. Checks

- `tools/scenes/shadow-state-check.mjs`: **PASS** (`check.txt`).
- `bun run lint`: no errors; the 12 warnings were already there.
- `typecheck`.
- `test`: 4036.
- `build`.
- `test:browser`: 28.
- `architecture-interaction.mjs` on seeds 7, 0 and 8 (scratch output): 0 page errors and 0 unexpected failed
  requests, live and in the missing-art fallback, on each seed.
- `ground-light-evidence.mjs` before and after: 0 page errors on all 30 captures.

## 8. Limitations

- **Props only, ground only**, as in #299: people cast no lamp shadow, no shadow falls on a wall or another prop,
  and a lit prop's own tint (`lightAt`) does not know it stands in a shadow.
- **A patch only adds light.** The rare rounding case of §2 keeps the standing value; it is counted, never more than
  3/255, and checked.
- **The patch cache is unbounded within a scene.** It holds one small canvas per region state actually reached:
  at most 2ⁿ for a region of n props, and in practice a few per fight.
- **`window.__groundLight`** exists in development builds only, for the check.
- **Not exercised:** a real `/play` fight and save/load (§5).
