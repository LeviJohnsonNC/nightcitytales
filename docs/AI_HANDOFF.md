# Active residential material pass — 2026-10-11

Nightclub PR367 approved by Levi and merged. User authorized residential next.
Checkout /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/residential-material-pass; base origin/main 61ffecd4.
Original dirty checkout untouched; prior final handoff /tmp/nct367-final-handoff.md.

Local implementation: residential uses existing street material/art, night light,
reflection and contact-shadow pipeline; deterministic domestic facade palettes,
concrete drives, muted planting strips excluded from wet reflections. Saved
geometry and routes unchanged. Existing door/window/roof detail reused.
Baseline Chromium seeds4/5/6 pass after correcting harness to five residential
actors (initial copied interior harness expected four). Baseline screenshot4
inspected; evidence /tmp/nct-residential-before-captures.
Typecheck and 27 focused lighting/window/roof/reflection tests pass. First after
seed4 play inspected: warm entrances, calm domestic materials, readable street.
Implementation pushed as548995c8 in PR368:
https://github.com/LeviJohnsonNC/nightcitytales/pull/368.
After Chromium4/5/6 pass (1.3m); all play, reveal4, destroyed4 and compact4
visually inspected. Evidence saved to /Users/levijohnson/.codex/visualizations/2026/10/11/01a12b66-843f-7a70-86c1-77681c3d2c1f/residential-evidence.
Adding seed7 for setback-home topology (5/6 share offset-driveway layout).
Full tests/lint/typecheck/build running; remote checks next. Levi reviews before
merge or further scope.

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
