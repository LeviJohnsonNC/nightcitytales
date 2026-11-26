# Lucy’s private message — 2026-11-26 15:54 UTC

[PR #400](https://github.com/LeviJohnsonNC/nightcitytales/pull/400) is open on `codex/lucy-private-message`, base `0c0b054c`, tested implementation `d740cbe4` pushed.
The Opera pitch, LucyOffer, its CSS and LifeScreen put the family message, fee, questions, freeform reply and decision together. The campaign adapter now updates only the last-shown day when narration ends. This prevents stale offer terms or a declined offer returning. A Life turn regression covers the write.
Production build, typecheck, changed-file lint and 4,801 unit tests passed. Visually inspected the offer at 1440 and 390 px. Chromium exercised the shipping route with fixture campaign data and narrator replies, including a completed opposed roll, outcome persistence, hidden/revealed information, legacy acceptance, passing and freeform replies. Staging and live AI were not exercised.
Next after review and merge: “Open Lucy’s offer on a staging character, ask who is paying, then take the first lead.”

# Lucy’s opening offer — 2026-11-26 15:06 UTC

[Merged PR #399](https://github.com/LeviJohnsonNC/nightcitytales/pull/399), branch
`codex/lucy-job-offer`, base `d0995fc9`, tested implementation `32c54979` pushed.
Opera’s authored offer, LifeScreen, LucyOffer and CSS, LifeCheckCard, the saved
hook reader and its regression, OperaOpening, and ROADMAP comprise this pass.
The first offer shows Lucy’s broadcast and the saved fee with no automatic GM
turn. The quoted total reflects existing settlement behavior.

Production build, typecheck, changed-file lint, and all 4,800 unit tests passed.
Chromium exercised the shipping play route with a fixture Supabase backend at
1440×900 and 390×844. Verified the decline reason and freeform disclosure, the
Trading check and keyboard focus, and reload/acceptance of a legacy negotiated
offer with all three leads available. Inspected desktop, phone and accepted
screens. The staging campaign and the existing Opera action RPC were not
exercised against a live service. Next: review/merge #399 and play through
one lead on staging. Fresh-chat prompt: verify Lucy’s offer and first lead on
a signed-in staging campaign after #399.

# Landing readability and motion — 2026-11-25 17:11 UTC

[Draft PR #398](https://github.com/LeviJohnsonNC/nightcitytales/pull/398),
branch `codex/landing-reading-motion`, based on the merge of #397 at `5471e895`.
Implementation `4a60aed7` is pushed. The index renders copy and actions on first
paint and puts Life’s status labels in a strip beneath the illustration.
The landing components and styles gate rooftop effects on viewport, document
visibility, and motion preference. Regression coverage is in
`e2e/public-routes.spec.ts`.

Production build, typecheck, changed-file lint, 11 landing unit tests and all
14 desktop/phone landing browser checks passed. The browser checks cover
scrolling, live motion preferences and text visibility with JavaScript disabled.
Visually inspected the status strip at 1440×900 and 390×844. The environment
returned HTTP 403 for the hosted rooftop artwork. Review its crop at both sizes
in Lovable before merging. Fresh-chat prompt after merge: continue from #398
and check the hosted hero artwork at phone and desktop sizes.

# Public landing page, one night — 2026-11-25 17:02 UTC

[Draft PR #397](https://github.com/LeviJohnsonNC/nightcitytales/pull/397),
branch `codex/landing-one-night`, based on the merge of #396 at `36626fbf`.
Implementation `07adf807` is pushed. The index places `OneNight` immediately
after Evergreen and retains the Jobs anchor. LandingNav follows reading order.
The four-moment example combines the former Jobs panel and timeline, with the
existing motel artwork and a native disclosure for Dino’s sample reply.

Production build, typecheck, changed-file lint, 11 landing unit tests and
10 desktop/phone landing browser checks passed. The public-route regression
covers keyboard open and pointer close. Visually inspected the expanded section
at 1440×900 and collapsed at 390×844. The new section's artwork loads locally.
The previously requested hosted rooftop check still requires the Lovable preview
because the review environment returned HTTP 403 for the asset.

Next, review the One night section in Lovable and merge #397 when ready.

# Public landing page first pass — 2026-11-25 16:45 UTC

`LeviJohnsonNC/nightcitytales`, branch `codex/landing-evergreen-first-pass`,
base `9e3e3822`, implementation checked at `1da596c8`.

- The index route identifies the game in the hero. Its sample link opens the
  Evergreen scene at the existing `#the-game` anchor, with the player move,
  the clerk’s reply and the saved lead. Both widths use the existing game art.
- `StoryEntryLink` serves the hero, closing CTA and `LandingNav`. Signed-in
  users go to the roster. New visitors land on `/login?mode=signup`, and
  direct `/login` still opens sign-in. Both keep Google and email entry.
- Changed the two route files, the entry link, navigation and the public-route
  browser spec. Implementation committed for branch review.
- Production build, typecheck, changed-file lint and 11 landing unit tests
  passed. All 18 relevant browser checks passed at 1440×900 and 390×844,
  including the new sample-to-account flow. One phone sign-in load needed an
  isolated retry after Vite hot-reloaded during the original run.
- Visually checked the Evergreen section at desktop and phone sizes. Mock
  Supabase responses verified email confirmation and the signed-in roster
  destination. Real account creation and OAuth were outside this visual pass.
- Review the original rooftop image in the Lovable preview before merging.
  Its hosted asset returned 403 from this environment. Production is unchanged.

# A Night at the Opera opening — 2026-11-19

PR 394, branch `codex/opera-campaign-opening`, based on `88d3dbb`.
The pilot covers accepting the offer, finding the first lead, and confirming a
way into the party.

- The Evergreen illustration, case file, radio and composer carry over Life's
  scene hierarchy. First moves show the engine's time costs.
- The clerk, broadcast and campus approaches lead to the guest list, public
  ticket queue or press check-in. Clicked actions and equivalent typed
  commands share the Job submit path. Other free text goes to the Job GM.
- Mission branch history restores each learned fact on reload and supplies it
  to later GM turns. The case file keeps the lead and the confirmed way in.
- `20261119010000_opera_action.sql` commits progress, clock and history together.
  A retry uses the original request ID. Fresh local Postgres replay applied
  20 migrations above the baseline and passed the atomicity, stale choice,
  retry and ownership regression.
- The [roadmap](../ROADMAP.md#campaign-opening-pilot) ranks the signed-in
  Opera review, a single generated Job, then the broader Job and Aftermath pass.

All 4,799 tests, typecheck, lint, and the production build passed. Chromium
used a mocked session, backend, and GM response to verify six walkthroughs,
matching elapsed time for clicks and typed commands, reload, later GM facts,
and failures before and after commit. The route confirmation fits at 1280 × 690
and has no horizontal overflow at 390 px.

The schema migration and signed-in staging playthrough are the release gate.
This cloud workspace used npm registry tarball URLs for the temporary frozen
install because Lovable's package hosts returned HTTP 403.

[Previous handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/88d3dbb/docs/AI_HANDOFF.md)
covers the inventory migration and staging follow-up.
