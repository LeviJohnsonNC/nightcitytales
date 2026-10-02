/**
 * Spending a character's Improvement Points between sessions.
 *
 * The engine owns the prices (advancement.ts) and the database owns the
 * transaction (spend_ip_on_skill), so this component only renders what a Level
 * costs and asks for it. It never computes a price of its own.
 */
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  availableSkillRaises,
  describeRoleRankRaise,
  describeSkillRaise,
  EARNED_AREA_RULE,
  IP_COSTS,
  LOCAL_EXPERT_SKILL_ID,
  MAX_SKILL_LEVEL,
  skillEntryName,
  skillLineKey,
  roleAbilityOf,
  spendOnRoleRank,
  spendOnSkill,
  untrainedSkillRaises,
  type EarnedArea,
  type RoleRankRaise,
  type SkillRaise,
} from "@/engine";
import { ReceiptBar } from "@/features/status/ReceiptBar";
import { skillReceipts, type SkillSnapshot } from "@/features/status/receipts";
import { useReceipts } from "@/features/status/useReceipts";
import { spendIpOnRoleRank, spendIpOnSkill, type FullCharacter } from "@/lib/backend";

function RaiseRow({
  raise,
  onBuy,
  busy,
  verb = "Raise",
}: {
  raise: SkillRaise;
  onBuy: (raise: SkillRaise) => void;
  busy: boolean;
  verb?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-sm">
        {raise.skillName}
        {raise.doubleCost && (
          <span className="ml-1 font-mono text-[10px] text-muted-foreground">x2</span>
        )}
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {raise.atMax
            ? `Level ${raise.currentLevel} (max)`
            : `${raise.currentLevel} → ${raise.nextLevel}`}
        </span>
      </span>
      {!raise.atMax && (
        <>
          <span className="font-mono text-xs text-muted-foreground">{raise.cost} I.P.</span>
          <Button
            size="sm"
            variant="outline"
            disabled={!raise.affordable || busy}
            onClick={() => onBuy(raise)}
          >
            {verb}
          </Button>
        </>
      )}
    </li>
  );
}

/**
 * The next Rank of the character's Role Ability, and what it gives.
 *
 * The preview is the engine's diff of the Role's opening at this Rank and the
 * next (`roleRankPreview`), so it can only promise what play will deliver. A
 * Rank that changes nothing visible says where the next change is, rather than
 * selling it as more than it is.
 */
function RoleRankRow({
  raise,
  onBuy,
  busy,
}: {
  raise: RoleRankRaise;
  onBuy: () => void;
  busy: boolean;
}) {
  const preview = raise.preview;
  return (
    <div className="space-y-2 border-b border-border pb-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm">
          {raise.abilityName}
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {raise.atMax
              ? `Rank ${raise.currentRank} (max)`
              : `Rank ${raise.currentRank} → ${raise.nextRank}`}
          </span>
        </span>
        {!raise.atMax && !raise.unbuilt && (
          <>
            <span className="font-mono text-xs text-muted-foreground">{raise.cost} I.P.</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!raise.affordable || busy}
              onClick={onBuy}
            >
              Raise
            </Button>
          </>
        )}
      </div>
      {raise.unbuilt ? (
        <p className="text-xs text-muted-foreground">
          Not for sale yet: {raise.abilityName} arrives with its own update, and a Rank that does
          nothing is not worth points.
        </p>
      ) : preview && preview.changes.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {preview.changes.map((change) => (
            <li key={change.label}>
              <span className="text-foreground">{change.label}.</span> {change.detail}
            </li>
          ))}
        </ul>
      ) : preview ? (
        <p className="text-xs text-muted-foreground">
          Nothing new opens at Rank {preview.nextRank}
          {preview.nextChangeAt !== null
            ? `; the next change is at Rank ${preview.nextChangeAt}.`
            : "."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A neighbourhood the campaign says the character has come to know.
 *
 * Local Expert is the one Skill you cannot simply decide to have: it names a
 * place, and buying local knowledge of a district you have never set foot in is
 * the purchase it should not support. So a new district appears here only once
 * the campaign's own record of where the character has walked says it should —
 * and it says WHY, because a row that appears without explanation reads as a
 * bug rather than as something earned.
 */
function NewAreaRow({
  area,
  raise,
  onBuy,
  busy,
}: {
  area: EarnedArea;
  raise: SkillRaise;
  onBuy: (raise: SkillRaise) => void;
  busy: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{area.districtName}</span>
        <span className="block font-mono text-[10px] text-muted-foreground">
          {area.isHome
            ? "You live here"
            : `${area.visits} visits across ${area.places} ${area.places === 1 ? "address" : "addresses"}`}
        </span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{raise.cost} I.P.</span>
      <Button
        size="sm"
        variant="outline"
        disabled={!raise.affordable || busy}
        onClick={() => onBuy(raise)}
      >
        Learn
      </Button>
    </li>
  );
}

export function SpendIpCard({
  character,
  improvementPoints,
  newAreas = [],
  campaignId,
}: {
  character: FullCharacter;
  improvementPoints: number;
  /**
   * The campaign whose screen this card sits on. Its bundle carries the
   * character too, so a purchase has to refresh it as well — otherwise the card
   * keeps offering the Level just bought, and the database (rightly) refuses it.
   */
  campaignId?: string;
  /**
   * Neighbourhoods the character could start knowing, from the campaign's own
   * record of where they have been. Empty off-campaign — the roster has no
   * campaign to read a history from, and offering a district there would be
   * offering it on no evidence at all.
   */
  newAreas?: EarnedArea[];
}) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const skills = character.skills.map((s) => ({
    skillId: s.skill_id,
    level: s.level,
    specialization: s.specialization,
  }));
  // The home district resolves the printed "Your Home" placeholder to a real
  // neighbourhood name on this screen, the same as it does on the sheet.
  const homeDistrictKey = character.finance?.home_district_key ?? null;
  const raises = availableSkillRaises(skills, improvementPoints, homeDistrictKey);
  const affordable = raises.filter((r) => r.affordable);
  const untrained = untrainedSkillRaises(skills, improvementPoints);

  const roleId = character.character.role ?? null;
  const ability = roleAbilityOf(roleId);
  const rank = character.roleAbility?.rank ?? ability?.startingRank ?? null;
  const rankRaise =
    roleId && rank !== null ? describeRoleRankRaise(roleId, rank, improvementPoints) : null;

  // The sheet as it stands, so a Level bought shows as `Handgun 6 → 7` when the
  // refreshed character arrives — the same receipt, and the same timing, as a
  // Life turn's.
  const sheet = useMemo(() => {
    const snapshot: SkillSnapshot = {};
    for (const s of character.skills) {
      snapshot[skillLineKey(s.skill_id, s.specialization)] = {
        name: skillEntryName(
          { skillId: s.skill_id, specialization: s.specialization },
          homeDistrictKey,
        ),
        level: s.level,
      };
    }
    // The Rank rides in the same snapshot, so buying one reads
    // `Combat Awareness 4 → 5` on the same strip.
    if (ability && rank !== null) {
      snapshot[`role:${ability.abilityId}`] = { name: ability.abilityName, level: rank };
    }
    return snapshot;
  }, [character.skills, homeDistrictKey, ability, rank]);
  const receipts = useReceipts(sheet, skillReceipts);

  // A district is bought as a Level 1 line, priced by the same rule as every
  // other first Level. The district KEY is the specialization, so the line the
  // purchase creates is the one `localExpert.ts` resolves.
  const areaOffers = newAreas.map((area) => ({
    area,
    raise: describeSkillRaise(
      LOCAL_EXPERT_SKILL_ID,
      0,
      improvementPoints,
      area.districtKey,
      homeDistrictKey,
    ),
  }));

  const buy = useMutation({
    mutationFn: async (raise: SkillRaise) => {
      // Re-validate against the engine before spending: the button state is a
      // hint, the rule is the authority.
      const plan = spendOnSkill(skills, improvementPoints, raise.skillId, raise.specialization);
      return spendIpOnSkill(
        character.character.id,
        plan.skillId,
        plan.newLevel,
        plan.spent,
        plan.specialization,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["character", character.character.id] });
      if (campaignId) {
        void queryClient.invalidateQueries({ queryKey: ["play", campaignId] });
        void queryClient.invalidateQueries({ queryKey: ["life", campaignId] });
      }
    },
  });

  const buyRank = useMutation({
    mutationFn: async () => {
      if (!roleId || rank === null) throw new Error("This character has no Role Ability on file.");
      // The engine re-validates before spending, as for a Skill.
      const plan = spendOnRoleRank(roleId, rank, improvementPoints);
      return spendIpOnRoleRank(character.character.id, plan.abilityId, plan.newRank, plan.spent);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["character", character.character.id] });
      if (campaignId) {
        void queryClient.invalidateQueries({ queryKey: ["play", campaignId] });
        void queryClient.invalidateQueries({ queryKey: ["life", campaignId] });
      }
    },
  });
  const busy = buy.isPending || buyRank.isPending;

  const shown = showAll ? raises : affordable;

  // Nothing banked, nothing to decide: the card stays out of the way until the
  // session hands over some I.P. — unless the last point was just spent, in
  // which case the receipt for it is the one thing worth showing.
  if (improvementPoints === 0) {
    return receipts.length > 0 ? <ReceiptBar receipts={receipts} /> : null;
  }

  return (
    <section className="no-print space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Improvement Points</Label>
        <span className="font-mono text-sm">{improvementPoints} I.P. unspent</span>
      </div>

      <ReceiptBar receipts={receipts} />

      {rankRaise && <RoleRankRow raise={rankRaise} onBuy={() => buyRank.mutate()} busy={busy} />}

      <p className="text-xs text-muted-foreground">
        A Skill costs {IP_COSTS.skillCostPerLevel} I.P. times its new Level (doubled for a Skill the
        sheet flags x2), one Level at a time, up to Level {MAX_SKILL_LEVEL}.
      </p>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not enough for any Skill yet — the cheapest raise is {raises[0]?.cost ?? 0} I.P.
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {shown.map((raise) => (
            <RaiseRow key={raise.key} raise={raise} onBuy={(r) => buy.mutate(r)} busy={busy} />
          ))}
        </ul>
      )}
      {raises.length > affordable.length && (
        <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show only what I can afford" : `Show all ${raises.length} skills`}
        </Button>
      )}

      {untrained.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <Button size="sm" variant="ghost" onClick={() => setShowNew((v) => !v)}>
            {showNew
              ? "Hide Skills you have never trained"
              : `Learn something new · ${untrained.length} Skills from Level 0`}
          </Button>
          {showNew && (
            <ul className="max-h-60 overflow-y-auto">
              {untrained.map((raise) => (
                <RaiseRow
                  key={raise.key}
                  raise={raise}
                  onBuy={(r) => buy.mutate(r)}
                  busy={busy}
                  verb="Learn"
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {areaOffers.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <Label>Neighbourhoods you could come to know</Label>
          <p className="text-xs text-muted-foreground">
            Local Expert is worth its Level in one neighbourhood and nothing anywhere else. A
            district appears here once you have put {EARNED_AREA_RULE.visits} visits across{" "}
            {EARNED_AREA_RULE.places} of its addresses — house rule: the rulebook lets you name any
            location, and this asks the campaign to show you have been there.
          </p>
          <ul className="max-h-52 overflow-y-auto">
            {areaOffers.map(({ area, raise }) => (
              <NewAreaRow
                key={area.districtKey}
                area={area}
                raise={raise}
                onBuy={(r) => buy.mutate(r)}
                busy={busy}
              />
            ))}
          </ul>
        </div>
      )}

      {buy.error && <p className="text-sm text-destructive">{(buy.error as Error).message}</p>}
      {buyRank.error && (
        <p className="text-sm text-destructive">{(buyRank.error as Error).message}</p>
      )}
    </section>
  );
}
