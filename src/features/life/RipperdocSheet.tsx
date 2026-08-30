import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CYBERWARE, formatDuration, getCyberware } from "@/engine";
import type { LifeBundle } from "./useLife";
import { quoteCyberware, useRipperdoc } from "./useRipperdoc";

export function RipperdocSheet({
  bundle,
  narrate,
}: {
  bundle: LifeBundle;
  narrate: (facts: string) => Promise<boolean>;
}) {
  const clinic = useRipperdoc(bundle, narrate);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(CYBERWARE.map((item) => item.category))].sort(), []);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CYBERWARE.filter((item) => !category || item.category === category).filter(
      (item) => !needle || item.name.toLowerCase().includes(needle),
    );
  }, [category, query]);
  const selected = selectedId ? getCyberware(selectedId) : null;
  const quote = selected ? quoteCyberware(bundle, selected.id) : null;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          setSelectedId(null);
          clinic.clearMessage();
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          See your ripperdoc
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>{clinic.ripperdoc?.name ?? "The ripperdoc"}</SheetTitle>
        </SheetHeader>
        {clinic.ripperdoc ? (
          <>
            <p className="text-sm text-muted-foreground">
              Disposition {clinic.ripperdoc.disposition >= 0 ? "+" : ""}
              {clinic.ripperdoc.disposition}. Printed prices include surgery; your history changes
              how long you wait, not what the chrome costs.
            </p>
            <p className="num text-sm font-bold">{bundle.vitals.eurobucks}eb on hand</p>

            <Input
              className="mt-2"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search 96 implants…"
            />
            <div className="flex gap-1 overflow-x-auto py-2">
              <Button
                size="sm"
                variant={category === null ? "default" : "outline"}
                onClick={() => setCategory(null)}
              >
                All
              </Button>
              {categories.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  className="shrink-0 capitalize"
                  variant={category === value ? "default" : "outline"}
                  onClick={() => setCategory(value)}
                >
                  {value.replaceAll("_", " ")}
                </Button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-y border-border">
              <ul>
                {shown.map((item) => {
                  const itemQuote = quoteCyberware(bundle, item.id);
                  return (
                    <li key={item.id} className="border-b border-border/60 last:border-0">
                      <button
                        type="button"
                        className={`w-full px-1 py-2 text-left ${selectedId === item.id ? "bg-accent/10" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          <span className="num shrink-0">{itemQuote.cost}eb</span>
                        </span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {item.install} · {item.slotsUsed} slot{item.slotsUsed === 1 ? "" : "s"} ·
                          HL {item.humanityLossDice ?? "0"}
                          {itemQuote.quantity > 1 ? " · paired ×2" : ""}
                        </span>
                        {!itemQuote.available && (
                          <span className="block text-xs text-destructive">{itemQuote.reason}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selected && quote && (
              <section className="space-y-2 border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.notes}</p>
                  </div>
                  <span className="num shrink-0 font-bold">{quote.cost}eb</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {quote.appointmentDays ?? "—"} day wait · {formatDuration(quote.procedureMinutes)}{" "}
                  surgery · {quote.recoveryDays} recovery day{quote.recoveryDays === 1 ? "" : "s"}
                </p>
                {bundle.phase === "hook" && (
                  <p className="border-l-2 border-destructive px-2 text-sm text-destructive">
                    Going under means passing on the job currently on the table.
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={clinic.busy || !quote.available}
                  onClick={() => clinic.install(selected.id)}
                >
                  {clinic.busy ? "On the table…" : `Install for ${quote.cost}eb`}
                </Button>
              </section>
            )}
            {clinic.message && <p className="text-sm text-muted-foreground">{clinic.message}</p>}
          </>
        ) : (
          <p className="text-sm text-destructive">
            No ripperdoc is in this campaign's standing cast.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
