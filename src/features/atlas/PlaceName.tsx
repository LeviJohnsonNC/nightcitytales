/**
 * A place you can click. Opens the atlas dossier for that district or location.
 * Mirrors NpcName: unknown names render as plain text.
 */
import { useState } from "react";
import { resolvePlaceMention } from "@/engine";
import { PlaceDossier } from "./PlaceDossier";

export function PlaceName({ name, children }: { name: string; children?: React.ReactNode }) {
  const mention = resolvePlaceMention(name);
  const [open, setOpen] = useState(false);
  if (!mention) return <>{children ?? name}</>;
  const targetKey = mention.kind === "place" ? mention.place.key : mention.district.key;
  const label = mention.kind === "place" ? mention.place.name : mention.district.name;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border-b border-dotted border-ember/60 text-ember transition-colors hover:border-ember hover:text-accent"
        aria-label={`Open the atlas entry for ${label}`}
      >
        {children ?? name}
      </button>
      <PlaceDossier targetKey={targetKey} open={open} onOpenChange={setOpen} />
    </>
  );
}
