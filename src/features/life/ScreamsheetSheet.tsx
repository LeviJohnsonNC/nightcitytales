/**
 * The Screamsheet: what the city printed about what you did.
 *
 * The words are `engine/screamsheet.ts`'s — derived from the ledger and never
 * stored, a flag a place gained or what a job left behind — and this is only the
 * page. A dock tile carries the count of headlines the reader has not read; the
 * sheet opens on them, newest morning first. When the city has said nothing, the
 * sheet says so, and does not fill the space.
 */
import { useState } from "react";
import { Newspaper } from "lucide-react";
import { groupByDay, newestSeq, unseenCount } from "@/engine";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { readSheetSeen, writeSheetSeen } from "@/features/status/sheetSeen";
import { ScreamsheetItem } from "@/features/status/ScreamsheetItem";
import { weekdayFor } from "@/engine";
import type { LifeBundle } from "./lifeOps";
import { DockTile } from "./hud/DockTile";

/** More than this and the count is a wall, not news. */
const MAX_BADGE = 9;

function dayLabel(day: number | null): string {
  return day === null ? "Earlier" : `Day ${day} · ${weekdayFor(day)}`;
}

export function ScreamsheetSheet({ bundle }: { bundle: LifeBundle }) {
  const campaignId = bundle.campaign.id;
  const items = bundle.sheet;
  const [open, setOpen] = useState(false);
  // Where the reader had got to when the sheet was opened, kept for the whole
  // visit so the headlines that were new still say so while they are looked at.
  // A reader who has never opened the sheet has nothing to compare against, so
  // nothing is marked: forty headlines that are all "new" are not news.
  const [baseline, setBaseline] = useState<number | null>(null);
  const [seen, setSeen] = useState<number | null>(() => readSheetSeen(campaignId));

  const unseen = unseenCount(items, seen);
  const groups = groupByDay(items);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setBaseline(seen);
    } else {
      const newest = newestSeq(items);
      if (newest !== null) {
        writeSheetSeen(campaignId, newest);
        setSeen(newest);
      }
    }
    setOpen(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <DockTile
          icon={<Newspaper className="size-6" />}
          label="The Sheet"
          badge={unseen > 0 ? `${unseen > MAX_BADGE ? `${MAX_BADGE}+` : unseen} new` : null}
        />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader className="space-y-1 border-b border-border pb-3">
          <SheetTitle className="font-display text-3xl font-extrabold uppercase tracking-[0.06em]">
            The Screamsheet
          </SheetTitle>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
            Night City · Nobody reads it. Everybody knows what it says.
          </p>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="mt-6 space-y-2 border-l-2 border-hairline pl-3" data-testid="sheet-empty">
            <p className="text-sm">Nothing in the Sheet is about you yet.</p>
            <p className="text-xs text-muted-foreground">
              The city reads what you do. When it has something to say about it, it says it here.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {groups.map((group) => (
              <section key={group.day ?? "earlier"} className="space-y-3">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  {dayLabel(group.day)}
                </h2>
                <div className="space-y-4">
                  {group.items.map((item) => (
                    <ScreamsheetItem
                      key={item.key}
                      item={item}
                      isNew={baseline !== null && item.seq > baseline}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
