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
 * A glass tube with the value poured into it as glowing neon liquid. The
 * endpoints are the band the printed Role templates actually use for this STAT
 * (widened only if this Character sits outside it) — no invented ceiling.
 */
function StatScale({ stat, value }: { stat: StatKey; value: number | null }) {
  const range = statTemplateRange(stat);
  const min = Math.min(range.min, value ?? range.min);
  const max = Math.max(range.max, value ?? range.max);
  const span = Math.max(1, max - min);
  const pct = value === null ? 0 : Math.max(0, Math.min(100, ((value - min) / span) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="num font-mono text-xs text-text-dim">{min}</span>
        <div className="relative h-5 flex-1 overflow-hidden rounded-full border border-hairline bg-[color-mix(in_oklab,var(--color-surface)_70%,transparent)] shadow-[inset_0_1px_0_color-mix(in_oklab,white_12%,transparent)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember/50 to-ember shadow-[0_0_14px_2px_color-mix(in_oklab,var(--color-ember)_55%,transparent)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/12 to-transparent" />
          {value !== null && (
            <span
              className="num absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-text"
              style={{ left: `clamp(0.5rem, ${pct}% - 0.75rem, calc(100% - 1.75rem))` }}
            >
              {value}
            </span>
          )}
        </div>
        <span className="num font-mono text-xs text-text-dim">{max}</span>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
        {value === null ? "not set" : `you: ${value}`} · band seen in the Role templates {range.min}–
        {range.max}
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
  const flavor = STAT_FLAVOR[stat];
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">
              {info ? info.name : stat.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {info ? `${info.stat} · ${info.group}` : "STAT"}
            </DialogDescription>
          </DialogHeader>
          {info ? (
            <div className="space-y-3">
              <p className="text-[0.95rem] leading-relaxed text-text">{info.description}</p>
              <p className="text-[0.95rem] leading-relaxed text-text-muted">{flavor.atTheTable}</p>
              <p className="text-[0.95rem] leading-relaxed text-text-muted">{flavor.whenItsThin}</p>
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

/**
 * Extra colour for a Skill briefing, composed only from what skills.json
 * already says about the Skill — governing STAT, category, x2 cost, Basic
 * Skill status, specialization. No rules values are invented here.
 */
function skillNotes(skill: NonNullable<ReturnType<typeof getSkill>>): string[] {
  const statInfo = STAT_DESCRIPTIONS[skill.stat as StatKey];
  const statName = statInfo ? statInfo.name : skill.stat.toUpperCase();
  const notes: string[] = [];
  notes.push(
    `Rolled off ${statName} (${skill.stat.toUpperCase()}): when the table calls for this Skill, you add your ${statName} to your Level in it and let the d10 argue with the difficulty. Two edgerunners with the same training are not the same operator — the STAT underneath decides who makes it look easy.`,
  );
  notes.push(
    `It lives in the ${skill.category} group on your sheet, which is where the GM will look first when a scene turns that way. A Level here is not decoration; it is the reason a hard moment becomes a roll you actually want to make instead of one you are hoping to survive.`,
  );
  if (skill.doubleCost) {
    notes.push(
      "This one is flagged x2 — it costs double to raise. The book charges more for it because it is worth more, and the edgerunners who own it tend to be the ones people call by name.",
    );
  }
  if (skill.isBasicSkill) {
    notes.push(
      "It is a Basic Skill: everyone in Night City has at least a little of it, so you will never be rolling this one completely cold.",
    );
  }
  if (skill.requiresSpecialization) {
    notes.push(
      `It takes a specialization${skill.specializationLabel ? ` (${skill.specializationLabel})` : ""} — you do not know the whole field, you know your corner of it, and that corner is the one that pays.`,
    );
  }
  return notes;
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">{definition.name}</DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {definition.category} · {definition.stat.toUpperCase()}
              {definition.doubleCost ? " · x2" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[0.95rem] leading-relaxed text-text">
              {definition.description ??
                `No description for "${definition.id}" in src/data/rules/skills.json.`}
            </p>
            {skillNotes(definition).map((note) => (
              <p key={note.slice(0, 24)} className="text-[0.95rem] leading-relaxed text-text-muted">
                {note}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
