# Life: the phase between jobs

## Critique of the brief

**What's strong**

- The phase model (`life → hook → job → aftermath → life`) with the *app* as authority is exactly right, and it fits what's already here: campaigns already outlive a single job, and `startNextJob` already keeps money, wounds and kit across jobs. Life is the missing room between them.
- "UI carries the information, prose carries the mood" matches the codebase's core contract — the engine owns numbers, the GM narrates. Life is the same contract with a different screen.
- Structured AI response over free prose: the GM turn already returns a validated object through a tolerant normalizer, so a Life-shaped response is a small extension, not a new system.
- "No generic downtime menu" is a fair criticism of what exists today: `DowntimePanel` is literally Rest / Pay bills / Repair armor. It should stay as the *mechanics*, and stop being the *interface*.
- Persistent situations + clocks are the right unit of memory. `campaign_flags` already stores arbitrary keyed world facts, so clocks have a home.

**What I'd change**

1. **Situations must be engine objects, not AI memories.** The brief lets the AI generate situations from four categories. If the AI both invents and remembers them, they evaporate. Instead: the app keeps a table of live situations with clocks and deadlines, and the AI's job each turn is to *dress* the situation the app selected, plus propose at most one new one. Selection, escalation and expiry are deterministic.
2. **Don't let the AI invent Life outcomes either.** Same rule as combat: the AI proposes, the engine resolves. Money spent, time advanced, HP healed, armor repaired, disposition moved — all engine-applied deltas from a fixed vocabulary, never numbers the model asserts in prose.
3. **The clock is currently fake.** `campaigns.minute` exists and `formatClock` renders it, but nothing in the play loop ever advances it; only downtime rest moves `day`. Life can't make time a resource until there's one `advanceClock` path everything goes through. This is prerequisite work, not a nice-to-have.
4. **Four content categories is a taxonomy, not a system.** I'd keep them, but give each a deterministic trigger source so the world moves without the AI: NEEDS from real state (bills due, damaged armor, low HP, empty magazines, Humanity), PRESSURE from clocks ticking, PEOPLE from recurring NPCs with a "last seen" day, OPPORTUNITY as the only mostly-AI-authored one.
5. **The hook needs its own contract.** "Player must knowingly commit" is right but under-specified. I'd make the commit a single explicit engine action (`accept_job`) that no free-text path can trigger implicitly — the AI can never emit it; only a button the player presses in a Hook card can.
6. **Don't reuse the Job GM prompt with a mode flag.** Agreed with the brief — but go further: a separate system prompt *and* a separate response schema, so `start_encounter` and `advance_beat` aren't even expressible in Life. Violence in Life should be possible, but it must route through the hook/job boundary or a small skirmish, not the mission beat machine.
7. **Cut the first slice smaller than the brief's list.** Ship one loop end-to-end (situation → 3 actions + freeform → resolve → deltas → time → next situation) with three seeded situation generators, then add categories. The acceptance test only needs that plus the hook.
8. **Freeform must still hit the legality gate.** `judgeAction` and the capability snapshot already exist; Life actions that spend money, use items, or fire weapons go through them, otherwise Life becomes the hole in the wall the whole legality layer was built to close.

## What gets built

### 1. Phase, made authoritative

- `campaigns.phase` column: `life | hook | job | aftermath`, default `life`.
- Engine module `src/engine/phase.ts`: the legal transitions and who may trigger each. Only `acceptHook` moves `hook → job`; only mission settlement moves `job → aftermath`; only the aftermath wrap-up moves back to `life`.
- Existing job play is untouched. `PlayScreen` picks the Life screen or the current job screen off `phase`, and every existing job path keeps working exactly as it does now.
- `startNextJob` stops firing automatically at wrap-up. Wrap-up moves to `aftermath`, then to `life`; the next job arrives as a hook.

### 2. The clock becomes real

- `src/engine/clock.ts`: `advanceClock(clock, minutes)` rolling minutes into days, plus a named cost table (`TIME_COSTS`) for call / travel / shop / repair / evening / sleep.
- One backend helper writes `day` + `minute` together; Life actions, downtime rest and sleep all go through it.
- Status bar renders weekday, time and day count from the clock.

### 3. Situations and clocks as state

New tables (with grants + RLS mirroring the existing `owns_campaign` pattern):

- `campaign_situations` — `key`, `category` (need/people/opportunity/pressure), `title`, `summary`, `npc_key`, `status` (live/resolved/expired/escalated), `severity`, `due_day`, `data`, timestamps.
- `campaign_clocks` — `key`, `label`, `filled`, `segments`, `hidden`, `data`.

Engine (`src/engine/life.ts`, pure):

- `deriveNeeds(state)` — turns real numbers into candidate situations: bills due, armor below SP, HP below max, weapons empty or broken, Humanity below threshold, eurobucks near zero. All read from existing engine helpers; no invented values.
- `tickClocks(clocks, minutesPassed)` and `escalate(situation)` — deterministic worsening and expiry.
- `selectSituation(candidates)` — one primary per turn, weighted by severity and deadline, never the same key twice in a row unless it escalated.

### 4. The Life turn

`src/features/life/` (new), reusing existing components and styling:

- `LifeScreen.tsx` — status bar (day/time/district, eurobucks, wound state, Humanity when relevant, up to two pressure chips), situation card (title, 1–3 sentences, NPC avatar when known), 3 action cards, "Do something else…" freeform, and a visible clock rail for non-hidden clocks.
- Action cards show what the character would reasonably know before committing: time cost, known eurobuck cost, and the skill it leans on (reusing the existing skill-hover treatment from the suggestion chips).
- Resolution shows a delta strip — `−€$400`, `+2 hours`, `Armor repaired`, `Wakako +1` — with the GM's 1–3 sentences underneath, not instead of it.
- Mobile: single column, situation dominant, actions stacked; desktop: situation + actions centre, clocks and status as rails.

### 5. Life GM mode

- `src/features/life/lifeSystemPrompt.ts` — its own versioned prompt: run Life, never start a job, never place the player in an operation, keep narration to a few sentences, NPCs act on their own motives, nothing dramatic is required every turn. Prose voice comes from `CYBERPUNK_STYLE_GUIDE` as everywhere else.
- `src/features/life/lifeResponse.ts` — its own zod wire schema + tolerant normalizer (same pattern as `gmResponse.ts`): `situation`, `actions[]` (label, description, timeMinutes, knownCost, skillId), `resolution` text, `proposedActions` limited to `skill_check | opposed_check | spend | use_item | travel | rest | hook_offer | none`, `deltas`, `newSituation?`.
- `src/features/life/lifeContext.ts` — the context slice: clock, vitals, money, live situations, visible + hidden clocks, recurring NPCs with disposition and last-seen day, and the existing capability block so it can't propose the impossible.
- `lifeTurn.server.ts` — mirrors `gmTurn.server.ts` (same gateway, same error mapping).

### 6. Resolution pipeline (engine-owned)

`useLife.ts` runs: legality gate (`judgeAction` on the capability snapshot) → dice if a check is proposed (reusing `CheckCard` and the existing skill-check engine) → apply deltas → advance clock → tick clocks and situations → append to the campaign ledger → request the next situation. Every euro, HP point and SP point is applied by existing backend adapters, never by the model.

### 7. Hooks and the job boundary

- A `hook_offer` proposal creates a `campaign_situations` row of category `people` with the offer's terms in `data`, and moves the phase to `hook`.
- The Hook card offers: hear him out, ask who's paying, negotiate, not tonight, refuse, ignore, plus freeform. Questioning and negotiating are ordinary Life turns (an opposed Persuasion check can move the payout inside a printed band).
- **Accept** is the only path into `job`: it calls the existing job start (mission runtime, luck refresh, mission_started event) unchanged. The AI cannot emit an accept.
- Refuse/ignore writes consequences: fixer trust clock moves, the offer expires after a deadline day.
- On job completion, `aftermath` shows the existing payout + I.P. wrap-up, then returns to `life` with wounds, damaged armor and spent ammo intact — which is what seeds the next Life turn's NEEDS.

### 8. Downtime, repositioned

`DowntimePanel` stays as the mechanical backend (rest, bills, repair maths are all correct and tested) but is no longer the between-jobs interface; Life actions call the same `useDowntime` operations so there is one implementation of resting and paying rent.

## Technical notes

- New engine modules are pure and tested: `phase.ts`, `clock.ts`, `life.ts` (needs derivation, clock ticking, situation selection, escalation/expiry).
- Migration adds `campaigns.phase`, `campaign_situations`, `campaign_clocks`, each with GRANTs, RLS and `owns_campaign` policies; types regenerated after it applies.
- No rules values are invented: time costs are app pacing constants (documented as such, not presented as CP:R rules), and every mechanical number — DVs, repair cost, healing, bills, payouts — comes from `/src/data/rules/` through existing engine functions.
- Existing job code paths, tests and components are left alone apart from the phase switch and the wrap-up transition.

## First slice (what ships first)

Phase column + clock advance + situations/clocks tables + Life screen with situation, 3 actions, freeform, engine resolution and delta strip + NEEDS and PRESSURE generators + one recurring-NPC generator + hooks with explicit accept + return to Life after aftermath. Opportunities, richer relationship arcs and hidden-clock reveals follow once the loop is proven against the acceptance test.
