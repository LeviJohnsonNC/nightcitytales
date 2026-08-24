/**
 * House-voice colour for the STAT briefings on the character sheet.
 *
 * NOTHING in here is a rules value. Every number, DV, and formula still comes
 * out of src/data/rules/. These are two short paragraphs per STAT — what the
 * STAT feels like at the table, and what it costs you when it is thin — so the
 * modal reads like Night City instead of a spec sheet.
 */
import type { StatKey } from "@/engine";

export type StatFlavor = {
  /** What having this STAT actually buys you in play. */
  atTheTable: string;
  /** What a low score looks like from the inside. */
  whenItsThin: string;
};

export const STAT_FLAVOR: Record<StatKey, StatFlavor> = {
  int: {
    atTheTable:
      "INT is the part of you that keeps working while the rest of you is scared. It is the read on a room before you step into it, the name you half-remember from a corp org chart, the second look at a door that has been opened too recently. Players lean on it every time the answer is already in front of them and somebody has to notice.",
    whenItsThin:
      "Thin INT does not make you stupid — it makes you late. The clue sits on the table and nobody picks it up, and the fixer's silence turns out to have meant something three scenes after you needed to know.",
  },
  will: {
    atTheTable:
      "WILL is what is left when the plan is gone. It is the reason you keep walking down a corridor that is screaming at you, the reason a Ripperdoc's chair does not break you, the reason you say nothing while somebody explains exactly what they will do to your friends.",
    whenItsThin:
      "Low WILL cracks quietly. You take the deal. You blink first. You are not a coward — you are just tired in a city that never once offered you a reason to hold.",
  },
  cool: {
    atTheTable:
      "COOL is your public face and how well it holds. Charm, menace, the flat voice you use on the phone with people who could have you killed — it all comes out of here. Street rep is built by people who stayed convincing in rooms where nobody was buying.",
    whenItsThin:
      "Without COOL you are legible. Everyone in the bar knows what you want before you order, and the price adjusts accordingly.",
  },
  emp: {
    atTheTable:
      "EMP is the wire that still runs to other people. It reads the tell, hears the lie under the apology, notices that the kid working the counter has not blinked in a while. It is also the thing chrome eats, one implant at a time.",
    whenItsThin:
      "Low EMP is how the story ends for most edgerunners: not a bullet, just a slow drift until the people you used to love look like furniture.",
  },
  tech: {
    atTheTable:
      "TECH is hands. Steady ones. Cracking a housing without leaving marks, field-stripping a pistol on the floor of a moving AV, fixing the thing everyone else already wrote off as scrap. Night City runs on gear, and gear is always three minutes from failing.",
    whenItsThin:
      "Thin TECH means everything you own is disposable. When it breaks you replace it, and replacing it costs money you did not have in the first place.",
  },
  ref: {
    atTheTable:
      "REF is the gap between deciding and doing. It puts your rounds where you looked, it gets you moving before the first muzzle flash finishes, and it decides who in a hallway acts first — which, in most firefights, decides everything else.",
    whenItsThin:
      "Slow REF makes combat something that happens to you. You are always answering, never asking, and the round you never got to take is the one that would have mattered.",
  },
  dex: {
    atTheTable:
      "DEX is your whole body agreeing with you at once. Rooftops, fire escapes, a knife fight in a space too small for either of you, the drop from a ledge you told yourself was shorter. It is grace on a city that never built anything at a comfortable height.",
    whenItsThin:
      "Low DEX turns architecture into a threat. The route the rest of the crew took is closed to you, and you go the long way — past the cameras.",
  },
  move: {
    atTheTable:
      "MOVE is ground covered while people are shooting. Cover to cover, the sprint to the van, the distance between where the ambush wanted you and where you would rather be. In a running fight it is the most honest number on your sheet.",
    whenItsThin:
      "A short MOVE means the open ground is longer than you are brave. You either stay put and take it, or you make the run and hope.",
  },
  body: {
    atTheTable:
      "BODY is how much city you can absorb. Punches, falls, a slug that got past the armor, the long night after. It hits back too — heavy weapons, doors that were not meant to open, the person holding your collar deciding they picked the wrong collar.",
    whenItsThin:
      "Thin BODY makes every fight a coin flip. You can win the exchange and still be the one bleeding out behind the dumpster.",
  },
  luck: {
    atTheTable:
      "LUCK is the only STAT you spend. It is the thumb you get to put on the scale when a roll matters more than the odds allow, and it refreshes with each new session — a fresh allowance of near-misses.",
    whenItsThin:
      "Low LUCK means the dice are the whole story. No second chances, no almost — just whatever the d10 decided, every single time.",
  },
};
