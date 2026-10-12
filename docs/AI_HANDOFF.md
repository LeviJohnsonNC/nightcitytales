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

- **Shopping:** PRs #343–#363 are merged: the Counter, browse-from-story, keepers, the haggle scene and counterNews. All 26 keeper portraits are in (originals in src/assets/creator, WebP in public/images/keepers, listed in `KEEPER_ART_READY`).
- **Audit:** merged (#369, #371, #372). See ROADMAP.md, "Audit — 2026-10-11", and the debts it lists.
- **Validation:** typecheck, lint and the unit suite pass locally; the signed-in game was not browser-checked.
- **Next:** the audit improvements not yet approved (3, 4, 6–8, 11–17 in the list sent to Levi).

## Parallel painted architecture pass

PR #347 (`codex/painted-architecture`) implements the approved painted facade kit.
See [painted-architecture-handoff.md](painted-architecture-handoff.md) for its isolated
checkout, asset registration, validation and remaining visual-review gates.

## Parallel stream — faces in the text (Claude, branch claude/face-fidelity)

Updated 2026-10-12. Base origin/main 132d7c1 (#373). Goal: the pictures of people in
Life's text were bolted on and sometimes wrong (sex, age). Review first, then phase 1.

- **Cause:** the face was chosen after the prose from 40 pictures that differ only by role
  and sex, and the narrator was never told which face, or any sex or age for the 36
  standing cast and 26 keepers. The 3:2 scene was shown at 120x80.
- **Done (local until the PR is pushed):** looks recorded and told to the narrator
  (`cast-looks.json`, keepers in `place-shops.json`, `seenAsLine`); walk-ons inverted
  (`ambientPeople.ts`, "Also here", `resolveWalkOns` told-set); `seenAsPronounsHold` check;
  40 face crops (`tools/art/flavor-faces.mjs`) in the strip with role and look; prompts
  Life 2.26.0, Job 2.18.0; packet ceilings raised on purpose (see `packetBudget.test.ts`).
- **Validation:** lint, typecheck and the unit suite pass. The strip was screenshotted in
  Chromium at 900 and 390 px from a scratch route (not committed); the signed-in game was
  not browser-checked. Eval: three new scenarios, 3 runs each, one model, all checks
  passed (the report is in the gitignored `evals/results/`, so it is not in the PR):
  evidence, not a verdict, and no run of the old prompt for comparison.
- **Not done:** layout pass (one "who is here" row, shared face plate, hover card), more
  faces per role (older/younger), "Also here" in the Job packet. ROADMAP debts 27 and 28.
- **Needs Levi:** a look over the 49 sex/age readings, which were read from the pictures. The seven left open at first are decided (follow-up PR: Kit, Lark, Wren, Sunny and Cutter female, Marrow male, Adair left androgynous).
- **Next:** review the PR, then decide the layout pass and which faces to generate.
