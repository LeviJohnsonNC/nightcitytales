import { useState } from "react";
import { UserRound } from "lucide-react";
import { findNpcNumbered, npcArtwork, npcImage } from "@/features/cast/npcDirectory";

/** Known identities use their own artwork; unknown combatants keep a neutral silhouette. */
export function CombatPortrait({
  name,
  src,
  hostile = false,
}: {
  name: string;
  src?: string | null | undefined;
  hostile?: boolean;
}) {
  const npc = findNpcNumbered(name);
  const source = src === undefined ? (npc ? npcImage(npc) : null) : src;
  // Only the directory's own portraits have a narrow twin; a caller-supplied
  // src is whatever they handed us and gets no srcSet invented for it.
  const set = src === undefined && npc ? npcArtwork(npc).srcSet : undefined;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`combat-portrait ${hostile ? "is-hostile" : ""}`} aria-hidden="true">
      {source && failed !== source ? (
        <img
          src={source}
          {...(set ? { srcSet: set, sizes: "64px" } : {})}
          alt=""
          onError={() => setFailed(source)}
        />
      ) : (
        <>
          <UserRound />
          <span>{name.slice(0, 2).toUpperCase()}</span>
        </>
      )}
    </span>
  );
}
