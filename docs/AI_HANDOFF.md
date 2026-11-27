# Job scene continuity — 2026-11-27 17:08 UTC

[Draft PR #405](https://github.com/LeviJohnsonNC/nightcitytales/pull/405), branch `codex/job-scene-continuity` in `/workspace/nightcitytales`, stacked on #404 at `ef99f5ea`. Implementation `0c7f1f60` is pushed. `CityTurns` shares Life’s wait bar, and `JobScene`, `PlayScreen` and `usePlay` put the current turn, receipts and saved roll results beside the decision. The authored Opera scene adds two optional ways to investigate the invitation.
Typecheck, changed-file lint, formatting, and build passed. The full suite passed 4,804 of 4,805 tests. The timed-out nightclub composition test passed with all 11 tests in its isolated rerun. Chromium at 1440 and 390 px verified the delayed wait, reduced motion, after-show transition and a generated Job through a check and Journal with fixture data. Reviewed after-show layouts at both widths.
Next: review #404, then retarget #405 to main for review. The signed-in Lovable playthrough remains. Fresh-chat prompt after merge: “Verify the wait bar and the transition out of Symphony Hall in my Lovable campaign.”

# Player-facing copy cleanup — 2026-11-27 16:41 UTC

[Draft PR #404](https://github.com/LeviJohnsonNC/nightcitytales/pull/404), branch `codex/trim-ui-copy` in `/workspace/nightcitytales`, base `feb4451f` (merged PR #403). Implementation `ad88f052` is pushed. It removes unset-value copy and repeated instructions across chargen, roster, sign-in, Opening, Life, shops, Job, downtime, and the Rap Sheet. Job sources and Lifepath errata are available on demand. Required warnings, retries, rules and suggestion announcements remain.
The exact “Card name not specified” string is absent from tracked source. The shared Lifepath “Not set” fallback is removed. Existing untracked `generated_images/` is unrelated.
Build, typecheck, changed-file lint, and 4,805 tests passed. Local Chromium checks at 1440 and 390 px verified sign-in and sign-up copy and Symphony Hall with fixture data, including the compact success feedback, visible no-result feedback, and preserved action draft and campaign state. The live campaign was outside this browser check.
Next: review and merge #404. Fresh-chat prompt after merge: “Check an unselected Lifepath card and the Symphony Hall suggestions in Lovable.”

# Symphony Hall scene actions — 2026-11-27 16:14 UTC

[PR #403](https://github.com/LeviJohnsonNC/nightcitytales/pull/403), branch `codex/opera-scene-actions`, base `92a4c466`, implementation `6d3f872d` pushed. Opera scene typography, portrait selection and layout, and the open composer share a decision with three or four starting actions. The Job options path returns distinct ideas without writing a turn.
Build, typecheck, changed-file lint and 4,805 unit tests passed. Chromium ran at 1440 and 390 px with a fixture campaign and model. Checked repeated suggestions, draft and state preservation, confirmed and walk-on faces, camera availability, and the transition after the show. No provider credentials were available for the live narrator eval. Staging playthrough remains.
Fresh-chat prompt after merge: “Resume my save at Symphony Hall, try Suggest more actions, and check the next investigation scene.”

# Lucy’s investigation handoff — 2026-11-26 17:16 UTC

[PR #402](https://github.com/LeviJohnsonNC/nightcitytales/pull/402) from `codex/opera-investigation`, base `ec8d3bc8`, implementation `2548eb6c` pushed.
OperaOpening, PlayScreen, job loading and scene advancement, the authored mission, and the handbill WebP cover Getting Tickets and arrival at the show or the professor’s office. The case file uses the saved fee and offers keep their earned entry route.
Build, typecheck, changed-file lint and 4,802 tests passed. Chromium verified all three routes, a legacy save, both next scenes, fee and identity disclosure, Journal and Credibility dialogs, and focus on navigation and a resumed roll. Browser runs used a fixture backend and GM response at 390, 800, 1024 and 1440 px. Staging smoke test remains.
Fresh-chat prompt after merge: “Resume my staging campaign at Getting Tickets, then review how the next noncombat Job scenes could reuse this layout.”

# Lucy’s character sidebar — 2026-11-26 16:20 UTC

[PR #401](https://github.com/LeviJohnsonNC/nightcitytales/pull/401), branch `codex/lucy-character-sidebar`, base `b836ca0b`, implementation `b83dbdc4` pushed. LifeScreen, CharacterCard, mobileShell and lucy-offer.css restore desktop status beside the offer, keep the sheet below 1280 px and collapse the idle feedback band.

# Lucy’s private message — 2026-11-26 15:54 UTC

[PR #400](https://github.com/LeviJohnsonNC/nightcitytales/pull/400) merged from `codex/lucy-private-message`, base `0c0b054c`, tested implementation `d740cbe4` pushed.
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

PR #394 introduced the three ways into the show and the saved approach. The existing `20261119010000_opera_action.sql` commits progress, time and the receipt together. The [earlier handoff](https://github.com/LeviJohnsonNC/nightcitytales/blob/88d3dbb/docs/AI_HANDOFF.md) covers inventory migration and staging.
