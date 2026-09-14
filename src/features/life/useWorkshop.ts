/**
 * The bench, as a piece of application state.
 *
 * The rules of a build live in engine/fabrication.ts and the writes live in
 * campaign/fabricating.ts; this is only the part React needs — whether this
 * character is a Tech at all, what is worth building, and what happened when
 * they tried.
 *
 * Unlike the shop there is no visit to charge for. A build's printed time is
 * the whole cost of going to the bench, and charging a separate errand on top
 * of a fortnight would be noise.
 */
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ARMOR,
  AMMUNITION,
  FABRICABLE_KINDS,
  GEAR,
  WEAPONS,
  planFabrication,
  skillLevelFor,
  woundActionPenalty,
  type FabricationPlan,
  type ItemKind,
  type WoundStateCode,
} from "@/engine";
import { fabricate, materialsKey, materialsOnHand } from "@/features/campaign/fabricating";
import { actorFor, effectiveStatsRecord } from "@/features/play/playModel";
import { liveRoleAbility, makerSpecialties } from "@/features/play/roleAbilityModel";
import type { LifeBundle } from "./lifeOps";

export type WorkshopMessage = { tone: "built" | "failed"; text: string };

/** One buildable line, planned and priced against what the character holds. */
export type BenchItem = {
  plan: FabricationPlan;
  /** True when the parts are affordable, or already bought and waiting. */
  affordable: boolean;
  /** True when a previous failed attempt left these parts on the bench. */
  partsOnBench: boolean;
};

function catalogOf(kind: ItemKind): { id: string }[] {
  switch (kind) {
    case "weapon":
      return WEAPONS;
    case "armor":
      return ARMOR;
    case "ammunition":
      return AMMUNITION;
    case "gear":
      return GEAR;
    default:
      return [];
  }
}

export function useWorkshop(bundle: LifeBundle | undefined) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<WorkshopMessage | null>(null);

  const ability = bundle ? liveRoleAbility(bundle.character) : null;
  /** Null for every Role but the Tech, which is what keeps the bench off their screen. */
  const isTech = ability?.info.abilityId === "maker";
  const specialtyRank =
    bundle && isTech ? (makerSpecialties(bundle.campaign)["fabrication_expertise"] ?? 0) : 0;

  const eurobucks = bundle?.vitals.eurobucks ?? 0;
  const onBench = useMemo(
    () => materialsOnHand(bundle?.campaign.role_state),
    [bundle?.campaign.role_state],
  );

  /**
   * Everything the catalog can turn out, planned.
   *
   * Listed whether or not the parts are affordable, for the same reason the
   * shop lists the rifle you cannot afford: seeing what a better bench-hand
   * could make is the point of standing at the bench.
   */
  const bench = useMemo(() => {
    const out: BenchItem[] = [];
    for (const kind of FABRICABLE_KINDS) {
      for (const item of catalogOf(kind)) {
        const plan = planFabrication(kind, item.id);
        if (!plan) continue;
        const partsOnBench = onBench.includes(materialsKey(kind, item.id));
        out.push({
          plan,
          partsOnBench,
          affordable: partsOnBench || plan.materialsCost <= eurobucks,
        });
      }
    }
    return out.sort(
      (a, b) =>
        a.plan.materialsCost - b.plan.materialsCost ||
        a.plan.itemName.localeCompare(b.plan.itemName),
    );
  }, [eurobucks, onBench]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["life", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["play", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["downtime", bundle?.campaign.id] });
  }, [queryClient, bundle?.campaign.id]);

  const build = useMutation({
    mutationFn: async (item: BenchItem) => {
      if (!bundle) throw new Error("Still loading.");
      const context = { vitals: bundle.vitals, inventory: bundle.inventory };
      const stats = effectiveStatsRecord(bundle.character, context);
      // Through the engine's own reader rather than off the rows: a sheet can
      // carry more than one line for a Skill, and the level is the best of them.
      const level = skillLevelFor(actorFor(bundle.character, context), item.plan.skillId);
      // Being hurt follows you to the bench, the same −2/−4 every other Check
      // outside a fight already takes.
      const wounds = woundActionPenalty(bundle.vitals.wound_state as WoundStateCode);
      return fabricate({
        campaignId: bundle.campaign.id,
        kind: item.plan.kind,
        itemId: item.plan.itemId,
        tech: stats["tech"] ?? 0,
        skillLevel: level,
        specialtyRank,
        ...(wounds !== 0 ? { modifiers: [{ label: "Wounds", value: wounds }] } : {}),
      });
    },
    onSuccess: (outcome) => {
      if (!outcome.ok) {
        setMessage({ tone: "failed", text: outcome.reason });
        return;
      }
      setMessage(
        outcome.built
          ? {
              tone: "built",
              text:
                `${outcome.plan.itemName} finished — ${outcome.plan.timeLabel} and ` +
                `${outcome.spent}eb of parts, against ${outcome.plan.itemPrice}eb to buy one.`,
            }
          : {
              tone: "failed",
              text:
                `It did not come together. ${outcome.plan.timeLabel} gone; the parts are still ` +
                "on the bench, so the next attempt costs only the time.",
            },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "failed", text: error.message }),
  });

  return {
    /** True when this character has Maker at all. The bench belongs to the Tech. */
    isTech,
    specialtyRank,
    eurobucks,
    bench,
    message,
    busy: build.isPending,
    build: (item: BenchItem) => build.mutate(item),
    clearMessage: () => setMessage(null),
  };
}
