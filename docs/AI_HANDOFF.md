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
