/**
 * What the character is actually carrying, right now.
 *
 * Presentational only; the reading of the rows lives in carriedKit.ts.
 */
import { carriedKit } from "./carriedKit";
import type { CampaignInventoryItem } from "@/lib/backend";

export function CarriedKit({ inventory }: { inventory: CampaignInventoryItem[] }) {
  const groups = carriedKit(inventory);

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
              <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {line.quantity > 1 && <span className="num">{line.quantity}× </span>}
                  {line.name}
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
