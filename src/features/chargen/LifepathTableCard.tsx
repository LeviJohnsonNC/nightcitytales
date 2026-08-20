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

/**
 * A single Lifepath table rendered as a compact row: label + current value on
 * the left, Roll / Choose / edit controls on the right. The free-text override
 * is hidden behind the pencil and only appears when the player opens it.
 */
export function LifepathTableCard({
  tableId,
  entry,
  onChange,
  onRemove,
  titleOverride,
}: {
  tableId: string;
  entry: LifepathEntryRecord | null;
  onChange: (entry: LifepathEntryRecord) => void;
  onRemove?: () => void;
  /** Kept for call-site compatibility; the row is always compact now. */
  compact?: boolean;
  titleOverride?: string;
}) {
  const table = getLifepathTable(tableId);
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState(false);
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
  const value = entry ? (entry.custom?.trim() ? entry.custom.trim() : entry.value) : null;

  return (
    <article
      className={cn(
        "border border-hairline bg-surface px-3 py-2.5 transition-colors duration-200",
        entry && "border-ember/40 bg-surface-raised",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-display text-xs font-bold uppercase tracking-[0.12em] text-text">
              {titleOverride ?? table.label}
            </h3>
            {entry && (
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-text-dim num">
                {entry.method === "rolled" ? `rolled ${entry.roll}` : "chosen"}
              </span>
            )}
          </div>
          <p className={cn("mt-0.5 truncate text-sm", value ? "text-text" : "text-text-dim")}>
            {value ?? "Not set"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {rolling && (
            <span
              aria-hidden
              className="grid size-7 animate-pulse place-items-center border border-ember font-mono text-sm font-semibold text-ember num"
            >
              {face}
            </span>
          )}
          <Button size="sm" onClick={handleRoll} disabled={rolling}>
            {rolling ? "…" : entry ? "Reroll" : "Roll"}
          </Button>
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
          {onRemove && (
            <button
              type="button"
              aria-label="Remove"
              onClick={onRemove}
              className="grid size-8 shrink-0 place-items-center border border-hairline text-text-dim transition-colors hover:border-danger hover:text-danger"
            >
              ×
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
              <li key={row.label}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full gap-3 p-3 text-left transition-colors duration-200 hover:bg-surface-raised",
                    entry?.value === row.value && "bg-surface-raised",
                  )}
                  onClick={() => {
                    onChange({
                      ...chooseLifepathEntry(tableId, row.value),
                      custom: entry?.custom ?? null,
                    });
                    setChoosing(false);
                  }}
                >
                  <span className="w-10 shrink-0 font-mono text-xs text-text-dim num">
                    {row.label}
                  </span>
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
