# Active garage material pass — 2026-10-11

Warehouse PR364 approved and merged. User authorized the next environment; garage chosen.
Checkout /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/garage-material-pass, base origin/main 764a4854.
Original dirty checkout untouched. Previous final handoff /tmp/nct364-final-handoff.md.

Local implementation: share warehouse finishes as industrialFinish, enable garage materials,
painted vehicles/workbenches, room-bounded lighting and contact/cast shadows.
Garage floor wear follows saved vehicle footprints; no geometry changes or extra obstacles.
Baseline Chromium seeds4/5/7 pass; seed4 play inspected, captures /tmp/nct-garage-before-captures.
Local typecheck and 20 focused lighting tests pass. First Chromium seeds4/5/7 pass;
play images inspected. Seeds4/7 repeat the same layout, so final review set is4/5/9.
Baseline and initial captures cover two layouts; final seed9 and matched CI add the third.
Implementation ready for checkpoint. Next: full tests/lint/build, final Chromium and CI.
User in-app acceptance remains the gate before another environment.

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
