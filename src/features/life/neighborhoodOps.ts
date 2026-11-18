import { planNeighborhood, type NeighborhoodContext } from "@/engine/neighborhood";
import { commitNeighborhood } from "@/lib/backend";
import { standingAt } from "@/features/campaign/favours";
import type { LifeBundle } from "./lifeBundleOps";

export function neighborhoodContext(b: LifeBundle): NeighborhoodContext {
  return {
    place: standingAt(b.campaign),
    role: b.character.character.role,
    clock: b.clock,
    cash: b.vitals.eurobucks,
    hp: b.vitals.hp_current,
    maxHp: b.vitals.hp_max,
    serious: b.vitals.seriously_wounded_threshold,
  };
}

export async function takeNeighborhoodAction(bundle: LifeBundle, id: string, requestId: string) {
  if (bundle.phase !== "life") throw new Error("Come back between jobs.");
  const ctx = neighborhoodContext(bundle);
  const state = bundle.neighborhood;
  const { choice, patch, clock, wound } = planNeighborhood(state, ctx, id);
  await commitNeighborhood({
    campaign_id: bundle.campaign.id,
    request_id: requestId,
    action: id,
    summary: choice.receipt,
    expected: {
      ...ctx.clock,
      location: bundle.campaign.location_key,
      state,
      hp: ctx.hp,
      cash: ctx.cash,
    },
    patch,
    clock,
    minutes: choice.minutes,
    cost: choice.cost ?? 0,
    heal: choice.heal ?? 0,
    wound,
  });
}
