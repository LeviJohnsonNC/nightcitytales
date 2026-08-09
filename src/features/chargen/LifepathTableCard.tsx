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
  chooseLifepathEntry,
  getLifepathTable,
  rollLifepathTable,
  type LifepathEntryRecord,
} from "@/engine";

/** How long the die tumbles before the engine's result is shown. */
const ROLL_MS = 620;

export function LifepathTableCard({
  tableId,
  entry,
  onChange,
  onRemove,
  compact,
  titleOverride,
}: {
  tableId: string;
  entry: LifepathEntryRecord | null;
  onChange: (entry: LifepathEntryRecord) => void;
  onRemove?: () => void;
  compact?: boolean;
  titleOverride?: string;
}) {
  const table = getLifepathTable(tableId);
  const [choosing, setChoosing] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function handleRoll() {
    if (face !== null) return;
    const tick = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 10)), 60);
    const stop = window.setTimeout(() => {
      window.clearInterval(tick);
      const rolled = rollLifepathTable(tableId, Math.random);
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
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
          {titleOverride ?? table.label}
        </h3>
        {!compact && <p className="text-xs text-text-dim">{table.prompt}</p>}
        <div className="ml-auto flex items-center gap-2">
          {entry && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim num">
              {entry.method === "rolled" ? `rolled ${entry.roll}` : "chosen"}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-danger"
            >
              remove
            </button>
          )}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={handleRoll} disabled={rolling}>
          {rolling ? "…" : entry ? "Reroll 1d10" : "Roll 1d10"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setChoosing(true)}>
          Choose
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
      </div>

      {entry ? (
        <div className="mt-3 space-y-2">
          <p className="text-base text-text">{entry.value}</p>
          {entryDescription(tableId, entry.value) && (
            <p className="text-xs leading-relaxed text-text-muted">
              {entryDescription(tableId, entry.value)}
            </p>
          )}
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
              <li key={row.label}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full gap-3 p-3 text-left transition-colors duration-200 hover:bg-surface-raised",
                    entry?.value === row.value && "bg-surface-raised",
                  )}
                  onClick={() => {
                    onChange({ ...chooseLifepathEntry(tableId, row.value), custom: entry?.custom ?? null });
                    setChoosing(false);
                  }}
                >
                  <span className="w-10 shrink-0 font-mono text-xs text-text-dim num">{row.label}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-text">{row.value}</span>
                    {row.description && (
                      <span className="mt-1 block text-xs text-text-muted">{row.description}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function entryDescription(tableId: string, value: string): string | undefined {
  return getLifepathTable(tableId).entries.find((e) => e.value === value)?.description;
}
