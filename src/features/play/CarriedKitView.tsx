/**
 * What the character is actually carrying, right now.
 *
 * Presentational only; the reading of the rows lives in carriedKit.ts.
 *
 * Every line that the catalog recognises carries the same "?" the Weapons and
 * Armor panels use, opening the same entry. A player looking at "Medium Pistol
 * · 6/6 loaded" and wondering what it actually does should not have to scroll
 * to the sheet below to find out, and a second kind of info button would be a
 * second thing to learn.
 */
import { catalogItem, type ItemKind } from "@/engine";
import { ItemInfo, type ItemKindLabel } from "@/features/chargen/ItemInfo";
import { carriedKit } from "./carriedKit";
import type { CampaignCyberware, CampaignInventoryItem } from "@/lib/backend";

/** The kinds the item modal knows how to render. */
const DESCRIBABLE: ItemKindLabel[] = ["weapon", "armor", "ammunition", "cyberware", "gear"];

function describable(kind: ItemKind): kind is ItemKindLabel {
  return (DESCRIBABLE as string[]).includes(kind);
}

/**
 * The "?" for one carried line, when the catalog knows what it is.
 *
 * A row can hold an id the catalog has never heard of — a legacy label, a
 * campaign written before a constraint was widened — and `carriedKit` keeps
 * showing those rather than dropping them. They simply get no button.
 */
function KitInfo({ kind, itemId }: { kind: ItemKind; itemId: string }) {
  if (!describable(kind)) return null;
  try {
    const item = catalogItem(kind, itemId);
    return <ItemInfo kind={kind} item={item as never} />;
  } catch {
    return null;
  }
}

export function CarriedKit({
  inventory,
  cyberware = [],
}: {
  inventory: CampaignInventoryItem[];
  cyberware?: CampaignCyberware[];
}) {
  const groups = carriedKit(inventory, cyberware);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Carrying nothing at all.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.kind}>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="mt-1 space-y-0.5">
            {group.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate">
                    {line.quantity > 1 && <span className="num">{line.quantity}× </span>}
                    {line.name}
                  </span>
                  <KitInfo kind={group.kind} itemId={line.itemId} />
                </span>
                {line.detail && (
                  <span className="num shrink-0 font-mono text-[11px] text-muted-foreground">
                    {line.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
