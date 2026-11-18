import { DockTile } from "./DockTile";
/**
 * The people the character knows, as a row of faces.
 *
 * Five tiles with a ring that runs cold to warm, and what each one is carrying
 * waits behind a tap rather than standing open down the rail. "All" opens the
 * whole list and, beside it, where the character stands with the factions.
 * Presentation only: dispositions, standings and the facts a player has earned
 * are all read from the campaign, and nothing here decides one.
 */
import { useState } from "react";
import { Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { NpcDossier, NpcName } from "@/features/cast/NpcName";
import { getFaction, isHostile, standingBand, type FactionStanding } from "@/engine";
import { cn } from "@/lib/utils";
import { RING, WORD, dispositionBand } from "./hudModel";

export type HudPerson = {
  key: string;
  name: string;
  disposition: number;
  standing?: string | undefined;
  known?: readonly string[] | undefined;
  lastSeenDay?: number | undefined;
};

function Face({ person, size }: { person: HudPerson; size: "md" | "sm" }) {
  const [failed, setFailed] = useState(false);
  const npc = findNpc(person.name);
  const art = npc && !failed ? npcArtwork(npc) : null;
  const band = dispositionBand(person.disposition);
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border-2 bg-ground font-bold text-text-dim",
        size === "md" ? "size-12 text-lg" : "size-9 text-sm",
        RING[band.tone],
      )}
    >
      {art ? (
        <img
          src={art.src}
          srcSet={art.srcSet}
          sizes="48px"
          alt=""
          className="h-full w-full object-cover object-top"
          onError={() => setFailed(true)}
        />
      ) : (
        person.name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** What one person is, to this character: how they feel, who they are, what has been learned. */
function Detail({ person }: { person: HudPerson }) {
  const band = dispositionBand(person.disposition);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold">
          <NpcName name={person.name} />
        </span>
        <span
          className={cn(
            "num shrink-0 font-mono text-[10px] uppercase tracking-[0.16em]",
            WORD[band.tone],
          )}
        >
          {band.label} ({person.disposition})
        </span>
      </div>
      {person.standing && <p className="text-xs text-muted-foreground">{person.standing}</p>}
      {(person.known ?? []).map((fact) => (
        <p key={fact} className="text-xs text-neon-pink">
          {fact}
        </p>
      ))}
    </div>
  );
}

/** The same facts as `Detail`, set under the name in a dossier rather than in a popover. */
function Relation({ person }: { person: HudPerson }) {
  const band = dispositionBand(person.disposition);
  return (
    <div className="space-y-1 border-y border-hairline/60 py-2">
      <p className={cn("num font-mono text-[10px] uppercase tracking-[0.16em]", WORD[band.tone])}>
        {band.label} ({person.disposition})
      </p>
      {person.standing && <p className="text-sm text-muted-foreground">{person.standing}</p>}
      {(person.known ?? []).map((fact) => (
        <p key={fact} className="text-sm text-neon-pink">
          {fact}
        </p>
      ))}
    </div>
  );
}

function Standings({ standings }: { standings: readonly FactionStanding[] }) {
  if (standings.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-hairline pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">Standing</p>
      <ul className="space-y-1">
        {standings.map((s) => (
          <li
            key={s.factionId}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2"
          >
            <span className="truncate text-sm">{getFaction(s.factionId).name}</span>
            <span
              className={cn(
                "num shrink-0 font-mono text-[10px] uppercase tracking-[0.16em]",
                isHostile(s.standing) ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {standingBand(s.standing).label} ({s.standing})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactFace({ person }: { person: HudPerson }) {
  const npc = findNpc(person.name);
  const [open, setOpen] = useState(false);
  return npc ? (
    <>
      <button
        type="button"
        aria-label={`Open dossier for ${person.name}`}
        onClick={() => setOpen(true)}
      >
        <Face person={person} size="sm" />
      </button>
      <NpcDossier
        npc={npc}
        open={open}
        onOpenChange={setOpen}
        relation={<Relation person={person} />}
      />
    </>
  ) : (
    <Face person={person} size="sm" />
  );
}

export function PeopleStrip({
  people,
  standings,
}: {
  people: readonly HudPerson[];
  standings: readonly FactionStanding[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <DockTile icon={<Users />} label="Contacts" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Contacts and standing</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {!people.length && <p>Your contacts will appear here as you meet them.</p>}
          <ul className="space-y-4">
            {people.map((person) => (
              <li key={person.key} className="flex gap-3">
                <ContactFace person={person} />
                <div className="min-w-0 flex-1">
                  <Detail person={person} />
                </div>
              </li>
            ))}
          </ul>
          <Standings standings={standings} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
