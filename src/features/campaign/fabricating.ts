/**
 * A Tech at the bench, applied.
 *
 * The arithmetic is `engine/fabrication.ts`; this is the part that spends the
 * money, moves the calendar and puts the thing in the kit. It follows
 * `shopping.ts` deliberately, including its two orderings: the money is read
 * LIVE rather than taken from the caller's snapshot, and the outcome is settled
 * before anything is written.
 *
 * The one piece of state it keeps is materials. The printed rule is "buy
 * materials one price category below the item" and "a failure means starting
 * over with materials intact", so a failed build must not charge for parts
 * again on the retry. Rather than invent a materials inventory, the campaign's
 * `role_state.maker.materials` remembers which builds already have their parts
 * bought — a set of keys, in the blob the Role panel already writes to.
 */
import {
  advanceClock,
  canAfford,
  planFabrication,
  rollFabrication,
  slotFor,
  stacksInInventory,
  type FabricationPlan,
  type FabricationResult,
  type ItemKind,
} from "@/engine";
import {
  addInventoryItem,
  appendCampaignEvent,
  getCampaign,
  setCampaignClock,
  updateCampaign,
  updateCampaignVitals,
  type Json,
} from "@/lib/backend";

/** The ledger type a build is written under, win or lose. */
export const FABRICATION_EVENT = "fabrication";

/** How a build addresses its own materials in the stored set. */
export function materialsKey(kind: ItemKind, itemId: string): string {
  return `${kind}:${itemId}`;
}

/** The builds whose parts are already bought and not yet consumed. */
export function materialsOnHand(roleState: unknown): string[] {
  const all = (roleState ?? {}) as Record<string, unknown>;
  const maker = all["maker"];
  const raw =
    maker && typeof maker === "object" ? (maker as Record<string, unknown>)["materials"] : null;
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

/** The `maker` block with its materials set replaced, everything else kept. */
function withMaterials(roleState: unknown, materials: string[]): Json {
  const all = (roleState ?? {}) as Record<string, unknown>;
  const maker = (all["maker"] ?? {}) as Record<string, unknown>;
  return { ...all, maker: { ...maker, materials } } as unknown as Json;
}

export type FabricationInput = {
  campaignId: string;
  kind: ItemKind;
  itemId: string;
  /** The character's TECH, their Level in the repair Skill, and their Rank. */
  tech: number;
  skillLevel: number;
  specialtyRank: number;
  /** Situational modifiers the caller has already worked out (wounds, Luck). */
  modifiers?: { label: string; value: number }[];
};

export type FabricationOutcome =
  | {
      ok: true;
      built: boolean;
      plan: FabricationPlan;
      result: FabricationResult;
      /** Eurobucks actually spent — zero when the parts were already bought. */
      spent: number;
      /** True when a failed build left its parts on the bench for another try. */
      materialsKept: boolean;
    }
  | { ok: false; reason: string };

/**
 * Build one thing.
 *
 * The outcome is decided before any write, and the writes are ordered so a
 * failure partway leaves something a later turn can read: the parts are
 * accounted for first, then the item, then the clock, then the receipt.
 */
export async function fabricate(input: FabricationInput): Promise<FabricationOutcome> {
  const plan = planFabrication(input.kind, input.itemId);
  if (!plan) return { ok: false, reason: "That is not something a bench can turn out." };

  const full = await getCampaign(input.campaignId);
  if (!full?.vitals) return { ok: false, reason: "Campaign not found." };
  const eurobucks = full.vitals.eurobucks;

  // Parts already bought for this exact build are still on the bench, per the
  // printed "starting over with materials intact".
  const key = materialsKey(plan.kind, plan.itemId);
  const onHand = materialsOnHand(full.campaign.role_state);
  const alreadyBought = onHand.includes(key);
  const spend = alreadyBought ? 0 : plan.materialsCost;
  if (!canAfford(eurobucks, spend)) {
    return {
      ok: false,
      reason:
        `${plan.materialsCategory} materials for a ${plan.itemName} run ${plan.materialsCost}eb ` +
        `and you have ${eurobucks}eb.`,
    };
  }

  const result = rollFabrication({
    plan,
    tech: input.tech,
    skillLevel: input.skillLevel,
    specialtyRank: input.specialtyRank,
    ...(input.modifiers?.length ? { modifiers: input.modifiers } : {}),
  });

  // The parts: bought now if they were not already, and consumed only by a
  // build that actually finished.
  const materialsAfter = result.built
    ? onHand.filter((entry) => entry !== key)
    : alreadyBought
      ? onHand
      : [...onHand, key];
  // Unchanged in two of the four cases — a failure whose parts were already on
  // the bench, and a build that bought its parts and used them in the same
  // sitting — and those write nothing.
  if (materialsAfter.length !== onHand.length) {
    await updateCampaign(input.campaignId, {
      role_state: withMaterials(full.campaign.role_state, materialsAfter),
    });
  }
  if (spend > 0) {
    await updateCampaignVitals(input.campaignId, { eurobucks: eurobucks - spend });
  }

  if (result.built) {
    await addInventoryItem(input.campaignId, {
      kind: plan.kind,
      itemId: plan.itemId,
      quantity: 1,
      stack: stacksInInventory(plan.kind),
    });
  }

  // The bench eats the time whether or not the thing works, which is the whole
  // cost of a failure and the reason building is a decision.
  await setCampaignClock(
    input.campaignId,
    advanceClock({ day: full.campaign.day, minute: full.campaign.minute }, plan.minutes),
  );

  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: FABRICATION_EVENT,
    summary: result.built
      ? `Built a ${plan.itemName} from ${plan.materialsCategory} materials — ` +
        `${plan.timeLabel} at the bench, ${plan.materialsCost}eb of parts against ${plan.itemPrice}eb to buy one.`
      : `Failed to build a ${plan.itemName} — ${plan.timeLabel} lost. The parts are still on the bench.`,
    data: {
      kind: plan.kind,
      itemId: plan.itemId,
      built: result.built,
      dv: plan.dv,
      total: result.total,
      materialsCost: plan.materialsCost,
      spent: spend,
      minutes: plan.minutes,
      slot: slotFor(plan.kind, plan.itemId),
    } as unknown as Json,
  });

  return {
    ok: true,
    built: result.built,
    plan,
    result,
    spent: spend,
    materialsKept: !result.built,
  };
}
