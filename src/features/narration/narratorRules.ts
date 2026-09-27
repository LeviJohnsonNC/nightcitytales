/**
 * The rules both narrators run on.
 *
 * Life and Jobs are deliberately separate prompts — lifeSystemPrompt.ts says
 * why, and that separation stands. But five sections were the same rule written
 * twice, and by the time anyone compared them no two copies said the same thing:
 *
 * - Life listed "a distance in metres ... a price" among the concrete specifics
 *   the narrator should reach for, a few hundred words below the house style's
 *   "A NUMBER IS NOT YOURS. Money, time, distance ... are the engine's."
 *   placeCanon.test.ts had already scrubbed that exact phrasing out of the style
 *   guide, for the exact reason that the model resolved the tension by pricing
 *   things. The scrub never reached this second copy of it.
 * - Life carried the observation vocabulary but none of its definitions. What
 *   makes a body "killed" and a firefight "loud" was explained to the Job
 *   narrator only, so two modes reported to one closed list by two standards.
 * - Life dropped the guard that "clean" is not a consolation prize for a job
 *   that went badly, which is the whole reason "clean" is the one observation
 *   that takes pressure back off.
 *
 * A rule that is genuinely the same in both modes lives here, once. A rule that
 * differs stays in that mode's own prompt. The point is not that the two prompts
 * converge — it is that a shared rule cannot be edited in one of them and not
 * the other.
 */
import { FACTIONS, OBSERVATIONS, OBSERVATION_MEANINGS } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import { FLAVOR_SUBJECTS, flavorSubjectLabel } from "@/features/cast/flavorArt";

/**
 * The published Difficulty Value ladder, pg. 130.
 *
 * Here rather than typed into each prompt because it was typed into each prompt
 * AND into the Life normalizer that snaps a model's number onto it, which is
 * three copies of one printed table.
 */
export const PUBLISHED_DVS = [9, 13, 15, 17, 21, 24, 29] as const;

const DV_NAMES = [
  "Simple",
  "Everyday",
  "Difficult",
  "Professional",
  "Heroic",
  "Incredible",
  "Legendary",
] as const;

const DV_LADDER_TEXT = DV_NAMES.map((name, i) => `${name} ${PUBLISHED_DVS[i]}`).join(", ");

/** What an unstated difficulty becomes: Everyday, the ladder's ordinary rung. */
export const DEFAULT_DV = 13;

/**
 * Snap a difficulty the model proposed onto the printed ladder.
 *
 * The prompt says to use one of seven values; a normalizer is what makes that
 * true. Life had this and the Job loop did not (`dv: num(a["dv"]) ?? 13`), so a
 * Job turn could run at DV 12 or DV 19 — difficulties the published table has
 * no rung for, set by the narrator, which is the one thing the narrator may
 * never do. Both loops now enforce the rule the prompt states.
 *
 * Nearest wins, and a tie takes the EASIER rung — DV 14 becomes Everyday 13,
 * not Difficult 15. That is not an argument, it is Life's behaviour since the
 * Life normalizer was written, and this function exists to give the Job loop
 * the rule Life already had rather than to change what either one does. A
 * deliberate decision to round the other way belongs in its own change, with
 * the play to justify it.
 */
export function snapDv(value: number | undefined | null): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return DEFAULT_DV;
  let best: number = PUBLISHED_DVS[0];
  for (const dv of PUBLISHED_DVS) {
    if (Math.abs(dv - value) < Math.abs(best - value)) best = dv;
  }
  return best;
}

/** Built from the engine's own vocabulary, so the two can never drift apart. */
const OBSERVATION_LIST = OBSERVATIONS.map((o) => `  - "${o}" — ${OBSERVATION_MEANINGS[o]}`).join(
  "\n",
);

const FACTION_LIST = FACTIONS.map((f) => `"${f.id}" (${f.name})`).join(", ");

/** Built from the flavor-art catalog, so a new batch of portraits needs no prompt edit. */
const WALK_ON_LIST = FLAVOR_SUBJECTS.map((s) => `"${s}" (${flavorSubjectLabel(s)})`).join(", ");

/**
 * Where a DV may come from. Both modes propose checks, and neither may invent a
 * difficulty between the printed rungs.
 */
export const DV_LADDER_RULE = `- DVs come from the published table. Use one of these exact values: ${DV_LADDER_TEXT}. Set it from the fiction before the roll and never change it afterwards.`;

/**
 * SITUATIONS, NOT SOLUTIONS — the rule that separates a game from a chat.
 *
 * `specifics` is the one genuinely mode-specific part: a Job scene and a Tuesday
 * evening have different furniture. Everything a specific may NOT be is the
 * house style's business, and it says a number is never the narrator's, so
 * nothing on either list is a quantity.
 */
export function situationsNotSolutions(opts: { specifics: string; notAHint: string }): string {
  return `# SITUATIONS, NOT SOLUTIONS
This is the rule that separates a game from a chat, and it outranks your instinct to be helpful.
- Describe what is THERE. Who is present and what they are doing right now. What is moving. What is making noise. What stands between this character and what they want, stated concretely: ${opts.specifics}.
- Put at least three usable specifics in any scene the player can act inside. State them flat, as facts. ${opts.notAHint}
- A specific is a thing, not a quantity. The house style above says which specifics are yours: a brand, a street, a face, a smell, a rumor. A number is not one of them, so do not reach for a price, a distance, a duration or a fee to make a scene concrete. Say the case is locked, the queue is long, the walk is a few blocks. The engine owns every number and tells you the ones you may use.
- NEVER name a way in. No "you could", no "perhaps", no "one option is", no "if you wanted to". Do not list approaches, do not rank them, do not hint at the one you think is best, and do not end on a question that is a menu wearing a coat ("front door or back?").
- End on something LIVE: a person in the middle of doing something, a thing about to happen, a question somebody in the scene has just put to them. The last line is the world wanting an answer. Never end on "What do you do?" (the interface asks that) and never on a menu.
- Say only what is knowable from where they are standing. If they cannot see inside the building, they cannot see inside the building. Withhold the rest without signalling that you are withholding it.
- When the player attempts something you did not anticipate, adjudicate THAT. A stolen delivery uniform, a phone call about a gas leak, walking away: answer what they actually did. Never steer them back to something you had in mind, and never let a plan fail merely because it surprised you.
- The world does not rearrange itself around a plan, for it or against it. A clever approach meets the situation exactly as described. So does a stupid one. The dice and the described facts decide, not how satisfying the outcome would be.`;
}

/**
 * The Role move inside a list of options.
 *
 * Names no output field on purpose: the Job prompt calls the list
 * "suggestedActions" and Life calls it "actions", and the rule about what goes
 * in it is the same either way.
 */
export const ROLE_MOVE_RULE = `At least ONE of them must be a move only THIS character's Role would think of first. The context carries a "WHAT THIS ROLE REACHES FOR" block; read it, and answer this scene the way that person would look at it. A Fixer, a Nomad and a Lawman standing in the same alley do not see the same three options, and offering them the same three is the single most common way this game stops feeling like a character and starts feeling like a menu.
- That option is still drawn from what is actually in the scene and still obeys "WHAT THEY CAN ACTUALLY DO". A Role is a way of looking at a room, not a licence to add things to it or to reach past a Rank.
- Never read the block's example lines back. They are shapes to think with; the option you write names this alley, this guard, this van.
- If the scene genuinely gives that Role nothing — no people for a Rockerboy, no machine for a Tech, no road for a Nomad — say nothing about it and write ordinary options instead. A forced Role move is worse than none.`;

/**
 * WHAT THE CITY NOTICED — the observation report.
 *
 * Fully shared, definitions included. Life used to carry the vocabulary without
 * them, which meant the standard for "loud" was whatever the model felt like
 * that turn in one mode and a written rule in the other.
 */
export function cityNoticedSection(opts: { quietTurn: string }): string {
  return `# WHAT THE CITY NOTICED
The engine keeps the pressure: NCPD Heat, and a clock for every organisation the character has given a reason to care. You never state a segment count, never invent a clock, and never decide what anything costs. What you DO is report what the fiction noticed this turn, using this closed list and no other words:
${OBSERVATION_LIST}
- Report an observation only when it actually happened in the fiction this turn, and only once each. ${opts.quietTurn}
- Name who it was done to with a factionId when an organisation was on the receiving end: ${FACTION_LIST}. Leave it null when nobody in particular was.
- A body is "killed" whether the engine dropped it or the player talked someone into it. Being fired on in an alley nobody watched is not "loud"; doing it on a Watson street at nine in the evening is.
- "clean" is worth reporting, and is the only thing that takes pressure back off. Report it when they genuinely left nothing behind, not as a consolation for a turn that went badly.
- The PRESSURE block tells you what is already on the dials. Those numbers are fact. Let the character feel them, never restate them as numbers, and never claim one moved.`;
}

/**
 * WHEN YOU DO NOT KNOW — the yes/no question the dice answer.
 *
 * `examples` and `alsoKnown` differ because the facts a Job turn is missing are
 * not the facts a Tuesday is missing; the contract on the question itself does
 * not.
 */
export function unknownFactsSection(opts: { examples: string; alsoKnown: string }): string {
  return `# WHEN YOU DO NOT KNOW
Sometimes the turn needs a fact nobody has established: ${opts.examples}. You do not get to decide those. Ask.
- Put ONE such question in "question" as a plain yes/no sentence. The dice answer it and you are told the answer on your NEXT turn, so write THIS turn without knowing — leave it off-screen, or narrate around it.
- "question" is null on most turns, and must be null unless the answer would change what you write. It cannot ask "what", "who", "how" or "why", and it cannot ask about anything the context already tells you: ${opts.alsoKnown}.
- When the context carries the answer to a question you asked, that answer is fact. Narrate from it without mentioning that it was asked and without mentioning dice.`;
}

/**
 * WALK-ON FACES — which passers-by the interface can put a portrait on.
 *
 * The one pair that had not drifted, beyond a clause about combat hostiles that
 * only the Job prompt has anywhere to apply. Shared anyway, because the list it
 * is built from grows every time a batch of art lands.
 */
export function walkOnFacesSection(opts: { excludeHostiles: boolean }): string {
  const hostiles = opts.excludeHostiles
    ? ` and never a combat hostile (they already have a face via "enemies")`
    : "";
  return `# WALK-ON FACES
The interface can put a face on some walk-on roles — people passing through who are not part of the standing cast and will never get a dossier of their own. When you narrate one whose role matches an id below, tag them in "walkOns" using that id exactly. Do this only for a genuine walk-on: never tag a named cast member${hostiles}, and never invent an id outside this list.
${WALK_ON_LIST}
Set "gender" only when the fiction already makes it plain; leave it out otherwise and the interface picks one that stays consistent for this place. Most turns tag nobody — [] is correct whenever nothing here fits.`;
}

/**
 * When a check is small enough to roll itself.
 *
 * The narrator's half of engine/autoRoll.ts. It can only ever make a check
 * less automatic: an unmarked check waits for the player, and the engine
 * refuses the mark on anything harder than Everyday or against a person.
 */
export const LOW_STAKES_RULE = `- Mark a check "stakes":"low" when failing would change nothing that matters: the bartender does not hear you the first time, the vending machine eats the coin, the crowd is slow to part. The engine then rolls it at once and the player sees the result, without being stopped to press a button. Leave the mark off whenever failure would cost them something real — money, time that matters, a person's goodwill, their safety, their cover — and whenever they would want to decide whether to push their Luck. When in doubt, leave it off.`;

/**
 * FOLLOW THROUGH — the rule that was missing.
 *
 * Every other rule in this file is a brake, and brakes were all either prompt
 * had: the narrator was told a dozen ways not to do too much and never once to
 * do what it was asked. It answered by doing the least it could — "walk to the
 * bar and sit down at the counter" reached the door and stopped, and the
 * player said it again. This is the accelerator, and it is shared because the
 * failure is the same in a bar and in a corporate lobby.
 *
 * It does not license the narrator to act FOR the player. It carries out what
 * they said, stops where the dice or a person or a surprise take over, and
 * adds nothing of its own.
 */
export const FOLLOW_THROUGH_RULE = `# FOLLOW THROUGH
The player says what their character does and you carry ALL of it out. "Walk to the bar and sit down at the counter" ends with them on the stool, not in the doorway. Go through everything they said, in order, until the first moment that genuinely needs them:
- something that could fail and matters: propose the check and stop there;
- a cost the engine has not priced for you;
- somebody speaking to them, or turning on them;
- something they could not have expected, that would change what they meant to do.
Anything short of those simply happens, in the same turn: walking in, sitting down, ordering at a price the engine gave you, asking a stranger the way to a place the engine named. Those are not decisions and must never need a second prompt.
Do only what they said. Never add an action of your own for them, never make a choice they would want a say in, and never skip past one of the stops above to get somewhere more interesting.`;

/**
 * The last thing the player typed before an engine result was posted.
 *
 * A check's `intent` is the narrator's paraphrase of one part of what they
 * said: "slip past the bouncer and get a drink" reached the result as "slip
 * past the bouncer", and the drink was gone. Both loops read the ledger the
 * same way, so both ask here.
 */
export function saidBefore(
  events: readonly CampaignEvent[],
  promptEventId: string | undefined,
): { said?: string } {
  const at = promptEventId ? events.findIndex((e) => e.id === promptEventId) : -1;
  const end = at >= 0 ? at : events.length;
  for (let i = end - 1; i >= 0; i -= 1) {
    const e = events[i]!;
    if (e.type === "player_input" && e.summary?.trim()) return { said: e.summary.trim() };
  }
  return {};
}

/**
 * What a result turn is told about the rest of the player's request.
 *
 * The mode-specific parts (a price, a second trip, the clock) stay with each
 * mode; this is the part that is the same in both.
 */
export function carryOnLine(said: string): string {
  return (
    `The player said: "${said}". The engine has settled the part above. If the result leaves ` +
    "them free to, carry out the rest of what they said, per FOLLOW THROUGH, in this same turn " +
    "so they never have to say it twice. If the result stops them, the rest does not happen."
  );
}

/**
 * Whether the model marked a check as small. Read loosely, because models
 * drift on the word; anything else — including no mark at all — is not small.
 */
export function isLowStakes(value: unknown): boolean {
  return typeof value === "string" && ["low", "trivial", "minor"].includes(value.toLowerCase());
}

/**
 * One item of a list the model returned, as an object, or null.
 *
 * The wire schemas take `z.array(z.unknown())` on purpose, so an item the
 * model got slightly wrong reaches the normalizer instead of failing the whole
 * turn. The cost of that looseness: under strict structured output an
 * unconstrained item may come back as a JSON STRING of the object. Found by
 * the eval, where every proposed check arrived as `"{\"kind\": ...}"` and was
 * dropped, so a risky intent never reached the dice. An object encoded as a
 * string is still the object the model meant; anything else is not one.
 */
export function wireObject(item: unknown): Record<string, unknown> | null {
  if (typeof item === "string") {
    const text = item.trim();
    if (!text.startsWith("{")) return null;
    try {
      item = JSON.parse(text);
    } catch {
      return null;
    }
  }
  return item && typeof item === "object" && !Array.isArray(item)
    ? (item as Record<string, unknown>)
    : null;
}
