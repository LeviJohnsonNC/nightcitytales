# Night City Tales — resume here

Updated 2026-10-09. Next revision: workshop depth and covered balcony.
PR328 confirmed merged by GitHub at 06dffcd08a3afb2123a84040c413925392d75a97.
Levi explicitly accepts that merge as baseline and wants the NEXT PR's paired visuals.
Do not wait for PR328's previous artifact review or ask for re-upload to proceed.

## Workflow

Remote LeviJohnsonNC/nightcitytales. New branch codex/workshop-depth.
Local city-block-recovery history is reconstructed: NEVER git push.
Publish selected files through GitHub connector. Levi merges/deploys.
Preserve unrelated cityBlock.ts formatting, cityBlock.test.ts and recovery docs.

## This revision

Presentation only on the occupied repair premises selected by v13 attachments.
Replace the repeated pegboard/radio strip with separate wide repair bench and narrow
parts storage bay. New workshopInterior.ts draws an asymmetric CRT, open receiver,
bench magnifier, speaker, parts bins and job cards at physical facade dimensions.
Two narrow street-facing windows use the same equipment composition.
Add a shallow folded metal canopy below the shop sign. Enlarge the upper balcony
with a projecting slab, privacy screen, roof and posts; retain plants and cloth.
Lift the balcony 0.35m so its projection clears the sign at the oblique camera angle.
Subtract matching canopy/balcony silhouettes from additive light/glow in
frontageIdentity.ts so windows cannot shine through opaque fittings. Same cutaway
clip as the albedo. Regression checks mask use and canvas-state restoration.
No new generated paintings. No recipe, collision, cover, route or actor changes.

## Verification

All 4121 local tests/328 files passed, including two unrelated untracked cityBlock
tests excluded from publication. Typecheck, changed-file ESLint and diff checks pass.
Final balcony height adjustment followed by typecheck/lint; full suite preceded it.
Live Chrome checked normal night, Reveal, neutral and compact normal. No console
errors. Evidence: docs/evidence/workshop-depth (local checkpoint only).
Local captures are not same-viewport CI comparisons. New PR paired captures are the
next visual decision point; do not call visual quality accepted yet.
Actor rings looked single/anchored locally; earlier CI duplicate-ring report remains
unresolved. Watch the next CI captures; no speculative actor changes made.

## Preview

Vite localhost5174; stop/restart after source edits because HMR caching was unreliable.
Chrome extension preview works; local Playwright browser launcher previously failed.
Use /scene-review?place=intersection&seed=8&adventure=0&actors=1&access=0&night=1&lights=1&reflect=on&reveal=0
Paired CI capture workflow is already in repository from prior revisions.
