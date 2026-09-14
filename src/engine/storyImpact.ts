/**
 * What a published story actually does.
 *
 * Credibility was the most complete Role Ability in the engine and the least
 * consequential in the game: `believabilityCheck` rolled the printed chance,
 * the panel printed "the neighbourhood believes it", and nothing anywhere
 * changed. A Media could publish the truth about Arasaka every night of the
 * week and Arasaka would never notice.
 *
 * Two things move, in opposite directions, and that is the whole design:
 *
 *  - The story HURTS the people it is about. The printed Impact column says so
 *    in prose — "local bad guys arrested or ousted", "mid-level corporations or
 *    governments may fall" — so segments come OFF that faction's clock. What
 *    they were building against you lost that much momentum.
 *  - And it tells them who wrote it. Their standing falls, and standing does
 *    not recover on its own.
 *
 * The numbers are a house rule and story-impact.json says so; the bands they
 * hang on are the printed Credibility ranks, read off the same ladder
 * roleAbility.ts reads.
 *
 * Pure arithmetic. Nothing here reads a campaign or writes a row.
 */
import impactData from "@/data/rules/story-impact.json";
import { credibilityFor, evidenceBonus } from "./roleAbility";

type RawBand = { maxRank: number; clockSegments: number; standing: number };

const FILE = impactData as unknown as {
  houseRule: boolean;
  byRank: RawBand[];
  evidence: { countsDiscoveredTruths: boolean; requiresNewInformationPerTopic: boolean };
};

/** True when these are what they claim to be: tunable house rules. */
export const STORY_IMPACT_IS_HOUSE_RULE: boolean = FILE.houseRule;

/** Evidence is what the character found out, never a number they typed. */
export const EVIDENCE_COUNTS_DISCOVERED_TRUTHS: boolean = FILE.evidence.countsDiscoveredTruths;

export type StoryImpact = {
  /** Segments that come off the target's clock. Never negative. */
  clockSegments: number;
  /** What the organisation thinks of you afterwards. Never positive. */
  standing: number;
  /** The printed Impact prose for this Rank, for the narrator and the panel. */
  impact: string;
  /** The printed audience this Rank reaches. */
  audience: string;
};

/**
 * What a believed story at this Rank is worth, or null when the Rank reaches
 * no audience at all.
 */
export function storyImpactFor(rank: number): StoryImpact | null {
  const band = credibilityFor(rank);
  if (!band) return null;
  const row = FILE.byRank.find((entry) => rank <= entry.maxRank) ?? FILE.byRank.at(-1);
  if (!row) return null;
  return {
    clockSegments: Math.max(0, Math.trunc(row.clockSegments)),
    standing: Math.min(0, Math.trunc(row.standing)),
    impact: band.impact,
    audience: band.audience,
  };
}

/**
 * How many pieces of evidence a story carries, and whether there is a story at
 * all yet.
 *
 * The printed rule is "one piece of easily understood verifiable evidence" and
 * "you can't publish another story on the exact same topic without new
 * information". Both are answered by the same fact: what the character has
 * found out since they last filed about these people. A truth is discovered
 * through the truth system, which the player cannot type into a box, so the
 * believe chance is earned by looking rather than asserted.
 */
export type StoryEvidence = {
  /** Truths discovered since the last story about this topic. */
  pieces: number;
  /** The printed believe-chance bump those pieces buy. */
  bonus: number;
  /** False when there is nothing new to say, which the rules forbid publishing. */
  publishable: boolean;
};

export function storyEvidence(input: {
  /** The day each known truth was discovered on. Undated truths do not count. */
  discoveredDays: (number | null | undefined)[];
  /** The day the last story about this topic ran, or null when none has. */
  lastStoryDay: number | null;
}): StoryEvidence {
  const since = input.lastStoryDay;
  const pieces = input.discoveredDays.filter(
    (day): day is number => typeof day === "number" && (since === null || day > since),
  ).length;
  return {
    pieces,
    bonus: evidenceBonus(pieces),
    // The first story needs something to say too: a Media with nothing found
    // out is a Media with nothing to publish.
    publishable: pieces > 0,
  };
}
