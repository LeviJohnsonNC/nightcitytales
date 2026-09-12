/**
 * A place you can click. Opens the atlas dossier for that district or location.
 * Mirrors NpcName: unknown names render as plain text.
 */
import { Suspense, lazy, useState } from "react";
import { resolvePlaceMention } from "@/engine";

/**
 * Loaded on first open, not on first render.
 *
 * PlaceDossier pulls in placeDossiers.ts — about 1,950 lines of hand-written
 * atlas prose — and a place name appears inline in almost every line of Life
 * and play narration. Mounted eagerly, that corpus was in the bundle before
 * anybody had clicked anything.
 */
const PlaceDossier = lazy(() =>
  import("./PlaceDossier").then((m) => ({ default: m.PlaceDossier })),
);

export function PlaceName({ name, children }: { name: string; children?: React.ReactNode }) {
  const mention = resolvePlaceMention(name);
  const [open, setOpen] = useState(false);
  // Stays mounted once opened, so closing keeps its animation.
  const [everOpened, setEverOpened] = useState(false);
  if (!mention) return <>{children ?? name}</>;
  const targetKey = mention.kind === "place" ? mention.place.key : mention.district.key;
  const label = mention.kind === "place" ? mention.place.name : mention.district.name;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        className="cursor-pointer border-b border-dotted border-ember/60 text-ember transition-colors hover:border-ember hover:text-accent"
        aria-label={`Open the atlas entry for ${label}`}
      >
        {children ?? name}
      </button>
      {everOpened ? (
        <Suspense fallback={null}>
          <PlaceDossier targetKey={targetKey} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
