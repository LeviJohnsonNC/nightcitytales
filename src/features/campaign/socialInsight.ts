/**
 * Reading someone while you were doing something else, in either loop.
 *
 * This was written inside `useLife.ts`, which meant it only ever ran in Life: a
 * Persuasion check against a fixer over breakfast read the fixer, and the same
 * check against the same fixer in the middle of a job read nobody. Jobs are
 * where the pressure is and where most Social checks get rolled, so the half of
 * the game that needed it most was the half that did not have it.
 *
 * WHICH something a check reveals, and whether anything at all, is the engine's
 * (`socialRead`): Conversation gets what they want and never what they are
 * hiding, Interrogation goes for the secret and they remember you did it,
 * Wardrobe & Style reads nobody whatever the Core Rulebook files it under. This
 * module persists that answer and hands the model ONE line — never the rungs
 * still hidden.
 *
 * The attempt is paid for either way. Working somebody raises how guarded they
 * are with you, landed or not, and a guarded person stops giving things up to
 * being asked; the way back in is to stop asking and watch them instead.
 */
import { canRead, socialRead, suspicionCost } from "@/engine";
import { appendCampaignEvent, findCampaignNpc, type Json } from "@/lib/backend";
import { guardednessOf, knownFactsOf, raiseNpcSuspicion, revealFact } from "./castSeeding";

export type InsightResult =
  /** A rung of their dossier, which the model narrates as a tell. */
  | { kind: "learned"; text: string }
  /** Something about the exchange itself, which is not a thing they revealed. */
  | { kind: "note"; text: string };

export async function applyInsight(args: {
  campaignId: string;
  npcKey: string;
  skillId: string;
  success: boolean;
  margin: number;
  /** The in-game day, for suspicion's cooling. */
  today: number;
}): Promise<InsightResult | null> {
  // A Skill that neither reads anybody nor costs them anything is not a social
  // exchange at all: an opposed Athletics check over a fence has no business
  // reading a row back.
  const cost = suspicionCost(args.skillId);
  if (cost === 0 && !canRead(args.skillId)) return null;

  const npc = await findCampaignNpc(args.campaignId, args.npcKey);
  if (!npc) return null;

  // Paid before anything is learned, and on a failed check too: they noticed
  // being worked whether or not it worked.
  if (cost > 0) await raiseNpcSuspicion(args.campaignId, npc, cost, args.today);

  if (!args.success) return null;
  const read = socialRead({
    skillId: args.skillId,
    margin: args.margin,
    known: knownFactsOf(npc),
    // Their state at the moment of the ask, not after this ask's own cost: the
    // push that tips somebody over still gets its answer, and the next one does
    // not.
    suspicion: guardednessOf(npc, args.today),
  });

  if (read.outcome !== "read") {
    // Two of the silences are worth saying out loud, because both tell the
    // player to change approach without telling them what is left to find.
    if (read.why === "guarded") {
      return {
        kind: "note",
        text:
          `${npc.name} has noticed being worked and has closed up: they are still dealing with ` +
          "the character, and they are not volunteering anything to being asked. Play the " +
          "carefulness; do not explain it to them.",
      };
    }
    if (read.why === "out_of_reach") {
      return {
        kind: "note",
        text:
          `This kind of approach has got everything out of ${npc.name} that it is going to. ` +
          "Nothing new came of it. Do NOT invent something they gave away, and do not hint that " +
          "there is more — a different kind of ask would be a different scene.",
      };
    }
    return null;
  }

  const learned = await revealFact(args.campaignId, npc, read.fact);
  if (!learned) return null;
  await appendCampaignEvent({
    campaign_id: args.campaignId,
    type: "npc_read",
    summary: learned.text,
    data: {
      npcKey: args.npcKey,
      fact: learned.fact,
      shape: read.shape.shape,
    } as unknown as Json,
  });
  return { kind: "learned", text: learned.text };
}

/** How a read reaches the narrator: as a tell, or as a note about the exchange. */
export function insightLine(read: InsightResult | null): string {
  if (!read) return "";
  return read.kind === "learned"
    ? ` Reading them that closely told the character something they did not volunteer: ${read.text} Let it show as a tell in how they behave, not as an announcement.`
    : ` ${read.text}`;
}
