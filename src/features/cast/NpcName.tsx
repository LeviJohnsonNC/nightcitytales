/**
 * A name you can click. Opens the dossier: the portrait, what they are to the
 * character, and the background text once it exists.
 */
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FacePlate } from "./FacePlate";
import { findNpc, isPerson, npcArtwork, type NpcEntry } from "./npcDirectory";
import { seenAsFor } from "./npcLooks";

export function NpcDossier({
  npc,
  open,
  onOpenChange,
  relation,
}: {
  npc: NpcEntry;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** What this person is to the character right now: shown under their name. */
  relation?: React.ReactNode;
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
            {relation}
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
 * A face on a card, for the "who is here" row: the same plate the walk-ons get,
 * with the name and role under it, opening the dossier on tap.
 */
export function NpcFace({
  npc,
  ringClass,
  relation,
}: {
  npc: NpcEntry;
  ringClass?: string | undefined;
  relation?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const art = npcArtwork(npc);
  const look = seenAsFor(npc.name);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-[5.5rem] shrink-0 flex-col gap-1 text-left"
        aria-label={`Open dossier for ${npc.name}`}
      >
        <FacePlate
          src={art.src}
          srcSet={art.srcSet}
          sizes="88px"
          name={npc.name}
          alt={look ? `${npc.name}, ${look}` : npc.name}
          ringClass={ringClass}
          className="size-[5.5rem] transition-opacity group-hover:opacity-80"
        />
        <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">
          {npc.name}
        </span>
      </button>
      <NpcDossier npc={npc} open={open} onOpenChange={setOpen} relation={relation} />
    </>
  );
}

/** The little card over a name: who it is, at a glance. */
function NameCard({ npc }: { npc: NpcEntry }) {
  const art = npcArtwork(npc);
  const look = seenAsFor(npc.name);
  return (
    <div className="flex items-center gap-3">
      <FacePlate
        src={art.src}
        srcSet={art.srcSet}
        sizes="64px"
        name={npc.name}
        className="size-16"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight text-foreground">{npc.name}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {npc.role}
        </p>
        {look && <p className="mt-0.5 text-xs text-muted-foreground/80">{look}</p>}
      </div>
    </div>
  );
}

/**
 * Inline clickable name. Falls back to plain text when we have no such person.
 *
 * `card` puts a small card with the person's face over the name while a mouse
 * rests on it, for prose (NpcText) where a name is a passing mention worth a
 * glance. It used to put a thumbnail in front of every mention instead, which
 * turned a paragraph into a row of tiny circles; the scene's "who is here" row
 * now carries the faces and the text stays text. A tap still opens the dossier,
 * since a touch screen has no hover.
 */
export function NpcName({
  name,
  children,
  card = false,
}: {
  name: string;
  children?: React.ReactNode;
  card?: boolean;
}) {
  const npc = findNpc(name);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (!npc) return <>{children ?? name}</>;
  const showCard = card && isPerson(npc);
  // A short delay either way, so a mouse crossing the text does not flash cards
  // and a mouse travelling from the name to the card does not lose it.
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(true), 220);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(false), 120);
  };
  const button = (
    <button
      type="button"
      onClick={() => {
        setHover(false);
        setOpen(true);
      }}
      onPointerEnter={showCard ? enter : undefined}
      onPointerLeave={showCard ? leave : undefined}
      onFocus={showCard ? () => setHover(true) : undefined}
      onBlur={showCard ? () => setHover(false) : undefined}
      className={cn(
        "cursor-pointer border-b border-dotted border-accent/60 text-accent transition-colors hover:border-accent hover:text-ember",
      )}
      aria-label={`Open dossier for ${npc.name}`}
    >
      {children ?? name}
    </button>
  );
  return (
    <>
      {showCard ? (
        <Popover open={hover} onOpenChange={setHover}>
          <PopoverAnchor asChild>{button}</PopoverAnchor>
          <PopoverContent
            side="top"
            align="start"
            className="w-64 p-3"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={leave}
          >
            <NameCard npc={npc} />
          </PopoverContent>
        </Popover>
      ) : (
        button
      )}
      <NpcDossier npc={npc} open={open} onOpenChange={setOpen} />
    </>
  );
}
