# Progression, and the first ten minutes

Two things the game does not do yet.

**It does not tell you where you stand.** Improvement Points are judged once, at
the end of a job, and are invisible until then. Money is a bare number in a
header while the obligation behind it — rent, Lifestyle, the month that came due
— is modelled in `engine/downtime.ts` and shown nowhere. Objectives render a
checkmark that nothing can ever set.

**It does not have an opening.** A campaign is created from a roster button that
seeds a mission before the player has seen a word of fiction, and drops them
mid-beat. The one real choice at the start — the authored opener or a generated
job — is made out of character, in a UI that belongs to the character list.

This is the plan for both, and the ruling it is built on.

## The ruling: pressure and trajectory, not score

PRODUCT.md is not neutral about this request. It says money "should produce
decisions, not a score", that "Eurobucks that only ever go up have stopped being
a mechanic"; it warns that anything measuring how interesting a place is "will
always find something, and then every pin is lit and this is a quest board with
a skin on"; and on how much state to show, "the default is fewer".

It is also, in the same document, explicit that the interface should "prefer
event cards, portraits, action cards, resource chips, relationship indicators,
clock dials" and should "show, do not explain" — `Armor SP 11 -> 8`, `Kiro ^`,
`-E$450 +3 days`.

Both are satisfied by the same rule: **show the pressure and the trajectory, not
the score.**

| Instead of  | Show                                |
| ----------- | ----------------------------------- |
| `E$4,350`   | `E$4,350 - rent in 11 days`         |
| An XP bar   | `340 IP - 60 more for Handgun 6->7` |
| A quest log | The commitments you actually made   |

Every one of those is the same data the game already holds, turned to face the
decision it is supposed to produce. None of them is a new mechanic, which is the
bar PRODUCT.md sets in "Before you build".

## What the code actually does today

Established by reading it, not assumed.

**IP.** `awardImprovementPoints` is called from exactly one place,
`features/play/playOps.ts:1820`, at mission settlement. Spending is
`SpendIpCard`, reachable from the roster and the downtime panel.
`ipDescriptor(ip, column)` already returns per-tier prose for each of the four
playstyle columns and is rendered by nothing.

**Money.** `billsDue()` in `engine/downtime.ts` charges rent and Lifestyle a
whole month at a time against `paid_through_day`, so the runway is a pure
function of state that exists. `LifeScreen.tsx:615` renders
`{bundle.vitals.eurobucks}eb`.

**Objectives are broken.** `MissionObjective.status` is set to `"active"` by
`objectivesFor` (`engine/mission.ts:179`) and merged forward by `advance`.
Nothing in the repository ever writes `"done"` or `"failed"` — the only other
mention of either is the renderer at `PlayScreen.tsx:620` and the settlement
line at `playOps.ts:1718`, which counts closed objectives and therefore reports
`0/N objectives closed` on every job ever completed. This is standing debt 10 in
ROADMAP.md. A progress surface built over this today would be a progress surface
that never moves.

**First play.** `RosterList` and `CharacterDetail` call
`startOrResumeAdventure`, which resolves a mission id (`NIGHT_AT_THE_OPERA` or a
generated job), creates the campaign, and lands the player on Play, where
`needsOpeningScene` triggers `openScene` to narrate whichever beat the mission
starts on.

## What this reuses rather than invents

- **The situation funnel.** `LifeSituation` already carries a category
  (`need`, `people`, `opportunity`, `pressure`, `hook`), a severity of 1 to 5, and
  a `dueDay`. It is persisted, aged and scored every Life turn. It is a
  commitments model that has never been shown as a standing list.
- **Clocks.** `engine/clocks.ts` gives six-segment, faction-scoped pressure with
  a `hidden` flag already on the definition, so a dial that renders is a dial the
  character can feel coming.
- **Advancement.** `availableSkillRaises` and `skillRaiseCost` already price
  every purchase, which is what makes "what you could buy next" a read rather
  than a new system.
- **Cast dispositions** and **place dials, flags and truths**, unchanged.

No new tables. The rail is derived state.

---

## Phase 0 — Make objectives tick

A prerequisite, not a nicety: nothing downstream is honest until an objective
can close.

- Add `completeObjective` and `failObjective` to `engine/mission.ts`.
- Give `BeatExit` optional `completes: string[]` and `fails: string[]`, applied
  by `advance`. The beat graph closes its own objectives when an exit is taken:
  deterministic, engine-owned, no model judgement, consistent with the mission
  runtime owning position and transitions.
- Backfill `missions/nightAtTheOpera.ts` and `missions/generator.ts`.
- Extend `validateMission` to reject an exit naming an objective the mission does
  not declare, so a typo fails in a test rather than stranding a player.
- Test: a full walk of the authored opener ends with objectives closed, and
  `playOps.ts:1718` stops reporting `0/N`.
- Clear standing debt 10 in ROADMAP.md.

Merged on its own, before anything else.

## Phase 1 — The status rail — shipped

Built as described, with two decisions taken during the work and recorded here
rather than left in a commit message.

**It replaced rather than joined.** The bare Eurobucks number in the Life rail,
the "On your plate" list and the separate Pressure panel are gone: the first was
a score rather than a pressure, and the other two put a lead the world was
dangling on the same footing as a promise the player made. Adding a rail beside
them would have meant the same facts in two places, drifting.

**Play passes no clocks.** `PressurePanel` is their home on that screen, and
saying it twice is worse than either.

## Phase 1 — as planned

One component, three chips, derived on render.

| Chip        | Face                                                          | Expanded                                        |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------- |
| Money       | `E$4,350 - rent in 11d`, amber under a month, red when owed   | Bills due, Lifestyle, what the current job pays |
| Growth      | `340 IP - 60 more for Handgun 6->7`, "ready to spend" at zero | `availableSkillRaises`, cheapest first          |
| Commitments | `3 open - 1 due today`                                        | The Phase 2 panel                               |

The Growth chip reads the **cheapest available raise** and the gap to it, so the
number on screen is always a distance to a decision rather than a score.

**Placement.** Full rail in Life, always. In Play it collapses to a single
tappable strip that expands on demand — the Play screen already carries vitals,
the scene, objectives, prompts and the combat board, and on a phone it cannot
afford three more chips at rest.

## Phase 2 — The commitments panel — shipped

Live situations grouped with due dates, severity, the job's objectives pinned
above them and visible clocks as six-segment dials. The rule that keeps it off
the quest board is enforced in `statusModel.ts` rather than left to the
renderer: `COMMITTED_CATEGORIES` is `need`, `people`, `pressure`, and an
`opportunity` or a `hook` is a **lead** — shown under its own heading, never
counted in the chip.

## Phase 2 — as planned

Live situations grouped by category, `dueDay` rendered as `due in 2 days`,
severity as a dot count, the active mission's objectives pinned at the top, and
visible clocks as segment dials (`NCPD Heat [##....]`). Hidden clocks stay
hidden.

The line that keeps this off the quest board: **nothing appears here that the
player did not cause.** A job they took, a promise they made, a debt they owe, a
clock they started. Opportunities the world is dangling are not commitments and
do not belong in the list — they arrive through the funnel, as they do now.

## Phase 3 — The opening — shipped

Built as planned, with four decisions taken during the work.

**`take_work` offers the authored opener.** "A Night at the Opera" is the
strongest first job in the game, and it is now reached in fiction rather than
from a button on the character list. It is an OFFER: the player can question it,
argue the fee up, or turn it down, and the wire supplies generated work from
then on. One line in `openingOps.ts` changes it to a generated job if that ever
reads as too fixed.

**It offers, it does not start.** `take_work` moves LIFE → HOOK, not LIFE → JOB.
`accept_hook` remains the only door into a job, and the player still gets the
negotiation.

**Money reaches the model as a band, never a figure.** The style guide's hardest
rule is that numbers belong to the engine, and the surest way to stop the cold
open pricing the rent is never to hand it the rent. A test asserts no long
number appears in the prompt at all.

**The doors' wording falls back; the prose never does.** A model that forgets a
door, invents a fifth, or repeats one still produces a playable first screen,
because the doors are the engine's. Empty prose is a failed generation and is
reported as one, per the call below.

## Phase 3 — as planned

The roster's starter-versus-generated button is removed. In its place, on
campaign creation and before any mission is seeded:

A server call generates **two to three paragraphs** from material the engine
already holds — lifepath, Role, home place and its dials, known truths, starting
Lifestyle and what is owed — and returns **four openings** drawn from a closed
vocabulary. The model writes the flavour; the engine owns the consequence:

| Choice        | What the engine does                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| `take_work`   | Seeds a mission — the authored opener or a generated job — and enters HOOK           |
| `see_someone` | Seeds a `people` situation against a seeded cast NPC; stays in LIFE                  |
| `just_living` | Seeds a `need` situation grounded at home; stays in LIFE                             |
| `role_action` | Seeds an `opportunity` situation from the character's Role affordance; stays in LIFE |

This is the same split as the hook offer: closed vocabulary in, deterministic
transition out, prose around it. Three of the four open the game in **Life**,
which the game currently cannot do — every campaign today begins mid-job.

Night at the Opera is not retired; it becomes one of the things `take_work` can
hand over, reached in fiction rather than from a character-list button.

**On failure: retry, then block.** The intro is the experience and will not be
degraded — a failed generation offers a retry rather than a lesser opening. The
consequence, stated plainly: first play then depends on a paid AI call
succeeding, and an outage means a new campaign cannot be started at all. The
four choices are engine-owned regardless, so if that trade ever looks wrong, an
authored fallback intro can be added later without touching the branch logic.

## Phase 4 — Receipts — shipped

`−€$450`, `HP 30 → 21`, `Kiro ↑`, `NCPD Heat 4/6` with its dial, `+3 hours`,
under the Life log, fading after seven seconds.

Built as a **diff of two snapshots**, not a new record. Every value was already
moved by the turn and written to a row; none of them was ever shown as a
_change_. So nothing here is stored and nothing here can disagree with what it
came from.

Two rules worth keeping:

- **A card appears only when something moved.** A turn that changed nothing
  produces none. A strip that is always lit is wallpaper.
- **A hidden clock is never a receipt.** Showing its movement would leak exactly
  what hiding it was for.

Time sorts last, because it moves on almost every turn and would otherwise be
the card the eye lands on first.

## Phase 4 — as planned

Transient cards after a turn resolves: `Kiro ^`, `-E$450 +3 days`,
`Handgun 6->7`, `NCPD Heat [##....]`. The rail is standing state; the receipts
are feedback. This is where the request's "video game-y" actually lands, and it
is the cheapest phase, because every value in it is already computed and
discarded.

---

## Sequencing

1. **Phase 0**, alone, merged first.
2. **Phases 1 and 2** together — the rail is not worth much without the panel
   behind its third chip.
3. **Phase 3**.
4. **Phase 4**.

## Decisions taken, and by whom

Settled with the product owner before writing this:

- Goals mean **commitments the player made**, not generated opportunities and
  not a long-term ambition track.
- Money leads with **runway**, not balance.
- IP shows the **banked total and the gap to the cheapest available raise**. No
  live playstyle meter during a job — that would invite playing to the meter.
- The opening's four choices **really branch**.
- Night at the Opera becomes **something `take_work` can offer**.
- The rail is **full in Life, collapsed in Play**.
- A failed intro generation **retries and blocks**.
