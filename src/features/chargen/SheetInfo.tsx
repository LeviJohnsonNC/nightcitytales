/**
 * Small "?" affordances for the character sheet: what a STAT is for, and what a
 * Skill covers. Every word of rules text comes from src/data/rules/ — this file
 * only lays it out.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STAT_DESCRIPTIONS, getSkill, statTemplateRange } from "@/engine";
import type { StatKey } from "@/engine";

/** The shared round "?" button used beside a sheet line. */
export function InfoDot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-5 shrink-0 place-items-center rounded-full border border-hairline font-mono text-[11px] leading-none text-text-dim transition-colors hover:border-ember hover:text-ember"
    >
      ?
    </button>
  );
}

/**
 * Where a value sits on the band the printed Role templates actually use,
 * drawn as ====(7)==. The bar is a picture, not a rule.
 */
function StatScale({ stat, value }: { stat: StatKey; value: number | null }) {
  const range = statTemplateRange(stat);
  const min = Math.min(range.min, value ?? range.min);
  const max = Math.max(range.max, value ?? range.max);
  const marks: string[] = [];
  for (let i = min; i <= max; i += 1) {
    marks.push(i === value ? `(${i})` : "=");
  }
  return (
    <div className="space-y-1">
      <p className="num overflow-x-auto whitespace-nowrap font-mono text-lg tracking-tight text-ember">
        {marks.join("")}
      </p>
      <p className="flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
        <span>{min}</span>
        <span>
          {value === null ? "not set" : `you: ${value}`} — band seen in the Role templates{" "}
          {range.min}–{range.max}
        </span>
        <span>{max}</span>
      </p>
    </div>
  );
}

/** A STAT box that opens its own briefing when clicked. */
export function StatInfoDialog({
  stat,
  value,
  children,
}: {
  stat: StatKey;
  value: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const info = STAT_DESCRIPTIONS[stat];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-left transition-colors hover:border-ember focus-visible:outline-none"
        aria-label={`What is ${stat.toUpperCase()} good for?`}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">
              {info ? `${info.stat} — ${info.name}` : stat.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {info ? info.group : "STAT"}
            </DialogDescription>
          </DialogHeader>
          {info ? (
            <div className="space-y-3">
              <p className="text-[0.95rem] leading-relaxed text-text">{info.description}</p>
              <p className="text-sm text-text-muted">Drives: {info.drives}</p>
              <StatScale stat={stat} value={value} />
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No entry for {stat.toUpperCase()} in src/data/rules/creation-rules.json →
              statDescriptions.stats.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The "?" beside a Skill line on the sheet. */
export function SkillInfo({ skillId }: { skillId: string }) {
  const [open, setOpen] = useState(false);
  let skill: ReturnType<typeof getSkill> | null = null;
  try {
    skill = getSkill(skillId);
  } catch {
    skill = null;
  }
  if (!skill) return null;
  const definition = skill;
  return (
    <>
      <InfoDot label={`What is ${definition.name}?`} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">{definition.name}</DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {definition.category} · {definition.stat.toUpperCase()}
              {definition.doubleCost ? " · x2" : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-[0.95rem] leading-relaxed text-text">
            {definition.description ??
              `No description for "${definition.id}" in src/data/rules/skills.json.`}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
