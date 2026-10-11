# Active warehouse material pass — 2026-10-11

User approved warehouse after alley PR362 merged; one focused pass then in-app review.
Checkout /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/warehouse-material-pass; base origin/main 549417c2 (PR363).
Original dirty checkout untouched. Prior final alley handoff /tmp/nct362-final-handoff.md.

Implementation fccc1d36 committed/pushed in draft PR364:
https://github.com/LeviJohnsonNC/nightcitytales/pull/364
Warehouse materials/contact shadows, room-clipped lighting, concrete floors and cutaway walls,
material-bearing stocked racks and workbenches. Suspended lights use footprint/elevation sorting.
No engine geometry or saved recipe changes. Warehouse dry; no outdoor rain/reflections applied.

Local verification of fccc1d36: 4290 tests /346 files pass; typecheck/build pass;
lint 0 errors /15 existing warnings. Final Chromium 3 seeds pass (1.1min).
Inspected play seeds4/5/7, seed4 destroyed and compact. Initial brightness/grain reduced.
No detached actor rings seen. No exterior Reveal control exists indoors; actor occlusion automatic.
Baseline captures /tmp/nct-warehouse-before-captures; baseline harness corrected for absent reveal.
Final evidence: /Users/levijohnson/.codex/visualizations/2026/10/11/01a12b66-843f-7a70-86c1-77681c3d2c1f/warehouse-evidence.

Remote CI still running: matched warehouse, alley and intersection Chromium + main checks.
Next: verify remote checks, open local /scene-review?place=warehouse&seed=4 for Levi.
Review seeds4 (receiving/rack hall),5 (side office/loading),7 (cross-aisle stockrooms).
User in-app review/merge remains the acceptance gate. Do not advance to another environment.
Fresh chat: read this handoff, check PR364 and respond to Levi's warehouse visual feedback.

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
