/**
 * "Here": the faces in the scene, in one row above the prose.
 *
 * Replaces a collapsed strip under each paragraph and a thumbnail in front of
 * each name. A row the player can see at a glance, that is the same on every
 * turn in the same place and changes when somebody arrives, is what makes a
 * scene feel populated rather than decorated. What is in it is `sceneFaces`'s
 * decision; this only lays it out (and scrolls sideways on a phone rather than
 * wrapping into a wall of portraits).
 */
import { NpcFace } from "@/features/cast/NpcName";
import { WalkOnFace } from "@/features/cast/WalkOnStrip";
import { RING } from "./hud/hudModel";
import type { SceneFace } from "./sceneFaces";

export function SceneFaces({ faces }: { faces: readonly SceneFace[] }) {
  if (faces.length === 0) return null;
  return (
    <section aria-label="Who is here" className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Here</p>
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {faces.map((face) => (
          <li key={face.key} className="shrink-0">
            {face.kind === "person" ? (
              <NpcFace npc={face.npc} ringClass={face.tone ? RING[face.tone] : undefined} />
            ) : (
              <WalkOnFace subject={face.subject} gender={face.gender} name={face.name} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
