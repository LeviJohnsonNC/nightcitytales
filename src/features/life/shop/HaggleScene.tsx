/**
 * Talking the price down, as a short scene: how you put it, the dice, and what
 * the person behind the counter says back.
 *
 * The roll is the printed Haggle and nothing here changes it: your Trading
 * against theirs, once a visit, whichever way you pitch it. The pitch and the
 * reply are presentation (`place-shops.json`, house rule) and say so on screen.
 * Presentational: everything is read off `ShopController`.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HAGGLE_APPROACHES, haggleReply, type HaggleApproach } from "@/engine";
import { cn } from "@/lib/utils";
import type { ShopController } from "../useShop";
import { KeeperFace } from "./KeeperFace";

function Die({
  value,
  total,
  who,
  tone,
}: {
  value: number;
  total: number;
  who: string;
  tone: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {who}
      </span>
      <span
        className={cn(
          "num grid size-14 place-items-center border-2 font-display text-2xl font-extrabold motion-safe:animate-[counter-enter_0.5s_ease-out_both]",
          tone,
        )}
      >
        {value}
      </span>
      <span className="num text-sm">
        total <b>{total}</b>
      </span>
    </div>
  );
}

export function HaggleScene({
  shop,
  open,
  onOpenChange,
}: {
  shop: ShopController;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pitch, setPitch] = useState<HaggleApproach | null>(null);
  const name = shop.keeper?.name ?? shop.vendor.label;
  const result = shop.lastHaggle;
  const close = (next: boolean) => {
    if (!next) setPitch(null);
    onOpenChange(next);
  };
  const go = (approach: HaggleApproach) => {
    setPitch(approach);
    shop.haggle();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg gap-0 border-accent/40 bg-surface p-0 sm:rounded-none">
        <div className="flex items-center gap-3 border-b border-hairline p-4 pr-12">
          <KeeperFace keeper={shop.keeper} fallback={shop.vendor.label} className="size-14" />
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl font-extrabold">
              Talk {name} down
            </DialogTitle>
            <DialogDescription className="text-xs text-text-muted">
              Your Trading against theirs, once a visit. Win and everything here is{" "}
              {shop.hagglePercent}% cheaper until you leave.
              {shop.haggleOdds !== null && (
                <>
                  {" "}
                  Your chance: <b className="num text-text">{shop.haggleOdds}%</b>.
                </>
              )}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {!result && !shop.busy && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                How do you put it? (It is the same roll either way.)
              </p>
              <ul className="space-y-2">
                {HAGGLE_APPROACHES.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => go(a)}
                      className="w-full border border-hairline p-3 text-left hover:border-accent/60 hover:bg-accent/5"
                    >
                      <span className="block font-display font-bold">{a.label}</span>
                      <span className="block text-sm italic text-text-muted">{a.line}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {shop.busy && !result && (
            <p className="py-6 text-center text-sm italic text-text-muted">
              {pitch?.line ?? "You make your pitch."}
            </p>
          )}

          {result && (
            <>
              {pitch && <p className="text-sm italic text-text-muted">{pitch.line}</p>}
              <div className="flex items-start gap-4">
                <Die
                  who="You"
                  value={result.yours.die}
                  total={result.yours.total}
                  tone={result.won ? "border-success text-success" : "border-hairline"}
                />
                <span className="self-center font-mono text-xs text-text-muted">vs</span>
                <Die
                  who={name}
                  value={result.theirs.die}
                  total={result.theirs.total}
                  tone={result.won ? "border-hairline" : "border-danger text-danger"}
                />
              </div>
              <p className="border-l-2 border-accent/60 pl-3 text-[15px] leading-relaxed">
                {haggleReply({
                  won: result.won,
                  seed: result.yours.total * 31 + result.theirs.total,
                  name,
                })}
              </p>
              <p
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.14em]",
                  result.won ? "text-success" : "text-text-muted",
                )}
              >
                {result.won
                  ? `${result.percent}% off everything here this visit`
                  : result.tie
                    ? "A tie, and a tie goes to the counter. That was your one try tonight."
                    : "That was your one try tonight."}
              </p>
              <details className="font-mono text-[10px] text-text-muted">
                <summary className="cursor-pointer">The rolls</summary>
                <p className="mt-1">{result.yours.formula}</p>
                <p>{result.theirs.formula}</p>
              </details>
              <Button className="w-full" variant="outline" onClick={() => close(false)}>
                Back to the counter
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
