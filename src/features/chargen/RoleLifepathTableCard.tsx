import { useEffect, useRef, useState } from "react";
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
import {
  chooseRoleLifepathEntry,
  rollRoleLifepathTable,
  type LifepathEntryRecord,
  type RoleLifepathTable,
} from "@/engine";

/** How long the die tumbles before the engine's result is shown. */
const ROLL_MS = 620;

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
  const [face, setFace] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const sides = table.die ? Number(table.die.slice(2)) : 0;

  function handleRoll() {
    if (face !== null || !table.die) return;
    const tick = window.setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), 60);
    const stop = window.setTimeout(() => {
      window.clearInterval(tick);
      const rolled = rollRoleLifepathTable(roleId, table.id, Math.random);
      setFace(null);
      onChange(rolled.entry);
    }, ROLL_MS);
    timers.current.push(stop);
    setFace(1);
  }

  const rolling = face !== null;

  return (
    <article
      className={cn(
        "border border-hairline bg-surface p-4 transition-colors duration-200",
        entry && "border-ember/40 bg-surface-raised",
        table.dependsOn && "border-l-2 border-l-cool",
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
          {table.label}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          {table.die ?? "choose only"}
        </span>
        {entry && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim num">
            {entry.method === "rolled" ? `rolled ${entry.roll}` : "chosen"}
          </span>
        )}
      </header>

      {table.sourceDiscrepancy && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cool">
          {table.sourceDiscrepancy}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {table.die && (
          <>
            <Button size="sm" onClick={handleRoll} disabled={rolling}>
              {rolling ? "…" : entry ? `Reroll ${table.die}` : `Roll ${table.die}`}
            </Button>
            <span
              aria-hidden
              className={cn(
                "grid size-9 place-items-center border border-hairline font-mono text-base font-semibold num",
                rolling ? "animate-pulse border-ember text-ember" : "text-text-muted",
              )}
            >
              {rolling ? face : (entry?.roll ?? "–")}
            </span>
          </>
        )}
        <Button size={table.die ? "sm" : "default"} variant="outline" onClick={() => setChoosing(true)}>
          Choose
        </Button>
      </div>

      {entry ? (
        <div className="mt-3 space-y-2">
          <p className="text-base text-text">{entry.value}</p>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              Free-text override — your words, table value kept underneath
            </span>
            <Input
              className="mt-1"
              value={entry.custom ?? ""}
              placeholder="Say it in your own voice…"
              onChange={(e) => onChange({ ...entry, custom: e.target.value || null })}
            />
          </label>
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-dim">No answer yet.</p>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{table.label}</DialogTitle>
            <DialogDescription>
              {table.prompt} — pick any row. Choosing is as legal as rolling.
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
                    onChange({
                      ...chooseRoleLifepathEntry(roleId, table.id, row.value),
                      custom: entry?.custom ?? null,
                    });
                    setChoosing(false);
                  }}
                >
                  <span className="w-10 shrink-0 font-mono text-xs text-text-dim num">
                    {row.roll ?? "—"}
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