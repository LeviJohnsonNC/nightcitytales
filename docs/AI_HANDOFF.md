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

## Parallel stream — faces layout pass (Claude, branch claude/face-layout)

Updated 2026-10-12. Base origin/main c01abb0 (#374 and #375 merged). Goal: make the faces
belong on the page, not only be true.

- **Done (in the PR once it is pushed):** one "Here" row per scene (`sceneFaces.ts`,
  `SceneFaces.tsx`), one `FacePlate` for keeper, person and walk-on, the People rail's
  ring on known faces, names as text with a hover card (`NpcName`), `npcMentions.ts` as
  the one name matcher. Life's current turn lost its strip; scrollback and Job keep it.
- **Validation:** lint, typecheck and unit suite pass. Chromium screenshots (900 and
  390 px) and a hover/focus/Escape/click script on a scratch route that was not committed.
  The signed-in game was NOT browser-checked: that is the remaining gate
  (`docs/checkpoint-faces-layout.md`). No prompt or packet text changed, so no eval run.
- **Not done:** more faces per role (debt 27), "Also here" in the Job packet.
- **Next:** play a real Life turn and look at the row; then decide which faces to generate.

## Parallel stream — Job packet "Also here" (Claude, branch claude/job-also-here)

Updated 2026-10-12. Base origin/main d66f547 (#376 merged). Goal: the Job packet tells the
narrator who a place has standing in it, as Life does.

- **Done (in the PR once pushed):** `place.alsoHere` in the Job context, the shared
  `alsoHereNote("life"|"job")`, Job prompt 2.19.0, `resolveWalkOns` told-set in the Job turn,
  and the same "Here" row on the Job's pinned latest turn (people named and walk-ons tagged;
  not the place's roles). Job note says the beat decides who is in a scene.
- **Validation:** lint, typecheck, unit suite pass. Eval (3 runs, one model): all eight Job
  scenarios; the unsourced-number class failed at similar rates on main (2.18.0) and here;
  "opens on smells" in job-opens-a-room 2/5 here vs 1/5 on main over a 5-run recheck, which is
  not distinguishable from chance. The Job screen row was not browser-checked.
- **Next:** nonbinary support (identity, creation, portraits, narrator, checks) as its own PR.

## Parallel stream — nonbinary support (Claude, branch claude/nonbinary, stacked on claude/job-also-here)

Updated 2026-10-12. Goal: nonbinary characters, starting with the keeper Adair, then players.

- **Done (in the PR once pushed):** `Sex` gains `nonbinary` (they/them) in `engine/identity.ts` and
  `identity.json`; the picker says "Gender" with a third option; Adair is nonbinary; the narrator's
  appearance rule and `seenAsPronounsHold` hold "they"; prompts Life 2.27.0, Job 2.20.0.
- **Validation:** lint, typecheck, unit suite pass. The picker was exercised in Chromium on a scratch
  route (each option sets the right pronouns and line). Eval: nonbinary keeper scenario 3 runs, "they"
  every run. A nonbinary PLAYER character's third-person references are not measured.
- **Next:** none required; faces art (older/younger) remains debt 27.

## Parallel stream — walk-on names persist (Claude, branch claude/walkon-names-persist)

Updated 2026-10-13. A name learned for a role at a place is kept for good and shown every time.

- **Done (in the PR once pushed):** `knownWalkOnNames` reads it off the ledger by place; `resolveWalkOns`
  carries it; the Job narration now records `at`; the "Also here" line says who the character knows;
  prompts Life 2.29.0, Job 2.22.0; check `walk-on-keeps-known-name`; packet fixtures carry names (+112 chars,
  inside both ceilings).
- **Validation:** typecheck, lint, unit suite pass. Eval: `life-walk-on-known-name` first leaked the name into
  an npcKey (2/5 and then 3/5 runs failed `knownNpcKeysOnly`), fixed by one Life prompt sentence, then 0/5 over
  5 runs; the other face scenarios still pass 3/3. Not seen in a signed-in browser.

## Parallel stream — walk-on faces, second batch (Claude, branch claude/walkon-faces-batch2)

Updated 2026-10-14. The 67 young and older walk-on pictures are imported and used.

- **Done (in the PR once pushed):** PNGs converted to WebP at 1024/512 (`tools/art/webp.mjs`), 67 catalog entries
  (age 20 or 62, face squares set by eye from a gridded contact sheet), faces cut (`tools/art/flavor-faces.mjs`);
  `pickFlavorFace` chooses one per role and place, the packet's "Also here" line describes it, and the id is stored
  on the narration's `walkOns` (`face`) so the player sees the face described.
- **Validation:** typecheck, lint, unit suite (4,764) and build pass; eval 5 face scenarios x 3 runs, all checks clean.
  Not seen in a signed-in browser.
