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
import { uploadedAsset } from "./art";
import { SKILL_TASKS, taskOdds } from "./skillTasks";
import { useChargenStore, type ChargenState } from "./store";

type Method = "edgerunner" | "complete_package";

/**
 * The picture on a way-to-work card, by file name: `way-<role>-<preset>`, e.g.
 * `way-exec-shark.webp` in src/assets/creator. A card with no file keeps its
 * plain look. The list of names and what each shows is in docs/art-style.md.
 */
export function wayArtName(roleId: string, presetId: string): string {
  return `way-${roleId}-${presetId.replace(/_/g, "-")}`;
}

/** How many things the "what you can do" list shows. Enough to see a shape. */
const SHOWN = 6;

/**
 * How likely a task must be to count as something you can DO. Presentation, not
 * a rule: the odds themselves are the engine's, this only picks which to boast of.
 */
const LIKELY = 80;

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
          const art = uploadedAsset(wayArtName(roleId, preset.id));
          const badge = selected && (
            <span className="bg-ember px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-background">
              You
            </span>
          );
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
                "group flex flex-col gap-2 overflow-hidden border text-left transition-[border-color,background-color,box-shadow] duration-300",
                art ? "pb-4" : "p-4",
                selected
                  ? "border-ember bg-ember/10 shadow-[0_0_30px_-12px_var(--color-ember)]"
                  : "border-hairline bg-surface hover:border-accent/60",
              )}
            >
              {art ? (
                <span className="relative block aspect-[16/9] overflow-hidden">
                  <img
                    src={art}
                    alt=""
                    loading="lazy"
                    className={cn(
                      "h-full w-full object-cover transition-[transform,filter] duration-700 ease-out group-hover:scale-105",
                      !selected &&
                        "brightness-[0.8] saturate-[0.85] group-hover:brightness-100 group-hover:saturate-100",
                    )}
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
                  <span className="absolute inset-x-4 bottom-2 flex items-end justify-between gap-2">
                    <span className="text-xl font-bold tracking-tight [text-shadow:0_1px_6px_rgb(0_0_0/0.8)]">
                      {preset.name}
                    </span>
                    {badge}
                  </span>
                </span>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold tracking-tight">{preset.name}</span>
                  {badge}
                </span>
              )}
              <span className={cn("text-sm leading-relaxed text-text-muted", art && "px-4")}>
                {preset.pitch}
              </span>
              <span className={cn("mt-auto flex flex-wrap gap-1.5 pt-1", art && "px-4")}>
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
 * What this character can actually do: the things their best Skills make
 * likely, one line each, "Athletics: Clear the gap between two rooftops".
 *
 * Only tasks the engine puts at LIKELY or better are listed, best first, so a
 * short list is an honest one. The odds come from the engine against a DV on
 * the printed ladder and are not shown — being on the list is the claim. The
 * bars live in the fine-tune rows, where moving a Level moves them. Before the
 * STATs exist it says so rather than quoting a chance it cannot know.
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
    .map((entry) => ({ entry, odds: taskOdds(entry, state.stats) }))
    .filter((l): l is { entry: SkillEntry; odds: NonNullable<typeof l.odds> } => l.odds !== null)
    .filter((l) => l.odds.percent >= LIKELY)
    .sort((a, b) => b.odds.percent - a.odds.percent || b.entry.level - a.entry.level)
    .slice(0, SHOWN);

  if (entries.length === 0) return null;
  const statsMissing = entries.some(
    (e) => taskOdds(e, state.stats) === null && SKILL_TASKS[e.skillId],
  );

  return (
    <section className="space-y-3 border border-hairline bg-surface p-4">
      <h2 className="text-lg font-bold tracking-tight">What you can do</h2>
      {lines.length === 0 ? (
        <p className="text-sm italic text-text-dim">
          {statsMissing
            ? "Set your STATs first and what you are good at shows up here."
            : "Nothing is a sure thing yet. Pick how you work, or raise a Skill."}
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {lines.map(({ entry, odds }) => (
            <li key={skillEntryKey(entry)} className="py-2 text-sm">
              <span className="font-bold">{skillEntryName(entry, home)}</span>
              <span className="text-text-muted">: {odds.task}</span>
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
