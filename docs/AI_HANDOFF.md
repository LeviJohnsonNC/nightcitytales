# Active service alley pass — 2026-10-11

User approved one alley pass, then in-app review before warehouse. Intersection PR359 merged;
user rates it B-ish and explicitly chose to move on. Do not work on warehouse yet.
Checkout /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/service-alley-pass; base origin/main a0936a35 (PR361).
Original dirty checkout untouched; previous final handoff preserved /tmp/nct359-merged-handoff.md.

Implementation ready to commit/push: material/night/contact/reflection treatment enabled for alley;
new recipe v7 turns low east frontage toward lane, preserves reference seeds1–3 and old snapshots;
saved service surrounds choose one warm open workshop, cooler receiving doors; existing interior art.
Receiving parts cabinet, drain cluster, concrete handling strips drier than exposed asphalt.
Utility lamps and compact loading indicators replace intersection traffic/ad fixtures in alley.
Relevant files: sceneComposer/sceneClusters, courtyard serviceFrontage, cityFixtures, afterRain,
composedEnvironment, createCourtyard, frontageIdentity/occupiedFrontage/nightLighting; scene-review controls.
New e2e/service-alley.spec.ts exercises seeds4/11/5 with save/restore, reveal, destruction, compact.

Baseline captures /tmp/nct-alley-before-captures: seed4play inspected; old baseline lacks lighting
controls so first browser run failed that assertion; harness now tolerates absent baseline controls.
First implementation exposed missing cluster reference/duplicate attachment IDs; fixed. 64 seeds compose.
Full suite second run 4278pass/2fail: outdated surround-ID lookup and road-repair assumption; corrected.
First visual seed11 inspected: significant material improvement; lamp and cabinet corrections made.
Final local verification: 4280tests/345files pass; lint0errors15existingwarnings;
typecheck and production build pass. Chromium all3seeds pass (1.4min).
Visually inspected seed4 play/reveal/destruction/compact, seed11play and rotatedseed5play.
No detached rings or unexplained actor/prop intersections observed in these captures.
Evidence: /Users/levijohnson/.codex/visualizations/2026/10/11/01a12b66-843f-7a70-86c1-77681c3d2c1f/service-alley-evidence.
Next: push draftPR, waitCI (including matched alley baseline and intersection regression);
then open local seed4 review. User reviews/merges; warehouse remains deferred.
Fresh chat: read this handoff and use Levi's alley review feedback before any warehouse work.

## Parallel stream — shopping as discovery (Claude, branch claude/shady-goods-store-art-i8grnn)

Updated 2026-10-10. Plan of record: docs/shopping-discovery.md. Passes 1–4 merged
(#343–#346). Store UI part 1, the Counter (features/life/shop/, inline in LifeScreen,
/shop-review fixtures): typecheck, lint, unit suite (337 files), build and the
public-route browser test for /shop-review (desktop + phone, axe) pass; screenshots
taken from /shop-review only — the signed-in Life screen was not browser-checked.
Next: Levi generates the 22 item pictures (docs/art-style.md, Object wrapper);
convert with tools/art/webp.mjs public/images/items and list them in ITEM_ART_READY.

## Parallel painted architecture pass

PR #347 (`codex/painted-architecture`) implements the approved painted facade kit.
See [painted-architecture-handoff.md](painted-architecture-handoff.md) for its isolated
checkout, asset registration, validation and remaining visual-review gates.
