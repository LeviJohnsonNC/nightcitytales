/**
 * A name you can click. Opens the dossier: the portrait, what they are to the
 * character, and the background text once it exists.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { findNpc, npcImage, type NpcEntry } from "./npcDirectory";

export function NpcDossier({
  npc,
  open,
  onOpenChange,
}: {
  npc: NpcEntry;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] border border-hairline bg-surface p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{npc.name}</DialogTitle>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-background">
          <img
            src={npcImage(npc)}
            alt={npc.name}
            className="h-full w-full object-cover object-top"
          />
          <div className="pointer-events-none absolute inset-0 border border-ember/40" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ember/60 to-transparent" />
        </div>
        <div className="space-y-2 p-5 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            {npc.role}
          </p>
          <h2 className="text-lg font-bold leading-tight">{npc.name}</h2>
          {npc.bio ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{npc.bio}</p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Dossier pending
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Inline clickable name. Falls back to plain text when we have no such person. */
export function NpcName({ name, children }: { name: string; children?: React.ReactNode }) {
  const npc = findNpc(name);
  const [open, setOpen] = useState(false);
  if (!npc) return <>{children ?? name}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border-b border-dotted border-accent/60 text-accent transition-colors hover:border-accent hover:text-ember"
        aria-label={`Open dossier for ${npc.name}`}
      >
        {children ?? name}
      </button>
      <NpcDossier npc={npc} open={open} onOpenChange={setOpen} />
    </>
  );
}
