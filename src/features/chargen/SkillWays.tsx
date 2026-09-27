import { useState, type ReactNode } from "react";
import {
  getSkill,
  matchingPreset,
  presetEntries,
  presetSkillId,
  presetsFor,
  skillEntryKey,
  skillEntryName,
  type SkillEntry,
} from "@/engine";
import { cn } from "@/lib/utils";
import { SKILL_TASKS, taskOdds } from "./skillTasks";
import { useChargenStore, type ChargenState } from "./store";

type Method = "edgerunner" | "complete_package";

/** How many things the "what you can do" list shows. Enough to see a shape. */
const SHOWN = 6;

/** A chance as a bar and a number, coloured by how much you would want to bet on it. */
export function OddsBar({ percent, className }: { percent: number; className?: string }) {
  const tone = percent >= 70 ? "bg-success" : percent >= 40 ? "bg-accent" : "bg-text-dim";
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="relative h-1.5 w-20 overflow-hidden bg-hairline">
        <span className={cn("absolute inset-y-0 left-0", tone)} style={{ width: `${percent}%` }} />
      </span>
      <span className="w-9 text-right font-mono text-xs tabular-nums">{percent}%</span>
    </span>
  );
}

/**
 * "How do you work?" — three ways to be this Role, each a legal allocation.
 *
 * Picking one writes a full sheet the validators accept, so a player can be
 * done here in one click. The card whose sheet the character currently has
 * stays lit; move a single point in the fine-tune drawer and it goes dark,
 * because it is no longer that preset, it is theirs.
 */
export function WaysToWork({ state, method }: { state: ChargenState; method: Method }) {
  const patch = useChargenStore((s) => s.patch);
  const roleId = state.roleId;
  const presets = presetsFor(roleId);
  if (!roleId || presets.length === 0) return null;
  const current = state.skills.length
    ? matchingPreset({ method, roleId, entries: state.skills })
    : null;
  const edited = state.skills.length > 0 && !current;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold tracking-tight">Pick how you work</h2>
        <p className="text-sm text-text-muted">
          {edited
            ? "You have made this your own. Pick one again to start over from it."
            : "One click and your Skills are set. You can fine-tune anything after."}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {presets.map((preset) => {
          const selected = current?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                patch({
                  skills: presetEntries({ method, roleId, preset, current: state.skills }),
                })
              }
              className={cn(
                "flex flex-col gap-2 border p-4 text-left transition-colors",
                selected
                  ? "border-ember bg-ember/10"
                  : "border-hairline bg-surface hover:border-accent/60",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-bold tracking-tight">{preset.name}</span>
                {selected && (
                  <span className="bg-ember px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-background">
                    You
                  </span>
                )}
              </span>
              <span className="text-sm leading-relaxed text-text-muted">{preset.pitch}</span>
              <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {preset.focus.map((name) => (
                  <span
                    key={name}
                    className="border border-hairline px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim"
                  >
                    {getSkill(presetSkillId(name) ?? "").name}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * What this character can actually do, and how likely it is to work.
 *
 * The Skills a character has invested in, shown as tasks with odds rather
 * than as numbers. Odds come from the engine against a DV on the printed
 * ladder; nothing here is estimated. Before the STATs exist it says so rather
 * than showing a chance it cannot know.
 */
export function WhatYouCanDo({
  state,
  entries,
  home,
}: {
  state: ChargenState;
  entries: SkillEntry[];
  home: string | null;
}) {
  const lines = entries
    .filter((e) => e.level >= 4)
    .map((entry) => ({ entry, odds: taskOdds(entry, state.stats) }))
    .filter((l): l is { entry: SkillEntry; odds: NonNullable<typeof l.odds> } => l.odds !== null)
    .sort((a, b) => b.odds.percent - a.odds.percent || b.entry.level - a.entry.level)
    .slice(0, SHOWN);

  if (entries.length === 0) return null;
  const statsMissing = entries.some(
    (e) => taskOdds(e, state.stats) === null && SKILL_TASKS[e.skillId],
  );

  return (
    <section className="space-y-3 border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold tracking-tight">What you can do</h2>
        <p className="text-sm text-text-muted">
          Your real chances, from your STATs and Skills against the book&apos;s difficulties.
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm italic text-text-dim">
          {statsMissing
            ? "Set your STATs first and your chances show up here."
            : "Nothing stands out yet. Pick how you work, or raise a Skill."}
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {lines.map(({ entry, odds }) => (
            <li
              key={skillEntryKey(entry)}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{odds.task}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
                  {skillEntryName(entry, home)} {entry.level} · {odds.dvName}
                </span>
              </span>
              <OddsBar percent={odds.percent} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Every Level by hand, closed until asked for. Open by default for a sheet that is not a preset. */
export function FineTune({ children, open: initial }: { children: ReactNode; open: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="border border-hairline">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          {open ? "Close fine-tuning" : "Fine-tune every Skill"}
        </span>
        <span aria-hidden className="font-mono text-text-dim">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="space-y-4 border-t border-hairline p-4">{children}</div>}
    </section>
  );
}
