import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FitText } from "./FitText";
import {
  choiceOnlyDieSides,
  chooseRoleLifepathEntry,
  rollChoiceOnlyRoleLifepathTable,
  rollRoleLifepathTable,
  type LifepathEntryRecord,
  type RoleLifepathTable,
} from "@/engine";

import { DiceRoll } from "./DiceRoll";

export function RoleLifepathTableCard({
  roleId,
  table,
  entry,
  onChange,
}: {
  roleId: string;
  table: RoleLifepathTable;
  entry: LifepathEntryRecord | null;
  onChange: (entry: LifepathEntryRecord) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  /** Face shown at rest for tables with no printed die (virtual d2/d3/etc). */
  const [virtualFace, setVirtualFace] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const sides = table.die ? Number(table.die.slice(2)) : 0;
  const value = entry ? (entry.custom?.trim() ? entry.custom.trim() : entry.value) : null;

  return (
    <article
      className={cn(
        "border border-hairline bg-surface px-3 py-2.5 transition-colors duration-200",
        entry && "border-ember/40 bg-surface-raised",
        table.dependsOn && "border-l-2 border-l-cool",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <FitText
              as="h3"
              min={0.65}
              className="min-w-0 flex-1 font-display text-xs font-bold uppercase tracking-[0.12em] text-text"
            >
              {table.label}
            </FitText>
            {!(entry && entry.method === "rolled") && (
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-text-dim">
                {entry ? "chosen" : (table.die ?? "choose")}
              </span>
            )}
          </div>
          <FitText
            as="p"
            min={0.7}
            className={cn("mt-0.5 text-sm", value ? "text-text" : "text-text-dim")}
          >
            {value ?? "Not set"}
          </FitText>
          {table.sourceDiscrepancy && (
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cool">
              {table.sourceDiscrepancy}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {table.die && sides > 0 ? (
            <DiceRoll
              sides={sides}
              value={entry?.roll ?? null}
              roll={() => {
                const rolled = rollRoleLifepathTable(roleId, table.id, Math.random);
                return { face: rolled.entry.roll ?? 1, commit: () => onChange(rolled.entry) };
              }}
            />
          ) : (
            /* No printed die: offer a die sized to the number of options instead. */
            <DiceRoll
              sides={choiceOnlyDieSides(table)}
              value={virtualFace}
              label={`Pick at random (1d${choiceOnlyDieSides(table)})`}
              roll={() => {
                const rolled = rollChoiceOnlyRoleLifepathTable(roleId, table.id, Math.random);
                return {
                  face: rolled.face,
                  commit: () => {
                    setVirtualFace(rolled.face);
                    onChange({ ...rolled.entry, custom: entry?.custom ?? null });
                  },
                };
              }}
            />
          )}

          <Button size="sm" variant="outline" onClick={() => setChoosing(true)}>
            Choose
          </Button>
          {entry && (
            <button
              type="button"
              aria-label="Write this in your own words"
              aria-pressed={editing}
              onClick={() => setEditing((v) => !v)}
              className={cn(
                "grid size-8 shrink-0 place-items-center border text-xs transition-colors",
                editing
                  ? "border-ember text-ember"
                  : "border-hairline text-text-dim hover:border-ember hover:text-ember",
              )}
            >
              ✎
            </button>
          )}
        </div>
      </div>

      {entry && editing && (
        <div className="mt-2">
          <Input
            autoFocus
            value={entry.custom ?? ""}
            placeholder="In your own words…"
            onChange={(e) => onChange({ ...entry, custom: e.target.value || null })}
          />
          {entry.custom?.trim() && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
              Table value kept underneath: {entry.value}
            </p>
          )}
        </div>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{table.label}</DialogTitle>
            <DialogDescription>
              {table.prompt} Pick any row; choosing is as legal as rolling.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-hairline border border-hairline">
            {table.entries.map((row) => (
              <li key={row.value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full gap-3 p-3 text-left transition-colors duration-200 hover:bg-surface-raised",
                    entry?.value === row.value && "bg-surface-raised",
                  )}
                  onClick={() => {
                    setVirtualFace(null);
                    onChange({
                      ...chooseRoleLifepathEntry(roleId, table.id, row.value),
                      custom: entry?.custom ?? null,
                    });
                    setChoosing(false);
                  }}
                >
                  <span className="w-10 shrink-0 font-mono text-xs text-text-dim num">
                    {row.roll ?? "-"}
                  </span>
                  <span className="min-w-0 text-sm text-text">{row.value}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </article>
  );
}
