/**
 * The bench.
 *
 * A Tech's own screen, and nobody else's: the sheet renders nothing at all for
 * a character without Maker, so the button never appears for a Solo. What it
 * offers is the printed Fabrication table made concrete — what parts cost, what
 * the thing would cost to simply buy, the DV, and the time the bench eats
 * whether or not the build works.
 *
 * Presentational only. Every number on it comes from the engine's plan.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { describeDuration, FABRICABLE_KINDS, type ItemKind } from "@/engine";
import { useWorkshop, type BenchItem } from "./useWorkshop";
import type { LifeBundle } from "./lifeOps";

const KIND_LABELS: Record<string, string> = {
  weapon: "Weapons",
  armor: "Armor",
  ammunition: "Ammo",
  gear: "Gear",
};

/** One buildable line: what it takes, and what it saves. */
function BenchRow({
  item,
  busy,
  onBuild,
}: {
  item: BenchItem;
  busy: boolean;
  onBuild: () => void;
}) {
  const { plan } = item;
  // What the bench is FOR, stated plainly: the gap between parts and price.
  const saved = plan.itemPrice - plan.materialsCost;
  return (
    <li className="flex items-start gap-2 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm ${item.affordable ? "" : "text-muted-foreground"}`}>
            {plan.itemName}
          </span>
          {item.partsOnBench && (
            <span
              className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-accent"
              title="A failed attempt left these parts on the bench — the next try costs only time"
            >
              parts ready
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          DV {plan.dv} · {describeDuration(plan.minutes)} · {plan.materialsCategory} parts
          {saved > 0 ? ` · saves ${saved}eb` : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="num shrink-0"
        disabled={busy || !item.affordable}
        onClick={onBuild}
      >
        {item.partsOnBench ? "retry" : `${plan.materialsCost}eb`}
      </Button>
    </li>
  );
}

export function WorkshopSheet({ bundle }: { bundle: LifeBundle }) {
  const workshop = useWorkshop(bundle);
  const [kind, setKind] = useState<ItemKind>("weapon");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workshop.bench
      .filter((i) => i.plan.kind === kind)
      .filter((i) => !q || i.plan.itemName.toLowerCase().includes(q));
  }, [workshop.bench, kind, query]);

  // The bench belongs to the Tech. Every other Role never sees the button.
  if (!workshop.isTech) return null;

  return (
    <Sheet onOpenChange={(open) => !open && workshop.clearMessage()}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Get to the bench
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Making something</SheetTitle>
        </SheetHeader>

        <p className="num mt-1 text-sm">
          You have <span className="font-bold">{workshop.eurobucks}eb</span>
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Fabrication Expertise {workshop.specialtyRank} · TECH + repair Skill + Rank + 1d10
        </p>
        <p className="mt-2 text-sm italic text-muted-foreground">
          Parts cost a price category less than the finished thing. The bench takes the time whether
          or not it works — and a failure leaves the parts where they are.
        </p>

        {workshop.message && (
          <p
            className={`mt-3 border-l-2 px-3 py-2 text-sm ${
              workshop.message.tone === "built"
                ? "border-accent bg-accent/10 text-foreground"
                : "border-destructive bg-destructive/10 text-destructive"
            }`}
          >
            {workshop.message.text}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FABRICABLE_KINDS.map((k) => (
            <Button
              key={k}
              size="sm"
              variant={k === kind ? "default" : "outline"}
              onClick={() => {
                setKind(k);
                setQuery("");
              }}
            >
              {KIND_LABELS[k] ?? k}
            </Button>
          ))}
        </div>

        <Input
          className="mt-2"
          placeholder="Find something to build"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <ul className="mt-1 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Nothing here matches that.
            </li>
          ) : (
            shown.map((item) => (
              <BenchRow
                key={`${item.plan.kind}:${item.plan.itemId}`}
                item={item}
                busy={workshop.busy}
                onBuild={() => workshop.build(item)}
              />
            ))
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
