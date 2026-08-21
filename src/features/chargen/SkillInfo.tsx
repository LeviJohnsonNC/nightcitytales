import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSkill } from "@/engine";
import skillsData from "@/data/rules/skills.json";
import { SKILL_FLAVOR } from "./skillFlavor";

/** Exact mechanical text from the rulebook data, keyed by skill id. */
const DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  (skillsData.skills as unknown as { id: string; description: string }[]).map((s) => [
    s.id,
    s.description,
  ]),
);

/** A small "?" button that opens a modal explaining a skill in-voice. */
export function SkillInfo({ skillId }: { skillId: string }) {
  const [open, setOpen] = useState(false);
  const skill = getSkill(skillId);
  const flavor = SKILL_FLAVOR[skillId];
  const description = DESCRIPTIONS[skillId];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What does ${skill.name} do?`}
        title={`What does ${skill.name} do?`}
        className="grid size-5 shrink-0 place-items-center rounded-full border border-hairline font-mono text-[11px] leading-none text-text-dim transition-colors hover:border-ember hover:text-ember"
      >
        ?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">{skill.name}</DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {skill.stat.toUpperCase()} · {skill.category}
              {skill.doubleCost ? " · ×2 cost" : ""}
            </DialogDescription>
          </DialogHeader>

          {flavor && <p className="text-[0.95rem] leading-relaxed text-text">{flavor}</p>}

          {description && (
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
                How it works
              </p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{description}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
