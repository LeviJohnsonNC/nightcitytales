/**
 * The faces under a line of narration: walk-on characters the turn named who
 * are not part of the standing cast, and so have no dossier — just a picture,
 * clickable for the full-size version. Never inline with the words, which
 * would need the model to also echo the exact phrase it used; a strip under
 * the paragraph needs nothing from the text at all.
 *
 * Collapsed by default everywhere except the one place a caller marks as the
 * current turn (`defaultOpen`): the same face recurring across a scrollback
 * of visits to one bar was turning into a wall of portraits, one per turn,
 * for a person the player already has a mental picture of.
 *
 * Life's CURRENT scene no longer uses the strip: its faces are one "Here" row
 * above the prose (`life/SceneFaces.tsx`), built from the same `WalkOnFace`. The
 * strip remains for Life's scrollback and for a Job turn, which has no row.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { seenAsLine } from "@/engine";
import { FacePlate } from "./FacePlate";
import { flavorArt, flavorSubjectLabel, type FlavorGender } from "./flavorArt";

export type WalkOn = { subject: string; gender: FlavorGender };

/** One walk-on as a face with its role and how it reads; the whole scene is a tap away. */
export function WalkOnFace({ subject, gender }: WalkOn) {
  const art = flavorArt(subject, gender);
  const [open, setOpen] = useState(false);
  // The catalog and the files on disk can drift (a JSON entry with no WebP
  // yet); rendering nothing is the honest answer, the same rule SceneHero
  // follows for a place with no picture.
  if (!art) return null;
  const label = flavorSubjectLabel(subject);
  const look = seenAsLine(art.look);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-[5.5rem] shrink-0 flex-col gap-1 text-left"
        aria-label={`Open image of ${label}`}
      >
        {/* The head and shoulders, cut from the scene (tools/art/flavor-faces.mjs):
            the whole 3:2 painting at this size was a few pixels of face and a lot of neon. */}
        <FacePlate
          src={art.faceSrc}
          name={label}
          alt={look ? `${label}, ${look}` : label}
          className="size-[5.5rem] transition-opacity group-hover:opacity-80"
        />
        <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[92vw] border border-hairline bg-surface p-0 sm:max-w-[64rem]">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <img
            src={art.src}
            srcSet={art.srcSet}
            sizes="(min-width: 640px) 1024px, 92vw"
            alt={label}
            className="w-full object-cover"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WalkOnStrip({
  walkOns,
  defaultOpen = false,
}: {
  walkOns: WalkOn[];
  /** Open on first render — reserved for wherever a caller shows "the current turn". */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!walkOns.length) return null;
  const label = walkOns.map((w) => flavorSubjectLabel(w.subject)).join(", ");
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")}
          />
          {label}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-wrap gap-3">
          {walkOns.map((w, i) => (
            <WalkOnFace key={`${w.subject}-${i}`} subject={w.subject} gender={w.gender} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
