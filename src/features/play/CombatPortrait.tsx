import { useState } from "react";
import { UserRound } from "lucide-react";
import { findNpc, npcImage } from "@/features/cast/npcDirectory";

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
  const npc = findNpc(name);
  const source = src === undefined ? (npc ? npcImage(npc) : null) : src;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`combat-portrait ${hostile ? "is-hostile" : ""}`} aria-hidden="true">
      {source && failed !== source ? (
        <img src={source} alt="" onError={() => setFailed(source)} />
      ) : (
        <>
          <UserRound />
          <span>{name.slice(0, 2).toUpperCase()}</span>
        </>
      )}
    </span>
  );
}
