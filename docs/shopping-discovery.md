# Shopping, strange gear, and discovery

The agreed design and its milestones. Levi's brief was the fantasy:

> Discover something strange → understand what it does → imagine a use → try
> something clever → it becomes part of your story.

This file is the plan of record for that work. `PRODUCT.md` still decides intent
and `AGENTS.md` architecture; this says what the shopping passes are building
and in what order. A store UI overhaul follows these passes, so every pass keeps
the rules in pure engine/model modules and the sheets thin: the look can be
replaced without touching what a shop does.

## The central decision: a tool is a permission, not a bonus

Night City Tales resolves the world through checks, oracles, clocks, closed
observations, truths and the combat board. There is no NPC hearing, no sound
propagation and no interactive scenery outside combat, so an item that "makes a
noise where you leave it" cannot be honest by simulating physics. It is honest
when it changes what the ENGINE resolves. Each strange item carries one (rarely
two) capabilities from a closed list, and each capability maps to a lever the
engine already owns:

| Capability | What the engine guarantees                                | Lever                      |
| ---------- | --------------------------------------------------------- | -------------------------- |
| Remote     | An approach may be made from elsewhere; no `seen` for it  | observations, clocks       |
| Watch      | Left at a place, it truthfully answers "did anyone come?" | oracles, place state       |
| Pass       | A route or approach becomes legal that otherwise is not   | legality, place approaches |
| Shield     | Deploys a section of cover with HP on the combat board    | cover, prop placement      |
| Quiet      | A `loud` act is not recorded as loud                      | observations               |
| Quick      | An activity takes less in-world time                      | clock                      |
| Reveal     | Opens one truth's approach                                | truths, Deduction          |

Limits come from a closed list too: charges, range, must be recovered,
conspicuous, unreliable (an oracle). Whether the clever plan works is still a
check or an oracle, so failure is the world answering, never the game ignoring
the player. The narrator is told the contract and may not exceed it.

## Milestones

**1. Honest shelves.** _Shipped in this pass._ Stock is derived
(`engine/shopStock.ts`): seed + seller + stock week, minus this week's purchases
from the ledger. Pressing Buy again can no longer reroll the stock die. Four
layers (staples, the shop's line, the week's unusual roll, a back room opened by
the place's `welcome` flag), "new since your last visit", "What's unusual?" and a
restock countdown. Each atlas shop has a `signature` and `backRoom` in
`place-shops.json`.

**2. Strange gear.** _Shipped: quiet, remote and quick finds (`engine/gadgets.ts`), one of each a week at shops that sell them, the kit bonuses on the roll, and each find's contract in the packet. No migration was needed after all: a find's item id is its whole identity. Watch, Pass, Reveal and Shield wait for the levers later passes build._ Originally planned as: Item instances (a `data` jsonb on `campaign_inventory`: the
same per-row modification concept the Tech's Upgrade Expertise is blocked on),
the capability vocabulary as a house-rule data file, authored base objects ×
capability × limit with deterministic hashed names, finds in shop stock, each
capability wired to its lever, the item's contract in the narrator packet
(through `packetBudget.ts`), and the printed gear bonuses (Medscanner,
Techscanner, Agent…) applied to checks with their names in the odds chip.

**3. The city stocks the shops.** _Shipped: `engine/shopSupply.ts` (salvage flags and settled jobs lean nearby shops' and fences' finds and lend them provenance in the id; hot finds a ladder step cheaper and `seen` against the faction on purchase), selling at half price, sold finds back on the shelf for two weeks._ Originally planned as: Place flags (`raided`, `burned`…), settled jobs
and their factions weight what turns up where; provenance is a key into what the
ledger recorded, never prose. Selling at pawn and street shops; a unique item
sold stays on that shelf for a few weeks. Hot goods carry an observation risk.

**4. Merchants know you.** _Shipped: interests and word of mouth, one hold with a deposit, range trials, item records (`engine/merchantTies.ts`). Not built: repair/restoration terms and Shield cover in combat._ Originally planned as: Up to two "keep an eye out for" needs from the
capability list; one hold citywide with a deposit and an expiry clock, shown in
Within reach; a find held for you ("saw this and thought of you"), told in
Aftermath or Life, never as a ping; trial at a range; repair and restoration
terms; an item's record ("Day 41, Dock 13: kept you alive") computed from the
checks it was part of. Shield cover in combat if it fits.

## Deliberately not built

A free-form combination engine (later, one shape: Watch output → Remote effect),
model-written provenance, an AI image per item, auctions, cyberware
demonstrations as scenes, the detachable Anchorhand (needs body-part state),
shopkeepers as cast members, stacked limited-time offers.
