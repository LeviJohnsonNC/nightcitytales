# Active warehouse material pass — 2026-10-11

User approved warehouse after alley PR362 merged; one focused pass then in-app review.
Checkout /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/warehouse-material-pass; base origin/main 549417c2 (PR363).
Original dirty checkout untouched. Prior final alley handoff /tmp/nct362-final-handoff.md.

Local-only implementation ready for checkpoint: warehouse materials/contact shadows, room-clipped lighting,
concrete floors and cutaway walls, material-bearing stocked racks and workbenches.
No engine geometry or saved recipe changes. Warehouse dry; no outdoor rain/reflections applied.
Baseline captures /tmp/nct-warehouse-before-captures (seed4 play inspected).
Baseline browser run captured all3seeds but failed absent exterior-only Reveal button;
warehouse harness now tolerates that control's absence (interiors use automatic occlusion).
Local typecheck and 13 focused tests passed before final fixture sorting correction.
Chromium 3 seeds passed; inspected all3 play images. Brightness/grain reduced after first captures.
Fixture footprint/elevation now registered to shared sorter; needs final browser verification.
Next: checkpoint draftPR, full tests/lint/typecheck/build and final captures.
Review seeds4/5/7 cover distinct layouts. No exterior Reveal control exists indoors;
actor occlusion remains automatic. User review/merge is the remaining acceptance gate.

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
