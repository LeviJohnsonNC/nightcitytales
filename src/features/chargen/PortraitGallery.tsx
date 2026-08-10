import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArtSlot } from "./ArtSlot";
import { PRESENTATIONS, portraitArt, portraits, type Presentation } from "./art";

/**
 * Portrait picker. Every image resolves through art.ts (pointer → manifest src
 * → placeholder); no path or pointer is referenced here. Filters are soft chips
 * the player can clear to browse everything.
 */
export function PortraitGallery({
  roleId,
  selected,
  onSelect,
}: {
  roleId: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const all = portraits();
  const [roleOnly, setRoleOnly] = useState(Boolean(roleId));
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      all.filter(
        (p) =>
          (!roleOnly || !roleId || p.roles.includes(roleId)) &&
          (!presentation || p.presentation === presentation),
      ),
    [all, roleOnly, roleId, presentation],
  );

  const enlargedEntry = enlarged ? all.find((p) => p.id === enlarged) ?? null : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Filters
        </span>
        {roleId ? (
          <Chip active={roleOnly} onClick={() => setRoleOnly((v) => !v)}>
            Fits my Role
          </Chip>
        ) : null}
        {PRESENTATIONS.map((p) => (
          <Chip
            key={p}
            active={presentation === p}
            onClick={() => setPresentation((cur) => (cur === p ? null : p))}
          >
            {p}
          </Chip>
        ))}
        {(roleOnly || presentation) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRoleOnly(false);
              setPresentation(null);
            }}
          >
            Clear — show everything
          </Button>
        )}
      </div>

      {all.length === 0 ? (
        <div className="border border-dashed border-hairline bg-surface/50 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
            No portraits registered
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Upload artwork to Lovable, then add one entry to
            <span className="font-mono"> src/data/art/manifest.json → portraits</span>. Nothing
            else needs touching.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-text-muted">
          No portrait matches those filters. Clear them to browse everything.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shown.map((entry) => {
            const art = portraitArt(entry);
            const isSelected = selected === entry.id;
            return (
              <li key={entry.id}>
                <div
                  className={`relative aspect-[3/4] border transition-colors duration-200 ${
                    isSelected ? "border-ember" : "border-hairline"
                  }`}
                >
                  <ArtSlot art={art} label={entry.id} />
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-ground/80 p-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setEnlarged(entry.id)}
                    >
                      Enlarge
                    </Button>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => onSelect(isSelected ? null : entry.id)}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={enlargedEntry !== null} onOpenChange={(open) => !open && setEnlarged(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="font-mono text-sm uppercase tracking-[0.2em]">
            {enlargedEntry?.id}
          </DialogTitle>
          <DialogDescription>{enlargedEntry?.alt}</DialogDescription>
          {enlargedEntry ? (
            <>
              <div className="relative aspect-[3/4] w-full border border-hairline">
                <ArtSlot art={portraitArt(enlargedEntry)} label={enlargedEntry.id} />
              </div>
              <Button
                onClick={() => {
                  onSelect(enlargedEntry.id);
                  setEnlarged(null);
                }}
              >
                Use this portrait
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors duration-200 ${
        active
          ? "border-ember bg-ember/15 text-text"
          : "border-hairline text-text-muted hover:border-ember/60"
      }`}
    >
      {children}
    </button>
  );
}