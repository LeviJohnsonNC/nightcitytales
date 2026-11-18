import type { CampaignEvent } from "@/lib/backend";
import type { CheckRoll } from "@/features/play/checkPrompt";

export type SavedLifeRoll = {
  event: CampaignEvent;
  promptId: string;
  skillName: string;
  roll: CheckRoll;
};

/** Use the immutable ledger's totals and modifiers, including after a reload. */
export function readLifeRoll(event: CampaignEvent): SavedLifeRoll | null {
  if (event.type !== "skill_check") return null;
  const data = event.data as {
    prompt_event_id?: unknown;
    skill_name?: unknown;
    luck_spent?: unknown;
    auto?: unknown;
  } | null;
  if (!data || data.auto === true || typeof data.prompt_event_id !== "string") return null;
  const result = event.roll as CheckRoll["result"] | null;
  const luckSpent = typeof data.luck_spent === "number" ? data.luck_spent : 0;
  let roll: CheckRoll;
  if (
    result &&
    typeof result === "object" &&
    "actor" in result &&
    result.actor?.rolls?.length &&
    result.opponent?.rolls?.length
  ) {
    roll = { kind: "opposed", result, luckSpent };
  } else if (
    result &&
    typeof result === "object" &&
    "rolls" in result &&
    result.rolls?.length &&
    typeof result.total === "number"
  ) {
    roll = { kind: "dv", result, luckSpent };
  } else {
    return null;
  }
  return {
    event,
    promptId: data.prompt_event_id,
    skillName: typeof data.skill_name === "string" ? data.skill_name : "Skill",
    roll,
  };
}

export function currentLifeRoll(events: CampaignEvent[]): SavedLifeRoll | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]!;
    if (
      [
        "player_input",
        "travelled",
        "neighborhood_action",
        "phase_changed",
        "encounter_ended",
      ].includes(event.type)
    )
      break;
    const roll = readLifeRoll(event);
    if (roll) return roll;
  }
  return null;
}

export function lifeRollOutcome(saved: SavedLifeRoll, events: CampaignEvent[]) {
  const passages = events.filter(
    (event) => event.type === "life_narration" && event.seq > saved.event.seq,
  );
  const linked = passages
    .filter(
      (event) =>
        (event.data as { resolvedCheckId?: unknown } | null)?.resolvedCheckId === saved.promptId,
    )
    .at(-1);
  // Existing saves recorded the roll immediately before its follow-up passage.
  const prompt = events.find((event) => event.id === saved.promptId);
  return (
    linked ??
    (prompt &&
    passages.length === 1 &&
    !(passages[0]!.data as { resolvedCheckId?: unknown } | null)?.resolvedCheckId
      ? passages[0]
      : undefined)
  );
}

export function lifeCheckVerdict(roll: CheckRoll): string {
  const result = roll.result;
  if (roll.kind === "opposed" && roll.result.tie) return "Tie · Defender holds";
  if (result.margin === 0) return result.success ? "Success · Met DV" : "Failed · Matched DV";
  return `${result.success ? "Success" : "Failed"} by ${Math.abs(result.margin)}`;
}

export function lifeCheckAnnouncement(roll: CheckRoll): string {
  const score =
    roll.kind === "opposed"
      ? `${roll.result.actor.total} against ${roll.result.opponentSide.name}'s ${roll.result.opponent.total}`
      : `${roll.result.total} against DV ${roll.result.dv}`;
  return `${score}. ${lifeCheckVerdict(roll)}.`;
}
