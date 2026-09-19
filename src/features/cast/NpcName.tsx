/**
 * A name you can click. Opens the dossier: the portrait, what they are to the
 * character, and the background text once it exists.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { findNpc, npcArtwork, type NpcEntry, type NpcKind } from "./npcDirectory";

/**
 * Which kinds get a face in running prose. Factions and hostile archetypes are
 * groups or repeatable crowd-fill rather than a specific person the text is
 * about, and a thumbnail on every mention of "gangers" or "Tyger Claws" would
 * read as noise rather than a face worth knowing.
 */
const INLINE_PORTRAIT_KINDS = new Set<NpcKind>(["cast", "broker", "patron", "target"]);

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
      <DialogContent className="max-h-[88vh] max-w-[92vw] overflow-y-auto border border-hairline bg-surface p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{npc.name}</DialogTitle>
        {/*
          One child, deliberately. DialogContent lays its children out in a
          grid, and a grid row sized automatically around a child whose height
          comes from an aspect-ratio comes up short — which drops the portrait
          over the name printed underneath it.
        */}
        <div>
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-background">
            <img
              src={npcArtwork(npc).src}
              srcSet={npcArtwork(npc).srcSet}
              sizes="(min-width: 640px) 512px, 92vw"
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
              <div className="space-y-3 pt-1">
                {npc.bio.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-foreground/90">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Dossier pending
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline clickable name. Falls back to plain text when we have no such person.
 *
 * `portrait` additionally puts a small face in front of the name — for prose
 * (NpcText), where a name is a passing mention worth a glance, not for the
 * compact People rail, which truncates a whole line to one and has no room
 * to spare.
 */
export function NpcName({
  name,
  children,
  portrait = false,
}: {
  name: string;
  children?: React.ReactNode;
  portrait?: boolean;
}) {
  const npc = findNpc(name);
  const [open, setOpen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  if (!npc) return <>{children ?? name}</>;
  const showThumb = portrait && INLINE_PORTRAIT_KINDS.has(npc.kind) && !thumbFailed;
  const thumb = showThumb ? npcArtwork(npc) : null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border-b border-dotted border-accent/60 text-accent transition-colors hover:border-accent hover:text-ember"
        aria-label={`Open dossier for ${npc.name}`}
      >
        {thumb && (
          <img
            src={thumb.src}
            srcSet={thumb.srcSet}
            sizes="20px"
            alt=""
            className="mr-1 inline-block h-[1.15em] w-[1.15em] -translate-y-[1px] rounded-full border border-hairline/70 align-middle object-cover"
            onError={() => setThumbFailed(true)}
          />
        )}
        {children ?? name}
      </button>
      <NpcDossier npc={npc} open={open} onOpenChange={setOpen} />
    </>
  );
}
