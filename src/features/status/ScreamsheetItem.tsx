/**
 * One headline, as the Screamsheet sets it: a kicker, the headline, the line
 * under it, and the place it is about, which opens its atlas entry.
 *
 * Presentation only. The words are `engine/screamsheet.ts`'s; nothing here adds
 * to them. Shared by the Life sheet and by Aftermath's clipping so a headline
 * looks the same wherever the player meets it.
 */
import type { SheetItem, SheetTone } from "@/engine";
import { PlaceName } from "@/features/atlas/PlaceName";

const BAR: Record<SheetTone, string> = {
  bad: "border-destructive/80",
  good: "border-neon-cyan/80",
  neutral: "border-text-dim",
};

const KICKER: Record<SheetTone, string> = {
  bad: "text-destructive",
  good: "text-neon-cyan",
  neutral: "text-text-dim",
};

export function ScreamsheetItem({
  item,
  isNew = false,
  clipping = false,
}: {
  item: SheetItem;
  /** True for a headline the reader has not seen yet. */
  isNew?: boolean;
  /** The Aftermath treatment: a cutting, not a column. */
  clipping?: boolean;
}) {
  return (
    <article
      className={`space-y-1 border-l-2 py-1.5 pl-3 ${BAR[item.tone]} ${
        clipping ? "border-y border-r border-dashed border-border/70 bg-white/[0.03] pr-3" : ""
      }`}
      data-testid="sheet-item"
      data-kind={item.kind}
    >
      <p
        className={`flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] ${KICKER[item.tone]}`}
      >
        <span>{item.kicker}</span>
        {isNew && (
          <span className="bg-ember px-1.5 py-px text-[9px] tracking-[0.12em] text-background">
            New
          </span>
        )}
      </p>
      <h3 className="font-display text-lg font-extrabold leading-tight tracking-tight">
        {item.headline}
      </h3>
      {item.deck && <p className="text-sm leading-snug text-muted-foreground">{item.deck}</p>}
      {item.placeName && (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
          <PlaceName name={item.placeName} />
        </p>
      )}
    </article>
  );
}
