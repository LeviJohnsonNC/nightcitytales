# Active environment consistency pass — 2026-10-11

All seven first material passes approved; residential PR368 merged.
User authorized consistency audit and highest-impact fixes, will test later.
Checkout /Users/levijohnson/.codex/worktrees/street-neon-clipping/nightcitytales.
Branch codex/environment-consistency; base origin/main db1373f4.
Original dirty checkout untouched; prior handoff /tmp/nct368-final-handoff.md.

Baseline9 Chromium tests pass (3.9m): intersection8, all others4, extra office8
and nightclub8. Play captures inspected across all seven; additional damage,
reveal and compact inspected for the changed cases. Baseline evidence:
/tmp/nct-consistency-before-captures; audit details docs/environment-consistency.md.
Local changes: shared responsive map heading/controls; missing waiting-seat
shadow casters; residential drives render over planting in floor and wet mask.
Driveway regression reproduced before fix; initial17tests and typecheck pass.
Added phone captures and header-fit checks to all7existing browser harnesses.
Next: checkpoint PR, focused/full checks and fresh screenshots. No campaign writes
or merge; user tests later.

## Parallel stream — shopping, then the audit (Claude, branch claude/shady-goods-store-art-i8grnn)

Updated 2026-10-11.

- **Shopping:** PRs #343–#363 are merged: the Counter, browse-from-story, keepers, the haggle scene and counterNews. Levi is generating the 26 keeper portraits (prompts are in docs/art-style.md). To add them, run `tools/art/webp.mjs public/images/keepers --widths=1024,512` and list each slug in `KEEPER_ART_READY`.
- **Audit:** the fixes and tests are on draft PR #369. See ROADMAP.md, "Audit — 2026-10-11", and debts 20–26.
- **Validation:** typecheck, lint and the unit suite pass locally; the signed-in game was not browser-checked.
- **Next:** CI on #369. After that, the improvement list Levi is approving.

## Parallel painted architecture pass

PR #347 (`codex/painted-architecture`) implements the approved painted facade kit.
See [painted-architecture-handoff.md](painted-architecture-handoff.md) for its isolated
checkout, asset registration, validation and remaining visual-review gates.
