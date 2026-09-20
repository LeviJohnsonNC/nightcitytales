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
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { flavorArt, flavorSubjectLabel, type FlavorGender } from "./flavorArt";

export type WalkOn = { subject: string; gender: FlavorGender };

function WalkOnPortrait({ subject, gender }: WalkOn) {
  const art = flavorArt(subject, gender);
  const [open, setOpen] = useState(false);
  // The catalog and the files on disk can drift (a JSON entry with no WebP
  // yet); rendering nothing is the honest answer, the same rule SceneHero
  // follows for a place with no picture.
  if (!art) return null;
  const label = flavorSubjectLabel(subject);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="aspect-[3/2] h-20 shrink-0 overflow-hidden rounded-md border border-hairline/70 transition-opacity hover:opacity-80"
        aria-label={`Open image of ${label}`}
      >
        <img
          src={art.src}
          srcSet={art.srcSet}
          sizes="120px"
          alt={label}
          className="h-full w-full object-cover object-top"
        />
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
        <div className="mt-2 flex flex-wrap gap-2">
          {walkOns.map((w, i) => (
            <WalkOnPortrait key={`${w.subject}-${i}`} subject={w.subject} gender={w.gender} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
