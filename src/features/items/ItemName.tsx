/**
 * A piece of kit you can click. Opens the same catalog entry the market uses.
 * Mirrors NpcName/PlaceName: unknown names render as plain text.
 */
import { useState } from "react";
import { ItemDialog } from "@/features/chargen/ItemInfo";
import { resolveItemMention } from "./itemDirectory";

export function ItemName({ name, children }: { name: string; children?: React.ReactNode }) {
  const found = resolveItemMention(name);
  const [open, setOpen] = useState(false);
  if (!found) return <>{children ?? name}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border-b border-dotted border-accent/60 text-accent transition-colors hover:border-accent hover:text-ember"
        aria-label={`Open the catalog entry for ${found.item.name}`}
      >
        {children ?? name}
      </button>
      <ItemDialog kind={found.kind} item={found.item} open={open} onOpenChange={setOpen} />
    </>
  );
}
