# Roadmap

What is built, what is next, and why — in the order the product needs it.

`PRODUCT.md` says what the game is and how to decide. `AGENTS.md` says how the
code is organised and which gaps are open. This file says what to build next.
When they disagree, `PRODUCT.md` wins on intent and `AGENTS.md` wins on the
current state of the code.

---

## Now: the Tomorrow Test — shipped

The central claim in `PRODUCT.md` is that tomorrow remembers what happened
today. The loop — Life → Hook → Job → Aftermath → changed Life — existed as
separate working systems that did not reliably hand state to each other. The
closeout work connected them.

Shipped:

- Combat costs reach canonical campaign rows: HP, wound state, Death Save
  failures, armor SP, and loaded ammunition, rather than living only on the
  encounter.
- Job settlement is one locked, idempotent transaction (`settle_job`). A partial
  write can no longer lose a payout or leave tallies, pressure, or phase
  half-applied.
- Settlement re-reads fresh canonical state before planning closeout instead of
  trusting a mid-turn bundle.
- Aftermath closes atomically (`close_aftermath`).
- Wounds and armor are no longer duplicated as `aftermath_*` situations. Life
  derives them from vitals and inventory, so there is one source of truth.
- Attack ledger entries carry enough trace to reconstruct HP loss, armor
  ablation, ammunition spent, and Critical Injuries, and Aftermath shows that as
  a receipt.

The acceptance test is the loop itself: finish a job wounded, underpaid and
noticed, and tomorrow opens on a situation caused by those exact events.

Still open from this work, tracked in `AGENTS.md` under Known implementation
gaps: the bounded `JOB_LEDGER_LIMIT` settlement window, legacy encounters with
no armor inventory IDs, pressure pricing that is not causally deduplicated, and
the missing `(campaign_id, npc_id)` uniqueness constraint. None of them block
the loop; all of them are cheaper to fix now than after more systems lean on
settlement.

---

## Also shipped: the ripperdoc

Chrome was the one thing the shop deliberately would not sell. It now has its
own scene in Life: the full cyberware catalog, your ripperdoc's waiting list,
surgery, and recovery.

Shipped:

- Foundations, Option Slots, paired implants, mutually exclusive systems and
  affordability are decided in `engine/cyberwareInstall.ts`. The scene asks the
  engine what is legal; it never asks the model.
- Humanity Loss is rolled after creation the way RED says, including the
  round-up `1d6/2` form, and the loss moves current EMP — so chrome shows up in
  Social checks, in combat, and in what the GM is told about you.
- Installation commits atomically through `install_cyberware`: payment,
  Humanity, the implants and their foundations, elapsed time, ripperdoc state,
  and the ledger receipt. Idempotent on the caller's request id.
- **Chrome competes with the job.** Going under the knife during a live hook
  passes on that job, in the same transaction that installs the implant. Time
  on the table is time you did not spend working.
- Play reads live chrome from `campaign_cyberware` rather than mutating the
  saved character, and a new campaign snapshots its starting cyberware into it.
- Armor's REF penalty now reaches play through the same helper, so heavy plate
  finally costs something.

Pacing — 0/1/3 recovery days by install level, four surgery hours per physical
implant, appointment delay by disposition — is a house rule, and `catalog.json`
labels it as one beside the values it takes from the Core Rulebook. Tune it
there rather than in code.

Disposition buys an earlier appointment, never a better price. That is
deliberate: a person's opinion of you changes access, not the printed cost.

---

## Next: make Life feel like the actual game

Life is where the player spends most of their time and is currently the weakest
expression of the product's identity. It still reads closer to a conversation
with statistics attached than to living another life.

The work:

- Lead with one concrete situation, not a narrative transcript.
- Show time, location, immediate need, the person involved, and the pressure.
- Add contextual actions — Pay, Repair, Rest, Call, Meet, Shop, Leave — while
  keeping freeform input prominent for everything unconventional.
- Show mechanical deltas visually after resolution.
- Make a quiet evening playable and short.
- Strengthen recurring-person presentation: portraits, relationship signals.
- Let the player inspect campaign state without burying the active situation.

Success: the player opens the game, understands their immediate problem in
seconds, decides, sees the cost, and moves on.

This is the fastest visible improvement available, it has honest incremental
milestones, and it now has something real to render — the Tomorrow Test made
Life's inputs trustworthy.

An open product decision sits inside this work: whether `DowntimePanel` belongs
in Aftermath at all. Healing, repairing and paying bills in a utility panel
before reaching Life resolves exactly the situations Life exists to present.
Decide it deliberately rather than by default.

---

## Then: combat as an interactive tactical mode

`PRODUCT.md` is explicit that narration supports the fight and is never the
fight. The engine already holds continuous-metre positioning, arenas, threat
profiles, initiative, attacks, damage, ablation, Death Saves, ammunition, and a
legality layer — behind a read-only HUD.

The first playable battlefield layer:

- Render combatants spatially.
- Let the player pick a destination and move within MOVE.
- Show range bands and calculated DVs before attacking.
- Enforce one Move plus one Action.
- Make targeting, ammunition, ablation, HP, and initiative legible.
- Add cover and line of sight once movement is solid.
- Keep freeform intent for unusual environmental actions.

Success: the player wins by repositioning into the right range band, managing
ammunition, and choosing the right target — not by describing an impressive
attack to the model.

This is deliberately third. It is the highest-complexity item, and building it
before Life would leave jobs far stronger than the life they are supposed to
interrupt.

---

## Standing debts

Not features, but they get more expensive with time. Full detail in `AGENTS.md`.

- The `portraits` storage bucket is never created by a migration.
- Lifepath narrative, pronouns and self-description have nowhere to persist.
- Mission objectives, rewards and final campaign status are not fully updated by
  the play loop.
- Ordinary play turns still span multiple writes; only encounter saves,
  settlement and Aftermath closeout are transactional.
- `bun run lint` fails on a pre-existing `prefer-const` error.
- Migration history creates some campaign and encounter objects more than once,
  so a clean database reset is not proven.

---

## Explicitly not scheduled

Deferred on purpose, so that deferring them stays a decision:

- The full RED Critical Injury subsystem. Settlement records that a critical
  occurred; the mechanics deserve their own feature.
- Cyberpsychosis as something that happens to you. The threshold is read from
  the rules file and Life raises a `humanity_low` situation, but crossing it
  carries no mechanical consequence of its own yet.
- Netrunning as a first-class mode.
- What happens after a character death.
- General inventory consumption beyond ammunition.
