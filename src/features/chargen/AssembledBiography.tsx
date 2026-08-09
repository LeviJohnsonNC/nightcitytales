import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LifepathEntryRecord } from "@/engine";

export type BiographyEditRow = {
  key: string;
  label: string;
  entry: LifepathEntryRecord;
  onChange: (entry: LifepathEntryRecord) => void;
};

/** The whole story — general plus Role — as one continuous piece of prose. */
export function AssembledBiography({
  paragraphs,
  rows,
}: {
  paragraphs: string[];
  rows: BiographyEditRow[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="border border-hairline bg-surface-raised p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-base font-bold uppercase tracking-[0.14em] text-text">
          The whole story
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done editing" : "Edit any of this"}
        </Button>
      </header>

      {paragraphs.length === 0 ? (
        <p className="mt-4 text-sm italic text-text-dim">
          Answer some tables and your biography assembles here.
        </p>
      ) : (
        <div className="mt-4 space-y-4 text-[1.0625rem] leading-[1.75] text-text">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-6 space-y-3 border-t border-hairline pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
            Reword anything. The table value stays underneath for the GM layer.
          </p>
          {rows.map((row) => (
            <label key={row.key} className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                {row.label} — {row.entry.value}
              </span>
              <Input
                className="mt-1"
                value={row.entry.custom ?? ""}
                placeholder={row.entry.value}
                onChange={(e) =>
                  row.onChange({ ...row.entry, custom: e.target.value || null })
                }
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}