import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { priceCategoryContext } from "@/engine";
import { ArtSlot } from "./ArtSlot";
import { itemArt } from "./art";
import { ITEM_FLAVOR } from "./itemFlavor";
import { eb } from "./market";

export type ItemKindLabel = "weapon" | "armor" | "ammunition" | "cyberware" | "gear";

/** Loose shape covering every catalog row this modal renders. */
type AnyItem = {
  id: string;
  name: string;
  damage?: string;
  magazine?: number | null;
  rof?: number | string;
  handsRequired?: string;
  skill?: string;
  concealable?: boolean;
  sp?: number | null;
  hp?: number | null;
  penalty?: { value: number; stats: string[] } | null;
  locations?: string[];
  types?: string[];
  unit?: string;
  humanityLoss?: number;
  slotsUsed?: number;
  install?: string;
  cost?: number;
  priceCategory?: string;
  variants?: string[];
  notes?: string | null;
  description?: string | null;
};

function statLine(kind: ItemKindLabel, item: AnyItem): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label, value: String(value) });
  };

  if (kind === "weapon") {
    push("Damage", item.damage);
    push("Magazine", item.magazine ?? "None");
    push("ROF", item.rof);
    push("Hands", item.handsRequired);
    push("Skill", item.skill);
    push("Conceal", item.concealable === undefined ? undefined : item.concealable ? "Yes" : "No");
  } else if (kind === "armor") {
    push("SP", item.sp ?? "None");
    push("HP", item.hp ?? undefined);
    push(
      "Penalty",
      item.penalty ? `${item.penalty.value} ${item.penalty.stats.join("/")}` : "None",
    );
    push("Locations", item.locations?.join(" / "));
  } else if (kind === "ammunition") {
    push("Available", item.types?.join(", "));
    push("Sold", item.unit);
  } else if (kind === "gear") {
    // Price category lives in the header tooltip, not the stat row.
  } else if (kind === "cyberware") {
    push("Humanity Loss", item.humanityLoss);
    push("Slots", item.slotsUsed);
    push("Install", item.install);
  }
  push("Cost", item.cost === undefined ? undefined : eb(item.cost));
  return rows;
}

/** A small "?" button that opens a modal explaining a catalog item. */
export function ItemInfo({
  kind,
  item,
}: {
  kind: ItemKindLabel;
  item: { id: string; name: string } & Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const it = item as AnyItem;
  const flavor = ITEM_FLAVOR[it.id];
  const mechanical = it.notes ?? it.description ?? null;
  const stats = statLine(kind, it);
  const priceContext = priceCategoryContext(it.priceCategory);
  const art = itemArt(`${kind}.${it.id}`, it.name);
  // Armor art can come as a Body/Head pair; show both when a head image exists.
  const headArt = kind === "armor" ? itemArt(`${kind}.${it.id}.head`, `${it.name} head`) : null;
  const hasHead = Boolean(headArt?.src);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What is ${item.name}?`}
        title={`What is ${item.name}?`}
        className="grid size-5 shrink-0 place-items-center rounded-full border border-hairline font-mono text-[11px] leading-none text-text-dim transition-colors hover:border-ember hover:text-ember"
      >
        ?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">{item.name}</DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {kind}
              {it.priceCategory ? (
                <>
                  {" · "}
                  {priceContext ? (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted underline-offset-4">
                            {it.priceCategory}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs normal-case tracking-normal">
                          {priceContext.fixerRank
                            ? `A Fixer at Operator Rank ${priceContext.fixerRank} can always source this. `
                            : ""}
                          {`A Tech builds or upgrades one at DV${priceContext.techDV}, ${priceContext.techTime} of work.`}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    it.priceCategory
                  )}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {/* Art scales to fit, never cropped, no frame. Armor with a Body/Head
              pair shows both side by side. */}
          {hasHead ? (
            <div className="grid grid-cols-2 gap-3">
              <figure className="min-h-32 w-full">
                <ArtSlot
                  art={art}
                  label={`${item.name} body`}
                  className="max-h-64 w-full border-0 object-contain"
                />
                <figcaption className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
                  Body
                </figcaption>
              </figure>
              <figure className="min-h-32 w-full">
                <ArtSlot
                  art={headArt!}
                  label={`${item.name} head`}
                  className="max-h-64 w-full border-0 object-contain"
                />
                <figcaption className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
                  Head
                </figcaption>
              </figure>
            </div>
          ) : (
            <div className="min-h-32 w-full">
              <ArtSlot
                art={art}
                label={item.name}
                className="max-h-64 w-full border-0 object-contain"
              />
            </div>
          )}

          {stats.length > 0 && (
            <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
                    {s.label}
                  </dt>
                  <dd className="font-mono text-sm tabular-nums text-text">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {it.variants && it.variants.length > 0 && (
            <p className="text-xs text-text-dim">
              <span className="font-mono uppercase tracking-[0.15em]">Examples: </span>
              {it.variants.join(", ")}
            </p>
          )}

          {flavor && <p className="mt-1 text-[0.95rem] leading-relaxed text-text">{flavor}</p>}

          {mechanical && (
            <div className="mt-2 border-t border-hairline pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
                How it works
              </p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{mechanical}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
