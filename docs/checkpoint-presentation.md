# Checkpoint: a clear, restrained tactical presentation

**Scope.** The combat board's overlay, starting from
[`corner-finish/gameplay.jpg`](evidence/corner-finish/gameplay.jpg): the actor markers, the movement overlay,
the targeting messages and the cutaway footprint. No artwork, lighting or geometry changes.

**This is a deliberate shared change.** `CombatBoard` is the one board `/play` and `/scene-review` both run, so
every environment's overlay changes with it. The art beneath it does not.

**Unchanged:**

- movement, reachability and costs;
- targeting, cover, line of sight and damage;
- selection hit areas (the transparent hit rectangle is the same);
- scene geometry and saved state.

**Not verified:** a real `/play` fight and save/load, which need a Supabase session. Everything here was driven
in `/scene-review`, which runs the same component.

## 1. Diagnosis

- **The oversized labels were the shared behaviour, not review mode.**
  - The board's SVG is drawn in scene units through a `viewBox` that is `1100 / camera.zoom` wide. Anything
    inside it scales with the camera.
  - At the play camera on an 1800 px board that is about 3.6×. The 10 px name label printed at about 36 px, the
    46-unit HP bar at about 165 px, and the 2-unit strokes as 7 px bands.
  - On a phone the same rule went the other way: labels at about 5 px.
  - `/play` and `/scene-review` share `CombatBoard`, so both had it.
- **The movement overlay** (painted by Phaser on intersection scenes, by the SVG elsewhere) drew every
  reachable square at one strength whenever it was your turn, at rest as much as while planning.
- **"IN THE WAY", the impact text and the callout's anchor** were also placed in scene units.
- **The callout** was centred on its anchor with no clamping, so near an edge it ran off the board.
- **The cutaway footprint** was a flat `#182329` with stripes, the asphalt's value, laid over the whole of a
  revealed building. The storefront, cut away to its front wall, read as a dark, empty room.

## 2. What changed

### Actor markers (`actorMarkers.ts`, pure; `ActorMarker.tsx`)

Every marker is drawn in screen pixels (`scale(ui)`, where `ui` is one screen pixel in scene units, measured
from the board's real size), above everything standing, at one size at every zoom. Each says as much as the
person's part in the fight calls for:

| Role              | At rest                         | Hovered, focused or aimed at |
| ----------------- | ------------------------------- | ---------------------------- |
| You               | a caret and a slim bar          | your name and HP             |
| The locked target | name, HP and bar, always        | (the same)                   |
| Other hostiles    | a diamond and a slim bar        | name, HP and bar             |
| Allies            | a disc and a slim bar           | name, HP and bar             |
| Bystanders        | nothing (their quiet ring)      | name, HP and bar             |
| A hurt bystander  | an open ring and a slim bar     | name, HP and bar             |
| Out of the fight  | a cross and what became of them | and the name                 |

- **Faction is carried by shape as well as colour:** caret, diamond, disc, ring, cross.
- **The large "YOU" is gone.** The caret over the head, the brightest ring on the board and the bar say the same
  without a word, and the name is a hover or focus away.
- **Placement.** `layoutMarkers` keeps every marker on screen and clear of the board's controls.
  - A worded marker moves up past an earlier one rather than printing across it, in priority order: target,
    pointed, you, threats.
  - Every marker moves off the "IN THE WAY" label.
  - A marker that had to move far keeps a thin leader to its head.
  - A person off screen draws nothing.
- **Keyboard focus** reveals the same detail and brackets as hovering. The browser's box round a unit's hit
  area, which read as clutter, is replaced by those.
- **Touch.** Tapping a person selects them, which shows the full marker; the inspector shows everything as
  before.
- **Lines** (rings, brackets, line of sight, route, destination, blocker outline) use a non-scaling stroke, so
  they keep one weight at every zoom.
- **Messages.** "IN THE WAY" and the impact text are screen-sized at their objects. The callout is anchored
  just above the target's marker (in screen pixels) and is nudged inside the board, or hung below its anchor
  when there is no room above.

### Movement overlay (`overlayModel.ts`)

| Mode     | When                          | Drawn                                                                         |
| -------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `rest`   | your turn, nothing in hand    | the edge of reachable ground, and a breath of fill                            |
| `plan`   | hovering or previewing a move | every reachable square (faint), the route, the destination, sheltered squares |
| `aim`    | finding a firing position     | the squares that can see the target, the rest faded                           |
| `target` | a target hovered or locked    | the edge only: the target and the line of sight are the point                 |

- **The edge** (`squaresOutline`) is drawn wherever a reachable square meets one that is not. It is the Move
  Action's real cost boundary, as a dark under-stroke and a light line, so it reads on asphalt and on
  pavement.
- **Line widths** are divided by the camera zoom in Phaser and non-scaling in the SVG.
- **The same modes** drive the diagram view's squares.

### Cutaway footprint (`paintCutawayFloor`)

The revealed building's footprint is drawn as a **cut solid**, the way a section drawing shows mass:

- an opaque neutral a shade lighter than the street, so it reads as something there rather than a hole;
- a fine level hatch every 0.4 m;
- a faint line where the walls stand, and a dark edge.

It is opaque (nothing of the street shows through), carries no furniture, and has no new geometry. The walls,
their cut tops, the entrances, the storefront's front and the roof-on view are unchanged.

**Compared at the same camera** (`compare-idle-reveal.jpg`, `compare-target-blocked.jpg`): the old dark slab
read as an open, empty interior. The hatch reads as solid mass, and the building's walls and the storefront's
front stay as they were. Obstruction and access are no less clear: the walls still bound it, and the overlay
never lit a square inside it, since it is not reachable. So the change is kept.

The short dashes seen across it in the captures are the scene's rain, on the street as much as the building
and present in the old version too. They are not road markings showing through.

## 3. Evidence (`docs/evidence/presentation/`)

`before/` is `main`, `after/` this branch, with every state reached through the page's own pointer and
keyboard (`tools/scenes/presentation-evidence.mjs`). `compare-*.jpg` set each pair side by side.

- **Seed 7, normal play zoom:** `idle-roof-on`, `idle-reveal`.
- **Movement planning:** `plan-hover`, `plan-preview`.
- **Blocked targeting:** `target-blocked` (the rifleman behind the parked car).
- **A crowd:** `crowd-rest`, `crowd-hover-bystander` (the corner at the overview camera, a bystander hovered).
- **Indoor:** `indoor-rest`, `indoor-hover` (the office).
- **Narrow viewport (390 × 844):** `narrow`, `narrow-target`.
- **`after/hover-select-zoom.webm`:** a 60-second recording, sped up 2.5×. It shows a bystander hovered, a
  hostile hovered then locked, zoom in and out across the camera's range, and the reveal toggled. The
  markers keep their size through the zoom.

## 4. Screenshot observations (what the captures show, not tested behaviour)

- **At rest** the street and the storefront carry the frame. A caret marks you, a diamond and a slim bar each
  threat, and the bystanders have only their quiet rings. The movement range is a thin edge, not a lit
  lattice.
- **The target** (hovered or locked) has its name, HP, bar and brackets. A blocked shot shows a dashed red line
  to it, "IN THE WAY" at the parked car, and a "NO SHOT" card that stays inside the board.
- **Planning** shows faint squares, the route and the destination, with the "MOVE HERE" card beside it.
- **The crowd.** At the overview camera the corner's people are told apart by marker shape: a caret for you,
  diamonds for hostiles, and only a quiet ring for bystanders. Hovering one names only that one.
- **Narrow screen.** Before, every word on the board shrank to about 5 px and was unreadable. Now the markers,
  "IN THE WAY" and the card are the same size as on a desktop.
- **The cutaway** reads as a hatched building mass, lighter than the street, under its cut walls.

## 5. Interaction tests

- **`presentation-evidence.mjs`:** every state, driven by pointer and keyboard, with 0 page errors on both
  builds.
- **`architecture-interaction.mjs`:** reveal, zoom, pan, Night and Lights toggles, reset and overview. 0 page
  errors live and in the missing-art fallback.
- **New unit tests** (`actorMarkers.test.ts`, 14) cover the role hierarchy, the detail rules, shape-not-colour
  faction glyphs, the layout's screen and overlap rules, the overlay modes and the reach outline.
- **Repository checks:** `bun run lint` (no errors; the 12 warnings were already there), `bun run typecheck`,
  `bun run test` (3961), `bun run build`, `bun run test:browser` (28, including the WCAG scan of
  `/scene-review`).
- **Not tested:** a real `/play` fight and save/load.

## 6. Against the acceptance questions

1. **Do the street and storefront stay prominent during play?** Yes. At rest the overlay is a thin edge, the
   markers are small, and nothing over the board is larger than the people it describes.
2. **Can I tell myself, my target and the threats immediately?**
   - You: a cyan caret and the strongest ring.
   - The target: brackets, a name and a red line.
   - Threats: red diamonds.

   Bystanders recede. One honest caveat: with no target locked, which hostile matters most is told by the
   inspector, not the board.

3. **Can I get full information without hunting?** Hover, keyboard focus, tap and selection all show name, HP
   and bar at the person, and the inspector still shows everything. At rest you see no names, by design.
4. **Are movement and blocked shots unambiguous?** Planning shows reachable ground, the route, the destination
   and the edge of reach. A blocked shot is a dashed red line, the blocker named at the blocker, and a "NO SHOT"
   card that offers a firing position.
5. **Does the cutaway say "a building is here" without dominating?** Better than before: it is a hatched mass
   rather than a dark room. It is still a large area when a whole building is cut. **Unresolved:** at night the
   ambient tint brings the hatch close to the street's value. A further step, outside this pass, would be a
   roof-tone treatment of the mass.

**Remaining limits.**

- **The marker sizes are fixed screen sizes:** 11 px names, 3 px bars. They suit desktop and phone; whether 11
  px is right on a large 4K board has not been checked.
- **Overlaps.** Two worded markers stack rather than overlap. Compact markers (a glyph and a bar) may still
  touch in a very tight group at the overview zoom; they are small enough that it reads as a group.
