# Checkpoint: the lower wrecks and the neighbours' tiles

**Scope:** the four images commissioned at the end of
[`checkpoint-architecture-pilot.md`](checkpoint-architecture-pilot.md), imported:

- `street-planter-wrecked-v2.png` and `street-cabinet-wrecked-v2.png`, edits of the tall wrecks;
- `roof-ballast.png` and `painted-render.png`, the shop's neighbours' own roof and walls.

**Unchanged:**

- geometry, cover, targeting, damage and saved scenes;
- the shop's own materials;
- every environment except intersections.

## The wrecks

**Versions.** The importer (`tools/art/street-props.ts`) now takes the newest `-vN` of each image.
The older images stay in `src/assets/creator/` as history.

**Height and spill.** Measured against its volume, each v2 is low enough, but the first measure
mixed two different things:

- **Height**, which the gate exists for: remains taller than walkable rubble read as cover that
  is not there. Both v2 images pass at 0.0%.
- **Spill**: the cabinet's doors lie flat up to half a metre past its 2 m ground. They are drawn
  under every person and clipped at the frame, so they hide nothing. Spill is now reported, not
  failed, within a 0.5 m apron (`WRECK_APRON`).

**Placement.** Picasso drew the cabinet wreck about 0.4 m behind where the intact cabinet
stands. The importer now moves a wreck that fails where it stands onto its own footprint, by
translation only (never scaled), up to 0.5 m, and reports it:

| Wreck   | Moved                   |
| ------- | ----------------------- |
| Cabinet | 0.39 m                  |
| Planter | 0.03 m                  |
| Sedans  | none, they already pass |

| Wreck   | Before the edit | v2, too tall | v2, flat past its ground |
| ------- | --------------- | ------------ | ------------------------ |
| Planter | 27.5%           | 0.0%         | 2.7%                     |
| Cabinet | 32.5%           | 0.0%         | 11.3%                    |

**The gate is now live.** `TALL_WRECKS_PENDING` is empty, so a wreck that stands too tall fails
the import.

## The tiles

**Validation.** `tools/art/materials.mjs` validates and makes both tiles.

| Tile             | Seam | Lighting probe              | Mean RGB      |
| ---------------- | ---- | --------------------------- | ------------- |
| `painted-render` | 1.24 | passes                      | 134, 124, 111 |
| `roof-ballast`   | 1.23 | reads 17, over the 12 limit | 104, 100, 93  |

**The ballast's probe reading.** Its 8×8 lighting probe reads the stones themselves: each cell
holds only a few of them, and the cells scatter between 92 and 110 with no trend. Its quadrant
means differ by 1.8/255, so there is no gradient across it, and a 2×2 tiling shows no repeat. It
carries its own limit (20) with that reasoning written beside it. The six existing tiles
reproduce byte for byte.

**Where they go** (`surfaceMaterials.ts`): `roof-ballast` covers 2 m per tile, gain 1, and
`painted-render` 4 m, gain 2.

- A neighbour's roof lays the ballast, and its walls the render, on the full building and on its
  cutaway pieces alike, so revealing the street never changes what the wall is.
- The shop keeps its concrete and membrane. A test holds both rules.

## Evidence (unedited browser captures, `docs/evidence/wrecks-and-tiles/`)

Before is `main` (the architecture pilot), after is this branch, with the same URL and camera for
each pair. The `compare-*.jpg` files set them side by side:

- `wrecks-kerb` and `wrecks-kerb-night`: the planter and cabinet destroyed, neutral light and night;
- `wrecks-behind`, `wrecks-beside`, `wrecks-on`, `wrecks-cabinet-behind`: a character around the
  remains;
- `block-neutral`, `block-night`: the adjoining block at play zoom;
- `play-night`, `play-neutral`, `play-neutral-reveal`: the corner at play zoom;
- `seed-1`, `seed-8`, `seed-8-neutral`: other seeds.

## Screenshot observations (what the captures show, not tested behaviour)

- **The planter's remains** are now low stumps and slabs on its square, and read as walkable
  rubble.
- **The cabinet** is a torn plinth on its footprint, with its doors lying flat around it.
- **A character behind either wreck** now reads as standing beyond rubble, not over a heap.
- **The neighbours' roofs** read as gravel, plainly not the shop's seamed membrane, and their
  walls as a quiet warm render. The warm shop remains the corner's focal point, and at night the
  neighbours stay dark and quiet.
- **On seeds 1 and 8** the neighbours of each storefront take the same two materials.

## Interaction tests

- **Pixel regression:** the six other environments are pixel-identical to `main` (see the PR).
- **Not tested:** a real `/play` fight and save/load (they need a Supabase session).
