# Product

This document describes what Night City Tales is trying to become, and how to
tell a good decision from a bad one when the code does not say.

`AGENTS.md` is the contract: where code lives, what may import what, which
boundaries are load-bearing. This is the compass: what the software is _for_.
When the two disagree, `AGENTS.md` wins on structure and this document wins on
intent. When neither settles it, the priority ladder below does.

`ROADMAP.md` applies this document to the current code: what is built, what is
next, and what is deferred on purpose.

It is written for anyone working in this repository, human or agent. It exists
because the failure mode here is not bad code. It is a large amount of clean,
well-typed, well-tested functionality that moves the product somewhere it should
not go. Requests like "improve the Life system", "make combat better", "add more
persistent consequences", "improve how the GM handles NPCs" have a dozen
plausible answers each, and most of them are wrong for this product.

---

## The fantasy

**You are living another life in Night City.**

Not reading about one. Not directing one. Living one, as a specific person with
rent, a landlord who knows their name, an armored jacket that is two firefights
from useless, a fixer who has stopped calling, a friend who wants something, a
gang that remembers their face, and eleven days until they cannot make rent.

Everything else follows from that sentence. Jobs matter because there is a life
outside them. Combat matters because its costs outlive the encounter.
Relationships matter because those people keep existing when the screen is
showing something else. Money matters because there is always something the
character genuinely needs and cannot quite afford.

The reaction we are building toward is not _"that AI wrote a good story."_
It is _"I cannot believe that happened to my character."_

The difference is authorship. The first reaction means the player felt a writer
behind the events. The second means they felt a world in front of them. Nearly
every design decision in this repository is an attempt to take authorship away
from the narrator and give it to the simulation.

---

## The priority ladder

Principles conflict. When two of these pull in opposite directions, the higher
one wins.

1. **The engine is authoritative.** No amount of narrative payoff justifies the
   model deciding, inventing, or quietly editing state.
2. **Consequences persist.** An event that changes nothing durable is close to
   worthless, however well written.
3. **The player acts; the game does not act for them.** Never resolve a
   meaningful decision on their behalf, and never present a choice whose outcome
   is already fixed.
4. **Concrete over abstract.** A named person at a named bar beats a "Socialize"
   button, every time.
5. **The world is honest, not dramatic.** Quiet nights are correct answers.
6. **Cyberpunk RED's mechanics are the skeleton.** Keep what makes them
   distinctive; delete the bookkeeping, never the mechanic.
7. **Speed of play.** A turn should be readable in seconds.

So: a slower turn that keeps a real mechanic beats a fast one that flattens it
(6 over 7). An honest quiet evening beats a manufactured ambush that would have
been more concrete (5 over 4). And a scene the model would write beautifully but
that requires it to invent a number does not ship (1 over everything).

---

## Before you build

**Do not equate more implementation with a better product.**

The failure mode this document exists to prevent is not bad code. It is a large
amount of clean, well-tested functionality that moves the product somewhere it
should not go — and the commonest way that happens is a new mechanism arriving
where an existing one would have served.

Before introducing a new abstraction, table, service, state machine, prompt or
framework:

1. **Inspect whether an existing system can serve the purpose.** Most of what
   this codebase needs, it already has: a situation funnel, a closed
   observation vocabulary, a clock shape, an oracle, a cast with dossiers, a
   deterministic seed. Reaching for one of those is nearly always better than
   standing up its cousin.
2. **Explain what player experience the change improves.** If the answer is
   only that the architecture would be tidier, it is not a change to this
   product. Name the moment at the table it makes better.
3. **Prefer the smallest implementation that meaningfully advances things.**
   Smallest that _advances_ — not the smallest that compiles, and not the
   complete version of an idea nobody has played yet.
4. **Preserve deterministic systems as authoritative where possible.** When a
   new feature seems to need the model to own something the engine could own,
   the answer is almost always a new closed vocabulary rather than an
   exception.
5. **Treat AI as a way to make the game reactive and open-ended, not as a
   replacement for game design.** The model is how an unplanned action gets an
   answer. It is not how a system gets designed, and prose is not a substitute
   for a rule.

A change that cannot answer these is usually a change that wanted to exist more
than the game wanted it.

---

## The loop

```
LIFE → HOOK → JOB → AFTERMATH → LIFE
```

These are explicit application state, not a mood. `src/engine/phase.ts` owns the
machine, and every transition has exactly one code path that can trigger it.
`accept_hook` is the only door into a job and only the player presses it.

This is not a stylistic preference. It is the single strongest guarantee in the
product: the narrator cannot decide the game has become a mission. Life and Job
even run from separate system prompts (`src/features/life/lifeSystemPrompt.ts`,
`src/features/gm/gmSystemPrompt.ts`), and the Life response schema cannot express
a job transition. The model is not asked to behave. It is not given the
vocabulary to misbehave.

Combat can occur inside a Job and, rarely, inside Life. It is a mode within a
phase, not a phase of its own.

### Life

Life is the foundation, not the corridor between missions. It is a compact,
turn-based city layer where the player repeatedly meets a concrete situation and
decides how to spend limited time, money, attention, goodwill and risk.

A Life turn should be understandable in seconds. The player sees where they are,
what time it is, the state that currently matters, **one** situation, a few
concrete things to do about it, and the freedom to do something else entirely.

Life is not a menu of everything theoretically possible. The application picks
what is loudest right now (`src/engine/life.ts` scores candidates from real
state: money owed, wounds, empty magazines, people neglected, pressures coming
due) and the model only dresses the one that won. The model never remembers,
escalates, or expires anything.

Situations come from five places, and the mix is the pacing:

- **Needs** the character must eventually deal with. Rent, wounds, ammunition,
  armor, chrome, food, transport, replacing what was lost.
- **People** taking initiative. A fixer calls. A neighbour needs help. Someone
  they disappointed stops answering.
- **Opportunities** that tempt. A rumor, cheap chrome with no history, a fight
  in a basement, a favor that will cost more than it pays.
- **Pressure** pushing back. Retaliation, an investigation, a collector, a
  deadline, a promise that came due.
- **The ground** they are standing on. The water truck did not make it today.
  The elevator is dead again. There is a toll on this street. See "The city"
  below: these are not descriptions of a place, they are situations it
  produced, and they are scored against the rent like everything else.

Routine Life resolves fast: one to three sentences, visible deltas, time spent.

```
-€$100      +1 Kiro      +2 hours
```

The prose supplies the smell of the corridor. The mechanics carry the weight.

### Hooks

A fixer calling is a **hook**, never an automatic mission. The player may hear it
out, ask questions, negotiate, investigate first, delay, refuse, ignore the call,
or go do something else entirely. Ignoring it is a real answer with real
consequences, not a soft block.

Whether work exists tonight is a die roll the engine makes
(`WORK_ON_THE_WIRE` in `src/engine/oracle.ts`), not a judgement the narrator
makes about whether the fiction is ready for a job. On most nights it rolls
nothing, and the evening is written without work in it.

Negotiation is mechanical, not conversational theater: pushing on pay, on who is
really paying, and on what is actually waiting are three differently shaped asks
with different risks (`src/engine/negotiation.ts`). Pushing can cost you
standing. That is what makes asking a decision.

### Jobs

**Jobs present problems, not solutions.**

Wrong:

> You can sneak through the rear entrance, hack the cameras, or bribe the guard.

Right:

> The warehouse sits behind twelve feet of chainlink. One guard smokes beside the
> loading dock. Two cameras sweep the south wall. A delivery van is backing
> toward the gate.

The second one is harder to write and it is the entire product. Suggested actions
exist to speed up common verbs, never to define the boundary of what is
attemptable. The moment the suggestions become the options, this is a dialogue
tree with extra latency.

A job is not over when the money lands. Its residue is the point: money, spent
ammunition, ablated armor, a Critical Injury, a body, a witness, a faction that
now has a file, a favor owed, an enemy who got away, a promise made in a corridor
and forgotten by morning.

### Aftermath

Aftermath is where the job becomes life again. It is also where the game tells
the truth about what happened: `src/engine/settlement.ts` replays the job's own
ledger and prices what it finds, reading events the _engine_ wrote rather than
what the narration mentioned. A firefight the GM forgot to describe is still a
firefight. Nobody gets a free one.

---

## Where the line is

This is the most important section in the document, and the one most likely to be
violated by a well-meaning change.

**The AI describes consequences. The rules decide uncertainty. The player decides
actions.**

| The engine owns                                           | The model owns                                 |
| --------------------------------------------------------- | ---------------------------------------------- |
| Dice, DVs, damage, armor, HP, Death Saves                 | How the hit looks and what it costs to watch   |
| Positions, distance, range, MOVE, initiative              | Who these people are and how they talk         |
| Money, inventory, ammunition, time, phase                 | Interpreting what the player meant             |
| Relationships, standings, clocks, pressure                | Improvising an answer to something unplanned   |
| What a job cost and who noticed                           | Connective tissue, texture, voice              |
| Where places are, what is on there, what they have become | Why this street feels like this one            |
| Whether work exists tonight, and what is behind it        | The room, the hour, the noise through the wall |

The engine is authoritative wherever it is practical to be authoritative, and the
project has repeatedly chosen to make it practical. Five patterns, already
shipped, are worth understanding because new work should extend them rather than
invent alternatives:

**Closed vocabularies.** The model reports from fixed word lists and the engine
prices them. It says `seen`, `named`, `witness`, `killed`, `loud`, `clean`
(`OBSERVATIONS` in `src/engine/clocks.ts`); the engine decides that is two
segments of an Arasaka file. It picks an arena and a threat profile from lists
built into the prompt from the engine's own data. It uses skill ids exactly as
printed and DVs only from the published table. A model that can only speak in
nouns the engine understands cannot drift.

**Distance is the DV.** `src/engine/battlefield.ts` exists because a narrator who
writes "about eight metres" has silently chosen the difficulty of the shot. The
engine places everyone, measures, and reads the printed Range DV table. Range is
measured in continuous metres, because RED's bands are 6/12/25/50/100/200/400/800
and a tile size would quantise them.

MOVEMENT is a different question, and the book answers it differently: a Move
Action covers "a number of squares (if playing on a grid) equal to their MOVE",
and a square is 2 m (pg. 168). So `src/engine/grid.ts` puts a 2 m lattice over
the same metres — bodies stand on square centres, a Move spends squares, and the
board draws exactly the squares the gate will accept. Range is still measured
between those positions in metres, off the printed table. Quantising WHERE
somebody stands does not quantise how far away they are.

One number in that lattice is invented and labelled as such: a diagonal step
costs 1.5 squares rather than the book's 1, so that counted squares and measured
metres cannot drift apart on the diagonal.

**Oracles.** Some things nobody at the table decides: whether work reaches you,
what the client left out, whether the clinic is still open. The engine rolls
those (`src/engine/oracle.ts`), _nothing happens_ is by far the most common
result, and the model may ask a yes/no question it is not allowed to answer
itself. This is what stops the model being the invisible author: it finds out
when the player does.

**Withheld knowledge.** The standing cast carry dossiers the model has never
seen (`src/engine/cast.ts`). What someone wants, fears, is hiding, and will not
do is released one rung at a time through play. A model that can see a secret
telegraphs it, and a telegraphed secret was never a secret. When the world tick
decides someone acts, the model is told _that_ Kiro is asking a favor and never
_why_.

**Computed memory.** The long campaign record is rebuilt from state the engine
already holds, never summarized by a model (`src/engine/chronicle.ts`). A summary
of summaries compounds its own errors permanently. A derived record cannot be
wrong, only stale, and it is recomputed every turn.

Two further rules that fall out of the same line:

- The model may **propose**; the engine **validates and resolves**.
  `src/engine/capability.ts` and `src/engine/legality.ts` mean it cannot propose
  firing an empty weapon, spending money that is not there, or acting twice in a
  Turn.
- Every resolution writes a full roll trace to the append-only ledger. The game
  can always show its work. That is not a debugging affordance, it is a trust
  affordance: a player who can see `8 + REF 8 + Handgun 6 = 22 vs DV 15` will
  believe the loss.

When a new feature seems to need the model to own something in the left column,
the answer is almost always a new closed vocabulary, not an exception.

---

## People

Relationships are a system, not dialogue flavor.

A campaign opens with six people (`src/engine/cast.ts`): three the game needs (a
fixer, a ripperdoc, a landlord) and three the character's own Lifepath already
rolled at creation (a friend, an enemy, and the one that ended badly). They are
generated once, deterministically, and every later turn draws on them.

Prefer the existing cast over inventing another intimidating ganger named Vex.
Recognition is the whole mechanism of attachment. The target thought is
_"Razor is here."_, and it only lands if Razor was there in week one, has a name
the player did not choose, and has been carrying the same grudge since.

Feelings are modelled as **disposition** on the person, not as a clock. There is
deliberately no "trust clock": a second dial for the same feeling drifts out of
step with the first. If a change proposes one, it is proposing a bug.

Not all of a person's state should be numeric on screen. Some of it should be
felt: who picks up, who takes the meeting, who mentions a thing you would rather
they forgot.

People act on their own. Once per in-world day the city gets a roll
(`src/engine/worldTick.ts`) and, on the rare day it comes up, exactly one person
moves. They ask for something, call in what they are owed, warn you, go quiet, or
come looking. One person, not six. A city that does something to you every day is
not alive, it is a notification tray.

---

## Pressure

Organisations are not people. A faction (`src/engine/factions.ts`) has no face to
read and no memory of a conversation, only an institutional opinion that moves
slowly and does not forget. Kill three Tyger Claws and the Claws are colder
toward you for the rest of the campaign, whether or not anyone who saw it is
still breathing.

Clocks are the shape of slow pressure: heat, investigations, retaliation, six
segments as the house standard. Corps and cops open a file; gangs come to your
door. Some clocks are visible, because known pressure is playable. Some are
hidden, because the world should be allowed to develop without narrating its own
machinery.

```
NCPD Heat              ███░░░
Arasaka Investigation  ██░░░░
Rent due               3 days
```

`clean` is worth reporting. Getting away without a trace is the only thing that
takes pressure back off, which is what makes a quiet exit a real objective.

---

## The city

Night City is a system, not a setting. The atlas — 24 districts and 156
locations, transcribed from the publisher's own book — is the ground the other
systems stand on, and four rules keep it that way.

**Where you are is a game variable.** The ground produces situations
(`engine/placeBeats.ts`), the district decides what noise costs you
(`engine/places.ts` reads each district's printed security provider, so being
loud in the Exec Zone is answered by Lazarus and being loud in Rancho Coronado
is answered by "NCPD (in theory)"), the location's tags decide what there is to
do (`engine/placeActions.ts`) and which arena a fight starts in.

**Location changes access, never printed price.** The Night Market cost ladder
IS the availability ladder, so a district decides what is on the shelf, whether
the unusual thing is in tonight, and how far you must travel to reach it. This
is the same ruling as the ripperdoc's: disposition buys an earlier appointment,
never a better price.

**What was written is a starting condition, not an eternal one.** Places carry
dials and flags (`engine/placeState.ts`) that move only when the engine prices
an observation against them. Bring the law down on the night market often
enough and the market closes, the beat that ran it stops firing, and the entry
the player read in week one is history. A dial that changes nothing the player
meets is decoration; every dial should reach something.

**Quiet is enforced, not hoped for.** The map may light three pins in the whole
city and one per district, every signal must trace to a row, and there is no
interestingness score — anything that measures how interesting a place is will
always find something, and then every pin is lit and this is a quest board with
a skin on. A place with nothing on it is the normal case. Going somewhere on an
ordinary afternoon and buying vegetables has to be a supported way for the
afternoon to go, because a game whose quiet moments are dead ends will
manufacture noise to avoid them.

Two further things fall out of the same line. **Familiarity pays in
information, never in dice**: visits open rungs on facts the engine already
holds about a place, because RED's DVs are printed and a home-field bonus is an
invented rule. And **presence is not a summons**: the standing cast keep places
(`engine/haunts.ts`), so if you go to the bar somebody drinks at, they are
probably in — but that puts nothing on the board and asks nothing of you. The
world tick still owns people acting.

---

## Money, time and the body

**Money** should produce decisions, not a score. The player should routinely want
more than they can afford: rent, food, ammunition, armor repair, a ripperdoc's
bill, transport, a bribe, a debt, the chrome that would have saved them last
time. Eurobucks that only ever go up have stopped being a mechanic.

**Time** is a resource with the same weight. Everything costs plausible in-world
time, healing included, which is exactly why recovery is a decision: a character
who rests until whole has paid a month's rent lying down
(`src/engine/downtime.ts`). Deadlines, shop hours, NPC schedules and job windows
all exist so that time can be spent badly.

**The body** does not reset between scenes. Wounds, wound states, Critical
Injuries, ablated armor, spent magazines and medical bills carry into Life and
are usually the reason the next Life turn has a shape. Do not balance away
Cyberpunk RED's lethality. Winning should frequently cost something. A fight the
player walks away from clean should feel like a result, not the default.

**Humanity** is the long arc: the chrome that makes the character survivable is
the same chrome that costs them the ability to be around people. Cyberware
decisions should be tempting and expensive in both currencies.

**Advancement** is Improvement Points spent between sessions at printed prices
(`src/engine/advancement.ts`). Growth is real, slow, and never a substitute for
the persistent-consequence layer.

---

## Character creation is act one

Creation is not a form standing between the player and the game. It is the first
half hour of the fantasy, and it is where the campaign's cast, debts, enemy and
old flame come from. The Lifepath answers are not backstory decoration: they are
grafted into the standing cast verbatim, so what the player wrote in week one is
still true in week forty.

Streetrat, Edgerunner and Complete Package all lead to the same game. Rolled and
chosen results are both audited and both legitimate. Whatever else changes here,
creation should keep producing a person with specific problems rather than a
statistically valid character.

---

## Interface

**It should not look like a chat window.** Chat-shaped input is a critical escape
hatch for agency. It is not the interface.

Prefer event cards, portraits, action cards, resource chips, relationship
indicators, clock dials, the battlefield, inventory, equipment, short dialogue,
visible state changes, contextual controls.

**Show, do not explain.**

| Prefer             | Over                                                           |
| ------------------ | -------------------------------------------------------------- |
| `Armor SP 11 → 8`  | "Your armor is badly damaged and will need repairs."           |
| `Kiro ↑`           | "Kiro seems to trust you a little more after that."            |
| `-€$450   +3 days` | "The ripperdoc's work takes several days and costs a fortune." |

Prose is for emotion and texture. Systems are for state. Never both for the same
fact.

**Default to concise, reveal on demand.** Combat shows `22 vs DV 15 · HIT` and,
if the player wants it, `Roll 8 + REF 8 + Handgun 6 = 22`, then
`16 damage · SP 7 → 6 · 9 HP lost`. Fast by default, fully auditable on request.

**Keep the player moving.** The rhythm is
_situation → decision → resolution → state change → new situation_. A player
should rarely read a wall of text before they can act again. Length is earned by
importance: a Critical Injury, a death, a betrayal, a reversal. Not by every
attack.

**Meaningful choices differ.** In risk, cost, time, information, relationships,
tactical position, or moral weight. Three buttons that reach the same state are
worse than one button, because they cost the player the effort of choosing and
give nothing back.

**Freeform is a first-class input, not a fallback.** The player can click Move,
Shoot, Reload, Aim, Negotiate, Pay, Repair. They can also type:

> Shoot the sprinkler pipe above them and cut the lights.
> Call my landlord and lie about when I get paid.
> Follow the fixer instead of taking the job.
> Sell the prototype to someone else.

The application makes common actions fast. The model makes uncommon actions
possible. That combination is the product. Neither half is optional.

---

## Combat

Combat is where this becomes most explicitly a game. The target is **Cyberpunk
RED mechanics, a tactical interface, and AI-powered openness**, in that order of
non-negotiability.

Once violence starts, the game enters a dedicated combat mode. The player
interacts with the battlefield, combatants, initiative, range, cover, weapons,
ammunition, armor, HP, Critical Injuries and their own Turn. Narration supports
the fight. Narration is never the fight.

Keep what makes RED itself: Initiative, MOVE, one Move plus one Action, range
DVs, STAT plus Skill plus 1d10, damage dice, armor SP and ablation, Critical
Injuries, aimed shots, autofire, suppressive fire, melee and martial arts,
grappling, Death Saves, ammunition, wound states, cover. The goal is never to
simplify these away. It is to make them effortless: the computer does lookup and
arithmetic, the player makes tactical decisions.

The separation of responsibilities matters more here than anywhere:

- **Combat engine.** Deterministic TypeScript. Legality, movement, range, attack
  resolution, damage, armor, Critical Injuries, ammunition, initiative, state
  transitions.
- **Battlefield.** Spatial truth in metres, and the interaction surface over it.
- **Tactical AI.** Chooses _legal_ NPC actions from goals, personality, morale
  and training.
- **AI GM.** Narrates, interprets unusual intent, characterizes, and carries the
  fight back into the campaign.

Enemies should not be interchangeable. A frightened ganger hides, shoots badly,
drags a friend out, surrenders. A trained Solo picks the real threat, plays the
range band, repositions, suppresses, and leaves while it is still winnable. A
cyberpsycho does not care about any of that. Personality changes tactics, never
the rules.

Combat narration is short by default. `The round punches through his jacket and
spins him into the vending machine.` Save the paragraph for the Critical Injury,
the death, the collapse, the surrender.

**Currently shipped:** continuous-metre positioning, arenas, threat profiles,
initiative, attacks, damage, ablation, Death Saves, ammunition, a legality layer,
cover and line of sight, and a read-only combat HUD. Cover follows the printed
rules (pg. 182-183): it is all-or-nothing rather than a penalty, it has hit
points and no SP, and a section of it is shot at exactly as a person is — so a
firefight is not two people trading dice from behind permanent walls.
**Direction, not yet built:** walls and doors as their own geometry, interactive
scenery, hazards, in-fight objectives, a fully interactive tactical map, and the
half of cover the player cannot yet reach — deliberately taking cover, and
shooting a section apart, both of which need somewhere to click. New combat work
should move toward that list without ever routing a mechanic through the model
to get there.

---

## Voice

`src/lib/prose-style.ts` is the single source of truth for tone, and generated
prose should import it rather than restating it. What follows is why it reads the
way it does.

Night City should feel dangerous, intimate, lived-in, expensive, occasionally
funny, frequently unfair, and human. Grim without being relentlessly bleak.
Gallows humor and swagger, not misery for its own sake.

Avoid generic neon dystopia. The city needs convenience stores, bad apartments,
bars, friends, food that is worse than it costs, bills, jokes, boredom, weather,
small favors, stupid arguments, broken appliances, dangerous people, ordinary
people, and moments of unearned beauty. The contrast is what makes the violence
land. A world that is only rain and chrome has nothing to lose.

---

## Anti-goals

Things that would be improvements to some product, but not this one.

- **Endless generated prose.** More text is not more immersion. It is usually
  less agency.
- **Infinite procedural NPCs.** A smaller recurring cast beats an unlimited
  supply of strangers.
- **Constant jobs.** The life is what makes the job matter.
- **Fake agency.** No choices whose outcome is predetermined, and no suggestion
  lists that are secretly the only legal moves.
- **A helpful GM.** Naming a way in, softening a failure, or steering the player
  back to the intended approach is the failure mode, not the service.
- **Manufactured drama.** Not every NPC has a secret. Not every alley has an
  ambush. Not every job is a conspiracy. Not everything is connected.
- **AI omnipotence.** The model operates inside the systems, never above them.
- **Rules purity at the cost of usability.** Keep the mechanic, delete the
  lookup.
- **Videogame simplification at the cost of freedom.** Structured UI should
  accelerate the common action without foreclosing the strange one.
- **A second source of truth.** Anything the engine already models should not be
  re-modelled in a prompt, a component, or a database column.

Out of scope for now, and not by accident: multiplayer or party play, a
GM-authored metaplot, and content that requires the model to hold canon the
engine cannot verify.

---

## How to tell it is going wrong

Practical smells, in roughly descending severity.

- A number appears in prose that no engine module produced.
- The model can pick from an open-ended set where a closed vocabulary would do.
- A new dial duplicates a feeling something else already models.
- Something summarized by a model is stored and later treated as fact.
- The player is inside a job without having pressed accept.
- A scene resolves entirely in narration when it could plausibly have failed.
- The suggested actions have quietly become the only actions.
- A turn ends with nothing durable changed, twice in a row.
- An NPC is invented when a member of the standing cast would have served.
- A quiet evening has been filled with a stranger, a phone call, or a noise in
  the corridor because the turn felt empty.
- Every pin on the map has something on it.
- A place's dial moves and nothing the player could ever meet depends on it.
- A location is described rather than played: the entry changed, and what the
  place does did not.
- The player is reading more than they are deciding.

---

## Open questions

Honest ambiguity, recorded so that it gets decided rather than defaulted into.

- **Death.** RED is lethal and permanence is the strongest possible statement of
  consequence, but a fifty-hour campaign ending to one bad Death Save is a
  different product. The current answer is that the rules stand; the long-term
  shape of what happens after a death is undecided.
- **Netrunning.** The Net is a distinct sub-game in RED with its own architecture
  and pacing. Whether it becomes a first-class mode or stays an ability with
  fiction attached is unsettled.
- **Session shape.** How much Life belongs between two jobs before it becomes a
  chore is a pacing question that only playtesting answers.
- **How much state to show.** Disposition, standings and clocks are all
  legible-in-principle. Which of them the player should see as numbers is a live
  question, and the default is fewer. A place's dials are currently hidden
  outright — you learn the market has gone quiet by finding it gone quiet — and
  whether that reads as depth or as nothing happening is unsettled.
- **How fast a place should change.** Four loud nights closes a market
  (`place-state.json`). Those numbers are pacing guesses that have not been
  played, and the honest way to settle them is a week in one district rather
  than an argument.
- **How much of the city to author.** Beats compose from tags so the whole city
  has something, but only Rancho Coronado is written up specifically. Whether
  composed beats carry enough weight to leave it there is the question that
  decides how big the content job is.

---

## The session we are building toward

The player wakes up wounded. The jacket is chewed. Rent is due in three days. A
friend wants to meet, and there is not enough money for the repair and the
evening both.

They fix the jacket. At the ripperdoc's they run into someone they have been
avoiding since a job two weeks ago, and that conversation goes somewhere neither
of them planned. Later the phone rings, and a fixer has work. The player asks who
is really paying, gets a worse answer than they wanted, pushes on the fee anyway,
and takes it.

The job goes sideways in the third room. Combat is tactical, close, and expensive.
They win, with a Critical Injury, four rounds left, a witness who walked, and a
faction that now has a file open.

They come home with money, a ruined jacket, a new enemy, and a promise they
forgot to keep. The landlord is waiting on the step.

The player thinks: _I will deal with that tomorrow._

And tomorrow actually comes.

---

## North star

Five questions, in order.

1. **Does this make the player feel more like they are living another life in
   Night City?** If not, it does not belong, however good it is.
2. **Can this be a game interaction instead of more text?** If it can, it should
   be.
3. **Does this need the model at all?** Use it for reaction, character, voice and
   improvisation. Never for anything a deterministic system can own.
4. **Will this still matter in ten minutes, two jobs, or three in-game weeks?**
   If nothing survives the scene, the scene was decoration.
5. **Who is the author of this outcome?** If the answer is the narrator, take it
   away and give it to the dice, the systems, or the player.

And when authored narrative and honest simulation pull against each other:
**prefer the world that can surprise us.**
