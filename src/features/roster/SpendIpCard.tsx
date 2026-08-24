/**
 * Spending a character's Improvement Points between sessions.
 *
 * The engine owns the prices (advancement.ts) and the database owns the
 * transaction (spend_ip_on_skill), so this component only renders what a Level
 * costs and asks for it. It never computes a price of its own.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { availableSkillRaises, MAX_SKILL_LEVEL, spendOnSkill, type SkillRaise } from "@/engine";
import { spendIpOnSkill, type FullCharacter } from "@/lib/backend";

function RaiseRow({
  raise,
  onBuy,
  busy,
}: {
  raise: SkillRaise;
  onBuy: (raise: SkillRaise) => void;
  busy: boolean;
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
            Raise
          </Button>
        </>
      )}
    </li>
  );
}

export function SpendIpCard({
  character,
  improvementPoints,
}: {
  character: FullCharacter;
  improvementPoints: number;
}) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const skills = character.skills.map((s) => ({
    skillId: s.skill_id,
    level: s.level,
    specialization: s.specialization,
  }));
  const raises = availableSkillRaises(skills, improvementPoints);
  const affordable = raises.filter((r) => r.affordable);

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
    },
  });

  const shown = showAll ? raises : affordable;

  // Nothing banked, nothing to decide: the card stays out of the way until the
  // session hands over some I.P.
  if (improvementPoints === 0) return null;

  return (
    <section className="no-print space-y-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Improvement Points</Label>
        <span className="font-mono text-sm">{improvementPoints} I.P. unspent</span>
      </div>

      <>
          <p className="text-xs text-muted-foreground">
            A Skill costs its new Level in I.P. (doubled for a Skill the sheet flags x2), one Level
            at a time, up to Level {MAX_SKILL_LEVEL}.
          </p>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not enough for any Skill yet — the cheapest raise is {raises[0]?.cost ?? 0} I.P.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {shown.map((raise) => (
                <RaiseRow
                  key={raise.key}
                  raise={raise}
                  onBuy={(r) => buy.mutate(r)}
                  busy={buy.isPending}
                />
              ))}
            </ul>
          )}
          {raises.length > affordable.length && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show only what I can afford" : `Show all ${raises.length} skills`}
            </Button>
          )}
        </>
      )}

      {buy.error && <p className="text-sm text-destructive">{(buy.error as Error).message}</p>}
    </section>
  );
}
