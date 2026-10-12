/**
 * Role Abilities that end in narration: a Rockerboy working a crowd, a Media
 * filing a story, a Lawman calling for Backup. Split out of playOps.ts, which
 * re-exports them. No React and no TanStack Query in here.
 */

import {
  getFaction,
  type BackupCall,
  type BelievabilityResult,
  type CharismaticImpactResult,
  type FactionId,
} from "@/engine";
import { publishStory } from "@/features/campaign/publishing";
import { appendCampaignEvent, listCampaignEvents, updateCampaign, type Json } from "@/lib/backend";
import { pendingBackupFrom } from "./backupFlow";
import { liveRoleAbility, withAbilityState } from "./roleAbilityModel";
import type { PlayBundle } from "./playBundleOps";
import { narrate } from "./playTurnOps";

/**
 * Record a Rockerboy working a crowd, and hand the result to the GM.
 *
 * Charismatic Impact is not a Skill Check — it is Rank + 1d10 against a DV set
 * by how many of them there are — so it gets its own ledger row rather than
 * pretending to be a skill_check.
 */
export async function commitCharismaticImpact(
  bundle: PlayBundle,
  result: CharismaticImpactResult,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const verdict = result.success ? "WON THEM OVER" : "FAILED";
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "role_ability",
    summary: `Charismatic Impact on ${result.audience.name}: ${result.formula} → ${verdict}`,
    roll: result as unknown as Json,
    data: {
      ability: "charismatic_impact",
      audience: result.audience.id,
      success: result.success,
    } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player used their Rockerboy Charismatic Impact on ${result.audience.name}. ` +
      `${result.formula}. Outcome: ${verdict}. ` +
      (result.success
        ? `They are Fans now, and at this Rank a fan will ${result.favor ?? "do very little"}. ` +
          `Narrate the crowd turning, and what that buys the player right now.`
        : `Narrate the room not buying it. They cannot be worked again for a week.`) +
      ` Do not re-decide the outcome. End on a decision.)`,
    { logInput: false },
  );
}

/**
 * File a story, and let it land on the people it is about.
 *
 * The believability roll happens in the panel, where the player watches the
 * die; this is what the result MEANS. A believed story takes segments off that
 * faction's clock and costs you their opinion, and either way it reaches the
 * ledger — the next story's evidence is counted from the day this one ran.
 */
export async function commitPublishedStory(
  bundle: PlayBundle,
  input: { factionId: FactionId; result: BelievabilityResult; evidencePieces: number },
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const rank = liveRoleAbility(bundle.character)?.rank ?? 0;
  const story = await publishStory({
    campaignId,
    factionId: input.factionId,
    rank,
    believed: input.result.believed,
    day: bundle.campaign.day ?? 0,
    evidencePieces: input.evidencePieces,
    beatId,
  });

  const faction = getFaction(input.factionId);
  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player published a Media story about ${faction.name}, backed by ` +
      `${input.evidencePieces} piece(s) of what they actually found out. ` +
      (story.believed
        ? `${story.impact?.audience ?? "The audience"} believes it. The printed Impact at this ` +
          `Rank is: ${story.impact?.impact ?? "change"}. ` +
          (story.moved.length
            ? `What moved: ${story.moved.join("; ")}. `
            : "Nothing was left on their dials to move. ") +
          `Narrate the story going out and what it costs THEM — people pulled in, a name ` +
          `withdrawn, a shipment stopped. They will work out who wrote it.`
        : `Nobody buys it. Narrate the story failing to land: no pickup, no follow-up, and the ` +
          `quiet that follows a piece nobody ran.`) +
      ` Do not re-decide the outcome and never state a segment count. End on a decision.)`,
    { logInput: false },
  );
}

/**
 * Record a Lawman calling it in. A call that lands is not help yet — it is help
 * on its way, so what gets stored is the Round it turns up on.
 */
export async function commitBackupCall(bundle: PlayBundle, call: BackupCall): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const round = bundle.encounter?.state.round ?? 0;
  const pending = pendingBackupFrom(call, round);

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "backup_called",
    summary: call.responded
      ? `Called for Backup (rolled ${call.responseRoll}) — ${call.tier?.name} inbound, ` +
        `${call.roundsUntilArrival} Round${call.roundsUntilArrival === 1 ? "" : "s"} out` +
        (call.tierUp ? ", and they are sending better" : "") +
        (call.groups > 1 ? ", two groups" : "")
      : `Called for Backup (rolled ${call.responseRoll}) — nobody answers.`,
    roll: call as unknown as Json,
    data: { responded: call.responded } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });

  if (pending) {
    await updateCampaign(campaignId, {
      role_state: withAbilityState(bundle.campaign, "backup", { pending }) as Json,
    });
  }

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player called for Backup. ${
      call.responded
        ? `Someone answered: ${call.tier?.name} is ${call.roundsUntilArrival} Round(s) out. Narrate the call going out and the wait, and do NOT narrate them arriving yet.`
        : `Nobody answered. Narrate the silence on the line. They can try again next Turn.`
    } Do not re-decide it. End on a decision.)`,
    { logInput: false },
  );
}
