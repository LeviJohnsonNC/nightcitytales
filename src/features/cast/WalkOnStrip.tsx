/**
 * The faces under a line of narration: walk-on characters the turn named who
 * are not part of the standing cast, and so have no dossier — just a picture,
 * clickable for the full-size version. Never inline with the words, which
 * would need the model to also echo the exact phrase it used; a strip under
 * the paragraph needs nothing from the text at all.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
        className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-hairline/70 transition-opacity hover:opacity-80"
        aria-label={`Open image of ${label}`}
      >
        <img
          src={art.src}
          srcSet={art.srcSet}
          sizes="40px"
          alt={label}
          className="h-full w-full object-cover object-top"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border border-hairline bg-surface p-0">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <img
            src={art.src}
            srcSet={art.srcSet}
            sizes="512px"
            alt={label}
            className="w-full object-cover"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WalkOnStrip({ walkOns }: { walkOns: WalkOn[] }) {
  if (!walkOns.length) return null;
  return (
    <div className="flex gap-2">
      {walkOns.map((w, i) => (
        <WalkOnPortrait key={`${w.subject}-${i}`} subject={w.subject} gender={w.gender} />
      ))}
    </div>
  );
}
